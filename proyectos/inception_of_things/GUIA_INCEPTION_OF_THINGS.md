# Guía de aprendizaje y desarrollo de Inception of Things

Esta guía traduce el `en.subject.pdf` a un itinerario de 6 clases. No sustituye al subject: si una indicación futura contradice el PDF, manda el PDF.

## Objetivo

Aprender el proyecto hasta poder explicarlo y defenderlo como si se hubiera construido desde cero: no solo ejecutar comandos, sino entender qué pide el subject, dónde se cumple en el repo, por qué se implementó así y cómo diagnosticar fallos.

## Enfoque

Cada clase debe cerrar cuatro preguntas:

- Qué pide exactamente el subject.
- Qué ficheros del repo lo implementan.
- Qué conceptos técnicos hay detrás.
- Cómo se demuestra o se diagnostica en una defensa.

La prioridad es estudiar el proyecto como infraestructura reproducible: Vagrant, K3s, Kubernetes YAML, K3d, Argo CD, GitOps y GitLab local.

## Estructura del curso

### Clase 1 — Subject y mapa mental

Objetivo: convertir el subject en una matriz de estudio: requisito, fichero, comando de prueba y explicación corta.

Conceptos:

- Estructura general del proyecto.
- Diferencia entre parte obligatoria y bonus.
- Qué significa que el subject sea la fuente de verdad.
- Cómo leer un proyecto de infraestructura terminado.

Resultado esperado: explicar el proyecto completo en dos minutos y ubicar cada parte: `p1`, `p2`, `p3`, `bonus`.

### Clase 2 — Vagrant, máquinas virtuales y p1

Objetivo: entender cómo se crea un cluster K3s de dos nodos con Vagrant.

Ficheros:

- `p1/Vagrantfile`
- `p1/scripts/server.sh`
- `p1/scripts/worker.sh`

Conceptos:

- Vagrant, provider, box y provisioner.
- Red privada e IPs fijas.
- K3s server vs K3s agent.
- Token de unión del worker.
- `--node-ip`, `--advertise-address`, `--flannel-iface`, `--tls-san`.
- Kubeconfig y uso de `kubectl` en la VM server.

Práctica propuesta: explicar cómo se une `<login>SW` a `<login>S` sin copiar el `node-token` generado por K3s.

### Clase 3 — Kubernetes básico y p2

Objetivo: entender cómo Kubernetes ejecuta tres aplicaciones y las expone con Ingress.

Ficheros:

- `p2/Vagrantfile`
- `p2/scripts/setup.sh`
- `p2/confs/app1.yaml`
- `p2/confs/app2.yaml`
- `p2/confs/app3.yaml`
- `p2/confs/ingress.yaml`

Conceptos:

- ConfigMap.
- Deployment, ReplicaSet y Pod.
- Labels y selectors.
- Service `ClusterIP`.
- Ingress y Traefik.
- Host header.
- Replicas y balanceo en `app2`.

Práctica propuesta: seguir una petición `curl -H "Host: app2.com" http://192.168.56.110` desde el host hasta uno de los Pods.

### Clase 4 — K3d, Argo CD y GitOps con p3

Objetivo: entender cómo se despliega una aplicación desde GitHub mediante Argo CD.

Ficheros:

- `p3/scripts/install.sh`
- `p3/confs/application.yaml`
- `p3/confs/manifests/deployment.yaml`
- `p3/confs/manifests/service.yaml`

Conceptos:

- K3s vs K3d.
- Docker como base de K3d.
- Namespaces `argocd` y `dev`.
- Argo CD Application CRD.
- `repoURL`, `targetRevision`, `path` y `destination`.
- `syncPolicy.automated`, `prune` y `selfHeal`.
- Polling de Argo CD y sync manual.
- Por qué `kubectl apply --server-side` es necesario para Argo CD.

Práctica propuesta: explicar por qué cambiar `deployment.yaml` solo en local no basta y por qué Argo CD necesita leer el cambio desde el remoto.

### Clase 5 — Bonus: GitLab local

Objetivo: entender cómo se cierra el flujo GitOps usando un GitLab dentro del cluster.

Ficheros:

- `bonus/scripts/install.sh`
- `bonus/scripts/gitlab.sh`
- `bonus/scripts/argocd.sh`
- `bonus/confs/gitlab.yaml`
- `bonus/confs/application.yaml`
- `bonus/confs/manifests/deployment.yaml`
- `bonus/confs/manifests/service.yaml`

Conceptos:

- GitLab CE omnibus.
- Namespace `gitlab`.
- PVCs y persistencia.
- Estrategia `Recreate`.
- Probes de Kubernetes.
- Service DNS interno: `gitlab.gitlab.svc.cluster.local`.
- Token de API y creación automática del proyecto.
- Port-forward temporal.
- Argo CD leyendo desde GitLab local en vez de GitHub.

Práctica propuesta: explicar por qué `localhost:8081` no sirve como `repoURL` para Argo CD y por qué debe usarse la URL interna del Service.

### Clase 6 — Defensa y troubleshooting

Objetivo: practicar la explicación completa del proyecto y responder preguntas de evaluador.

Conceptos:

- Orden recomendado de demostración.
- Qué enseñar en cada parte.
- Cómo justificar decisiones técnicas.
- Cómo diagnosticar fallos comunes.

Escenarios de troubleshooting:

- El worker de p1 no aparece como `Ready`.
- `kubectl` da `connection refused`.
- p2 devuelve 404.
- p2 devuelve 502 o 503.
- Argo CD queda en `OutOfSync` o `ComparisonError`.
- GitLab tarda demasiado o reinicia.
- Docker no responde.

Resultado esperado: defender el proyecto con fluidez, desde el requisito del subject hasta la implementación y la verificación.

## Dinámica de estudio

Cada clase debe seguir este patrón:

1. Leer el requisito del subject correspondiente.
2. Ubicar los ficheros reales que lo cumplen.
3. Explicar el flujo con un diagrama textual simple.
4. Hacer una lectura guiada de los ficheros importantes.
5. Formular preguntas tipo defensa.
6. Cerrar con una explicación oral corta, sin mirar apuntes.

## Criterio de dominio

Una parte se considera dominada cuando se puede responder:

- Qué problema resuelve.
- Qué componentes intervienen.
- Qué comandos la levantan y verifican.
- Qué fichero cambiaría el comportamiento principal.
- Qué fallo típico podría ocurrir y cómo se diagnostica.
