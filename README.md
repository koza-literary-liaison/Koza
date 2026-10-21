# KOZA LITERARY LIAISON

The website for **Koza Literary Liaison**, a book marketing agency.
Plain HTML, CSS and JavaScript — no framework, no build step, no dependencies
to install. It is designed to be hosted on GitHub Pages and it makes **zero
external network requests**: fonts, images, styles and scripts are all served
from this repository.

---

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home — hero, story, counters, services, why us, portfolio, values, partners, testimonial carousel, proposal form |
| `our-story.html` | Story, founder, mission, the 15 core values |
| `our-work.html` | Campaign portfolio |
| `lets-talk.html` | Contact details, proposal request form, FAQ |
| `register.html` | Author registration — two steps, no payment, no account, no password |
| `privacy.html` | Privacy policy |
| `terms.html` | Terms of service |
| `404.html` | Not-found page (marked `noindex`) |

## Before going live

Two values live in **`assets/js/site-config.js`**, the only file that needs
editing:

```js
window.KOZA = {
  siteUrl:     'https://USERNAME.github.io',   // the real live address
  email:       'kozaliteraryliaison@gmail.com',
  formspreeId: ''                              // paste your Formspree id here
};
```

**`formspreeId`** — while it is empty, forms fall back to opening the visitor's
mail app with every field pre-filled and addressed to the agency. Nothing is
lost, but the visitor has to press send. Create a free form at
[formspree.io](https://formspree.io) and paste the id (the part after
`/f/`) to make delivery fully automatic.

**`siteUrl`** — run the helper rather than editing by hand, because the same
address is repeated in every page's canonical tag, the Open Graph tags, the
sitemap and robots.txt:

```bash
python3 tools/set-site-url.py https://yourname.github.io
```

## Validate the build

There is nothing to compile, so validation means proving every link, asset,
script and config value agrees with every other. Run:

```bash
python3 tools/validate.py
```

It checks tag balance on all 8 pages, resolves 290 internal links and 112 asset
references, syntax-checks every script with `node --check`, balances every
stylesheet, scans for committed secrets, confirms `site-config.js`, the
canonical tags, `og:url` and `sitemap.xml` all match, and enforces a weight
budget. Exit code 0 means safe to deploy; 1 means stop.

This runs automatically on every push and pull request via
`.github/workflows/validate.yml`.

## Deploy

```bash
./tools/deploy.sh https://github.com/USERNAME/REPO.git
```

It validates first, refuses to run if a credential file is present, detects
whether the repository is new or already has history, and on an existing
repository works on a clone so **your unrelated files and commit history are
preserved**. Re-running it is safe — it commits only when something changed.

Then, once, in the repository: **Settings → Pages → Deploy from a branch →
`main` → `/ (root)` → Save**.

A detailed walkthrough, including how to add a custom domain later, is in
[`PUBLISH.md`](PUBLISH.md).

## Local preview

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>. Opening `index.html` directly from the file
system also works, but a local server matches production behaviour.

## Structure

```
assets/css/style.css       design system
assets/css/logo.css        animated motion logo
assets/css/register.css    registration flow
assets/css/fonts.css       self-hosted font faces
assets/js/site-config.js   >>> the only file you edit to go live <<<
assets/js/forms.js         form delivery + mail fallback + honeypot
assets/js/main.js          nav, reveals, counters, carousel, contact form
assets/js/register.js      the registration wizard
assets/fonts/              12 self-hosted woff2 files
assets/img/                logo, art, project images, headshots
tools/validate.py          the build gate
tools/deploy.sh            the deploy script
tools/set-site-url.py      keeps the public URL in sync everywhere
```

## Notes

- No cookies, no analytics, no third-party scripts, no tracking.
- Every form carries a hidden honeypot; bots that fill it are dropped silently.
- The registration form collects no password, because there is no login — it
  captures readiness to proceed, nothing more.
- Motion is disabled automatically for visitors whose system asks for reduced
  motion.

© Koza Literary Liaison. All rights reserved.
