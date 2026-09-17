const KEY = "moy_groq_key";
const MODEL = "moy_model";
const OWNER = "moy_owner";
const PROMPT = "moy_prompt";
const DB = "moy_pieces";
const FRAMES = ["frame-oro", "frame-barroco", "frame-negro", "frame-plata", "frame-madera", "frame-museo"];

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

apiKeyEl.value = localStorage.getItem(KEY) || "";
modelEl.value = localStorage.getItem(MODEL) || "qwen/qwen3.6-27b";
ownerEl.value = localStorage.getItem(OWNER) || "";
promptEl.value = localStorage.getItem(PROMPT) || DEFAULT_PROMPT;

if (new URLSearchParams(location.search).get("curador") === "1") {
  setupEl.classList.remove("hidden");
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

if (isStandalone()) installBtn.classList.add("hidden");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});

installBtn.onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const res = await deferredPrompt.userChoice;
    installHint.textContent = res.outcome === "accepted" ? "Instalada en tu pantalla." : "Cancelado.";
    if (res.outcome === "accepted") installBtn.classList.add("hidden");
    deferredPrompt = null;
    return;
  }
  if (isIOS()) {
    installHint.textContent = "iPhone: botón Compartir → Añadir a pantalla de inicio.";
    return;
  }
  installHint.textContent = "Chrome Android: menú ⋮ → Instalar aplicación. Si no sale, abre el sitio en Chrome (no Instagram ni Grok).";
};

window.addEventListener("appinstalled", () => {
  installBtn.classList.add("hidden");
  installHint.textContent = "Instalada.";
});

$("titleTap").onclick = () => {
  clearTimeout(tapTimer);
  taps += 1;
  tapTimer = setTimeout(() => { taps = 0; }, 1400);
  if (taps >= 5) {
    taps = 0;
    setupEl.classList.remove("hidden");
  }
};

$("hideSetup").onclick = () => setupEl.classList.add("hidden");
$("closeLb").onclick = () => lightbox.classList.add("hidden");
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.add("hidden");
});

$("saveSetup").onclick = () => {
  localStorage.setItem(KEY, apiKeyEl.value.trim());
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
function frameClass(p, i) {
  return p.marco && FRAMES.includes(p.marco) ? p.marco : FRAMES[i % FRAMES.length];
}
function shortDesc(t) {
  const words = String(t || "").trim().split(/\s+/);
  if (words.length <= 20) return t || "";
  return words.slice(0, 18).join(" ") + ".";
}
function plaqueHtml(p) {
  const fr = frameClass(p, 0);
  return `
    <div class="frame ${fr}"><img src="${p.image}" alt="" /></div>
    <div class="plaque">
      <p class="meta">${escapeHtml(p.fecha || "")}</p>
      <h3>${escapeHtml(p.titulo || "")}</h3>
      <p class="meta">${escapeHtml(p.periodo || "")} · ${escapeHtml(p.ubicacion || "")}</p>
      <p class="desc">${escapeHtml(shortDesc(p.descripcion || ""))}</p>
      <p class="score">Importancia histórica: ${escapeHtml(String(p.importancia ?? "?"))}/100</p>
    </div>`;
}
function openPiece(i) {
  const list = pieces();
  const p = list[i];
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
  const w = 1080;
  const h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3f1ec";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#c45c4a";
  ctx.fillRect(0, 0, w, 18);
  const box = 72;
  ctx.fillStyle = "#1a1814";
  ctx.fillRect(box - 16, 70, w - 2 * (box - 16), 720);
  const ratio = Math.min((w - 2 * box) / img.width, 680 / img.height);
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  ctx.drawImage(img, (w - iw) / 2, 90, iw, ih);
  ctx.fillStyle = "#1a1814";
  ctx.font = "28px Georgia";
  wrap(ctx, (p.titulo || "SIN TÍTULO").toUpperCase(), box, 860, w - 2 * box, 34);
  ctx.font = "22px Georgia";
  wrap(ctx, shortDesc(p.descripcion || ""), box, 980, w - 2 * box, 30);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#5c5850";
  ctx.fillText(`Importancia ${p.importancia ?? "?"}/100  ·  The Museum of You`, box, 1280);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  return new File([blob], "museum-of-you.jpg", { type: "image/jpeg" });
}
function wrap(ctx, text, x, y, maxW, lineH) {
  const words = String(text).split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = test;
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
      if (navigator.canShare && !navigator.canShare(data)) {
        await navigator.share({ title: data.title, text: data.text });
      } else {
        await navigator.share(data);
      }
    } else {
      await downloadFile(file);
    }
  } catch (err) {
    if (String(err.name) !== "AbortError") installHint.textContent = "No se pudo compartir: " + err.message;
  }
};
$("downloadBtn").onclick = async () => {
  const p = pieces()[openIndex];
  if (!p) return;
  const file = await pieceFile(p);
  await downloadFile(file);
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
      <div class="frame ${frameClass(p, i)}"><img src="${p.image}" alt="" /></div>
      <p>${escapeHtml(p.titulo || "Sin título")}</p>
      <button type="button" class="ghost open-mini" data-open="${i}">Ver / compartir</button>
    </article>
  `).join("") || "<p class='tiny'>Aún no hay patrimonio.</p>";
  galleryEl.querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = (ev) => {
      ev.stopPropagation();
      openPiece(Number(el.dataset.open));
    };
  });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
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
async function archivePiece() {
  const key = (apiKeyEl.value || localStorage.getItem(KEY) || "").trim();
  if (!key) {
    statusEl.textContent = "Toca 5 veces el título para configurar la key.";
    return;
  }
  if (!currentImage) return;
  generateEl.disabled = true;
  statusEl.textContent = "El curador está examinando la pieza...";
  const owner = ownerEl.value.trim() || localStorage.getItem(OWNER) || "un habitante anónimo";
  const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const prompt = (promptEl.value || DEFAULT_PROMPT).replaceAll("{{owner}}", owner).replaceAll("{{fecha}}", today);
  try {
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
    const raw = data.choices?.[0]?.message?.content || "";
    const card = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const piece = { ...card, image: currentImage, created: Date.now(), marco: FRAMES[pieces().length % FRAMES.length] };
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
