# Inception of Things Agent Notes

## Source Of Truth
- `en.subject.pdf` (version 4.0) is the only project specification. The mandatory part must be done in a virtual machine; only the work inside the submitted repository is evaluated.
- `GUIA_INCEPTION_OF_THINGS.md` is the Spanish learning roadmap; keep it synchronized with verified implementation, but the PDF wins on conflicts.
- Do not invent commands or tool versions. Once a real repo exists, treat its actual scripts and Vagrantfiles as authoritative.

## Evaluation Constraints
- The whole project runs in a virtual machine. Any tools or providers for the host VM and Vagrant are allowed.
- Usage is staged and must be done **in order**: Part 1 (K3s + Vagrant), Part 2 (K3s + 3 apps), Part 3 (K3d + Argo CD). The `bonus` is only evaluated if the mandatory part is *flawless*.
- Repository layout at root must be exactly: `p1/`, `p2/`, `p3/` (mandatory) and `bonus/` (optional). Scripts go in a `scripts/` folder, config files in a `confs/` folder.
- `p1`: 2 Vagrant machines, hostnames = login + `S` and login + `SW`. Fixed dedicated IPs `192.168.56.110` (Server) and `192.168.56.111` (ServerWorker). SSH with no password. K3s in controller mode on Server, agent mode on ServerWorker. `kubectl` installed.
- `p2`: 1 VM, K3s server. 3 web apps exposed by `Host` header against `192.168.56.110`: `app1.com` → app1, `app2.com` → app2 (3 replicas), anything else → app3 (default catch-all). Routing is done with an Ingress rule; app3 is the Ingress with **no** `host`.
- `p3`: no Vagrant. K3d (K3s inside Docker) + Argo CD. Two namespaces: one for Argo CD and one named `dev` containing an app auto-deployed by Argo CD from a public GitHub repo (repo name must contain a team member login). The app must have two taggable versions (`v1`, `v2`) exposed on port 8888; changing the version must be done by editing `deployment.yaml` in the public GitHub repo and confirming via `curl http://localhost:8888/`.
- `bonus`: GitLab CE running locally (latest version), namespace `gitlab`, everything from Part 3 working against the local GitLab instead of GitHub. Helm is allowed. Folder `bonus/` at repo root.

## Teaching Mode
- Treat Inception of Things sessions as interactive lessons: read the subject requirement, locate the real file that fulfills it, and only then explain concepts and verify live.
- Each class should close four questions: what the subject asks, which repo files implement it, which technical concepts lie behind it, and how to demonstrate/diagnose it in a defense.
- Review material in terms of reproducible infrastructure: Vagrant, K3s/Kubernetes YAML, K3d, Ingress/Host header, Argo CD (Application CRD, `repoURL`, `syncPolicy`), GitOps and local GitLab.
- Escalate help gradually (questions → hints → pseudocode → snippets → full solution). Do not turn exercises into copy-pasted solutions.
- End each lesson with a recap, defense-style questions, a small exercise and an explicit completion criterion.
- After each numbered class, create/update its standalone Markdown draft under `proyectos/inception_of_things/clases/clase-NN.md` in the canonical template; keep it suitable for later bilingual web publication, but do not transcribe the student conversation verbatim.