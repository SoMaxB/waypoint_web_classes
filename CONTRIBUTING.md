# Contributing · Contribuir

> **ES** — Todo en este repositorio es **bilingüe (ES/EN)**. Cualquier texto que añadas o
> edites (guías, clases, glosarios, plantillas, este documento) debe tener el mismo
> contenido en español e inglés. Los nombres de convención (`AGENTS.md`, plantillas) se
> documentan en [`AGENTS.md`](AGENTS.md); las reglas de este archivo tienen prioridad
> sobre convenciones no documentadas.
>
> **EN** — Everything in this repository is **bilingual (ES/EN)**. Any text you add or edit
> (guides, classes, glossaries, templates, this one) must carry the same content in Spanish
> and English. Naming conventions are documented in [`AGENTS.md`](AGENTS.md); the rules in
> this file take precedence over undocumented conventions.

---

## Español

### Cómo se construye una clase

Cada clase nace de una **sesión interactiva** (modo enseñanza) y pasa por cuatro pasos fijos:

1. **Sesión (Teaching Mode):** se imparte la clase de forma interactiva con un principiante.
2. **Borrador:** se destila en `proyectos/<proyecto>/clases/clase-NN.md` (o
   `conceptos/<concepto>/clases/clase-NN.md`) usando la **plantilla canónica** (abajo), en
   español y **sin transcribir la conversación verbatim**.
3. **Publicación:** se deriva `clases/<proyecto>/clase-NN.html` **bilingüe**.
4. **Índices:** se actualizan `clases/<proyecto>/index.html` / `clases/<concepto>/index.html` e `index.html`.

El draft (fuente, en español) y el HTML (derivado, bilingüe) son la **misma lección en dos
estados**. La consistencia de estilo se impone en el borrador, no al publicar.

### Estructura de un proyecto / concepto

Todo curso genera, bajo su carpeta:

- `en.subject.pdf` — subject oficial (solo **proyectos**; única fuente normativa).
- `AGENTS.md` — notas/agente del proyecto (solo **proyectos**).
- `GUIA_<NOMBRE>.md` — itinerario de clases (objetivo, conceptos, resultado por clase).
- `GLOSARIO_<NOMBRE>.md` — glosario de referencia en español.
- `clases/clase-NN.md` — borradores en la plantilla canónica.
- Publicado: `clases/<proyecto>/glosario.html` derivado del glosario.

Un **concepto** usa la misma estructura pero **sin `en.subject.pdf`** ni `AGENTS.md` propio: la
guía es su fuente de verdad.

### Plantilla canónica de un borrador

```text
# Clase N: título corto

## Objetivo
Un párrafo con el modelo mental y lo que el alumno debe poder hacer al terminar.

## 1. Sección
(secciones centrales: texto, tablas, bloques de código)
## 2. Sección
...

## Predicciones y ejercicios
Problemas sin solución visible, cada una con <details><summary>Solución</summary>…</details>.

## Errores frecuentes
## Has aprendido que
## Preguntas tipo defensa
## Criterio de finalización
## Siguiente clase
```

Reglas: un archivo por clase (`clase-NN.md`, `NN` en dos dígitos); el orden de las secciones
finales es fijo; las soluciones van dentro de `<details>`; **no inventes comandos de build**
aún no verificados (mira el `AGENTS.md` del proyecto).

### Cómo reportar un bug o typo

Abre un issue con la plantilla [`bug-typo`](.github/ISSUE_TEMPLATE/bug-typo.md), o corrige y
envía un *pull request*. Al publicar contenido, mántenlo bilingüe y con las claves de
progreso consistentes (`data-project`, `data-complete`).

### Cómo proponer un proyecto o concepto nuevo

Abre un issue con la plantilla [`aportar-proyecto`](.github/ISSUE_TEMPLATE/aportar-proyecto.md)
adjuntando el subject y enlazando a tu repo/archivos, y describe el itinerario objetivo. El flujo
es colaborativo: aportas material y se construye la guía sobre él — **no es un push a un botón**.
Si ya tienes borradores en el formato de arriba, se absorben directos.

### Pull requests

- Nombres claros y descripción concisa que relate y cierre un issue.
- **Bilingüe obligatorio** para todo lo publicado.
- Verifica enlaces relativos, clases bilingües completas y claves de progreso consistentes.
- Añade un issue referenciado ("Fixes #N"), si aplica.

### Licencia

Tu aportación queda bajo **CC BY-SA 4.0** (ver [`LICENSE`](LICENSE)). Los `en.subject.pdf`
son propiedad de 42 y se distribuyen con fines educativos.

---

## English

### How a class is built

Each class originates in an interactive **session** (teaching mode) and goes through four fixed steps:

1. **Session (Teaching Mode):** taught interactively to a beginner.
2. **Draft:** distilled into `proyectos/<project>/clases/clase-NN.md` (or
   `conceptos/<concepto>/clases/clase-NN.md`) using the **canonical template** (below), in
   Spanish, **without transcribing the conversation verbatim**.
3. **Publication:** derive the **bilingual** `clases/<project>/clase-NN.html`.
4. **Indexes:** update `clases/<project>/index.html` / `clases/<concept>/index.html` and `index.html`.

The draft (source, Spanish) and the HTML (derived, bilingual) are the **same lesson in two
states**. Style consistency is enforced at creation, in the draft.

### Project / concept structure

Every course keeps under its folder:

- `en.subject.pdf` — official subject (only **projects**; normative source of truth).
- `AGENTS.md` — project agent/notes (only **projects**).
- `GUIA_<NAME>.md` — learning roadmap (objective, concepts, result per class).
- `GLOSARIO_<NAME>.md` — reference glossary in Spanish.
- `clases/clase-NN.md` — drafts in the canonical template.
- Published: `clases/<project>/glosario.html` derived from the glossary.

A **concept** uses the same structure but **without `en.subject.pdf`** and no project
`AGENTS.md`: its guide is the source of truth.

### Canonical template for a draft

See the Spanish section above for the template and the ordering rules document. Drafts are
always authored in Spanish; translation to English happens only at publication time.

Rules: one file per class (`clase-NN.md`, two-digit `NN`); the trailing section order is fixed;
solutions go inside `<details>`; **never invent unverified build commands** — check the
project `AGENTS.md`.

### Reporting a bug / typo

Open an issue with the [`bug-typo`](.github/ISSUE_TEMPLATE/bug-typo.md) template, or fix and
send a pull request. Whichever you choose, keep published content bilingual and keep progress
keys (`data-project`, `data-complete`) consistent.

### Proposing a new project / concept

Open an issue with the [`aportar-proyecto`](.github/ISSUE_TEMPLATE/aportar-proyecto.md)
template, attaching the subject and link to your material/files, and describe the target
roadmap. The flow is collaborative: you bring material and the subject, and a guide is built
upon them (it is not a push-button). If you put drafts following the template above, they are
absorbed and polished.

### Pull requests

- Clear titles and a description that references and closes an issue.
- **Bilingual** for everything published.
- Verify relative links, complete bilingual classes and consistent progress keys.
- Reference the issue backwards (e.g., "Fixes #123") when applicable.

### License

Your contribution falls under **CC BY-SA 4.0** (see [`LICENSE`](LICENSE)). The
`en.subject.pdf` files are the property of 42 and are distributed for educational purposes.