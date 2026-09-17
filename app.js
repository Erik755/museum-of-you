const KEY_GROQ = "moy_groq_key";
const KEY_GEM = "moy_gemini_key";
const PROVIDER = "moy_provider";
const MODEL = "moy_model";
const OWNER = "moy_owner";
const PROMPT = "moy_prompt";
const DB = "moy_pieces";

const MODELS = {
  groq: [
    ["qwen/qwen3.8-27b", "Qwen 3.8 27B"],
    ["meta-llama/llama-4-scout-17b-16e-instruct", "Llama 4 Scout"]
  ],
  gemini: [
    ["gemini-3.8-flash", "Gemini 3.8 Flash"],
    ["gemini-3.5-flash", "Gemini 3.5 Flash"],
    ["gemini-2.5-flash", "Gemini 2.5 Flash"]
  ]
};
const GEMINI_FALLBACKS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"];

const DEFAULT_PROMPT = `Eres el curador más serio de un museo imaginario llamado The Museum of You.
Tratas objetos cotidianos ridículos con extrema solemnidad académica.
Nunca expliques que es una broma. Nunca uses emojis.

La pieza pertenece al universo de {{owner}}.
Fecha de ingreso: {{fecha}}.

Responde SOLO en JSON válido, sin markdown, con estas claves:
{
  "titulo": "título en mayúsculas, corto",
  "fecha": "{{fecha}}",
  "periodo": "nombre inventado de un periodo histórico personal",
  "descripcion": "UNA sola frase curatorial, máximo 18 palabras, específica de lo que se ve",
  "importancia": número entero del 1 al 100, normalmente bajo (1-25),
  "ubicacion": "sala o ala inventada del museo"
}`;

const $ = (id) => document.getElementById(id);
const apiKeyEl = $("apiKey");
const providerEl = $("provider");
const modelEl = $("model");
const ownerEl = $("owner");
const promptEl = $("promptBox");
const photoEl = $("photo");
const previewEl = $("preview");
const generateEl = $("generate");
const statusEl = $("status");
const exhibitEl = $("exhibit");
const galleryEl = $("gallery");
const countEl = $("count");
const setupEl = $("setup");
const lightbox = $("lightbox");
const lbInner = $("lbInner");
const installBtn = $("installBtn");
const installHint = $("installHint");

let currentImage = "";
let taps = 0;
let tapTimer = 0;
let deferredPrompt = null;
let openIndex = -1;

function currentProvider() {
  return providerEl.value === "gemini" ? "gemini" : "groq";
}
function keyStore() {
  return currentProvider() === "gemini" ? KEY_GEM : KEY_GROQ;
}
function fillModels(keep) {
  const list = MODELS[currentProvider()];
  modelEl.innerHTML = list.map(([v, n]) => `<option value="${v}">${n}</option>`).join("");
  const want = keep || localStorage.getItem(MODEL) || list[0][0];
  const ok = list.some(([v]) => v === want);
  modelEl.value = ok ? want : list[0][0];
}
function loadKeyField() {
  apiKeyEl.value = localStorage.getItem(keyStore()) || "";
  apiKeyEl.placeholder = currentProvider() === "gemini" ? "AIzaSy..." : "gsk_...";
}

providerEl.value = localStorage.getItem(PROVIDER) || "groq";
fillModels();
loadKeyField();
ownerEl.value = localStorage.getItem(OWNER) || "";
promptEl.value = localStorage.getItem(PROMPT) || DEFAULT_PROMPT;
providerEl.onchange = () => { fillModels(); loadKeyField(); };

if (new URLSearchParams(location.search).get("curador") === "1") setupEl.classList.remove("hidden");

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
if (isStandalone()) installBtn.classList.add("hidden");
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
installBtn.onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const res = await deferredPrompt.userChoice;
    installHint.textContent = res.outcome === "accepted" ? "Instalada en tu pantalla." : "Cancelado.";
    if (res.outcome === "accepted") installBtn.classList.add("hidden");
    deferredPrompt = null;
    return;
  }
  installHint.textContent = isIOS()
    ? "iPhone: Compartir → Añadir a pantalla de inicio."
    : "Chrome: menú ⋮ → Instalar aplicación o Añadir a pantalla de inicio.";
};
window.addEventListener("appinstalled", () => { installBtn.classList.add("hidden"); installHint.textContent = "Instalada."; });

$("titleTap").onclick = () => {
  clearTimeout(tapTimer);
  taps += 1;
  tapTimer = setTimeout(() => { taps = 0; }, 1400);
  if (taps >= 5) { taps = 0; setupEl.classList.remove("hidden"); }
};
$("hideSetup").onclick = () => setupEl.classList.add("hidden");
$("closeLb").onclick = () => lightbox.classList.add("hidden");
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.classList.add("hidden"); });

$("saveSetup").onclick = () => {
  localStorage.setItem(PROVIDER, currentProvider());
  localStorage.setItem(keyStore(), apiKeyEl.value.trim());
  localStorage.setItem(MODEL, modelEl.value);
  localStorage.setItem(OWNER, ownerEl.value.trim());
  localStorage.setItem(PROMPT, promptEl.value);
  $("setupStatus").textContent = "Guardado solo en este teléfono.";
};
$("resetPrompt").onclick = () => {
  promptEl.value = DEFAULT_PROMPT;
  localStorage.setItem(PROMPT, DEFAULT_PROMPT);
  $("setupStatus").textContent = "Prompt restablecido.";
};
photoEl.onchange = async () => {
  const file = photoEl.files[0];
  if (!file) return;
  currentImage = await compress(file);
  previewEl.src = currentImage;
  previewEl.hidden = false;
  generateEl.disabled = false;
  statusEl.textContent = "Foto lista.";
};
generateEl.onclick = archivePiece;

function pieces() {
  try { return JSON.parse(localStorage.getItem(DB) || "[]"); }
  catch { return []; }
}
function savePieces(list) {
  localStorage.setItem(DB, JSON.stringify(list));
  renderGallery();
}
function shortDesc(t) {
  const words = String(t || "").trim().split(/\s+/);
  if (words.length <= 20) return t || "";
  return words.slice(0, 18).join(" ") + ".";
}
function framed(src) {
  return `<div class="gold-frame"><img src="${src}" alt="" /></div>`;
}
function plaqueHtml(p) {
  return `
    ${framed(p.image)}
    <div class="plaque">
      <p class="meta">${escapeHtml(p.fecha || "")}</p>
      <h3>${escapeHtml(p.titulo || "")}</h3>
      <p class="meta">${escapeHtml(p.periodo || "")} · ${escapeHtml(p.ubicacion || "")}</p>
      <p class="desc">${escapeHtml(shortDesc(p.descripcion || ""))}</p>
      <p class="score">Importancia histórica: ${escapeHtml(String(p.importancia ?? "?"))}/100</p>
    </div>`;
}
function openPiece(i) {
  const p = pieces()[i];
  if (!p) return;
  openIndex = i;
  lbInner.innerHTML = plaqueHtml(p);
  lightbox.classList.remove("hidden");
}
function shareText(p) {
  return `${p.titulo || "Pieza"}\n${shortDesc(p.descripcion || "")}\nImportancia: ${p.importancia ?? "?"}/100\nThe Museum of You`;
}
async function pieceFile(p) {
  const img = await loadImg(p.image);
  const w = 1080, h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3f1ec"; ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(40, 40, 1040, 820);
  g.addColorStop(0, "#f0d78a"); g.addColorStop(0.5, "#b8892b"); g.addColorStop(1, "#6e4e14");
  ctx.fillStyle = g; ctx.fillRect(40, 40, 1000, 790);
  ctx.strokeStyle = "#5c4010"; ctx.lineWidth = 10; ctx.strokeRect(55, 55, 970, 760);
  ctx.strokeStyle = "#e8c86a"; ctx.lineWidth = 4; ctx.strokeRect(70, 70, 940, 730);
  const box = 110;
  const maxW = w - 2 * box, maxH = 680;
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const iw = img.width * ratio, ih = img.height * ratio;
  ctx.fillStyle = "#111"; ctx.fillRect((w - iw) / 2, 90, iw, ih);
  ctx.drawImage(img, (w - iw) / 2, 90, iw, ih);
  ctx.fillStyle = "#1a1814"; ctx.font = "28px Georgia";
  wrap(ctx, (p.titulo || "SIN TÍTULO").toUpperCase(), box, 880, w - 2 * box, 34);
  ctx.font = "22px Georgia";
  wrap(ctx, shortDesc(p.descripcion || ""), box, 990, w - 2 * box, 30);
  ctx.font = "18px sans-serif"; ctx.fillStyle = "#5c5850";
  ctx.fillText(`Importancia ${p.importancia ?? "?"}/100  ·  The Museum of You`, box, 1280);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  return new File([blob], "museum-of-you.jpg", { type: "image/jpeg" });
}
function wrap(ctx, text, x, y, maxW, lineH) {
  const words = String(text).split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW) { ctx.fillText(line, x, y); line = word; y += lineH; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
$("shareBtn").onclick = async () => {
  const p = pieces()[openIndex];
  if (!p) return;
  try {
    const file = await pieceFile(p);
    if (navigator.share) {
      const data = { title: p.titulo || "The Museum of You", text: shareText(p), files: [file] };
      if (navigator.canShare && !navigator.canShare(data)) await navigator.share({ title: data.title, text: data.text });
      else await navigator.share(data);
    } else await downloadFile(file);
  } catch (err) {
    if (String(err.name) !== "AbortError") statusEl.textContent = "No se pudo compartir.";
  }
};
$("downloadBtn").onclick = async () => {
  const p = pieces()[openIndex];
  if (!p) return;
  await downloadFile(await pieceFile(p));
};
function downloadFile(file) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
function renderGallery() {
  const list = pieces();
  countEl.textContent = list.length + (list.length === 1 ? " pieza" : " piezas");
  galleryEl.innerHTML = list.map((p, i) => `
    <article class="card" data-open="${i}">
      ${framed(p.image)}
      <p>${escapeHtml(p.titulo || "Sin título")}</p>
      <button type="button" class="ghost open-mini" data-open="${i}">Ver / compartir</button>
    </article>
  `).join("") || "<p class='tiny'>Aún no hay patrimonio.</p>";
  galleryEl.querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = (ev) => { ev.stopPropagation(); openPiece(Number(el.dataset.open)); };
  });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]));
}
function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1024;
      let w = img.width, h = img.height;
      if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
      else if (h > max) { w = Math.round(w * max / h); h = max; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = reject;
    img.src = url;
  });
}
function parseCard(raw) {
  const clean = String(raw || "").replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 ? clean.slice(start, end + 1) : clean);
}
async function callGroq(key, prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: modelEl.value,
      temperature: 0.8,
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: currentImage } }
      ]}]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Error de Groq: " + res.status);
  return parseCard(data.choices?.[0]?.message?.content || "");
}
function geminiHint(msg) {
  const m = String(msg || "");
  if (/API key|API_KEY|invalid|not valid/i.test(m)) {
    return "Key de Gemini rechazada. Crea una nueva en aistudio.google.com/apikey. En la key: sin restricciones de app, o HTTP referrers con https://erik755.github.io/*";
  }
  if (/not found|NOT_FOUND|is not found/i.test(m)) {
    return "Ese modelo no existe en tu cuenta. Prueba Gemini 3.5 Flash o 2.5 Flash.";
  }
  return m;
}
async function geminiOnce(key, prompt, model) {
  const b64 = currentImage.split(",")[1] || "";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/jpeg", data: b64 } }
      ]}]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Error Gemini " + res.status);
  const raw = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  if (!raw) throw new Error("Gemini no devolvió texto");
  return parseCard(raw);
}
async function callGemini(key, prompt) {
  const first = modelEl.value || GEMINI_FALLBACKS[0];
  const queue = [first].concat(GEMINI_FALLBACKS.filter((m) => m !== first));
  let last = "";
  for (const model of queue) {
    try {
      return await geminiOnce(key, prompt, model);
    } catch (err) {
      last = err.message || String(err);
      if (/API key|API_KEY|not valid/i.test(last)) throw new Error(geminiHint(last));
    }
  }
  throw new Error(geminiHint(last));
}
async function archivePiece() {
  const key = (apiKeyEl.value || localStorage.getItem(keyStore()) || "").trim();
  if (!key) { statusEl.textContent = "Toca 5 veces el título y pega tu API key."; return; }
  if (currentProvider() === "gemini" && !key.startsWith("AIza")) {
    statusEl.textContent = "La key de Gemini debe empezar con AIza. No uses la de Groq (gsk_).";
    return;
  }
  if (!currentImage) return;
  generateEl.disabled = true;
  statusEl.textContent = "El curador está examinando la pieza...";
  const owner = ownerEl.value.trim() || localStorage.getItem(OWNER) || "un habitante anónimo";
  const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const prompt = (promptEl.value || DEFAULT_PROMPT).replaceAll("{{owner}}", owner).replaceAll("{{fecha}}", today);
  try {
    const card = currentProvider() === "gemini"
      ? await callGemini(key, prompt)
      : await callGroq(key, prompt);
    const piece = { ...card, image: currentImage, created: Date.now() };
    const list = pieces();
    list.unshift(piece);
    savePieces(list);
    exhibitEl.hidden = false;
    exhibitEl.innerHTML = plaqueHtml(piece);
    exhibitEl.onclick = () => openPiece(0);
    statusEl.textContent = "Ingresada. Toca la ficha para ver y compartir.";
  } catch (err) {
    statusEl.textContent = "No se pudo archivar: " + err.message;
  } finally {
    generateEl.disabled = false;
  }
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
renderGallery();
