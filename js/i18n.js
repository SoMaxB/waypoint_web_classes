/* ============================================================
   web_classes — i18n ES/EN
   Interfaz bilingüe sin build: diccionario + toggle + persistencia.
   El contenido de cada página se alterna con secciones [lang].
   ============================================================ */
(function () {
  "use strict";

  const KEY = "wc-lang";
  const DEFAULT_LANG = "es";

  const DICT = {
    es: {
      "nav.home": "Inicio",
      "search.ph": "Buscar…",
      "lang": "EN",
      "hero.kicker": "web_classes · estudio por proyectos",
      "hero.title": "Aprende por proyectos",
      "hero.sub": "Toma cada clase, resuelve los ejercicios antes de mirar la solución y defiende lo aprendido.",
      "grid.title": "Biblioteca",
      "filter.projects": "Proyectos",
      "filter.concepts": "Conceptos",
      "badge.concept": "Concepto",
      "search.none": "Sin resultados para esa búsqueda.",
      "p.libasm.name": "Libasm",
      "p.libasm.desc": "Ensamblador x86-64 desde cero: memoria, registros, la ABI System V y tus primeras funciones en NASM.",
      "p.inception_of_things.name": "Inception of Things",
      "p.inception_of_things.desc": "Infraestructura reproducible: Vagrant, K3s, Kubernetes, Argo CD y GitOps.",
      "p.ft_ping.name": "ft_ping",
      "p.ft_ping.desc": "Recodifica el comando ping: sockets raw, ICMP Echo, RTT y estadísticas.",
      "p.music.name": "Music Room",
      "p.music.desc": "Un reproductor de música en el navegador.",
      "p.redtetris.name": "Red Tetris",
      "p.redtetris.desc": "Tetris multijugador sobre websockets.",
      "p.scop.name": "Scop",
      "p.scop.desc": "Un renderizador 3D con OpenGL y shaders.",
      "p.woody.name": "Woody Woodpacker",
      "p.woody.desc": "Un empaquetador de ejecutables ELF.",
      "p.semaforos.name": "Semáforos en C",
      "p.semaforos.desc": "Sincronización de hilos con semáforos POSIX: secciones críticas, atomicidad y productor-consumidor.",
      "p.sockets.name": "Sockets",
      "p.sockets.desc": "Redes desde el API de Berkeley: socket, bind, listen, accept y comunicación cliente-servidor.",
      "p.pthreads.name": "POSIX Threads",
      "p.pthreads.desc": "Concurrencia con pthreads: creación de hilos, carreras, mutex, variables de condición y join.",
      "proj.active": "Activo",
      "proj.coming": "Próximamente",
      "proj.classes": "clases",
      "proj.ogloss": "glosario",
      "proj.view": "Entrar al proyecto",
      "proj.viewconcept": "Entrar al concepto",
      "proj.viewlater": "Próximamente",
      "proj.completed": "completada",
      "proj.progress": "progreso",
      "proj.progressLabel": "{{done}} de {{total}} clases",
      "btn.complete": "Marcar clase como completada",
      "btn.completed": "Clase completada",
      "back.project": "Volver al proyecto",
      "prev.class": "Clase anterior",
      "next.class": "Siguiente clase",
      "gloss": "Glosario",
      "classes.title": "Clases",
      "obj": "Objetivo",
      "errors": "Errores frecuentes",
      "defense": "Preguntas de defensa",
      "learned": "Has aprendido que",
      "done": "Criterio de finalización",
      "exercise": "Ejercicio",
      "answer": "Mostrar solución",
      "nextclass": "Siguiente clase",
      "status.coming": "En preparación",
      "breadcrumb.home": "Inicio",
      "footer": "100% estática, sin frameworks, sin build."
    },
    en: {
      "nav.home": "Home",
      "search.ph": "Search…",
      "lang": "ES",
      "hero.kicker": "web_classes · learning by projects",
      "hero.title": "Learn by projects",
      "hero.sub": "Take each class, solve the exercises before peeking at the answer, and defend what you learned.",
      "grid.title": "Library",
      "filter.projects": "Projects",
      "filter.concepts": "Concepts",
      "badge.concept": "Concept",
      "search.none": "No results for that search.",
      "p.libasm.name": "Libasm",
      "p.libasm.desc": "x86-64 assembly from scratch: memory, registers, the System V ABI, and your first NASM functions.",
      "p.inception_of_things.name": "Inception of Things",
      "p.inception_of_things.desc": "Reproducible infrastructure: Vagrant, K3s, Kubernetes, Argo CD and GitOps.",
      "p.music.name": "Music Room",
      "p.music.desc": "A music player in the browser.",
      "p.ft_ping.name": "ft_ping",
      "p.ft_ping.desc": "Recode the ping command: raw sockets, ICMP Echo, RTT and statistics.",
      "p.redtetris.name": "Red Tetris",
      "p.redtetris.desc": "Multiplayer Tetris over websockets.",
      "p.scop.name": "Scop",
      "p.scop.desc": "A 3D renderer with OpenGL and shaders.",
      "p.woody.name": "Woody Woodpacker",
      "p.woody.desc": "An ELF executable packer.",
      "p.semaforos.name": "Semaphores in C",
      "p.semaforos.desc": "Thread synchronization with POSIX semaphores: critical sections, atomicity and producer-consumer.",
      "p.sockets.name": "Sockets",
      "p.sockets.desc": "Networking from the Berkeley API: socket, bind, listen, accept and client-server communication.",
      "p.pthreads.name": "POSIX Threads",
      "p.pthreads.desc": "Concurrency with pthreads: thread creation, races, mutex, condition variables and join.",
      "proj.active": "Active",
      "proj.coming": "Coming soon",
      "proj.classes": "classes",
      "proj.ogloss": "glossary",
      "proj.view": "Open project",
      "proj.viewconcept": "Open concept",
      "proj.viewlater": "Coming soon",
      "proj.completed": "completed",
      "proj.progress": "progress",
      "proj.progressLabel": "{{done}} of {{total}} classes",
      "btn.complete": "Mark class as completed",
      "btn.completed": "Class completed",
      "back.project": "Back to project",
      "prev.class": "Previous class",
      "next.class": "Next class",
      "gloss": "Glossary",
      "classes.title": "Classes",
      "obj": "Objective",
      "errors": "Common mistakes",
      "defense": "Defense questions",
      "learned": "You have learned that",
      "done": "Completion criteria",
      "exercise": "Exercise",
      "answer": "Show answer",
      "nextclass": "Next class",
      "status.coming": "In preparation",
      "breadcrumb.home": "Home",
      "footer": "100% static, no frameworks, no build."
    }
  };

  function current() {
    const s = localStorage.getItem(KEY);
    return s === "es" || s === "en" ? s : DEFAULT_LANG;
  }

  function other() {
    return current() === "es" ? "en" : "es";
  }

  function t(key, vars) {
    let v = DICT[current()][key];
    if (v === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        v = v.replace("{{" + k + "}}", vars[k]);
      });
    }
    return v;
  }

  function apply() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const v = t(el.getAttribute("data-i18n"));
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      const v = t(el.getAttribute("data-i18n-ph"));
      if (v !== undefined) el.setAttribute("placeholder", v);
    });
    const toggle = document.getElementById("lang-toggle");
    if (toggle) toggle.textContent = t("lang");
  }

  function setLang(lang) {
    localStorage.setItem(KEY, lang === "en" ? "en" : "es");
    document.documentElement.lang = current();
    apply();
    document.dispatchEvent(new CustomEvent("wc:langchange", { detail: { lang: current() } }));
  }

  function init() {
    document.documentElement.lang = current();
    apply();
    const toggle = document.getElementById("lang-toggle");
    if (toggle) toggle.addEventListener("click", function () { setLang(other()); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.WC_I18N = { current: current, other: other, t: t, apply: apply, setLang: setLang };
})();
