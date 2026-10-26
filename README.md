# yennyotero.com

My portfolio site. Plain HTML and CSS, no framework and no build step, so it loads fast and anyone can read the source.

- `index.html` is the homepage
- `work/` holds the four case studies
- `site.css` is shared by the case studies. Each case page opens with a four-line short read, and the full story simply continues below it, so there is nothing to click
- `a.js` is a small, cookie-free analytics helper that only runs on the live domain
- `img/` holds the images, all WebP, with any real people's names and data blurred or replaced by example data

Every push to `main` deploys to Vercel. To run the checks: `cd tests && npm install && npx playwright install chromium && npm test`.

Before each release I run checks in a headless browser: every image loads and keeps its true shape, the lightbox opens and closes, no page scrolls sideways at phone width, tap targets are large enough, and there are no JavaScript errors or failed requests.

The design system behind the Bachata Connect case study has its own public repo: [design-system-showcase](https://github.com/flamingointheweb/design-system-showcase).
