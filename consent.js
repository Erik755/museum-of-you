// Consentimiento explícito antes de enviar una foto al servicio de IA (se recuerda en localStorage).
(function () {
  var KEY = "moy_ai_consent";
  var VERSION = "2026-09-29";
  var POLICY = "https://extreme-solutions-eosin.vercel.app/privacidad#museum";

  function granted() {
    try { return localStorage.getItem(KEY) === VERSION; } catch (e) { return false; }
  }
  function remember() {
    try { localStorage.setItem(KEY, VERSION); } catch (e) { /* Sin almacenamiento: se volverá a preguntar. */ }
  }

  function buildDialog() {
    var dialog = document.createElement("dialog");
    dialog.id = "consentDialog";
    dialog.className = "consent-dialog";
    dialog.setAttribute("aria-labelledby", "consentTitle");
    dialog.innerHTML =
      '<h2 id="consentTitle">Antes de archivar tu foto</h2>' +
      "<p>Para escribir la ficha, tu foto reducida, el nombre de artista y la fecha se envían a un servicio de inteligencia artificial: " +
      "<strong>Google Gemini en su nivel gratuito</strong> (o Groq, si lo eliges en los ajustes). Desde la UE/EEE, Suiza y Reino Unido no se usa Gemini.</p>" +
      "<ul>" +
      "<li>En el nivel gratuito, <strong>Google puede usar el contenido para mejorar sus servicios y puede ser revisado por personas</strong>.</li>" +
      "<li><strong>No subas fotos sensibles</strong> (documentos, salud, menores) <strong>ni de otras personas sin su permiso</strong>.</li>" +
      "<li>Tu museo se guarda solo en este dispositivo. Uso para mayores de 18 años.</li>" +
      "</ul>" +
      '<p><a href="' + POLICY + '" target="_blank" rel="noopener noreferrer">Leer el aviso de privacidad</a></p>' +
      '<div class="consent-actions">' +
      '<button type="button" id="consentAccept">Acepto y archivar</button>' +
      '<button type="button" id="consentCancel" class="ghost">Cancelar</button>' +
      "</div>";
    document.body.appendChild(dialog);
    return dialog;
  }

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("#generate") : null;
    if (!button || button.disabled || granted()) return;
    event.preventDefault();
    event.stopPropagation();
    var dialog = document.getElementById("consentDialog") || buildDialog();
    dialog.querySelector("#consentAccept").onclick = function () {
      remember();
      dialog.close();
      button.click();
    };
    dialog.querySelector("#consentCancel").onclick = function () { dialog.close(); };
    if (typeof dialog.showModal === "function") dialog.showModal();
    else if (window.confirm("Tu foto se enviará a Google Gemini (nivel gratuito), que puede usarla para mejorar sus servicios y revisarla con personas. No subas fotos sensibles ni de terceros sin permiso. ¿Aceptas?")) { remember(); button.click(); }
  }, true);
})();
