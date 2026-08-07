# waypoint · web_classes

> **Biblioteca de aprendizaje estática, bilingüe (ES/EN) · A bilingual static learning library**
> 100% estática · sin frameworks · sin build — _100% static · no frameworks · no build_

> 🔗 **Página publicada / Live site:** <https://somaxb.github.io/waypoint_web_classes/>

Aprende por proyectos de 42. Cada clase es una transcripción didáctica bilingüe con
predicciones, ejercicios, defensa y criterio de finalización; el progreso se guarda en tu navegador (`localStorage`).

_Learn through 42 projects. Each class is a bilingual (ES/EN) didactic transcription with
predictions, exercises, a defense, and a completion criterion; progress is stored in your
browser (`localStorage`)._

---

## Índice / Contents

- [¿Qué es? / What it is](#qué-es--what-it-is)
- [Organización / Organization](#organización--organization)
- [Empezar / Getting started](#empezar--getting-started)
- [Aportar / Contributing](#aportar--contributing)
- [Licencia / License](#licencia--license)

---

## ¿Qué es? / What it is

**ES** — Un repositorio de guías de estudio derivadas de subjects de 42. La Biblioteca
(`index.html`) agrupa **proyectos** y **conceptos** con búsqueda y filtros. Todo el
contenido didáctico es frontal estático servido por GitHub Pages, sin servidor ni build.

**EN** — A static set of study guides derived from 42 subjects. The **Library**
(`index.html`) groups **projects** and **concepts** with search and filter chips. All
didactic content is static front-end served by GitHub Pages, with no server or build step.

---

## Organización / Organization

```
.
├── index.html               # Biblioteca (grid) · The Library grid
├── <proyecto>.html          # Página de proyecto · Project page
├── <concepto>.html          # Página de concepto · Concept page
├── clases/<proyecto>/       # Clases publicadas · Published classes (ES/EN)
│   ├── clase-NN.html
│   └── glosario.html        # Glosario bilingüe · Bilingual glossary
├── proyectos/<proyecto>/    # Material crudo · Raw project material
│   ├── en.subject.pdf       # Subject oficial · Official subject
│   ├── AGENTS.md            # Agente del proyecto · Project agent/notes
│   ├── GUIA_<PROYECTO>.md   # Itinerario ES · Learning roadmap (ES)
│   ├── GLOSARIO_<PROYECTO>.md # Glosario de referencia · Reference glossary
│   └── clases/clase-NN.md   # Borradores ES · Drafts (Spanish)
├── conceptos/<concepto>/    # Conceptos · Concepts (sin subject.pdf)
├── css/styles.css           # Estilos · Styles
└── js/                       # main.js (progreso/filtros) · i18n.js (ES/EN)
```

**ES — Reglas de oro:** el material crudo vive bajo `proyectos/` o `conceptos/`; los `AGENTS.md`
y la **plantilla canónica** definida en ellos son la fuente de verdad del formato. Todo lo
publicado es bilingüe (ES/EN) con el mismo contenido en cada idioma.

**EN — Golden rules:** raw material lives under `proyectos/` or `conceptos/`; the `AGENTS.md`
files and the **canonical template** they define are the source of truth for the format.
Everything published is bilingual (ES/EN) with the same content in each language.

## Empezar / Getting started

- **ES — Como estudiante:** abre `index.html` (o la página publicada), entra a un
  proyecto, y en cada clase resuelve las **predicciones y ejercicios** antes de abrir la
  solución. Marca las clases completadas; se guardan en tu navegador.
- **EN — As a student:** open `index.html` (or the live site), open a project, and in each
  lesson solve the **predictions and exercises** before revealing the answer. Mark lessons
  as completed; they are saved in your browser.

- **ES — Como colaborador:** lee [`CONTRIBUTING.md`](CONTRIBUTING.md) para el flujo
  completo (sesión → borrador → publicación → índices) y las convenciones de formato.
- **EN — As a contributor:** read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full flow
  (session → draft → publication → indexes) and the format conventions.

## Aportar / Contributing

- **ES:** Aporta un **proyecto nuevo**, un **concepto**, o corrige un **typo/bug**. Usa las
  [plantillas de issue](.github/ISSUE_TEMPLATE/) y abre un *pull request* siguiendo la
  plantilla [`pull_request_template.md`](.github/pull_request_template.md). Todo debe ir
  bilingüe (ES/EN). Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **EN:** Contribute a **new project**, a **concept**, or fix a **bug/typo**. Use the
  [issue templates](.github/ISSUE_TEMPLATE/) and open a pull request using the
  [`pull_request_template.md`](.github/pull_request_template.md). Everything must be
  bilingual (ES/EN). See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licencia / License

- **ES:** Contenido didáctico bajo **Creative Commons Attribution-ShareAlike 4.0
  International** ([CC BY-SA 4.0](LICENSE)). Reuso permitido con atribución; derivadas
  deben mantener la misma licencia.
- **EN:** Didactic content is licensed under **Creative Commons Attribution-ShareAlike 4.0
  International** ([CC BY-SA 4.0](LICENSE)). Reuse with attribution; derivatives must
  remain under the same license.

> ℹ️ **Subjects de 42 / 42 subjects** — Los PDFs `en.subject.pdf` son propiedad de
> **42** (École 42) y se distribuyen aquí con fines educativos; cada proyecto es
> responsable de la licencia de su propio subject. _The `en.subject.pdf` files are property
> of 42 and are distributed here for educational purposes._