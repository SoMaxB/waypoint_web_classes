# Etapa 1 — Sockets, de lo básico a los raw sockets

**Requisito previo:** [00-que-hace-ping.md](00-que-hace-ping.md) · **Siguiente:** [02-protocolo-icmp.md](02-protocolo-icmp.md)

---

**Versión llana:** existen distintos "tipos" de socket para distintos trabajos — `SOCK_STREAM` se
comporta como TCP (orientado a conexión), `SOCK_DGRAM` se comporta como UDP (sin conexión), y
`SOCK_RAW` te da acceso directo a un protocolo de más bajo nivel como IP o el propio ICMP.

**Repaso de `socket()`:** `socket(domain, type, protocol)` — `domain` (p. ej. `AF_INET` para IPv4),
`type` (p. ej. `SOCK_RAW`) y `protocol` (p. ej. `IPPROTO_ICMP`) le dicen al kernel exactamente qué
protocolo quieres bajo esa combinación de dominio y tipo.

> **Nombres, desglosados** — `AF_INET` = **A**ddress **F**amily: **INET**ernet · `SOCK_STREAM` =
> **SOCK**et, **STREAM** · `SOCK_DGRAM` = **SOCK**et, **D**ata**GRAM** · `SOCK_RAW` = **SOCK**et,
> **RAW** · `IPPROTO_ICMP` = **IP** **PROTO**col: **ICMP**. Lista completa en
> [GLOSARIO.md](GLOSARIO.md).

## Particularidades de los raw sockets

- `socket(AF_INET, SOCK_RAW, IPPROTO_ICMP)` te da un socket para enviar y recibir mensajes ICMP
  directamente. Por defecto el kernel sigue construyéndote la cabecera IP al enviar.
- `IP_HDRINCL` (**IP** **H**ea**D**e**R** **INCL**uded): una opción de socket que significa "la
  cabecera IP entera la construyo yo". No hace falta para la parte obligatoria (solo entregas un
  payload ICMP), pero la querrás si necesitas tocar campos a nivel IP directamente — relevante más
  adelante para el bonus `--ip-timestamp`.
- **Privilegios:** los raw sockets necesitan `CAP_NET_RAW` (**CAP**ability, **NET**work, **RAW**)
  en Linux — en la práctica, ejecutar como root, un binario setuid-root, o un binario con
  `setcap cap_net_raw+ep` aplicado. Ojo: Linux moderno también admite ICMP *sin privilegios* vía
  `SOCK_DGRAM` + `IPPROTO_ICMP` bajo un sysctl (`net.ipv4.ping_group_range`) — conviene saber que
  existe, pero el ft_ping de 42 espera la vía del raw socket, así que comprueba qué permite
  realmente la VM o el cluster donde te evalúan.

---

## Preguntas de control

<details><summary>P1: ¿Cuál es la diferencia práctica entre SOCK_DGRAM y SOCK_RAW aquí?</summary>

`SOCK_DGRAM` deja que el kernel gestione por ti el encuadre de la capa de transporte (como hace con
UDP) — pero no existe un "transporte ICMP" en el sentido tradicional. `SOCK_RAW` te da acceso más
cerca del nivel del protocolo: construyes y lees mensajes ICMP completos tú mismo, mientras el
kernel sigue rellenando la cabecera IP por defecto salvo que actives `IP_HDRINCL`.
</details>

<details><summary>P2: ¿Por qué necesita ft_ping privilegios elevados?</summary>

**Respuesta corta:** porque un socket `SOCK_RAW` puede usarse, en principio, para ver o inyectar
tráfico arbitrario a nivel IP — una capacidad sensible para la seguridad que el sistema operativo
restringe tras root o `CAP_NET_RAW`.

**Esa frase, desmontada:**

- **inject** (inyectar) — poner en la red paquetes que *has compuesto tú mismo*, byte a byte.
  Normalmente le entregas tus datos al sistema y él monta el paquete alrededor. Inyectar significa
  que el paquete lo escribes tú, incluidas las partes que se supone que te describen a ti.
- **arbitrary** (arbitrario) — cualquier cosa, sin restricciones. No "paquetes de un menú fijo":
  cualquier paquete imaginable, incluidos los malformados o mentirosos.
- **IP-level** (a nivel IP) — en la capa que se ocupa del direccionamiento y el enrutado entre
  máquinas, por debajo de la capa que normalmente mantiene separados a los programas entre sí.
- **traffic** (tráfico) — simplemente paquetes circulando por la red.
- **capability** — un permiso *concreto*, en lugar de permisos de administrador en bloque. Linux
  dividió "root puede hacer cualquier cosa" en una lista de poderes independientes que se pueden
  conceder de uno en uno.
- **gates** (restringe) — una comprobación que tienes que superar.

**En lenguaje llano:** un raw socket permite a tu programa leer paquetes que no iban dirigidos a él,
y enviar paquetes que mienten sobre su procedencia. Esa es la parte peligrosa, y por eso el sistema
te pregunta primero quién eres.

**Qué habilita en realidad** — las tres cosas de las que se protege el sistema operativo:

1. **Leer el correo ajeno.** Un raw socket recibe paquetes de los que tu programa no es el
   destinatario previsto. Tu filtro de respuestas de la Etapa 5 existe por esto: llegan tanto si los
   quieres como si no. Extiéndelo más allá de ICMP y tienes una escucha.
2. **Mentir sobre quién eres.** Normalmente el sistema pone la dirección de tu máquina como emisor
   y tú no puedes tocarla. Si construyes el paquete tú, ese campo es tuyo — puedes poner la
   dirección de otro, y las respuestas irán *a él*. Es la base del spoofing y la razón principal de
   que exista la restricción.
3. **Enviar paquetes que no deberían existir.** Combinaciones de campos contradictorias o sin
   sentido, que algunos sistemas han gestionado históricamente muy mal.

**La ironía:** ping no necesita nada de esto. Necesita una capacidad estrecha — enviar un ICMP Echo
y leer la respuesta — pero el mecanismo que la concede es tosco, así que llega en el mismo paquete
que todo lo anterior. Ese desajuste es exactamente por lo que Linux moderno añadió la vía sin
privilegios `SOCK_DGRAM` + `IPPROTO_ICMP` descrita arriba: una puerta estrecha para el único uso
legítimo.

**Acrónimos:** `SOCK_RAW` = **SOCK**et, **RAW**. `CAP_NET_RAW` = **CAP**ability, **NET**work,
**RAW**. `EPERM` = **E**rror: **PERM**ission denied — el error que recibes sin él.
</details>

---

## Ejercicio

Escribe un `main()` de unas 20 líneas que no haga más que abrir el socket y salir:

1. `socket(AF_INET, SOCK_RAW, IPPROTO_ICMP)`, comprueba si devuelve `-1`, y en caso de fallo
   `perror` + salida con código distinto de cero.
2. Ejecútalo como usuario normal — confirma que obtienes `Operation not permitted` (`EPERM`).
   **Esta es la ruta de error que tendrás que gestionar con elegancia en la Etapa 8, así que velo
   ahora.**
3. Ejecútalo con `sudo` — confirma que funciona.
4. Revisa tu entorno de evaluación: ¿permite `cat /proc/sys/net/ipv4/ping_group_range` hacer ICMP
   sin privilegios? Anota la respuesta; decide si puedes probar sin sudo.

**Terminado cuando:** el mismo binario imprima un error limpio sin privilegios y salga con 0 bajo
sudo — sin segfault y sin fallos silenciosos.

---

## Lecturas

- `man 2 socket` — el contrato de los tres argumentos y la lista completa de errno
- `man 7 raw` — léelo con calma; describe exactamente qué envía y recibe un raw socket ICMP, y
  documenta `IP_HDRINCL`
- `man 7 ip` — la tabla de opciones de socket (`IP_TTL`, `IP_HDRINCL`, `IP_OPTIONS` vuelven todas
  más adelante)
- `man 7 capabilities` — busca `CAP_NET_RAW`
- `man 8 setcap` — si quieres probar sin sudo
