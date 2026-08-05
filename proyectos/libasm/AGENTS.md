# Libasm Agent Notes

## Source Of Truth
- `en.subject.pdf` (version 5.4) is currently the only project specification; the repository has no implementation or build configuration yet.
- `GUIA_LIBASM.md` is the Spanish learning roadmap; keep it synchronized with verified implementation and workflow changes, but the PDF wins on conflicts.
- Do not invent build or test commands. Once a `Makefile` exists, treat its targets and flags as authoritative and update this file if they add non-obvious workflows.

## Evaluation Constraints
- Target Linux x86-64, ELF64, the System V AMD64 ABI, and glibc. Implement `.s` files with NASM Intel syntax; inline assembly is not allowed.
- Never add the `-no-pie` compilation flag; the subject explicitly forbids it.
- The mandatory output is `libasm.a`, containing `ft_strlen`, `ft_strcpy`, `ft_strcmp`, `ft_write`, `ft_read`, and `ft_strdup`.
- Submit a `main` function that links against `libasm.a` and demonstrates the mandatory functions.
- `ft_read` and `ft_write` must translate negative kernel results to `-1` and set thread-local `errno`; use glibc's verified `__errno_location` symbol on this target.
- The `Makefile` must provide `$(NAME)`, `all`, `clean`, `fclean`, and `re`, and must not rebuild or relink unchanged inputs.

## Bonus Boundary
- Do not start or rely on bonus work until every mandatory requirement is correct; bonus evaluation is skipped otherwise.
- Keep bonus code in separate `_bonus` files and include it only through a `bonus` target.
- Bonus symbols are `ft_atoi_base`, `ft_list_push_front`, `ft_list_size`, `ft_list_sort`, and `ft_list_remove_if`; consult the PDF annexes for their exact contracts and callback usage.

## Teaching Mode
- Treat Libasm sessions as interactive lessons for a beginner: explain the memory/register model, ask for predictions, then implement and debug.
- Increase help gradually from questions to hints, pseudocode, snippets, and only then a complete implementation; do not turn exercises into unexplained copy-paste solutions.
- Review assembly in terms of ABI, register lifetime, flags, stack alignment, effective addresses, ownership, and observable C behavior.
- End each lesson with a recap, defense-style questions, a small exercise, and an explicit completion criterion.
- After completing each numbered class, create or update its standalone Markdown document under `proyectos/libasm/clases/`. Keep it suitable for later web publication: preserve the lesson's explanations, prediction/exercise style, solutions, common mistakes, defense questions, completion criterion, and a `Has aprendido que` recap, but do not transcribe the student's conversation verbatim.
