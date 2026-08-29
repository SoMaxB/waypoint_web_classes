# Clase 10: auditoría de la parte obligatoria y defensa

## Objetivo

Cerrar la parte obligatoria como si ya estuviera en evaluación. Al terminar debes poder pasar una checklist de 14 puntos, ejecutar matrices de prueba de salida y de robustez, y responder en voz alta a preguntas de evaluador sin apoyarte en una solución memorizada. Solo entonces se abre el bonus.

## 1. Checklist de auditoría (no abras bonus hasta que todo sea sí)

- `make`, `clean`, `fclean`, `re` funcionan; un segundo `make` no hace trabajo innecesario.
- Ejecutable exactamente `ft_ping`.
- `-v` y `-?` funcionan; acepta un único IPv4 o FQDN.
- FQDN sin inversa en el retorno (una sola `getaddrinfo` al arrancar).
- Formato `inetutils-2.0` salvo RTT/DNS inverso (`diff` vacío + `cat -A`).
- Nunca salida inesperada (segfault/bus/double free) en ningún camino.
- ¿Puedes explicar checksum, `htons`, `sockaddr_in`, salto `ihl*4`, `CLOCK_MONOTONIC` y `sigaction/SA_RESTART/EINTR`?
- ¿Puedes reconstruir la lógica sin mirar una solución memorizada?
- `icmp_seq` empieza en 1, cabecera `PING ... 56(84) bytes...` completa.
- Payload sin leak de padding (`struct timeval tv = {0};`).
- `valgrind --leak-check=full --show-leak-kinds=all` limpio en rutas feliz, error y `Ctrl+C`.
- `freeaddrinfo` + `close` en todas las salidas.
- `ASan` limpio con reply buena, truncada y con id equivocado.
- Códigos de salida coinciden con `inetutils` (`echo $?`).

## 2. Matrices a ejecutar

**Matriz de salida (clase 9):**
- `sudo timeout 3 ./ft_ping 127.0.0.1` vs `ping-ref -c 3 127.0.0.1` → `diff` + `cat -A`
- Host inalcanzable + `Ctrl+C` → `0 received, 100% loss` sin `min/avg/max`.
- `-v` con TTL bajo (ver `-m 1` si ya existe, si no simula con `setsockopt` manual).

**Matriz de robustez (clase 8):**
- Sin args, `""`, `-z`, `999.999.999.999`, 5000 `a`, `-- -v`, `host1 host2`.

Si cualquier fila rompe, aún no estás en bonus.

## 3. Ensayo de defensa

Responde en voz alta y luego verifica contra tu código:

- ¿Qué dos vistas de ELF no, pero qué dos líneas están exentas de comparación? (RTT/DNS).
- ¿Por qué `CLOCK_MONOTONIC` y no pared?
- ¿Por qué `sigaction` y por qué el handler es de una línea?
- ¿Cómo validas `ihl` antes de indexar?
- ¿Qué hace tu `-v` con un `Time Exceeded`?
- ¿Dónde confirmas que tu `mdev` no divide por cero?

## Predicciones y ejercicios

### Ejercicio 1 — ¿cuándo dices "terminado"?

Un compañero dice "mi ping envía algo, ya está". ¿Qué le falta según la checklist?

<details><summary>Solución</summary>

Que `tcpdump` muestre reply, `recvfrom` valide y filtre, `diff` contra `inetutils` sea vacío salvo exentas, `valgrind/ASan` limpios, `Ctrl+C` con cero replies funcione, y pueda explicar `htons/checksum/ihl/mprotect` no, perdón — `CLOCK_MONOTONIC/sigaction`.

</details>

### Ejercicio 2 — ¿por qué no bonus aún?

Tu `ft_ping` pasa 9/10 filas de robustez pero falla con 5000 `a`. ¿Abres `-m/-T`?

<details><summary>Solución</summary>

No. Bonus se ignora si obligatoria no es perfecta. Arregla el overflow primero y repite `diff`/`valgrind` antes de tocar flags.

</details>

### Ejercicio 3 — defensa con `strace`

`strace -f ./ft_ping 127.0.0.1` muestra `socket, sendto, recvfrom, clock_gettime, sigaction`. ¿Qué falta si tu RTT es correcto?

<details><summary>Solución</summary>

Nada: esas son las syscalls esperadas. Si ves `getaddrinfo` repetido por paquete, estás resolviendo en el bucle y violas FQDN sin inversa.

</details>

## Errores frecuentes

- Decir "funciona" tras una sola prueba feliz.
- Abrir bonus con checklist a medias → bonus ignorado en evaluación.
- No repetir `diff`/`cat -A` tras cada fix de bug.
- No probar `Ctrl+C` con cero replies → `mdev` divide por cero en evaluación.

## Has aprendido que

- La auditoría es una lista cerrada de 14 sí/no; no es subjetiva.
- Dos matrices (salida y robustez) definen "parte obligatoria perfecta".
- La defensa se ensaya explicando sin memorizar frases.

## Preguntas tipo defensa

1. ¿Qué tres comandos demuestran que no fugas ni corrompes memoria?
2. ¿Qué dos pruebas de `make` demuestran incrementalidad?
3. ¿Por qué `icmp_seq` empieza en 1 y qué cambiaste para eso?
4. ¿Cómo evitaste el leak de padding del `timeval`?
5. ¿Cuándo se considera que la parte obligatoria está "perfecta" según el subject?

## Criterio de finalización

- Las 14 casillas son sí con evidencia (`diff`, `cat -A`, `valgrind`, `ASan`, `make` repetido).
- Puedes responder las 5 preguntas de arriba sin mirar el código y con el programa ejecutándose en vivo.
- Decides conscientemente que bonus solo se abre ahora.

## Siguiente clase

La clase 11 implementa los flags bonus (`-m/-T/-r/-S/-n/-p/-s/-i/-l/-f/-t/-o/-Q/-q`) por grupos de dependencia, solo porque la obligatoria ya es perfecta.

## Lecturas

- `en.subject.pdf` ft_ping v5.1 — relee la cláusula de bonus y de "nunca puede caerse"
- `GUIA_FT_PING.md` §11-12 — programa y auditoría
- Matriz de pruebas y `R_ping.md`
