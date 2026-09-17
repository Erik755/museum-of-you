const KEY = "moy_groq_key";
const MODEL = "moy_model";
const OWNER = "moy_owner";
const PROMPT = "moy_prompt";
const DB = "moy_pieces";

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
  "descripcion": "2 o 3 frases curatoriales solemnes y específicas de LO QUE SE VE en la foto",
  "importancia": número entero del 1 al 100, normalmente bajo (1-25) salvo que el objeto sea extraño,
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

let currentImage = "";
let taps = 0;
let tapTimer = 0;

apiKeyEl.value = localStorage.getItem(KEY) || "";
modelEl.value = localStorage.getItem(MODEL) || "qwen/qwen3.6-27b";
ownerEl.value = localStorage.getItem(OWNER) || "";
promptEl.value = localStorage.getItem(PROMPT) || DEFAULT_PROMPT;

if (new URLSearchParams(location.search).get("curador") === "1") {
  setupEl.classList.remove("hidden");
}

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

$("saveSetup").onclick = () => {
  localStorage.setItem(KEY, apiKeyEl.value.trim());
  localStorage.setItem(MODEL, modelEl.value);
  localStorage.setItem(OWNER, ownerEl.value.trim());
  localStorage.setItem(PROMPT, promptEl.value);
  $("setupStatus").textContent = "Guardado solo en este teléfono. No está en GitHub.";
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

function renderGallery() {
  const list = pieces();
  countEl.textContent = list.length + (list.length === 1 ? " pieza" : " piezas");
  galleryEl.innerHTML = list.map((p, i) => `
    <article class="card">
      <img src="${p.image}" alt="" />
      <p>${escapeHtml(p.titulo || p.title || "Sin título")}</p>
      <button type="button" data-i="${i}" class="ghost del">Quitar</button>
    </article>
  `).join("") || "<p class='tiny'>Aún no hay patrimonio.</p>";
  galleryEl.querySelectorAll(".del").forEach((btn) => {
    btn.onclick = () => {
      const list2 = pieces();
      list2.splice(Number(btn.dataset.i), 1);
      savePieces(list2);
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
      let w = img.width;
      let h = img.height;
      if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
      else if (h > max) { w = Math.round(w * max / h); h = max; }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
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
    statusEl.textContent = "En este teléfono no hay key. Toca 5 veces el título para configurar.";
    return;
  }
  if (!currentImage) return;

  generateEl.disabled = true;
  statusEl.textContent = "El curador está examinando la pieza...";

  const owner = ownerEl.value.trim() || localStorage.getItem(OWNER) || "un habitante anónimo";
  const today = new Date().toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const prompt = (promptEl.value || DEFAULT_PROMPT)
    .replaceAll("{{owner}}", owner)
    .replaceAll("{{fecha}}", today);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key
      },
      body: JSON.stringify({
        model: modelEl.value,
        temperature: 0.8,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: currentImage } }
            ]
          }
        ]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Error de Groq: " + res.status);
    }

    const raw = data.choices?.[0]?.message?.content || "";
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const card = JSON.parse(jsonText);
    const piece = { ...card, image: currentImage, created: Date.now() };
    const list = pieces();
    list.unshift(piece);
    savePieces(list);
    showExhibit(piece);
    statusEl.textContent = "Ingresada a la colección.";
  } catch (err) {
    statusEl.textContent = "No se pudo archivar: " + err.message;
  } finally {
    generateEl.disabled = false;
  }
}

function showExhibit(p) {
  exhibitEl.hidden = false;
  exhibitEl.innerHTML = `
    <img src="${p.image}" alt="" />
    <p class="meta">${escapeHtml(p.fecha || "")}</p>
    <h3>${escapeHtml(p.titulo || "")}</h3>
    <p class="meta">${escapeHtml(p.periodo || "")} · ${escapeHtml(p.ubicacion || "")}</p>
    <p class="desc">${escapeHtml(p.descripcion || "")}</p>
    <p class="score">Importancia histórica: ${escapeHtml(String(p.importancia ?? "?"))}/100</p>
  `;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

renderGallery();
