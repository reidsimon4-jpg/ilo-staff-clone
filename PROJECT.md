# Infinity Living Options — Marketing Website

Portable project context. Hand this file to another project/session to get up to speed fast.

## What it is
Public marketing site for **Infinity Living Options (ILO)** — a prefab modular **light gauge steel (LGS)** construction company in Bali, Indonesia (factory in Banyuwangi, East Java). Hand-written **static** HTML/CSS/JS — no framework, no build step, no package.json.

## Live URLs
- **Production:** https://www.ilo.net.au (apex `https://ilo.net.au` 301-redirects to `www`)
- **Netlify URL:** https://infinity-living-options.netlify.app
- SSL: Let's Encrypt, covers both `ilo.net.au` and `www.ilo.net.au`.

## Hosting / deploy
- **Netlify project:** `infinity-living-options` · site id `48044a47-259b-4d0e-bbaf-e8f733271b3a` · team slug `reid-simon4`. Folder is CLI-linked via `.netlify/`.
- **Deploy command (MUST use `--no-build`):**
  ```bash
  netlify deploy --prod --no-build --dir .
  ```
  Plain `netlify deploy` tries to auto-run a build and fails with an npm error (there is no build). No Git/CI connection — every change is a manual redeploy.
- **Local source:** `C:\Users\simon\Desktop\🟧 DEV & TOOLS\antigravity\ilo-website`

## Domain / DNS (cutover complete 2026-06-13)
- DNS hosted at **Crazy Domains** (ns1/ns2.crazydomains.com).
- apex `ilo.net.au` A → `75.2.60.5` (Netlify) · `www` CNAME → `infinity-living-options.netlify.app`.
- Netlify primary = `www.ilo.net.au`, alias `ilo.net.au`.
- **Email is Microsoft 365** — MX (`ilo-net-au.mail.protection.outlook.com`) + ds.network + SPF TXT. NEVER touch MX/TXT when editing DNS.

## Structure
- 16 pages: `index.html` (home), `about`, `lgs`, `benefits`, `process`, `factory`, `projects`, `galleries`, `articles` (+ 3 `article-*.html`), `knowledge-base`, `why-indonesia`, `contact`, `404.html`.
- `styles.css` (one global stylesheet, `?v=N` cache-busted) · `main.js` (all interactivity) · `hero3d.js` (ES module, three.js).
- `netlify.toml` — security headers; CSS/JS served `max-age=0, must-revalidate` (see Cache gotcha).
- Assets: `logo-infinity.png`, `favicon.png/.ico`, `apple-touch-icon.png`, `og-image.jpg`, many `img-*.jpg`, `hero-bali-frame.mp4` + `hero-poster.jpg`, `vid-*.mp4` + `-poster.jpg` (factory reel).

## Key features
- **3D hero** (`hero3d.js`): three.js (v0.160 from jsdelivr CDN) instanced LGS villa frame that self-assembles with week-by-week HUD captions; drag-to-rotate; falls back to the hero video if WebGL fails. `?built=1` skips the animation to the finished frame (for screenshots).
- **Build & Price configurator** (`main.js` §10): building type × build stage × area × floors × currency → live IDR/USD/AUD estimate + WhatsApp prefill + email capture. Sell rates derived from ILO's Bali rate database (`C:\Users\simon\Downloads\ID_BALI_ILO_cost_database.xlsx`, Apr 2026) and the official client guidance band (frame from ~Rp 2.5M/m², shell ~4M, turnkey 7–11M/m²). If the DB changes, re-derive the `RATES` table in main.js. Keep public per-m² claims consistent across configurator, `knowledge-base.html`, and `llms.txt`.
- **Forms (Netlify Forms, 6):** `contact`, `lead-inline`, `guide-download`, `exit-consultation`, `newsletter`, `configurator-lead`. Each has `data-netlify="true"` + hidden `form-name` + `bot-field` honeypot; `main.js` AJAX-POSTs to `/`. Submissions land in the Netlify dashboard per form name. (Form detection had to be enabled once on this site; if forms stop registering, re-enable detection and redeploy.)

## Real media sources (authentic > stock)
- **Logo:** `C:\Users\simon\Desktop\🟪 MEDIA\Images\neonlogo.jpg` (processed to transparent `logo-infinity.png`). Old `logo.png` placeholder is retired — don't reuse.
- **Factory videos:** `C:\Users\simon\OneDrive - Infinity Living Options\downloads` (coil→decoiler→roll-forming→assembly). Web-compressed `vid-*.mp4` on `factory.html`.
- **Site/factory photos:** WhatsApp chat exports in `C:\Users\simon\OneDrive - Infinity Living Options\whatsapp chats` (the "BCI Banyuwangi" chat is the gold mine — real Bali site + factory shots). Used several on home/galleries; many more available.
- ffmpeg for media work: the `imageio-ffmpeg` Python package binary; HEIC via `pillow-heif`.

## Gotchas
- **Cache:** never serve unversioned CSS/JS with `immutable` — it once poisoned returning visitors with year-old assets (dead configurator). Current scheme: `must-revalidate` + `?v=N` query-busting; bump N when assets change.
- **Headless screenshots time out** on this site (video + WebGL canvas) and a browser extension can wedge Claude-in-Chrome screenshots on some pages — verify via DOM (`preview_eval` / network logs) or Claude-in-Chrome on the live URL instead.
- **Crazy Domains** Account Manager session is unstable under browser automation (intermittent "Unauthorized", drops to login). Hand DNS edits to Simon if needed.

## Outstanding / ideas
- Squarespace subscription can be cancelled (nothing points to it anymore).
- `projects.html` and the deeper galleries could become a richer real-photo portfolio (more shots available in the BCI chat + `downloads` project folders: NUANU PROJECT RL02, mikesvilla, designs, ifcs sketchup).
- Optional: email notifications on form submissions (Netlify → Forms → notifications).

## Related — ILO ecosystem
This website is one node in a connected system. Full map: **`C:\Users\simon\Desktop\ILO-ECOSYSTEM.md`**.

The connection is **leads**: this site generates them (Netlify Forms + `wa.me/6285739888885` WhatsApp links) → the **WhatsApp AI Agent (Make.com)** qualifies them into the Notion "ILO WhatsApp Leads" DB → the **Three-App Portal CRM** imports and converts them to projects (CostControl 00NN code → Finance App). A future unifying step: POST this site's form submissions into the same Notion leads DB so website leads also flow into the portal CRM.

Other separate projects: Pecatu heliport 3D, Blangan point cloud.
