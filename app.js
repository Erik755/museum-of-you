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

if (isStandalone()) {
  installBtn.classList.add("hidden");
} else {
  installBtn.classList.remove("hidden");
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
  installHint.textContent = "";
});

installBtn.onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const res = await deferredPrompt.userChoice;
    if (res.outcome === "accepted") {
      installBtn.classList.add("hidden");
      installHint.textContent = "Listo. Ya está en tu pantalla de inicio.";
    }
    deferredPrompt = null;
    return;
  }
  if (isIOS()) {
    installHint.textContent = "En iPhone: Compartir → Añadir a pantalla de inicio.";
    return;
  }
  installHint.textContent = "En Chrome: menú ⋮ → Instalar aplicación o Añadir a pantalla de inicio.";
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
function plaqueHtml(p, i, withButton) {
  const fr = frameClass(p, i);
  return `
    <div class="frame ${fr}"><img src="${p.image}" alt="" /></div>
    <div class="plaque">
      <p class="meta">${escapeHtml(p.fecha || "")}</p>
      <h3>${escapeHtml(p.titulo || "")}</h3>
      <p class="meta">${escapeHtml(p.periodo || "")} · ${escapeHtml(p.ubicacion || "")}</p>
      <p class="desc">${escapeHtml(shortDesc(p.descripcion || ""))}</p>
      <p class="score">Importancia histórica: ${escapeHtml(String(p.importancia ?? "?"))}/100</p>
      ${withButton ? `<button type="button" class="ghost del" data-i="${i}">Quitar</button>` : ""}
    </div>`;
}
function shortDesc(t) {
  const words = t.trim().split(/\s+/);
  if (words.length <= 20) return t;
  return words.slice(0, 18).join(" ") + ".";
}
function openPiece(i) {
  const list = pieces();
  const p = list[i];
  if (!p) return;
  lbInner.innerHTML = plaqueHtml(p, i, false);
  lightbox.classList.remove("hidden");
}
function renderGallery() {
  const list = pieces();
  countEl.textContent = list.length + (list.length === 1 ? " pieza" : " piezas");
  galleryEl.innerHTML = list.map((p, i) => `
    <article class="card" data-open="${i}">
      <div class="frame ${frameClass(p, i)}"><img src="${p.image}" alt="" /></div>
      <p>${escapeHtml(p.titulo || "Sin título")}</p>
    </article>
  `).join("") || "<p class='tiny'>Aún no hay patrimonio.</p>";
  galleryEl.querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = () => openPiece(Number(el.dataset.open));
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
    const piece = {
      ...card,
      image: currentImage,
      created: Date.now(),
      marco: FRAMES[pieces().length % FRAMES.length]
    };
    const list = pieces();
    list.unshift(piece);
    savePieces(list);
    exhibitEl.hidden = false;
    exhibitEl.innerHTML = plaqueHtml(piece, 0, false);
    exhibitEl.onclick = () => openPiece(0);
    statusEl.textContent = "Ingresada a la colección. Toca la ficha para ampliar.";
  } catch (err) {
    statusEl.textContent = "No se pudo archivar: " + err.message;
  } finally {
    generateEl.disabled = false;
  }
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
renderGallery();
