# Woody Woodpacker Agent Notes

## Source Of Truth
- `en.subject.pdf` (version 2.1) is the only project specification. The repository has no implementation yet.
- `GUIA_WOODY_WOODPACKER.md` is the Spanish learning roadmap; keep it synchronized with verified implementation and workflow changes, but the PDF wins on conflicts.
- Do not invent build or test commands. Once a `Makefile` exists, treat its targets and flags as authoritative.
- Reference binary for testing: the `sample.c` / `sample` provided in `resources.tar` from the subject page.

## Evaluation Constraints
- Target Linux x86-64, ELF64 only. Any 32-bit file must print `File architecture not suported. x86_64 only` (note the typo in the subject) and exit cleanly.
- Language: C, with optional assembly for the stub (`nasm -f elf64` or `as`). If assembly is used, the `Makefile` must contain the appropriate compilation rules.
- Authorised functions for the mandatory part: `open, close, exit, lseek, mmap, munmap, mprotect, perror, strerror, syscall` plus the `printf` family and your `libft` (read, write, malloc, free, etc.). Other functions are allowed for bonus only if justified at defence.
- The executable must be named `woody_woodpacker` and take a single 64-bit ELF file as parameter.
- On success it creates a file named `woody`, prints `key_value: <hex>` on stdout, and the key must be generated as randomly as possible (`/dev/urandom`, not `rand()`).
- When `woody` is executed it must first print `....WOODY....\n` and then behave identically to the original binary — no crash, identical output and exit code.
- The encryption algorithm must be non-trivial (a simple ROT/XOR with a short fixed key is explicitly rejected). Be ready to justify the choice at defence.

## Bonus Boundary
- Do not start bonus until every mandatory requirement is perfect and error handling is flawless; bonus is ignored otherwise.
- Bonus ideas listed in the subject: 32-bit support, parameterized key, assembly optimisation of the algorithm, additional formats (PE, Mach-O), binary compression. Each must be defensible.

## Teaching Mode
- Treat Woody sessions as interactive lessons for a beginner: build the mental model of ELF first (headers, segments vs sections), then how the kernel loads them, then ABI, syscalls, crypto and the toolchain, before writing injection code.
- Increase help gradually from questions to hints, pseudocode, snippets, and only then a complete implementation; do not turn exercises into unexplained copy-paste solutions.
- Review code in terms of: ELF parsing and validation, `p_vaddr/p_offset/p_filesz/p_memsz/p_align` consistency, ABI register preservation and `jmp` vs `call`, `rip`-relative addressing for PIE, `mprotect` page alignment, and observable behaviour (`readelf`, `strace`, `gdb`, `diff`).
- End each lesson with a recap, defense-style questions, a small executable exercise, and an explicit completion criterion.
- After each numbered class, create or update its standalone Markdown draft under `proyectos/woody_woodpacker/clases/clase-NN.md` in the canonical template; keep it suitable for later bilingual web publication, but do not transcribe the student conversation verbatim.
