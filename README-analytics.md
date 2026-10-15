# Measuring visitors and clicks

Two steps, about five minutes. Nothing is recorded until you do step 1.

## 1. Create the account

Go to **umami.is**, sign up for the free cloud tier, add a website for `yennyotero.com`.
It gives you a **Website ID** that looks like `a1b2c3d4-...`.

Open `index.html`, `work/bachata-connect.html`, `work/tsb.html`,
`work/oslo-university-hospital.html` and `work/amplifon.html`, and in each one replace:

    data-website-id="REPLACE_WITH_UMAMI_ID"

with your real ID. Then redeploy.

Free tier: 100k events a month and 1 year of history. No cookies, so you do not
need a cookie banner. Prefer something else? `a.js` also speaks Plausible and
GoatCounter with no changes, just swap the provider script tag.

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

Pageviews, referrers, country, device and browser come from Umami itself.

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
- No cookies and no personal data. Umami stores aggregate counts, not people.
- Anyone running an ad blocker is invisible to this, and in a technical audience
  that can be a fifth of visitors. If that matters, Netlify Analytics reads the
  server logs instead at about $9 a month, though it cannot see clicks.
