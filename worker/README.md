# Museum of You proxy (Cloudflare Worker)

The Gemini/Groq API keys **never** reach the browser: the app calls this Worker and the Worker calls Google or Groq with the secret. It stores nothing (no KV, D1, R2 or logging of bodies).

- Endpoint: `POST /api/curate` with `{ "provider": "gemini"|"groq", "model": "...", "prompt": "...", "image": "data:image/jpeg;base64,..." }` → `{ "content": "...", "provider": "..." }`.
- Health check: `GET /health`.
- Allowed origins: `https://museum-of-you.pages.dev` (and preview subdomains), `https://erik755.github.io`, localhost; add more with the `EXTRA_ORIGINS` var.
- **Region rule:** Gemini is used on its unpaid tier, which Google's Gemini API terms do not allow for users in the EU/EEA, Switzerland or the UK. Gemini requests from those countries (`request.cf.country`) are rerouted to Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) when `GROQ_API_KEY` is set; otherwise the Worker answers HTTP 451 with `code: "region_unavailable"`.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
# optional, enables the Groq provider and the EU/EEA/CH/UK fallback:
# npx wrangler secret put GROQ_API_KEY
npm run deploy   # wrangler deploy --keep-vars (keeps variables set in the dashboard)
```
