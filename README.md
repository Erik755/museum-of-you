# The Museum of You

[![Live demo](https://img.shields.io/badge/demo-erik755.github.io%2Fmuseum--of--you-8A6D1F)](https://erik755.github.io/museum-of-you/)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

A tongue-in-cheek **installable PWA** that turns everyday objects into museum pieces. Snap a photo of anything — a mug, a sock, your cat's toy — and an AI "extremely serious curator" writes a solemn (and slightly ridiculous) museum plaque for it: title, artist, period, curatorial description and a historical importance score. Your pieces are kept in your own gold-framed gallery on the device.

> *PWA humorística: toma una foto de un objeto cotidiano y un curador con IA le escribe su ficha de museo.*

**Try it:** https://erik755.github.io/museum-of-you/

## Features

- Camera or gallery input with client-side image compression (canvas).
- AI vision captioning with a configurable curator prompt (`{{artista}}`, `{{fecha}}` placeholders), via **Groq** (Llama 4 Scout vision) or **Google Gemini** with automatic model fallback.
- Requests go through a small serverless proxy (Cloudflare Worker) so no API key ships in the page.
- Gallery stored locally in **IndexedDB** (with localStorage migration), draft photo restore, delete pieces.
- **Share / download** a rendered 1080×1350 plaque image (Canvas → JPEG) using the Web Share API.
- Installable **PWA**: web manifest, service worker for offline shell, iOS/Android install hints.
- Zero dependencies, no build step — plain HTML, CSS and JavaScript on GitHub Pages.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The settings panel (tap the title five times) lets you choose the provider/model, set the proxy URL and edit the curator prompt.

## Project structure

```
index.html            UI shell
styles.css            museum / gold-frame theme
app.js                app logic (capture, AI call, gallery, sharing)
sw.js                 service worker
manifest.json         PWA manifest + icons
```

## License

[MIT](LICENSE) © Erik Sanchez
