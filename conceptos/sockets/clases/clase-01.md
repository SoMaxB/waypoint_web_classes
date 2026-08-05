# Clase 1: Modelo de red y primer par cliente-servidor

## Objetivo

Construir el modelo mental de la red como **flujos de bytes entre dos extremos** identificados por IP y puerto, y montar un par cliente-servidor TCP mínimo que se hable. Al terminar debes poder dibujar qué hace cada llamada (`socket`, `bind`, `listen`, `accept`, `connect`, `read`, `write`) y explicar cuándo bloquea.

## 1. La red como flujos de bytes

Una conexión TCP es un **flujo de bytes bidireccional** entre dos extremos. El programa no envía "mensajes": escribe bytes y el receptor los lee en orden, como si fuera un archivo que crece por ambos extremos.

```text
cliente  ----bytes en una dirección---->  servidor
cliente  <----bytes en la otra---------  servidor
```

Como es un flujo, quien recibe no sabe de antemano cuánto va a llegar. Las aplicaciones delimitan los datos con su propio protocolo (por ejemplo `http\r\n\r\n`, o una longitud al principio).

## 2. Extremos: IP y puerto

Un extremo de la comunicación se identifica por:

- **Dirección IP**: identifica el host (`127.0.0.1` = esta misma máquina).
- **Puerto**: identifica el servicio dentro del host (los números bajos suelen estar reservados).

Un socket es la representación local de un extremo: un descriptor de archivo sobre el que puedes `read`/`write`.

## 3. Flujo del servidor

El servidor prepara un socket y espera conexiones:

```text
socket()   ->  obtengo un descriptor de socket
bind()     ->  le asigno IP y puerto (leo en 0.0.0.0:PORT)
listen()   ->  lo marco como "a la escucha"
accept()   ->  bloqueo hasta que llega un cliente; devuelvo un socket ESPECÍFICO de ese cliente
```

Punto clave: `accept` devuelve un **socket nuevo** para el cliente. El socket "original" sigue a la escucha para aceptar más clientes.

```c
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

int listen_fd = socket(AF_INET, SOCK_STREAM, 0);

struct sockaddr_in addr = {0};
addr.sin_family = AF_INET;
addr.sin_port = htons(8080);
addr.sin_addr.s_addr = htonl(INADDR_ANY);

bind(listen_fd, (struct sockaddr *)&addr, sizeof(addr));
listen(listen_fd, 16);

int client_fd = accept(listen_fd, NULL, NULL);   /* bloquea hasta un cliente */
```

## 4. Flujo del cliente

El cliente se conecta directamente:

```c
int sock = socket(AF_INET, SOCK_STREAM, 0);
addr.sin_addr.s_addr = inet_addr("127.0.0.1");   /* o inet_pton */
connect(sock, (struct sockaddr *)&addr, sizeof(addr));  /* bloquea hasta conectar */
```

Tras el `connect`, el cliente y el servidor ya pueden `write`/`read` entre sí a través de sus sockets.

## 5. Bloquear no es un error

Muchas llamadas se **bloquean**: quedan a la espera sin consumir CPU hasta que ocurre el evento.

- `accept`: espera cliente.
- `connect`: espera la respuesta del servidor.
- `read`: espera datos (si no hay, se bloquea hasta recibir algo o cerrarse la conexión).

Bloquear es lo normal en el modelo más simple. Solo cuando quieras seguir haciendo otra cosa mientras esperas necesitas `select`/`poll`/hilos.

## 6. Cierre

Cada extremo cierra su descriptor. En TCP, cuando el servidor hace `close(client_fd)`, el `read` del cliente acabará devolviendo 0 (EOF). Es importante cerrar **todos** los sockets (`listen_fd` y el de cada cliente) para no agotar descriptores.

## Predicciones y ejercicios

<details><summary>Predicción 1: quién bloquea</summary>

Indica cuáles de estas llamadas pueden bloquear: `socket`, `bind`, `listen`, `accept`, `connect`, `close`.

**Solución**: `accept` y `connect` suelen bloquear (esperan un cliente / una respuesta). `read` sobre un socket también bloquea si no hay datos. `socket`, `bind`, `listen` y `close` generalmente no se quedan esperando eventos de red.
</details>

<details><summary>Predicción 2: cuántos sockets</summary>

Un servidor ha aceptado 5 clientes. ¿Cuántos descriptores de socket "para conexiones" tiene abiertos como mínimo, y cuál sigue permitiendo aceptar más?

**Solución**: 6 descriptores: el `listen_fd` (que sigue a la escucha) y 5 `client_fd` (uno por cliente aceptado). Si quiere aceptar el cliente número 6, debe seguir usando `listen_fd`.
</details>

<details><summary>Predicción 3: mensajes</summary>

El cliente hace dos `write` de 10 bytes seguidos y el servidor hace un solo `read`. ¿Cuántos bytes puede leer el servidor en ese `read` y qué concluye sobre "mensajes"?

**Solución**: Puede leer los 20 bytes (o menos si llegaron parcialmente). TCP es un flujo: no hay fronteras entre `write`. Por eso el protocolo de aplicación debe delimitar los datos; no se puede asumir que un `read` corresponde a un `write`.
</details>

<details><summary>Ejercicio: eco en pseudo-código</summary>

Escribe el esqueleto (pseudo-código, sin detalles de manejo de errores) de un servidor que acepta un cliente y le devuelve (eco) cualquier bytes que reciba, para siempre.

**Solución**:

```text
listen_fd = socket(AF_INET, SOCK_STREAM, 0)
bind(listen_fd, ip=0.0.0.0, puerto=PORT)
listen(listen_fd)
client = accept(listen_fd)          # uno, por simplicidad
loop:
    n = read(client, buf, tamaño)
    if n == 0: break                # EOF: el cliente cerró
    if n < 0: manejar error, break
    write(client, buf, n)           # eco
close(client)
close(listen_fd)
```

El `read` que devuelve 0 marca el cierre del cliente: es el "se acabaron los datos" del flujo.
</details>

## Errores frecuentes

- No revisar el retorno de `socket`/`bind`/`listen`/`accept` (todas pueden fallar y casi siempre por un motivo).
- Dibujar el flujo como "mensajes" en vez de flujo de bytes.
- Olvidar `htons`/`htonl` para el puerto/IP (endianness).
- No cerrar los descriptores y agotar el límite de fds.
- Creer que `bind` "conecta" con algo; `bind` solo asocia el socket a IP+puerto locales, `connect`/`accept` hacen el contacto.
- Usar `inet_addr` (obsoleta) en lugar de `inet_pton`.

## Has aprendido que

- Una conexión TCP es un flujo de bytes bidireccional, no un canal de mensajes.
- Un extremo es IP + puerto; un socket es un descriptor sobre ese extremo.
- Servidor: `socket` → `bind` → `listen` → `accept` (bloquea y devuelve un socket por cliente).
- Cliente: `socket` → `connect`.
- Bloquear es normal; `accept`/`connect`/`read` se quedan esperando el evento.
- `close` cierra el descriptor; el `read` del otro extremo devuelve 0 como EOF.
- El puerto y la IP van en orden de red (big-endian).

## Preguntas tipo defensa

1. ¿Qué diferencia hay entre `bind` y `connect`?
2. ¿Por qué `accept` devuelve un socket y no reutiliza el de `listen`?
3. ¿Qué significa que una llamada "bloquee" y cuáles suelen hacerlo?
4. ¿Por qué un `read` no corresponde a un `write` en TCP?
5. ¿Qué valor devuelve `read` cuando el otro extremo cierra?
6. ¿Por qué hay que convertir el puerto con `htons`?

## Criterio de finalización

- Dibujo el flujo de llamadas de un servidor y un cliente básicos.
- Explico qué hace `bind`, `listen` y por qué `accept` bloquea.
- Razono cuántos descriptores hay abiertos tras aceptar varios clientes.
- Monto un eco TCP mínimo y lo pruebo con `nc` y `strace`.
- Explico por qué TCP es un flujo y qué hay que hacer para delimitar datos.

## Siguiente clase

La clase 2 profundiza en las **direcciones y la conversión**: `struct sockaddr_in`, `htons`/`htonl`, `inet_pton`/`inet_ntop`, y los errores típicos de endianness que cargan de bugs los clientes y servidores.