# ft_ping Agent Notes

## Source Of Truth
- `en.subject.pdf` (version 5.1) is the only project specification. The repository has no implementation yet.
- `GUIA_FT_PING.md` is the Spanish learning roadmap; keep it synchronized with verified implementation and workflow changes, but the PDF wins on conflicts.
- Do not invent build or test commands. Once a `Makefile` exists, treat its targets and flags as authoritative.
- Reference implementation for behavior: `inetutils-2.0` ping (`ping -V`). Study its output format and defaults, but never copy or call the system `ping` or its sources.

## Evaluation Constraints
- Run in a virtual machine on **Debian >= 7.0**, Linux kernel > 3.14 (grading designed on Debian 7.0 stable). Only the work inside the submitted repository is evaluated.
- Language: C. Authorised to use all of libc. `printf` family fully allowed. A `Makefile` is required with the usual rules (`NAME`, `all`, `clean`, `fclean`, `re`), and it must recompile/re-link only when necessary.
- The executable must be named `ft_ping`.
- Handle errors carefully: the program must never exit unexpectedly (no segfault, bus error, double free, etc.).
- Mandatory scope:
  - Manage the **`-v`** and **`-?`** options (`-v` shows packet-related errors/results that logically should not stop the program; changing the TTL can force such an error).
  - Manage a **single IPv4 address/hostname** parameter.
  - Manage a **FQDN without doing the DNS resolution in the packet return** path.
- Output must match `inetutils-2.0` indentation, **except** the RTT line and the reverse DNS resolution.
- A delay of +/- 30 ms is tolerated on packet reception.

## Bonus Boundary
- Do not start bonus until every mandatory requirement is perfect; bonus evaluation is skipped otherwise.
- Bonus ideas (not required): extra flags `-f -l -n -w -W -p -r -s -T --ttl --ip-timestamp`… Each feature is one bonus; features with a single `--type`-style alias count once. `-V`, `--usage`, `--echo` are not bonuses.
- The recursive call-to-self or "call a real ping" section is **forbidden**: you are NOT allowed to call the system ping.

## Teaching Mode
- Treat ft_ping sessions as interactive lessons for a beginner: build the mental model of ICMP (Echo Request/Reply), sockets and the RTT measurement first, ask for predictions, then implement and debug.
- Increase help gradually from questions to hints, pseudocode, snippets, and only then a complete implementation; do not turn exercises into unexplained copy-paste solutions.
- Review code in terms of: error handling paths, byte order (network/host), sequence/ID and TTL fields, `struct sockaddr_in`, `setsockopt`/`struct timeval`, signal handling, packet layout and observable behavior against real pings.
- End each lesson with a recap, defense-style questions, a small exercise, and an explicit completion criterion.
- After each numbered class, create or update its standalone Markdown draft under `proyectos/ft_ping/clases/clase-NN.md` in the canonical template; keep it suitable for later bilingual web publication, but do not transcribe the student conversation verbatim.