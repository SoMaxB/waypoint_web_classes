/* ============================================================
   web_classes — interacción (JS vanilla, sin dependencias)
   · Búsqueda/filtro client-side del grid de proyectos
   · Marcar clases como completadas (localStorage) + progreso
   · Items de verificación persistidos (preguntas de defensa, criterios)
   ============================================================ */
(function () {
  "use strict";

  var DONE_KEY = "wc-done-";

  function doneKey(project, slug) {
    return DONE_KEY + project + "/" + slug;
  }

  function isDone(project, slug) {
    try { return localStorage.getItem(doneKey(project, slug)) === "1"; } catch (e) { return false; }
  }

  function setDone(project, slug, on) {
    try {
      if (on) localStorage.setItem(doneKey(project, slug), "1");
      else localStorage.removeItem(doneKey(project, slug));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function classesFor(project) {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(DONE_KEY + project + "/") === 0) out.push(k);
    }
    return out.length;
  }

  /* ---------- Filtros del grid (búsqueda + categorías) ----------
     Un card se muestra si pasa la búsqueda Y su categoría está activa.
     Los chips de categoría se persisten en localStorage. */
  var FILTERS_KEY = "wc-grid-filters";

  function initGridFilters() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".grid .card"));
    if (!cards.length) return;
    var none = document.getElementById("search-none");
    var count = document.getElementById("grid-count");
    var input = document.getElementById("site-search");
    var checks = Array.prototype.slice.call(
      document.querySelectorAll(".grid-filters input[data-kind-filter]")
    );

    function apply() {
      var q = (input && input.value.trim().toLowerCase()) || "";
      var visible = 0;
      cards.forEach(function (card) {
        var hay = (card.dataset.name || "") + " " + (card.dataset.tags || "");
        var match = q === "" || hay.toLowerCase().indexOf(q) !== -1;
        var kind = card.dataset.kind || "proyecto";
        var cb = checks.find(function (c) { return c.getAttribute("data-kind-filter") === kind; });
        var kindOk = !cb || cb.checked;
        var show = match && kindOk;
        card.classList.toggle("hidden", !show);
        if (show) visible++;
      });
      if (count) count.textContent = visible;
      if (none) none.classList.toggle("hidden", visible !== 0);
    }

    function save() {
      var state = {};
      checks.forEach(function (cb) { state[cb.getAttribute("data-kind-filter")] = cb.checked; });
      try { localStorage.setItem(FILTERS_KEY, JSON.stringify(state)); } catch (e) {}
    }

    try {
      var saved = JSON.parse(localStorage.getItem(FILTERS_KEY) || "{}");
      checks.forEach(function (cb) {
        var k = cb.getAttribute("data-kind-filter");
        if (typeof saved[k] === "boolean") cb.checked = saved[k];
      });
    } catch (e) {}

    checks.forEach(function (cb) {
      cb.addEventListener("change", function () { save(); apply(); });
    });
    if (input) input.addEventListener("input", apply);
    apply();
  }

  /* ---------- Orden alfabético del grid ----------
     Reordena las cards por data-name y reasigna --i para que la
     animación de entrada mantenga el escalonado. */
  function sortCards() {
    var grid = document.querySelector(".grid");
    if (!grid) return;
    var children = Array.prototype.slice.call(grid.children);
    var cards = children.filter(function (el) {
      return el.classList && el.classList.contains("card");
    });
    var rest = children.filter(function (el) {
      return !el.classList || !el.classList.contains("card");
    });
    cards.sort(function (a, b) {
      return (a.dataset.name || "").localeCompare(b.dataset.name || "", "es");
    });
    cards.forEach(function (card, i) { card.style.setProperty("--i", i); });
    cards.forEach(function (card) { grid.appendChild(card); });
    rest.forEach(function (el) { grid.appendChild(el); });
  }

  /* ---------- Progreso de proyectos (index + proyecto) ---------- */
  function initProgress() {
    document.querySelectorAll("[data-project]").forEach(function (el) {
      var project = el.getAttribute("data-project");
      var total = parseInt(el.getAttribute("data-total") || "0", 10);
      var done = classesFor(project);
      if (el.hasAttribute("data-progress-fill")) {
        el.setAttribute("style", "width:" + Math.round((total ? done / total : 0) * 100) + "%");
      }
      if (el.hasAttribute("data-progress-label")) {
        var t = window.WC_I18N.t;
        el.textContent = t("proj.progressLabel", { done: done, total: total });
      }
    });
  }

  /* ---------- Toggle de clase completada ----------
     data-complete="proyecto/slug" → clave wc-done-proyecto/slug */
  function initCompleteToggles() {
    document.querySelectorAll("[data-complete]").forEach(function (cb) {
      var ref = cb.getAttribute("data-complete");
      var parts = ref.split("/");
      var project = parts[0], slug = parts[1];
      var on = isDone(project, slug);
      cb.checked = on;
      cb.closest(".complete-toggle")?.toggleAttribute("data-on", on);
      var status = document.querySelector('[data-status-for="' + ref + '"]');
      if (status) {
        var t = window.WC_I18N.t;
        status.textContent = on ? t("btn.completed") : t("btn.complete");
        status.closest(".class-row")?.classList.toggle("done", on);
      }
      cb.addEventListener("change", function () {
        var checked = cb.checked;
        setDone(project, slug, checked);
        cb.closest(".complete-toggle")?.toggleAttribute("data-on", checked);
        if (status) {
          var t = window.WC_I18N.t;
          status.textContent = checked ? t("btn.completed") : t("btn.complete");
          status.closest(".class-row")?.classList.toggle("done", checked);
        }
        initProgress();
      });
    });
  }

  /* ---------- Items de verificación persistidos ---------- */
  function initChecklists() {
    var chks = document.querySelectorAll(".chk input");
    if (!chks.length) return;
    var pageKey = "wc-chk-" + (document.body.dataset.class || "page");
    chks.forEach(function (input) {
      var id = input.getAttribute("data-id");
      if (!id) return;
      var saved = false;
      try { saved = localStorage.getItem(pageKey + ":" + id) === "1"; } catch (e) {}
      input.checked = saved;
      input.closest(".chk")?.classList.toggle("done", saved);
      input.addEventListener("change", function () {
        input.closest(".chk")?.classList.toggle("done", input.checked);
        try {
          if (input.checked) localStorage.setItem(pageKey + ":" + id, "1");
          else localStorage.removeItem(pageKey + ":" + id);
        } catch (e) {}
      });
    });
  }

  function init() {
    sortCards();
    initGridFilters();
    initCompleteToggles();
    initChecklists();
    initProgress();
    document.addEventListener("wc:langchange", initProgress);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
