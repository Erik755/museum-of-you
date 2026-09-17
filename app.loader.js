/* museum-of-you loader — concatenates app.part*.txt then runs */
(async function () {
  const parts = ['app.part0.txt', 'app.part1.txt', 'app.part2.txt', 'app.part3.txt'];
  try {
    const texts = await Promise.all(parts.map((p) => fetch("./" + p + "?v=12").then((r) => {
      if (!r.ok) throw new Error("part " + p + " " + r.status);
      return r.text();
    })));
    const code = texts.join("");
    (0, eval)(code);
  } catch (err) {
    const el = document.getElementById("status");
    if (el) el.textContent = "Error al cargar app: " + (err && err.message ? err.message : err);
    console.error(err);
  }
})();
