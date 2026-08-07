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

  /* ---------- GitHub: star + view source en el header ---------- */
  var GH_REPO = "SoMaxB/waypoint_web_classes";

  function initGitHub() {
    var actions = document.querySelector(".header-actions");
    if (!actions || actions.querySelector(".gh-source")) return;

    var from = document.createElement("a");
    from.className = "gh-link gh-source";
    from.href = "https://github.com/" + GH_REPO;
    from.target = "_blank";
    from.rel = "noopener noreferrer";
    from.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>' +
      '<span data-i18n="gh.source">Source</span>';
    actions.insertBefore(from, actions.firstChild);

    var star = document.createElement("a");
    star.className = "gh-link gh-star";
    star.href = "https://github.com/" + GH_REPO + "/stargazers";
    star.target = "_blank";
    star.rel = "noopener noreferrer";
    star.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>' +
      '<span data-i18n="gh.star">Star</span>' +
      '<span class="gh-count" title="stars">0</span>';
    actions.insertBefore(star, actions.firstChild);

    try {
      fetch("https://api.github.com/repos/" + GH_REPO)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          var n = data && typeof data.stargazers_count === "number" ? data.stargazers_count : 0;
          function fmt(c) {
            return c >= 1000 ? (c / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(c);
          }
          star.querySelector(".gh-count").textContent = fmt(n);
        })
        .catch(function () { /* silencioso */ });
    } catch (e) {}

    if (window.WC_I18N) window.WC_I18N.apply();
  }

  function init() {
    sortCards();
    initGridFilters();
    initCompleteToggles();
    initChecklists();
    initProgress();
    initGitHub();
    document.addEventListener("wc:langchange", initProgress);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
