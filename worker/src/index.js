/**
 * Museum of You — API proxy
 * Keeps Gemini/Groq keys on the server. Browser never sees them.
 * Stores nothing: forwards the photo + prompt to the AI provider and returns the text.
 *
 * Gemini is used on its unpaid (free) tier. Google's Gemini API terms only allow Paid Services
 * for users in the EEA, Switzerland and the UK, so Gemini requests from those countries
 * (request.cf.country) are rerouted to Groq when GROQ_API_KEY is configured, or rejected otherwise.
 */
// EU (27) + EEA (IS, LI, NO) + Switzerland + United Kingdom.
const GEMINI_FREE_BLOCKED = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH", "GB",
]);
const GROQ_FALLBACK_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_ALLOWED = [
  "https://erik755.github.io",
  "https://museum-of-you.pages.dev",
  "http://localhost",
  "http://127.0.0.1",
];

function allowedOrigin(origin, env) {
  if (!origin) return null;
  const extras = String(env.EXTRA_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const list = DEFAULT_ALLOWED.concat(extras);
  for (const base of list) {
    if (origin === base || origin.startsWith(base + ":") || origin.startsWith(base + "/")) {
      // localhost:port / 127.0.0.1:port
      if (base === "http://localhost" || base === "http://127.0.0.1") {
        try {
          const u = new URL(origin);
          if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return origin;
        } catch (_) {}
      } else if (origin === base || origin.startsWith(base)) {
        return origin;
      }
    }
  }
  // Exact match for pages path origin (erik755.github.io is enough; path not in Origin header)
  if (origin === "https://erik755.github.io") return origin;
  try {
    const u = new URL(origin);
    if (u.hostname === "museum-of-you.pages.dev" || u.hostname.endsWith(".museum-of-you.pages.dev")) return origin;
  } catch (_) {}
  return null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function callGemini(env, model, prompt, imageDataUrl) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada en el Worker");
  const b64 = String(imageDataUrl || "").split(",")[1] || "";
  if (!b64) throw new Error("Falta la imagen");
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent";
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: b64 } },
          ],
        },
      ],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || "Error Gemini " + r.status);
  const text = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [])
    .map((p) => p.text || "")
    .join("");
  if (!text) throw new Error("Gemini no devolvió texto");
  return text;
}

async function callGroq(env, model, prompt, imageDataUrl) {
  const key = env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY no configurada en el Worker");
  if (!imageDataUrl) throw new Error("Falta la imagen");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      model: model || "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.85,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || "Error de Groq: " + r.status);
  const text =
    data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
  if (!text) throw new Error("Groq no devolvió texto");
  return text;
}

export default {
  async fetch(request, env) {
    const originHdr = request.headers.get("Origin") || "";
    const origin = allowedOrigin(originHdr, env);

    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({ ok: true, service: "museum-of-you-proxy" }, 200, origin || "*");
    }

    if (request.method !== "POST" || !url.pathname.replace(/\/$/, "").endsWith("/api/curate")) {
      return json({ error: "Not found" }, 404, origin || "*");
    }

    if (!origin) {
      return json({ error: "Origen no permitido" }, 403, "*");
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "JSON inválido" }, 400, origin);
    }

    let provider = String(body.provider || "gemini").toLowerCase();
    let model = String(body.model || "").trim();
    const prompt = String(body.prompt || "");
    const image = String(body.image || body.imageDataUrl || "");
    if (!model || !prompt || !image) {
      return json({ error: "Faltan provider/model/prompt/image" }, 400, origin);
    }

    let rerouted = false;
    const country = String((request.cf && request.cf.country) || "").toUpperCase();
    if (provider !== "groq" && GEMINI_FREE_BLOCKED.has(country)) {
      if (!env.GROQ_API_KEY) {
        return json({
          error: "La ficha con IA no está disponible desde tu región (UE/EEE, Suiza o Reino Unido). / The AI label is not available in your region (EU/EEA, Switzerland or UK).",
          code: "region_unavailable",
        }, 451, origin);
      }
      provider = "groq";
      model = GROQ_FALLBACK_MODEL;
      rerouted = true;
    }

    try {
      const content =
        provider === "groq"
          ? await callGroq(env, model, prompt, image)
          : await callGemini(env, model, prompt, image);
      return json(rerouted ? { content, provider, rerouted } : { content, provider }, 200, origin);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      // Never echo secrets
      return json({ error: msg.replace(/AIza[^\s]+/g, "[redacted]").replace(/gsk_[^\s]+/g, "[redacted]") }, 502, origin);
    }
  },
};
