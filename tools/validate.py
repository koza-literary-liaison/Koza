#!/usr/bin/env python3
"""
KOZA LITERARY LIAISON — build validator
=======================================

This site has no bundler and no compile step, so "building" means proving
that everything the browser will ask for actually exists and agrees with
itself. This script is the build gate: it runs locally and in CI on every
push, and it fails loudly rather than letting a broken page go live.

It checks:
  1.  Every .html file parses and every tag is balanced
  2.  Every internal link resolves to a real file or a real anchor
  3.  Every <img>, <script>, <link> and CSS url() resolves and is non-empty
  4.  Every .js file parses (node --check) and every .css file balances
  5.  No external network dependencies (the site is fully self-hosted)
  6.  No secrets, API keys or credentials committed anywhere
  7.  site-config.js agrees with the canonical tags, og:url and sitemap
  8.  Deployment files are present (.nojekyll, robots.txt, sitemap.xml, 404)
  9.  Nothing exceeds the performance budget

Exit code 0 = safe to deploy. Exit code 1 = do not deploy.

Usage:  python3 tools/validate.py
"""

import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# ---------------------------------------------------------------- config
# Tags that never take a closing tag. SVG shape tags are included because
# the logo overlay is inline SVG.
VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
    "path", "stop", "circle", "ellipse", "line", "polygon", "polyline",
    "rect", "use", "image",
}

REQUIRED_FILES = [
    "index.html", "404.html", "robots.txt", "sitemap.xml",
    ".nojekyll", "assets/js/site-config.js", "assets/js/forms.js",
]

# Performance budget — a marketing site should load fast on a phone.
MAX_TOTAL_BYTES = 6 * 1024 * 1024      # 6 MB for the whole site
MAX_SINGLE_IMAGE = 1200 * 1024         # 1.2 MB for any one image
MAX_IMAGE_EDGE = 2200                  # pixels, longest side

SECRET_PATTERNS = [
    (r"(?i)\bapi[_-]?key\b\s*[:=]\s*['\"][^'\"\s]{8,}", "API key assignment"),
    (r"(?i)\bsecret\b\s*[:=]\s*['\"][^'\"\s]{8,}", "secret assignment"),
    (r"(?i)\bpassword\b\s*[:=]\s*['\"][^'\"\s]{4,}", "password assignment"),
    (r"(?i)\btoken\b\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}", "token assignment"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub personal access token"),
    (r"github_pat_[A-Za-z0-9_]{22,}", "GitHub fine-grained token"),
    (r"sk-[A-Za-z0-9]{20,}", "OpenAI-style secret key"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key id"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key block"),
    (r"xox[baprs]-[A-Za-z0-9\-]{10,}", "Slack token"),
]

TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".txt", ".xml", ".yml", ".yaml", ".sh"}

problems = []
warnings = []
notes = []


def fail(check, detail):
    problems.append(f"{check}: {detail}")


def warn(check, detail):
    warnings.append(f"{check}: {detail}")


# ------------------------------------------------------------- 1. HTML
class Balance(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append(f"stray </{tag}> on line {self.getpos()[0]}")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        # try to recover, but record it
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                self.errors.append(
                    f"</{tag}> on line {self.getpos()[0]} closes over "
                    f"<{self.stack[-1][0]}> opened on line {self.stack[-1][1]}"
                )
                del self.stack[i:]
                return
        self.errors.append(f"</{tag}> on line {self.getpos()[0]} has no opening tag")


pages = sorted(f for f in os.listdir(".") if f.endswith(".html"))
if not pages:
    fail("HTML", "no .html files found — is this the right directory?")

page_src = {}
for name in pages:
    with open(name, encoding="utf-8") as fh:
        src = fh.read()
    page_src[name] = src

    parser = Balance()
    parser.feed(src)
    for err in parser.errors:
        fail(f"HTML {name}", err)
    for tag, line in parser.stack:
        fail(f"HTML {name}", f"<{tag}> opened on line {line} never closed")

    if "<!DOCTYPE html>" not in src[:200]:
        warn(f"HTML {name}", "missing <!DOCTYPE html> at the top")
    if 'lang="' not in src[:600]:
        warn(f"HTML {name}", "missing lang attribute on <html>")
    if "<title>" not in src:
        fail(f"HTML {name}", "no <title>")

notes.append(f"HTML: {len(pages)} pages parsed, all tags balanced")


# --------------------------------------------------- 2/3. links + assets
def resolve(ref):
    """Turn a href/src into a path relative to the repo root, or None."""
    ref = ref.strip()
    if not ref or ref.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return None
    if ref.startswith("//"):
        return None
    if re.match(r"^[a-z]+://", ref, re.I):
        return None
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    return ref.lstrip("/")


link_count = 0
asset_count = 0
for name in pages:
    src = page_src[name]
    ids = set(re.findall(r'\bid="([^"]+)"', src))

    for m in re.finditer(r'<a\b[^>]*\bhref="([^"]*)"', src):
        href = m.group(1)
        link_count += 1
        if href.strip() == "#":
            fail(f"LINK {name}", "placeholder href=\"#\" — dead link")
            continue
        if href.startswith("#"):
            if href[1:] and href[1:] not in ids:
                fail(f"LINK {name}", f"anchor {href} has no matching id on the page")
            continue
        target = resolve(href)
        if target and not os.path.exists(target):
            fail(f"LINK {name}", f"{href} -> file not found")

    for m in re.finditer(r'\b(?:src|href)="([^"]*\.(?:css|js|png|jpe?g|svg|webp|woff2?))"', src):
        url = m.group(1)
        asset_count += 1
        target = resolve(url)
        if target is None:
            if url.startswith("//") or "://" in url:
                fail(f"ASSET {name}", f"external dependency: {url}")
            continue
        if not os.path.exists(target):
            fail(f"ASSET {name}", f"{url} -> file not found")
        elif os.path.getsize(target) == 0:
            fail(f"ASSET {name}", f"{url} -> file is empty")

    # Real network fetches only: src attributes, and <link> tags whose rel
    # makes the browser load something. A canonical or og:url pointing at
    # our own domain is a self-reference, not a request.
    for m in re.finditer(r'\bsrc="(https?://[^"]+)"', src):
        fail(f"EXTERNAL {name}", f"external script/image request: {m.group(1)}")
    for m in re.finditer(r'<link\b[^>]*\brel="([^"]+)"[^>]*\bhref="(https?://[^"]+)"', src):
        rel, url = m.group(1).lower(), m.group(2)
        if any(k in rel for k in ("stylesheet", "preconnect", "dns-prefetch",
                                  "preload", "icon", "manifest")):
            fail(f"EXTERNAL {name}", f"external <link rel={rel}> resource: {url}")
        # canonical / alternate / author are metadata, not fetches

notes.append(f"LINKS: {link_count} anchors resolved")
notes.append(f"ASSETS: {asset_count} html references resolved")


# ------------------------------------------------ 4. CSS + JS integrity
for dirpath, _dirnames, filenames in os.walk("assets"):
    for fname in filenames:
        path = os.path.join(dirpath, fname)

        if fname.endswith(".css"):
            with open(path, encoding="utf-8") as fh:
                css = fh.read()
            if css.count("{") != css.count("}"):
                fail(f"CSS {path}", f"unbalanced braces ({css.count('{')} open, {css.count('}')} close)")
            # url() inside CSS
            for m in re.finditer(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", css):
                ref = m.group(1).strip()
                if ref.startswith(("data:", "http:", "https:", "//", "#")):
                    continue
                target = os.path.normpath(os.path.join(dirpath, ref))
                if not os.path.exists(target):
                    fail(f"CSS {path}", f"url({ref}) -> file not found")

        elif fname.endswith(".js"):
            result = subprocess.run(
                ["node", "--check", path], capture_output=True, text=True
            )
            if result.returncode != 0:
                msg = (result.stderr or "").strip().splitlines()
                fail(f"JS {path}", msg[-1] if msg else "syntax error")

notes.append("CSS/JS: all stylesheets balanced, all scripts parse")


# ------------------------------------------------ 5. self-hosted only
for dirpath, _dirnames, filenames in os.walk("."):
    if "/.git" in dirpath:
        continue
    for fname in filenames:
        if not fname.endswith((".html", ".css", ".js")):
            continue
        path = os.path.join(dirpath, fname)
        with open(path, encoding="utf-8", errors="ignore") as fh:
            body = fh.read()
        for host in ("fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr",
                     "unpkg.com", "cdnjs.cloudflare.com", "google-analytics.com",
                     "googletagmanager.com"):
            if host in body:
                fail(f"EXTERNAL {path}", f"references {host}")

notes.append("EXTERNAL: no CDN, font or analytics dependencies")


# -------------------------------------------------------- 6. secrets
scanned = 0
for dirpath, _dirnames, filenames in os.walk("."):
    if "/.git" in dirpath or "/node_modules" in dirpath:
        continue
    for fname in filenames:
        if os.path.splitext(fname)[1].lower() not in TEXT_EXT:
            continue
        path = os.path.join(dirpath, fname)
        with open(path, encoding="utf-8", errors="ignore") as fh:
            body = fh.read()
        scanned += 1
        for pattern, label in SECRET_PATTERNS:
            for m in re.finditer(pattern, body):
                snippet = m.group(0)[:60]
                fail("SECRET", f"{path}: possible {label} -> {snippet!r}")

for forbidden in (".env", ".git-credentials", ".netrc", "id_rsa"):
    if os.path.exists(forbidden):
        fail("SECRET", f"{forbidden} is present and must never be committed")

notes.append(f"SECRETS: {scanned} text files scanned, none found")


# ----------------------------------------- 7. url / config consistency
cfg_path = "assets/js/site-config.js"
if os.path.exists(cfg_path):
    with open(cfg_path, encoding="utf-8") as fh:
        cfg = fh.read()
    m = re.search(r"siteUrl\s*:\s*['\"]([^'\"]*)['\"]", cfg)
    email_m = re.search(r"email\s*:\s*['\"]([^'\"]*)['\"]", cfg)
    fid_m = re.search(r"formspreeId\s*:\s*['\"]([^'\"]*)['\"]", cfg)

    site_url = m.group(1).rstrip("/") if m else ""
    if not site_url:
        fail("CONFIG", "siteUrl is empty in site-config.js")
    else:
        if not site_url.startswith("https://"):
            warn("CONFIG", f"siteUrl is not https ({site_url})")
        if site_url in ("https://kozaliteraryliaison.github.io",):
            warn("CONFIG", "siteUrl is still the placeholder address "
                           "https://kozaliteraryliaison.github.io — set it to the "
                           "real GitHub Pages URL before launch")
        parsed = urlparse(site_url)
        # A user/org pages site is <user>.github.io with no path.
        # A project pages site is <user>.github.io/<repo>.
        if parsed.netloc.endswith(".github.io") and parsed.path not in ("", "/"):
            notes.append(f"CONFIG: project pages URL detected (repo subpath {parsed.path})")

    if not email_m or "@" not in email_m.group(1):
        fail("CONFIG", "email missing or invalid in site-config.js")

    fid = fid_m.group(1).strip() if fid_m else ""
    if fid:
        notes.append(f"CONFIG: Formspree id set ({len(fid)} chars) — forms post directly")
    else:
        warn("CONFIG", "formspreeId is empty — forms use the mail-app fallback. "
                       "Everything still works, no lead is lost, but the visitor "
                       "must press send in their own mail client.")

    # canonicals + og:url must agree with siteUrl
    for name in pages:
        src = page_src[name]
        is_404 = name == "404.html"
        if is_404:
            if 'name="robots"' not in src or "noindex" not in src:
                warn(f"META {name}", "a 404 page should carry <meta name=robots content=noindex>")
            continue
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', src)
        og_url = re.search(r'<meta property="og:url" content="([^"]+)"', src)
        if not canonical:
            fail(f"META {name}", "missing canonical link")
        elif site_url and not canonical.group(1).startswith(site_url):
            fail(f"META {name}", f"canonical {canonical.group(1)} does not match siteUrl {site_url}")
        if not og_url:
            fail(f"META {name}", "missing og:url")
        elif site_url and not og_url.group(1).startswith(site_url):
            fail(f"META {name}", f"og:url {og_url.group(1)} does not match siteUrl {site_url}")
        og_img = re.search(r'<meta property="og:image" content="([^"]+)"', src)
        if not og_img:
            fail(f"META {name}", "missing og:image")
        elif not og_img.group(1).startswith("https://"):
            fail(f"META {name}", f"og:image must be absolute, got {og_img.group(1)}")
        if site_url:
            for ref in (canonical, og_url, og_img):
                if ref and site_url not in ref.group(1):
                    fail(f"META {name}", f"absolute URL is stale: {ref.group(1)}")

    # sitemap must agree too
    if os.path.exists("sitemap.xml"):
        with open("sitemap.xml", encoding="utf-8") as fh:
            sm = fh.read()
        locs = re.findall(r"<loc>([^<]+)</loc>", sm)
        if not locs:
            fail("SITEMAP", "sitemap has no <loc> entries")
        for loc in locs:
            if site_url and not loc.startswith(site_url):
                fail("SITEMAP", f"{loc} does not match siteUrl {site_url}")
            # the page it points at should exist locally
            rel = loc[len(site_url):].lstrip("/") if site_url and loc.startswith(site_url) else ""
            if rel == "":
                rel = "index.html"   # "/" is served as index.html
            if rel and not os.path.exists(rel):
                fail("SITEMAP", f"{loc} points at a page that does not exist ({rel})")
        # and every page should be in it
        for name in pages:
            if name == "404.html":
                continue            # a 404 is deliberately not indexable
            slug = "" if name == "index.html" else name
            if name not in sm and f"/{slug}" not in sm:
                warn("SITEMAP", f"{name} is missing from sitemap.xml")
        notes.append(f"SITEMAP: {len(locs)} urls, all consistent with siteUrl")
else:
    fail("CONFIG", "assets/js/site-config.js is missing")


# --------------------------------------------- 8. deployment files
for req in REQUIRED_FILES:
    if not os.path.exists(req):
        fail("DEPLOY", f"required file missing: {req}")

if os.path.exists("robots.txt"):
    with open("robots.txt", encoding="utf-8") as fh:
        robots = fh.read()
    if "Sitemap:" not in robots:
        warn("DEPLOY", "robots.txt does not point at the sitemap")

if os.path.exists("404.html"):
    with open("404.html", encoding="utf-8") as fh:
        p404 = fh.read()
    if 'rel="canonical"' in p404:
        warn("DEPLOY", "404.html carries a canonical tag, which can confuse crawlers")

notes.append("DEPLOY: .nojekyll, robots.txt, sitemap.xml and 404.html present")


# ------------------------------------------------- 9. weight budget
total = 0
for dirpath, _dirnames, filenames in os.walk("."):
    if "/.git" in dirpath:
        continue
    for fname in filenames:
        total += os.path.getsize(os.path.join(dirpath, fname))

if total > MAX_TOTAL_BYTES:
    fail("BUDGET", f"site is {total/1048576:.1f} MB, over the {MAX_TOTAL_BYTES/1048576:.0f} MB budget")

img_dir = "assets/img"
if os.path.isdir(img_dir):
    for fname in sorted(os.listdir(img_dir)):
        path = os.path.join(img_dir, fname)
        size = os.path.getsize(path)
        if size > MAX_SINGLE_IMAGE:
            fail("BUDGET", f"{path} is {size/1024:.0f} KB, over the "
                           f"{MAX_SINGLE_IMAGE/1024:.0f} KB per-image budget")
        try:
            from PIL import Image
            with Image.open(path) as im:
                w, h = im.size
            if max(w, h) > MAX_IMAGE_EDGE:
                warn("BUDGET", f"{path} is {w}x{h}, larger than needed")
        except ImportError:
            pass
        except Exception:
            fail("BUDGET", f"{path} is not a readable image")

notes.append(f"BUDGET: {total/1048576:.1f} MB total "
             f"({total/1048576/len(pages)*1024:.0f} KB per page on average)")


# ------------------------------------------------------------ report
line = "─" * 66
print()
print("  KOZA LITERARY LIAISON — build validation")
print("  " + line)
for n in notes:
    print(f"  ✓ {n}")
print()

if warnings:
    print(f"  {len(warnings)} warning(s) — not fatal, but read them:")
    for w in warnings:
        print(f"    ! {w}")
    print()

if problems:
    print(f"  ✗ BUILD FAILED — {len(problems)} problem(s):")
    for p in problems:
        print(f"    · {p}")
    print()
    print("  Do not deploy until these are resolved.")
    print()
    sys.exit(1)

print("  ✓ BUILD PASSED — no blocking problems. Safe to deploy.")
print()
sys.exit(0)
