# Arun Living

An English-language lifestyle journal for furniture, fashion, health, fitness, beauty, and home and decor. Designed for the GitHub Pages address `https://arun-ahirwar.github.io/`. It includes a visual article editing workflow through Pages CMS, SEO metadata, a sitemap, and robots.txt.

## First publication

1. Create a **public** repository named exactly `arun-ahirwar.github.io` in the `arun-ahirwar` account. Upload this project's files at the root of its `main` branch. Keep `.pages.yml`, `.github/workflows/pages.yml`, and `content/` in their original paths. Do not upload `node_modules` or `dist`.
2. In repository Settings → Pages → Build and deployment, select **GitHub Actions** as the source. The workflow builds and publishes the website at `https://arun-ahirwar.github.io/`.
3. Open `https://arun-ahirwar.github.io/admin/`, select **Open article editor**, and sign in to Pages CMS with GitHub. Install its GitHub App on **only this repository**. In Pages CMS, select this repository's `main` branch.
4. Open **Articles**, start a new entry or use the unpublished practice draft. Fill in all required fields. Use the rich-text editor for headings, formatting, links and lists. Switch **Published** on only when you are ready to make the article public. Save; the GitHub workflow republishes the blog and sitemap.
5. Search Console: add `https://arun-ahirwar.github.io/` as a URL-prefix property. Put the HTML meta tag's `content` value in **Website settings → Google Search Console verification code**, save, then verify. Submit `https://arun-ahirwar.github.io/sitemap.xml`.

The blog's `/admin/` is a guide and entry to the Pages CMS editor. The editor itself is hosted by Pages CMS; GitHub Pages cannot run WordPress/PHP. Drafts are omitted from the live site but remain visible in the public GitHub repository and history. Never put private content there.

## Local checks

With Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
npm run preview
```

Then visit `http://127.0.0.1:4173/`. The output in `dist/` is generated; edit `content/site.json`, `content/articles/`, `.pages.yml`, and `public/` instead.

The site treats future-dated articles as unpublished until a later build is run. It does not schedule an automatic build at the future date. Keep article URL names stable after publication. The `url` in `content/site.json` is for the GitHub user subdomain; changing it requires rebuilding.
