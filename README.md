# davidlevine.dev

My developer portfolio. A plain HTML/CSS site served by nginx on Google Cloud Run
(project `davidlevine-site`, region `us-central1`, service `portfolio`).

## Folders
- `public/`: the website itself. Edit `index.html` and `styles.css`; put photos, screenshots and a résumé PDF in `public/images/` or `public/`.
- `nginx.conf`: web server settings (www → davidlevine.dev redirect, security headers, caching).
- `Dockerfile`: how Google packages the site.
- `deploy/`: scripts to put it online.

## Filling in the placeholders
Everything still to fill in is marked `PLACEHOLDER` in a comment in `public/index.html`
and shows on the page as a dashed, amber box. When you replace one, remove its `placeholder` class
(or the whole placeholder box) as the comment describes.

## Preview on this Mac
```
cd public && python3 -m http.server 8000
```
Then open http://localhost:8000. (The www redirect and security headers only apply on Cloud Run.)

## Putting it online
1. `bash deploy/setup.sh`: once, prepares the Google Cloud project.
2. `bash deploy/deploy.sh`: deploys the latest commit on GitHub. Run again after each change you've pushed.
3. `bash deploy/map-domain.sh`: once, connects davidlevine.dev and www.davidlevine.dev.
   `bash deploy/map-domain.sh --status` shows whether the HTTPS certificate is ready.

## DNS (Cloudflare, all "DNS only" / grey cloud)
| Type | Name | Value |
|---|---|---|
| TXT | @ | google-site-verification=… (keep it: Google re-checks it) |
| A | @ | 216.239.32.21, 216.239.34.21, 216.239.36.21, 216.239.38.21 |
| AAAA | @ | 2001:4860:4802:32::15, …:34::15, …:36::15, …:38::15 |
| CNAME | www | ghs.googlehosted.com |
| CNAME | gameday | ghs.googlehosted.com (Game Day, mapped from project `gameday-514004`) |

Each future project gets its own `CNAME <name> → ghs.googlehosted.com` plus a Cloud Run domain mapping.

### Cloudflare account move (Wed 2026-11-11)
Records do not carry over. Before the move, Export the zone from the current account; after, Import
it into the new one with "Proxy imported DNS records" UNCHECKED. Then confirm in the new account that
every row above is present and grey, especially the verification TXT and the gameday CNAME.

The CSP and other headers in `nginx.conf` apply only to pages served by this site, never to
subdomains such as gameday.davidlevine.dev.
