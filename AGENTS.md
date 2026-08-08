# web_classes — Convenciones y flujo de trabajo

## Propósito

Web 100% estática, sin frameworks ni build, con clases interactivas basadas en proyectos de 42. Cada clase es una transcripción didáctica bilingüe (es/en) con predicciones, ejercicios, defensa y criterio de finalización. El progreso se guarda en el navegador (localStorage).

## Estructura del proyecto

- `index.html` — grid de la Biblioteca (portada): proyectos + conceptos, orden alfabético, búsqueda y chips de filtro. Único hub que vive en la raíz.
- `404.html` — página de error, en la raíz (requerida por GitHub Pages).
- `clases/<proyecto>/index.html` — página del proyecto (hub publicado): lista de clases, enlace al subject.pdf y progreso, junto a sus clases/glosario.
- `clases/<concepto>/index.html` — página del concepto (hub, misma estructura que un proyecto, sin subject.pdf).
- `clases/<proyecto>/clase-NN.html` — clases publicadas. Cada clase es bilingüe: una `<section lang="es">` y otra `<section lang="en">` con el mismo contenido.
- `clases/<proyecto>/glosario.html` — glosario de referencia publicado (obligatorio, bilingüe).
- `css/styles.css`, `js/main.js`, `js/i18n.js` — estilos, filtros/progreso y traducción.
- Stubs de redirect en la raíz (`<proyecto>.html`, `<concepto>.html`) — compatibilidad con URLs antiguas; saltan a `clases/<slug>/`. Sin contenido didáctico.

El material crudo no vive suelto en la raíz: cada proyecto tiene su carpeta bajo `proyectos/` y cada concepto la suya bajo `conceptos/`. La raíz solo aloja `index.html`, `404.html`, `css/`, `js/` y los stubs de redirect.

## Grid de la Biblioteca

- Título del grid: **Biblioteca** (`grid.title`). Al lado, dos chips (`grid-filters`) que activan/desactivan categorías; su estado se persiste en `localStorage` (`wc-grid-filters`).
- Cada card lleva `data-kind="proyecto"` o `data-kind="concepto"`; el filtro (`js/main.js` `initGridFilters`) muestra un card solo si pasa la búsqueda Y su categoría está activa.
- Las cards se ordenan alfabéticamente por `data-name` en `sortCards()` (que reasigna `--i` para no romper la animación); no hace falta mantener el orden en el HTML.
- Las cards de concepto usan `class="k-concept"` y un badge `Concepto`: redefinen `--accent`/`--accent-2` a violeta y así retintan el borde hover, el icono, el link y la barra de progreso sin reglas extra.
- Los nombres/descs de conceptos se declaran en `js/i18n.js` (`p.<slug>.name`, `p.<slug>.desc`).

## Estructura de un proyecto (`proyectos/<proyecto>/`)

Todo proyecto debe mantener esta estructura, igual para todos (Libasm, IoT, Scop, ft_ping…):

- `en.subject.pdf` — el subject oficial (fuente de verdad normativa).
- `AGENTS.md` — agente del proyecto, especializado en el tema del subject: restricciones de evaluación, entorno, herramientas, bonus, fuente de verdad. Un proyecto puede añadir el suyo propio siguiendo el modelo de `proyectos/libasm/AGENTS.md`.
- `GUIA_<PROYECTO>.md` — guía de aprendizaje: traduce el subject a un itinerario de clases (objetivo, conceptos y resultado por clase). Un solo archivo por proyecto; nunca `README.md` suelto.
- `GLOSARIO_<PROYECTO>.md` — glosario de referencia en español: siglas, estructuras, funciones y herramientas que aparecen en el curso (modelo: `proyectos/libasm/GLOSARIO_LIBASM.md`).
- `clases/clase-NN.md` — drafts de cada clase ya en la **plantilla canónica** (abajo), en español. De aquí se deriva el HTML publicado.

**Todo curso genera glosario**: además del `GLOSARIO_<PROYECTO>.md`, se publica `clases/<proyecto>/glosario.html` bilingüe derivado de él (modelo: `clases/libasm/glosario.html`, tablas con clase `mono-col`, `<body data-class="<proyecto>/glosario">`), y el hub publicado `clases/<proyecto>/index.html` enlaza a él.

La **consistencia de estilo se impone en la creación**, en el draft `clase-NN.md`, no al publicar.

## Estructura de un concepto (`conceptos/<concepto>/`)

Un concepto es un curso transversal (p. ej. Semáforos en C, Sockets, POSIX Threads) con la misma estructura que un proyecto pero **sin `en.subject.pdf`** ni `AGENTS.md` propio: la guía ES la fuente de verdad del tema.

- `GUIA_<CONCEPTO>.md` — itinerario de clases (objetivo, conceptos y resultado por clase), con la API y el modelo mental mínimos.
- `GLOSARIO_<CONCEPTO>.md` — glosario de referencia en español (modelo: `conceptos/semaforos/GLOSARIO_SEMAFOROS.md`).
- `clases/clase-NN.md` — drafts en la plantilla canónica.

La publicación es igual que en un proyecto: `clases/<concepto>/index.html` (sin badge de subject, con badge `Concepto`), `clases/<concepto>/clase-NN.html` y `clases/<concepto>/glosario.html`. La clave de progreso es `data-project="<concepto>"` (única, sin colisionar con proyectos).

## Flujo para crear una clase nueva

Cada clase nace de una sesión interactiva y pasa por cuatro pasos fijos:

1. **Sesión (Teaching Mode):** se imparte la clase de forma interactiva con un principiante; el material se lee del subject y de los ficheros reales del repo cuando existan. En un concepto, el material se lee de su `GUIA_<CONCEPTO>.md` y de código real.
2. **Draft:** se destila la sesión en `proyectos/<proyecto>/clases/clase-NN.md` (o `conceptos/<concepto>/clases/clase-NN.md`) usando la plantilla canónica de abajo, en español y sin transcribir la conversación verbatim.
3. **Publicación:** se deriva `clases/<proyecto>/clase-NN.html` (bilingüe) siguiendo el formato publicado de más abajo.
4. **Índices:** se actualizan `clases/<proyecto>/index.html` o `clases/<concepto>/index.html` (lista, nº de clases, enlace al subject en proyectos) e `index.html` (descripción, badge, progreso).

**Regla: ninguna clase se publica sin sesión.** Una clase pasa a `clases/<proyecto>/clase-NN.html` y se enlaza en los índices solo después de la sesión interactiva real. Un draft sin sesión es material en preparación (badge "Próximamente" / "En preparación"), nunca una clase publicada. Si una clase se ha publicado sin sesión, se des-publica (enlace a "Próximamente") hasta tomarla de nuevo.

Cuando el usuario suba material ya escrito (una carpeta temporal o un draft), leerlo, ubicar el proyecto, pulirlo al formato canónico y absorberlo en los pasos 2-4.

## Plantilla canónica de un draft (`proyectos/<proyecto>/clases/clase-NN.md`)

El draft se escribe **en español** con este esqueleto, en este orden. La traducción a inglés solo ocurre en el paso de publicación:

```text
# Clase N: título corto

## Objetivo
Un párrafo con el modelo mental que se construye y lo que el alumno debe poder hacer al terminar.

## 1. Sección
Explicaciones con texto, tablas y bloques de código.
## 2. Sección
...

## Predicciones y ejercicios
Problemas sin solución visible: cada uno con <details><summary>Solución</summary>…</details>.

## Errores frecuentes
Lista de errores típicos.

## Has aprendido que
Lista de conceptos clave.

## Preguntas tipo defensa
Lista numerada de preguntas para responder en voz alta.

## Criterio de finalización
Lista de ítems que marcan cuándo la clase está dominada.

## Siguiente clase
Un párrafo que enlaza con la siguiente.
```

Convenciones de los drafts:

- Un archivo por clase, nombrado `clase-NN.md` (ej. `clase-01.md`), numerado en dos dígitos.
- El orden de las secciones finales es fijo: `Predicciones y ejercicios`, `Errores frecuentes`, `Has aprendido que`, `Preguntas tipo defensa`, `Criterio de finalización`, `Siguiente clase`.
- Las soluciones de predicciones van dentro de `<details>` para que el alumno responda antes de abrirlas.
- Tablas Markdown para contratos y casos de prueba; bloques de código para ejemplos.
- La estructura didáctica (objetivo → predicciones → errores → resumen → defensa → criterio) es obligatoria; los títulos de las secciones centrales pueden variar por tema.

## Modo de enseñanza (Teaching Mode)

Aplica a todas las clases, de cualquier proyecto:

- Leer primero el `AGENTS.md` del proyecto y su `GUIA_<PROYECTO>.md`: son el agente especializado en el subject y definen las restricciones de evaluación, el entorno y el itinerario de clases.- Tratar cada sesión como una lección interactiva para un principiante: explicar el modelo mental, pedir predicciones y solo después implementar y depurar.
- Escalar la ayuda gradualmente: de preguntas a pistas, pseudocódigo, fragmentos y solo al final la implementación completa. No convertir los ejercicios en soluciones copiadas sin explicación.
- Revisar el código en términos de ABI, tiempo de vida de registros, flags, alineación de pila, direcciones efectivas, ownership y comportamiento observable.
- Cerrar cada lección con un resumen, preguntas tipo defensa, un pequeño ejercicio y un criterio de finalización explícito.

## Formato de una clase publicada (`clases/<proyecto>/clase-NN.html`)

Toda clase publicada debe incluir, en cada idioma:

- **Objetivo** (bloque `objective`).
- **Secciones** de contenido con explicaciones, tablas y bloques de código.
- **Predicciones y ejercicios** con solución desplegable (`<details class="solution">`); el alumno responde antes de mirarla.
- **Errores frecuentes** (bloque `panel warn`).
- **Has aprendido que** — resumen de conceptos clave.
- **Preguntas tipo defensa** — checklist para responder en voz alta.
- **Criterio de finalización** — checklist que marca cuándo la clase está dominada.

No transcribir la conversación del estudiante verbatim: destilar la lección en el formato anterior.

El draft canónico (en español) y la sección publicada son la misma lección en dos estados: el draft es la fuente, el HTML se deriva traduciendo y maquetando.

## Progreso y traducción

- Progreso por clase vía `data-project`, `data-complete` y `data-status-for`; lo gestiona `js/main.js` con localStorage.
- Textos cortos de UI vía `data-i18n` (`js/i18n.js`). El contenido didáctico largo va directamente en el HTML con `<span lang="es">`/`<span lang="en">`.

## Verificación

- No hay build ni lint configurados. Verificar manualmente: enlaces relativos correctos, clases bilingües completas y claves de progreso consistentes entre `index.html`, `clases/<proyecto>/index.html` y las páginas de clase.
