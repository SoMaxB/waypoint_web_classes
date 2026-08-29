# Etapa 4 — Construir y enviar el paquete

**Requisito previo:** [03-checksum.md](03-checksum.md) · **Siguiente:** [05-recibir-parsear.md](05-recibir-parsear.md)

---

**Versión llana:** rellena un struct que represente la cabecera ICMP (más los bytes de payload que
quieras), calcula el checksum sobre él, y entrega el buffer entero a `sendto()` junto con la
dirección de destino.

**Resolver el destino:** `getaddrinfo()` — **get** **addr**ess **info**rmation — convierte un
hostname o una IP en texto en un `sockaddr` que puedes pasar a `sendto()`. El subject exige tratar
**FQDN**s (**F**ully **Q**ualified **D**omain **N**ames — nombres de host completos como
`www.example.com`) pero dice que no hagas resolución DNS (**D**omain **N**ame **S**ystem) "en el
retorno del paquete", es decir: resuelve el destino una sola vez, al principio, y tampoco hagas una
consulta nueva como parte del tratamiento de cada respuesta.

**`sendto()` sobre un raw socket ICMP:** no hace falta puerto de destino — ICMP no tiene. Solo un
`sockaddr_in` con la IP del destino rellenada.

> **Nombres, desglosados** — `sockaddr_in` = **sock**et **addr**ess, variante **in**ternet (la de
> IPv4; `sockaddr_in6` es la de IPv6) · `AF_INET` = **A**ddress **F**amily: **INET**ernet ·
> `INADDR_ANY` = **IN**ternet **ADDR**ess: **ANY**, o sea "cualquier dirección local" ·
> `gai_strerror` = **g**et**a**ddr**i**nfo **str**ing **error**, la función de texto de error propia
> de `getaddrinfo` (que **no** usa `errno`, y por eso un `perror` normal te da algo sin sentido
> aquí) · `freeaddrinfo` = **free** (liberar) la **addr**ess **info** que `getaddrinfo` reservó por
> ti. Lista completa en [GLOSARIO.md](GLOSARIO.md).
>
> **"Resolución"** significa convertir un nombre en una dirección — el paso de consulta, nada más.

---

## Preguntas de control

<details><summary>P1: ¿Cuándo debe resolverse el hostname: una vez al arrancar, o en cada paquete?</summary>

Una vez, al arrancar. Resuelve el destino a una dirección IP una sola vez y reutilízala en cada
paquete que envíes. No hay ninguna razón para volver a resolver por paquete, y la formulación del
subject sobre el retorno del paquete apunta a no hacer consultas tampoco mientras tratas las
respuestas.
</details>

<details><summary>P2: ¿Por qué sendto() no necesita aquí un número de puerto?</summary>

Los puertos son un concepto de la capa de transporte (TCP/UDP) para multiplexar conexiones en un
host. ICMP opera en la capa de red y no tiene noción de puertos — los campos type/code/identifier
cumplen en su lugar el papel de "a qué conversación pertenece esto".
</details>

---

## Ejercicio

Primer paquete real en el cable. **Solo enviar — todavía no intentes recibir.**

1. Monta `getaddrinfo()` con `hints.ai_family = AF_INET` y `hints.ai_socktype = SOCK_RAW`. Comprueba
   el valor de retorno contra `0` e informa de los fallos con `gai_strerror()` (**no** con `perror`
   — `getaddrinfo` no establece `errno`). Llama siempre a `freeaddrinfo()` en todas las rutas de
   salida.
2. Prueba la resolución con: un literal IPv4 (`127.0.0.1`), un FQDN (`google.com`) y basura
   (`not.a.real.host.invalid`). Los tres deben comportarse bien — el tercero debe imprimir un error
   limpio, no caerse ni tener fugas de memoria.
3. Construye el paquete de la Etapa 2, calcula su checksum con el de la Etapa 3, y hazle `sendto()`.
   Comprueba el valor de retorno: devuelve los bytes enviados, o `-1`.
4. Confirma con `sudo tcpdump -n icmp` en otra terminal que tu paquete apareció de verdad — **y que
   el host respondió.** Verás la respuesta en tcpdump aunque tu programa todavía no la lea. Esa
   respuesta demuestra que tu checksum es correcto: un checksum erróneo hace que el receptor
   descarte el paquete en silencio, y verás un request sin respuesta.

**Terminado cuando:** tcpdump muestre tu request *y* una respuesta emparejada. Si no hay respuesta,
vuelve a la Etapa 3 — casi siempre es el checksum o el orden de bytes.

---

## Lecturas

- `man 3 getaddrinfo` — la página entera, en especial los campos de `hints`, `gai_strerror` y las
  reglas de propiedad de `freeaddrinfo`
- `man 2 sendto` — semántica del valor de retorno y lista de errno
- `man 7 ip` — el formato de `sockaddr_in`, las constantes `INADDR_*`
- `man 3 inet_ntop` — para volver a imprimir la dirección resuelta (la necesitas para la línea de
  cabecera de la Etapa 9)
