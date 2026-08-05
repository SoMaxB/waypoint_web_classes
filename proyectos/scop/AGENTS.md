# Scop Agent Notes

## Source Of Truth
- `en.subject.pdf` (version 5.0) is the only project specification. The repository has no implementation yet.
- `GUIA_SCOP.md` is the Spanish learning roadmap; keep it synchronized with verified implementation and workflow changes, but the PDF wins on conflicts.
- Do not invent build or install commands. Once a `Makefile` (or one-line installer) exists, treat its targets and flags as authoritative.
- The subject includes an explicit AI-usage policy: the learner keeps intellectual leadership, must be able to defend every design decision, and the README must describe how AI was used. Teaching should build deep understanding, not copy-paste solutions.

## Evaluation Constraints
- Build a program that displays a 3D object from a **`.obj` file** (created with a modeling tool such as Blender) inside a window, in **perspective**.
- The object must be **rotatable and translatable** around its three main axes of symmetry (origin at the object's center), with any user input method (keyboard, mouse…).
- Faces must be visually distinguishable using **various colors** (a face as defined in the `.obj`, or a triangle if the model is triangulated).
- A **dedicated key** toggles a **texture** on the object; pressing it again returns to the colored view. A **smooth transition** between the two is expected (no abrupt cuts).
- Language: C, C++ or Rust preferred. Graphics API: **OpenGL, Vulkan or Metal** (any one).
- Provide a **one-line command** to check for and possibly install all required dependencies (e.g. a classic `Makefile` for C).
- External libraries allowed **only** for window and event management.
- **No external libraries** for loading the 3D object, creating matrices, or loading shaders — these must be implemented yourself on top of the chosen graphics API.
- During the defense, showcase the **42 logo** spinning around its **central axis** (not a corner), with faces in subtle **shades of gray**; the texture should be cheerful (ponies, kittens, unicorns…). Additional 3D objects will likely be tested.
- The 42 logo is copyrighted and may be used only for pedagogical purposes within this project.

## README Requirements
- `README.md` at repo root; **first line** is italicized: `This project has been created as part of the 42 curriculum by <login1>[, <login2>[, ...]]`.
- Must include sections: `Description` (goal + brief overview), `Instructions` (compilation, installation, execution), and `Resources` (classic references for the topic + a description of how AI was used: for which tasks and which parts).

## Bonus Boundary
- Do not start bonus until every mandatory requirement is perfect; bonus evaluation is skipped otherwise.
- Bonus options: [10pt] handle complex `.obj` files (concave / non-coplanar), e.g. the original teapot with edge artifacts; [5pt] apply textures more subtly avoiding visible stretching; [10pt] additional impressive features.

## Teaching Mode
- Treat Scop sessions as interactive lessons for a beginner: build the mental model of the graphics/rendering pipeline (vertices → transformations → rasterization → fragments), ask for predictions, then implement and debug.
- Increase help gradually from questions to hints, pseudocode, snippets, and only then a complete implementation; do not turn exercises into unexplained copy-paste solutions.
- Review code in terms of: `.obj` parsing, matrix math and transformation order (model/view/projection), MVP multiplication, homogeneous coordinates, shader compilation/linking, buffers/VAO/VBO, textures and UV mapping, and smooth color-to-texture transitions.
- End each lesson with a recap, defense-style questions, a small exercise, and an explicit completion criterion.
- After each numbered class, create or update its standalone Markdown draft under `proyectos/scop/clases/clase-NN.md` in the canonical template; keep it suitable for later bilingual web publication, but do not transcribe the student conversation verbatim.