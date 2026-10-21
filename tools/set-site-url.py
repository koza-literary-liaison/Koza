#!/usr/bin/env python3
"""
Set the live address of the site, everywhere it appears.

The site stores its own public URL in five places that must agree:
  · assets/js/site-config.js        (siteUrl — used by JS)
  · every page's <link rel=canonical>
  · every page's <meta property=og:url> and <meta property=og:image>
  · sitemap.xml                     (all <loc> entries)
  · robots.txt                      (Sitemap: line)

Running this once keeps them in sync. It is idempotent: run it again with a
different URL and it rewrites cleanly rather than stacking duplicates.

Usage
-----
  python3 tools/set-site-url.py https://yourname.github.io
  python3 tools/set-site-url.py https://yourname.github.io/my-repo
  python3 tools/set-site-url.py https://kozaliteraryliaison.com

Then re-run the validator:
  python3 tools/validate.py
"""

import re
import sys
import os
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

if len(sys.argv) != 2:
    print(__doc__)
    sys.exit(1)

new = sys.argv[1].strip().rstrip("/")

# ---- validate the input before touching any file -----------------------
parsed = urlparse(new)
if parsed.scheme not in ("http", "https"):
    sys.exit(f"error: URL must start with https:// — got {new!r}")
if parsed.scheme == "http":
    print("warning: http will serve an insecure site; GitHub Pages gives you https free.")
if not parsed.netloc:
    sys.exit(f"error: no host in {new!r}")
if parsed.query or parsed.fragment:
    sys.exit("error: URL must not contain ? or #")

# ---- find the address currently in use ---------------------------------
cfg_path = "assets/js/site-config.js"
with open(cfg_path, encoding="utf-8") as fh:
    cfg = fh.read()

current = re.search(r"siteUrl\s*:\s*['\"]([^'\"]*)['\"]", cfg)
if not current:
    sys.exit("error: could not find siteUrl in assets/js/site-config.js")
old = current.group(1).rstrip("/")

if old == new:
    print(f"already set to {new} — nothing to do.")
    sys.exit(0)

print(f"  old address : {old}")
print(f"  new address : {new}")
print()

changed = []

# ---- 1. site-config.js -------------------------------------------------
cfg = re.sub(r"(siteUrl\s*:\s*['\"])[^'\"]*(['\"])", lambda m: m.group(1) + new + m.group(2), cfg)
with open(cfg_path, "w", encoding="utf-8") as fh:
    fh.write(cfg)
changed.append(cfg_path)

# ---- 2. every html page ------------------------------------------------
esc_old = old.replace("&", "&amp;")
for name in sorted(f for f in os.listdir(".") if f.endswith(".html")):
    with open(name, encoding="utf-8") as fh:
        body = fh.read()
    before = body
    # replace only inside absolute URLs that begin with the old address,
    # so unrelated text is never touched
    body = re.sub(r"(?<![\w./-])" + re.escape(esc_old) + r"(?=[/\"'<])", new, body)
    body = re.sub(r"(?<![\w./-])" + re.escape(old) + r"(?=[/\"'<])", new, body)
    if body != before:
        with open(name, "w", encoding="utf-8") as fh:
            fh.write(body)
        changed.append(name)

# ---- 3. sitemap --------------------------------------------------------
if os.path.exists("sitemap.xml"):
    with open("sitemap.xml", encoding="utf-8") as fh:
        sm = fh.read()
    sm = sm.replace(old, new)
    with open("sitemap.xml", "w", encoding="utf-8") as fh:
        fh.write(sm)
    changed.append("sitemap.xml")

# ---- 4. robots ---------------------------------------------------------
if os.path.exists("robots.txt"):
    with open("robots.txt", encoding="utf-8") as fh:
        rb = fh.read()
    rb = rb.replace(old, new)
    with open("robots.txt", "w", encoding="utf-8") as fh:
        fh.write(rb)
    changed.append("robots.txt")

print("updated:")
for f in changed:
    print(f"  · {f}")
print()
print("Now check nothing was missed:  python3 tools/validate.py")
