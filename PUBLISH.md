# Publishing KOZA LITERARY LIAISON

This folder is the complete, finished website. It is plain HTML, CSS and JavaScript —
no build step, no bundler, no framework. You can host it on GitHub Pages for free.

---

## 1. Two things to do before you go live

### 1a. Turn on the forms (about 5 minutes)

Right now, when someone submits a form, the site opens **their** email app with every
field already filled in and addressed to you. It works, but it relies on the visitor
having a mail app and on them pressing send.

To make it fully automatic, set up Formspree — it posts the submission straight to
your inbox, no visitor action needed:

1. Sign up at **https://formspree.io** using `kozaliteraryliaison@gmail.com`.
2. Confirm the email address when they send you the verification mail.
3. Click **New Form**, point it at the same address, give it the name `KOZA Website`.
4. Copy the form id out of the endpoint URL. It looks like this:
   `https://formspree.io/f/xqkgnvpd` → the id is `xqkgnvpd`
5. Open `assets/js/site-config.js` and paste it in:

```js
formspreeId: 'xqkgnvpd'
```

That is the whole change. Both the contact forms and the registration form will now
deliver to your inbox automatically.

**If you would rather not use Formspree**, leave that line empty. The mail-app
fallback stays in place and no enquiry is ever lost. You can also swap in a different
service later by editing one function in `assets/js/forms.js`.

### 1b. Set your real address

The site currently assumes the GitHub Pages address
`https://kozaliteraryliaison.github.io`. If your GitHub username is different, or you
later add a real domain, run this from inside the project folder:

```bash
sed -i 's|https://kozaliteraryliaison.github.io|https://YOUR-REAL-ADDRESS|g' \
  *.html assets/js/site-config.js sitemap.xml robots.txt
```

That one command updates the canonical links, the social share preview, the sitemap
and the robots file at the same time.

---

## 2. Publish to GitHub Pages

1. Create a free account at **https://github.com** if you do not have one.
2. Click **+** (top right) → **New repository**.
   - Name it whatever you like, e.g. `koza-literary-liaison`.
   - Set it to **Public** (GitHub Pages on the free plan requires this).
   - Do **not** tick "Add a README" — you already have the files.
3. On your computer, open a terminal in this folder and run:

```bash
git init
git add .
git commit -m "KOZA Literary Liaison — website launch"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/koza-literary-liaison.git
git push -u origin main
```

4. Back on GitHub, open your repository → **Settings** → **Pages**.
5. Under *Source*, choose **Deploy from a branch**, branch **main**, folder **/ (root)**,
   and press **Save**.
6. Wait about a minute, then your site is live at
   `https://YOUR-USERNAME.github.io`.

> **Note on the `.html` endings.** GitHub Pages serves `index.html` as `/` automatically,
> so the homepage is clean. The other pages keep their `.html` extension
> (`/our-story.html`) — that is normal and fine. If you would prefer clean URLs
> without the extension, that is a small extra step; ask and it can be arranged.

### Adding your own domain later

Buy a domain, then in the repository under **Settings → Pages** set a **Custom domain**.
GitHub issues the SSL certificate automatically. After that, run the `sed` command in
step 1b with your real domain so all the internal links and share previews match.

---

## 3. Updating the site later

Edit the files in this folder, then push again:

```bash
git add .
git commit -m "Update the site"
git push
```

GitHub Pages rebuilds and publishes within a minute or two.

---

## 4. What is where

```
index.html            Home — all 15 sections
our-story.html        Our story, founder, values
our-work.html         Portfolio of campaigns
lets-talk.html        Contact, proposal request, FAQ
register.html         Author registration (payment-free, 2 steps)
privacy.html          Privacy policy
terms.html            Terms of service
404.html              Shown for any broken or missing link
robots.txt            Search engine instructions
sitemap.xml           Page list for search engines

assets/css/style.css      The whole design system
assets/css/logo.css       The animated motion logo
assets/css/register.css   Registration page styles
assets/css/fonts.css      Self-hosted font definitions
assets/js/site-config.js  >>> EDIT THIS ONE FILE TO GO LIVE <<<
assets/js/forms.js        Form delivery (Formspree + mail fallback)
assets/js/main.js         Shared behaviour: nav, reveals, counters, carousel, forms
assets/js/register.js     The registration flow
assets/img/                Logo, hero art, project images, headshots
assets/fonts/              12 self-hosted woff2 files
```

---

## 5. Things worth knowing

- **No tracking, no cookies, no third-party scripts.** Fonts and images are served
  from this folder, so the site makes **zero external requests** apart from the
  Formspree form post. Nothing about your visitors is shared with anyone.
- **Spam protection is built in.** Every form carries a hidden honeypot field that
  only a bot will fill in, and Formspree adds its own filtering on top.
- **The registration form collects no password.** There is no account system, so
  asking for one would be misleading. It captures the contact and book details and
  confirms readiness, which is what the brief asked for.
- **The site is responsive** and verified at 1440px and 390px on every page.
- **Motion respects the reader.** All animation is disabled automatically for
  visitors whose device asks for reduced motion.

---

## 6. Pre-launch checklist

- [ ] Formspree id pasted into `assets/js/site-config.js` (or accept the mail fallback)
- [ ] `sed` command run with the real address
- [ ] Registration form submitted once end-to-end, confirmation received in the inbox
- [ ] Contact form submitted once end-to-end, confirmation received in the inbox
- [ ] Click through every page from the live URL
- [ ] `https://YOUR-ADDRESS/privacy.html` and `/terms.html` open correctly
- [ ] Share a link on WhatsApp or X and confirm the preview image appears
- [ ] Replace the Toronto address if the studio has moved
