# Measuring visitors and clicks

Uses **Vercel Web Analytics**: no extra account, no cookies, so no cookie banner.

## 1. Switch it on

In Vercel, open the `yennyotero-site` project → **Analytics** → **Enable**. Every page
already loads `/_vercel/insights/script.js`, and `a.js` sends its events through `window.va`.
Nothing is recorded until Analytics is enabled, and nothing is sent from previews or localhost.

Pageviews, referrers, country, device and browser appear in the Analytics tab. The events
below appear under **Events**. Prefer Umami, Plausible or GoatCounter? `a.js` speaks those
too: swap the script tag on each page.

## 2. Tag the link you put in each application

This is the part worth having. Add `?from=` and the company name to the link:

    yennyotero.com/?from=anima
    yennyotero.com/?from=lottie
    yennyotero.com/?from=linkedin-post

Every event from that visit is then tagged with that name, and the tag survives
as they move through the site. So you can answer "did Anima actually open it,
and did they download the CV" rather than only "someone visited today".

Keep the plain `yennyotero.com` on your LinkedIn profile and your CV.

## What gets recorded

| Event | Means |
|---|---|
| `visit-from-application` | Someone opened a tagged link, with the company name |
| `cv-download` | The CV was downloaded. The strongest signal you have |
| `case-study-open` | Which case study, by name |
| `image-open` | Which image in the strip they clicked |
| `email-click` | Someone tapped your email address |
| `linkedin-click` | Someone went to your LinkedIn |
| `scrolled-50` / `scrolled-90` | They read rather than bounced |
| `stayed-30s` | They were on the page more than a glance |

Pageviews, referrers, country, device and browser come from Vercel Web Analytics itself.

## What to look at

- **CV downloads against visits.** If people land and leave without the CV, the
  homepage is not convincing them.
- **Which case study opens most.** Put that one first.
- **Scroll depth on case studies.** If almost nobody reaches 90%, they are too long.
- **`from` tags with no follow-on events.** That application link was opened and
  dismissed in seconds, which usually means the first screen did not land.

## Notes

- Nothing is sent from `localhost` or from preview links, so your own testing
  never pollutes the numbers. Only `yennyotero.com` reports.
- No cookies and no personal data. Vercel Web Analytics stores aggregate counts, not people.
- Some ad blockers still hide visits, and in a technical audience that can be a
  sizeable share. Treat the numbers as a floor, not a total.
