# Glosario: Sockets

Referencia de los términos que aparecen en este concepto, en español. Se publica como glosario bilingüe cuando el concepto se publica.

| Término | Significado literal | Descripción de uso |
|---|---|---|
| socket | Toma / extremo | Descriptor de archivo que representa un extremo de una comunicación de red. |
| TCP | Transmission Control Protocol | Protocolo de flujo de bytes orientado a conexión y confiable. |
| UDP | User Datagram Protocol | Protocolo de datagramas sin conexión y sin garantía de entrega. |
| flujo de bytes | Byte stream | Secuencia ordenada de bytes; el receptor no ve "mensajes", solo datos. |
| IP | Internet Protocol | Dirección numérica que identifica un host en la red (p. ej. `127.0.0.1`). |
| puerto | Port | Número de 16 bits que identifica un servicio dentro de un host. |
| sockaddr_in | Socket address internet | Estructura con familia, puerto e IP para IPv4. |
| sockaddr | Socket address | Tipo genérico al que se hace cast desde las estructuras específicas. |
| htons | Host TO Network Short | Convierte un entero corto de orden de host a orden de red (big-endian). |
| ntohs | Network TO Host Short | Convierte de orden de red a host. |
| inet_pton | Internet presentation to numeric | Convierte una IP en texto (`"127.0.0.1"`) a formato binario. |
| inet_ntop | Informatic the inverse | Convierte una IP binaria a texto. |
| SOCK_STREAM | Stream socket | Tipo de socket orientado a conexión (flujo, normalmente TCP). |
| SOCK_DGRAM | Datagram socket | Tipo de socket de datagramas (normalmente UDP). |
| AF_INET | Address family internet | Familia de direcciones IPv4. |
| socket() | — | Crea un descriptor de socket. |
| bind() | Vincular | Asocia un socket a una IP y un puerto local. |
| listen() | Escuchar | Marca un socket como servidor a la escucha. |
| accept() | Aceptar | Bloquea hasta que llega un cliente y devuelve un socket nuevo para ese cliente. |
| connect() | Conectar | Desde el cliente, establece la conexión con un servidor. |
| INADDR_ANY | Any address | Constante para escuchar en todas las interfaces. |
| blocking / bloqueo | Suspensión | Llamada que espera (sin consumir CPU) hasta que ocurra un evento. |
| descriptor (fd) | File descriptor | Entero que identifica un recurso abierto (archivo, socket, pipe). |
| big-endian | Extremo grande primero | Orden de bytes en la red; hay que convertirlo desde el orden de la máquina. |
| `nc` | Netcat | Herramienta de prueba para hablar con un socket por la terminal. |
| socket raw | Raw socket | Socket que permite construir paquetes de protocolo a mano (p. ej. ICMP). |