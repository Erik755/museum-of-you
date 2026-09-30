# The Museum of You

[![Live demo](https://img.shields.io/badge/demo-erik755.github.io%2Fmuseum--of--you-8A6D1F)](https://erik755.github.io/museum-of-you/)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

A tongue-in-cheek **installable PWA** that turns everyday objects into museum pieces. Snap a photo of anything — a mug, a sock, your cat's toy — and an AI "extremely serious curator" writes a solemn (and slightly ridiculous) museum plaque for it: title, artist, period, curatorial description and a historical importance score. Your pieces are kept in your own gold-framed gallery on the device.

> *PWA humorística: toma una foto de un objeto cotidiano y un curador con IA le escribe su ficha de museo.*

**Try it:** https://museum-of-you.pages.dev/ (mirror: https://erik755.github.io/museum-of-you/)

## Features

- Camera or gallery input with client-side image compression (canvas).
- AI vision captioning with a configurable curator prompt (`{{artista}}`, `{{fecha}}` placeholders), via **Groq** (Llama 4 Scout vision) or **Google Gemini** with automatic model fallback.
- Requests go through a small serverless proxy (Cloudflare Worker, source in [`worker/`](worker/)) so no API key ships in the page.
- Explicit consent before the first upload (remembered in `localStorage`), with a link to the privacy notice.
- Gallery stored locally in **IndexedDB** (with localStorage migration), draft photo restore, delete pieces.
- **Share / download** a rendered 1080×1350 plaque image (Canvas → JPEG) using the Web Share API.
- Installable **PWA**: web manifest, service worker for offline shell, iOS/Android install hints.
- Zero dependencies, no build step — plain HTML, CSS and JavaScript on Cloudflare Pages (and GitHub Pages).

## Privacy

Privacy notice (ES/EN): https://extreme-solutions-eosin.vercel.app/privacidad#museum

- No account, cookies or analytics; the gallery stays on the device.
- When a piece is archived, the reduced photo, the artist name and the date are sent through the Worker to **Google Gemini on its unpaid (free) tier** — Google may use that content to improve its services and it may be reviewed by humans — or to Groq. Do not upload sensitive photos or photos of other people without their permission.
- Gemini's free tier is not offered in the EU/EEA, Switzerland or the UK: the Worker reroutes those requests to Groq when `GROQ_API_KEY` is configured, or returns HTTP 451.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The settings panel (tap the title five times) lets you choose the provider/model, set the proxy URL and edit the curator prompt.

## Deploy

```bash
# App (Cloudflare Pages, direct upload, production branch "main")
mkdir -p /tmp/moy-site && cp index.html app.js consent.js styles.css sw.js manifest.json *.png icon.svg /tmp/moy-site/
npx wrangler pages deploy /tmp/moy-site --project-name museum-of-you --branch main

# Worker
cd worker && npm install
npx wrangler secret put GEMINI_API_KEY   # optional: npx wrangler secret put GROQ_API_KEY
npm run deploy                           # wrangler deploy --keep-vars
```

Bump `CACHE` in `sw.js` and the `?v=` query in `index.html` on every release.

## Project structure

```
index.html            UI shell
styles.css            museum / gold-frame theme
app.js                app logic (capture, AI call, gallery, sharing)
consent.js            consent dialog shown before the first AI upload
sw.js                 service worker
worker/               Cloudflare Worker proxy (no secrets in the repo)
manifest.json         PWA manifest + icons
```

## License

[MIT](LICENSE) © Erik Sanchez
