# Guía de aprendizaje: Sockets

Concepto transversal a proyectos de 42 como ft_ping, ft_traceroute, minishell (pipes→sockets) o webserv. Se estudia con C y el API de Berkeley sobre Linux. No depende de un subject; el tema es la fuente de verdad.

El objetivo es construir el modelo mental de la red como **canales de bytes entre extremos**, entender el flujo `socket → bind → listen → accept` (servidor) y `socket → connect` (cliente), y saber cuándo una llamada bloquea.

## 1. Itinerario

| Clase | Tema | Resultado |
|---|---|---|
| 1 | Modelo de red y primer par cliente-servidor | Explicar IP/puerto/flujo de bytes y montar un eco TCP mínimo |
| 2 | Direcciones y conversión: `struct sockaddr_in`, `htons`, `inet_pton` | Construir direcciones correctamente sin errores de orden de bytes |
| 3 | Servidores concurrentes: `fork`/hilos, bloqueo, cierre de descriptores | Atender varios clientes a la vez sin fugas ni conexiones colgadas |

## 2. Modelo mental mínimo

- Una conexión TCP es un **flujo de bytes bidireccional** entre dos extremos. No hay "mensajes": el protocolo de aplicación delimita los datos.
- Un **socket** es un descriptor de archivo que representa un extremo de comunicación. Se puede `read`/`write` como un archivo.
- Un extremo se identifica por **IP + puerto**.
- El flujo clásico del servidor: `socket()`, `bind()` (asociar IP+puerto), `listen()` (marcar como a la escucha), `accept()` (aceptar un cliente y obtener un socket nuevo). El cliente: `socket()`, `connect()`.
- Muchas llamadas **bloquean**: `accept` espera un cliente, `connect` espera la respuesta, `read` espera datos. Bloquear no es un error.

## 3. API mínima

```c
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

int sockfd = socket(AF_INET, SOCK_STREAM, 0);      /* TCP */
struct sockaddr_in addr = {0};
addr.sin_family = AF_INET;
addr.sin_port = htons(8080);                       /* red = big-endian */
addr.sin_addr.s_addr = INADDR_ANY;                 /* escuchar en todas las IPs */

bind(sockfd, (struct sockaddr *)&addr, sizeof(addr));
listen(sockfd, 16);
int client = accept(sockfd, NULL, NULL);           /* bloquea hasta un cliente */
```

Compilar con `-Wall -Wextra -Werror`; usar `-pthread` si se atiende con hilos.

## 4. Cómo se estudia

1. **Predecir** qué llamada bloquea y cuál no.
2. **Implementar** un eco TCP en `echo.c` (cliente y servidor).
3. **Probar** con `nc` (netcat) y `strace` para ver las syscalls.
4. **Inspeccionar** descriptores con `lsof`/`/proc` y errores con `perror`/`errno`.
5. **Defender** en voz alta qué estado está cada socket.

## 5. Auditoría del concepto

Antes de cerrar debes responder afirmativamente:

- Explico por qué la red es big-endian y cuándo usar `htons`.
- Diferencio `SOCK_STREAM` (flujo) de `SOCK_DGRAM` (datagramas).
- Escribo un servidor y un cliente TCP que se hablan sin usar funciones prohibidas.
- Sé qué significa bloquear y cuándo una llamada se queda esperando.
- Cierro correctamente sockets y descriptores sin fugas.
- Distingo `struct sockaddr` de `struct sockaddr_in` y por qué se hace cast.

## 6. Siguientes pasos

- El concepto de **ft_ping** explora los sockets raw (`SOCK_RAW` + `IPPROTO_ICMP`).
- Para servidores de alto volumen, se combinan hilos (**Hilos POSIX**) y `select`/`poll`.

## 7. Referencias

- `man 7 ip`, `man 7 socket`, `man 2 bind`, `man 2 listen`, `man 2 accept`, `man 2 connect`, `man 2 socket`, `man 3 inet_pton`, `man 3 htons`.
- RFC 793 (TCP) para la semántica del flujo.
