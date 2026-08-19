# Guía de aprendizaje y desarrollo de ft_ping

Esta guía traduce el `en.subject.pdf` v5.1 a un itinerario práctico en C para Linux/Debian. No sustituye al subject: si una indicación futura contradice el PDF, manda el PDF.

El objetivo no es copiar `ping` línea por línea, sino entender el protocolo ICMP, los sockets raw y la medición del RTT hasta poder explicar cada decisión durante la defensa. Está **prohibido** llamar al `ping` del sistema o usar sus fuentes; la referencia de comportamiento es `inetutils-2.0`.

## 1. Qué exige exactamente el proyecto

### Parte obligatoria

Debes entregar un ejecutable llamado `ft_ping` en C, compilado por un `Makefile` con las reglas habituales, que:

| Requisito del subject | Qué significa en la práctica |
|---|---|
| Referencia `inetutils-2.0` (`ping -V`) | Reproducir el formato de salida y los valores por defecto de esa implementación |
| Opciones **`-v`** y **`-?`** | `-?` muestra ayuda; `-v` reporta errores/resultados de paquetes sin detener el programa (forzar un TTL bajo genera uno) |
| Un único **IPv4** (dirección o hostname) | Aceptar exactamente un parámetro de red |
| **FQDN** sin resolución DNS en la devolución del paquete | Resolver el nombre, pero no realizar la resolución inversa dentro del camino de respuesta del paquete |
| Manejo cuidadoso de errores | Nunca salir de forma inesperada (segfault, bus error, double free) |
| `libc` completa + familia `printf` | Permitido usar cualquier función de libc y de printf |

### Reglas que pueden invalidar la entrega

- El programa debe funcionar en una VM Debian >= 7.0, kernel > 3.14.
- La indentación debe coincidir con `inetutils-2.0`, **excepto** la línea del RTT y la resolución DNS inversa.
- Se tolera +/- 30 ms en la recepción de un paquete.
- Solo se evalúa lo que esté dentro del repositorio entregado.
- **Prohibido** usar el `ping` del sistema o fuentes de un ping estándar.

### Bonus

El bonus solo se corrige si la parte obligatoria está perfecta:

- Flags adicionales: `-f -l -n -w -W -p -r -s -T --ttl --ip-timestamp`…
- `-V`, `--usage`, `--echo` no cuentan como bonus; dos flags de la misma característica cuentan como uno.

## 2. Entorno objetivo y herramientas

- Sistema: Linux (Debian), kernel > 3.14.
- Lenguaje: C. Compilador: `cc`/`gcc`.
- Protocolo: ICMP Echo sobre sockets IPPROTO_ICMP (raw).

Herramientas recomendadas:

| Herramienta | Uso |
|---|---|
| `cc`/`gcc` | Compilar con `-Wall -Wextra -Werror` |
| `make` | Automatizar dependencias y objetivos |
| `ping` del sistema | Solo como **referencia de comportamiento** durante el desarrollo (comparar formato), nunca como código |
| `tcpdump` o `wireshark` | Observar paquetes ICMP en la red |
| `strace` | Ver syscalls: `socket`, `sendto`, `recvfrom`, `setsockopt` |
| `gdb` | Depurar campos de cabecera y buffers |
| `getent` / manual | Comprobar resolución de nombres (FQDN) |

## 3. Modelo mental mínimo

### ICMP Echo y ping

Ping usa el protocolo ICMP, tipo 8 (Echo Request) y tipo 0 (Echo Reply). Un paquete ICMP de eco tiene:

```text
0                   1                   2                   3
0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     Type      |     Code      |          Checksum            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           Identifier          |        Sequence Number       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Data (payload)                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

Para un Echo: `Type = 8`, `Code = 0`. El checksum se calcula sobre todo el paquete, con el campo checksum a cero durante el cálculo.

### Socket raw ICMP

```c
int sockfd = socket(AF_INET, SOCK_RAW, IPPROTO_ICMP);
```

Crear un socket raw normalmente requiere privilegios (`CAP_NET_RAW`, root o sysctl). El kernel ya rellena la cabecera IPv4; el programa construye la cabecera ICMP y el payload.

### RTT (Round-Trip Time)

El RTT es el tiempo entre el envío del Echo Request y la recepción de su Echo Reply. Se mide tomando `gettimeofday`/`clock_gettime` justo antes de `sendto` y justo después de `recvfrom`:

```c
rtt = (after.tv_usec - before.tv_usec) / 1000.0; /* ms, con cuidado del carry de segundos */
```

## 4. Frontera: el programa, no el sistema

- **No** ejecutar el binario `ping`.
- **No** incluir fuentes de un ping estándar.
- El `Makefile` produce `ft_ping`, no `ping`.
- Todas las funciones de libc están permitidas, incluida `printf`.

## 5. Parseo de argumentos

Debes aceptar `-v` y `-?`, y exactamente una dirección IPv4 o un FQDN:

```text
ft_ping
ft_ping -v
ft_ping -?
ft_ping 127.0.0.1
ft_ping example.com
ft_ping -v example.com
```

Comportamiento esperable:

- `-?` (o `--help`/`--usage`): mostrar ayuda y salir correctamente.
- `-v`: activar verbosidad; los errores/resultados de paquetes se muestran sin abortar.
- Sin parámetro de destino o con varios: error de uso y salida controlada.
- Destino inválido: mensaje de error y salida controlada.

## 6. Resolución del destino

- Si el destino es una dirección IPv4, `inet_pton` produce directamente el `struct sockaddr_in`.
- Si es un FQDN, `getaddrinfo` lo resuelve; usa la primera dirección IPv4.
- La resolución inversa (nombre a partir de la IP en la respuesta) **no** debe realizarse dentro del camino de retorno del paquete.

```c
struct addrinfo hints = {0}, *res;
hints.ai_family = AF_INET;
hints.ai_socktype = SOCK_RAW;
if (getaddrinfo(dest, NULL, &hints, &res) != 0) { /* error */ }
/* usas res->ai_addr */
```

## 7. Construcción del paquete ICMP

Pasos:

1. Preparar un buffer con espacio para la cabecera ICMP más el payload.
2. Fijar `type = ICMP_ECHO` (8), `code = 0`.
3. Elegir un `identifier` (p. ej. derivado del PID) y un `sequence` inicial.
4. Rellenar el payload (por ejemplo con datos no-cero; `inetutils` usa un patrón).
5. Calcular el checksum con el campo a cero.
6. Enviar con `sendto` al `sockaddr_in` resuelto.

```c
struct icmphdr icmp;
memset(&icmp, 0, sizeof(icmp));
icmp.type = ICMP_ECHO;
icmp.un.echo.id = htons(pid % 65536);
icmp.un.echo.sequence = htons(seq);
/* payload ... */
icmp.checksum = checksum(&icmp, n);
sendto(sockfd, &icmp, n, 0, res->ai_addr, res->ai_addrlen);
```

Nota: usar `htons` para los campos multibyte, porque la red es big-endian.

## 8. Recepción de respuestas y medición

1. `recvfrom` con timeout (`setsockopt(SO_RCVTIMEO)` o `select`/`poll`).
2. El buffer recibido contiene la cabecera IPv4 seguida del ICMP; salta `iphdr->ihl * 4`.
3. Comprueba `type == ICMP_ECHOREPLY` (0) y que `id` coincida con el nuestro (salvo casos donde el host no responda al id elegido en raw, de ahí la tolerancia/verbosidad).
4. Calcula el RTT y muestra la línea al estilo `inetutils` salvo ajustes aceptados.

```text
PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.
64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.043 ms
```

## 9. Salida y control por señales

- Imprime un encabezado al inicio y, al terminar (Ctrl-C / señal), un resumen con estadísticas (paquetes enviados/recibidos/perdidos, min/avg/max/desviación del RTT).
- Maneja `SIGINT` para interrumpir el bucle y mostrar las estadísticas y salir limpiamente, no con una terminación brusca.
- Cada paquete enviado incrementa el recuento; cada respuesta válida, el de recibidos.

## 10. Order de implementación recomendado

1. Estructura del proyecto, `Makefile` mínimo y parseo de argumentos (`-v`, `-?`, un destino).
2. Resolución de IPv4/FQDN y creación del socket raw ICMP.
3. Construcción del paquete Echo y cálculo del checksum.
4. Envío (`sendto`) y recepción con timeout (`recvfrom`).
5. Medición del RTT y salida en el formato de `inetutils`, respetando la excepción de indentación (RTT y resolución inversa).
6. Estadísticas finales y manejo de señales (`SIGINT`).
7. Verboosidad `-v` para errores relacionados con paquetes (p. ej. TTL cambiante).
8. Matriz de pruebas frente a `tcpdump`/`ping` real como referencia, respetando la prohibición de usarlo como código.
9. Auditoría de errores: nunca salir inesperadamente en ningún camino.
10. Solo entonces, bonus.

## 11. Programa de clases interactivas

Cada sesión sigue el formato general: repaso, explicación con el modelo mental, predicciones, ejercicio, implementación conjunta, depuración real, preguntas tipo defensa, resumen y tarea. El itinerario es **conceptos primero, código después**: las primeras clases construyen el modelo mental (ICMP, sockets, checksum) antes de escribir nada; al final se cierra con auditoría y defensa.

- **Clase 1:** qué hace ping realmente, modelo ICMP Echo y subject completo. Resultado: explicar el subject y el formato de salida esperado.
- **Clase 2:** sockets, de lo básico a los raw (privilegios, `CAP_NET_RAW`, `ping_group_range`). Resultado: abrir el socket y manejar `EPERM` con elegancia.
- **Clase 3:** cabecera ICMP a fondo y algoritmo del checksum. Resultado: checksum validado contra una captura real, sin red.
- **Clase 4:** resolución (`getaddrinfo`, FQDN) y construcción/envío del paquete Echo. Resultado: un Echo en el cable con su reply visible en `tcpdump`.
- **Clase 5:** recepción con timeout y parseo de la respuesta (IHL, filtrado id/seq, validación antes de indexar). Resultado: ciclo completo correcto y ASan limpio.
- **Clase 6:** medición del RTT (`CLOCK_MONOTONIC`, timestamp en payload). Resultado: RTT local < 1 ms y remoto dentro de ±30 ms.
- **Clase 7:** estadísticas y `SIGINT` (async-signal-safety, `mdev`, caso cero respuestas). Resultado: resumen correcto al interrumpir.
- **Clase 8:** parseo de la CLI, errores robustos y verbosidad `-v` (entradas adversas, valgrind). Resultado: nunca cae y reporta errores de paquete sin abortar.
- **Clase 9:** formato de salida exacto y Makefile (`diff`/`cat -A` contra `inetutils-2.0`, `-MMD -MP`). Resultado: diff vacío salvo líneas exentas y make incremental correcto.
- **Clase 10:** auditoría de la obligatoria y preguntas de defensa. Resultado: parte obligatoria cerrada y defendible.
- **Clase 11+:** bonus (flags extra, por grupos de dependencia) — solo cuando lo anterior es perfecto.

## 12. Auditoría de la parte obligatoria

No empieces bonus hasta poder responder afirmativamente:

- `make`, `clean`, `fclean`, `re` funcionan y un segundo `make` no hace trabajo innecesario.
- El ejecutable se llama exactamente `ft_ping`.
- `-v` y `-?` funcionan; acepta un único IPv4 o FQDN.
- Maneja un FQDN sin resolución inversa en el camino de retorno.
- Respeta el formato de `inetutils-2.0` salvo RTT y resolución inversa.
- Nunca sale inesperadamente (segfault, bus error, double free) en ningún camino de error.
- Puedes explicar el checksum, `htons`, `sockaddr_in`, el salto de cabecera IPv4, el RTT y el manejo de señales.
- Puedes reconstruir la lógica sin depender de una solución memorizada.

## 13. Cómo pedir la siguiente clase

Puedes iniciar con una petición como:

```text
Empecemos la clase 1 de ft_ping. No asumas conocimientos previos de sockets ni ICMP.
```

En sesiones posteriores indica qué código has escrito y qué no entiendes. El profesor debe pedirte predicciones y explicaciones, no pegar la solución.

## 14. Referencias

- `en.subject.pdf`, ft_ping v5.1: especificación normativa.
- `inetutils-2.0` `ping`: referencia de comportamiento (formato de salida); no reutilizar su código.
- Manuales locales: `man 7 icmp`, `man 7 ip`, `man 2 socket`, `man 2 sendto`, `man 2 recvfrom`, `man 3 getaddrinfo`, `man 2 gettimeofday`, `man 3 inet_pton`, `man 2 setsockopt`.
- RFC 792 (ICMP): formato y tipos de paquetes.

---

La regla de trabajo del proyecto será: comprender, predecir, implementar, inspeccionar y probar. `ft_ping` no está terminado cuando "envía algo", sino cuando respeta el contrato, el formato de referencia, la resolución y los errores, y puedes explicar por qué.