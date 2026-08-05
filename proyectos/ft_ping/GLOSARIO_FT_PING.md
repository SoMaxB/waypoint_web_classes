# Glosario de ft_ping

Este documento reúne las siglas, estructuras, funciones y herramientas que aparecen durante el proyecto. No hace falta memorizarlo de una vez: úsalo como referencia mientras lees código o haces ejercicios.

## Notación y red

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| ICMP | Internet Control Message Protocol | Protocolo de control usado por ping. Transporta los Echo Request y Echo Reply; viaja sobre IP, sin puertos. |
| Echo Request | Petición de eco | Mensaje ICMP que ping envía (tipo 8, código 0) para comprobar si un host responde. |
| Echo Reply | Respuesta de eco | Mensaje ICMP que el host devuelve (tipo 0, código 0) cuando recibe un Echo Request. |
| tipo (type) | Tipo de mensaje ICMP | Campo de la cabecera que identifica el mensaje: 8 = Echo Request, 0 = Echo Reply. |
| código (code) | Código de mensaje ICMP | Campo que matiza el tipo; para eco vale 0. |
| checksum | Suma de comprobación | Valor calculado sobre todo el paquete ICMP, con el campo a cero durante el cálculo, para detectar corrupción. |
| identifier | Identificador | Campo que asocia un Echo Request con su Reply; ping suele derivarlo del PID. |
| sequence number | Número de secuencia | Campo que numera cada Echo Request enviado, para emparejar respuestas. |
| TTL | Time To Live | Campo de la cabecera IP que limita los saltos de un paquete; se reduce en cada salto y al llegar a cero el paquete se descarta. |
| RTT | Round-Trip Time | Tiempo entre el envío de un Echo Request y la recepción de su Reply. |
| FQDN | Fully Qualified Domain Name | Nombre de host completo con todos sus dominios, por ejemplo `example.com`; hay que resolverlo a una dirección IP. |

## Sockets y direcciones

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| socket | Toma / enchufe | Extremo de comunicación del sistema. Para ping se abre un socket raw de ICMP. |
| raw socket | Socket crudo | Socket que permite construir y leer el protocolo directamente. Ping lo usa con `IPPROTO_ICMP`. |
| `AF_INET` | Address Family, Internet | Familia de direcciones IPv4 usada al crear el socket. |
| `SOCK_RAW` | Socket tipo raw | Tipo de socket que da acceso al protocolo ICMP a nivel de paquete. |
| `IPPROTO_ICMP` | Internet Protocol, ICMP | Protocolo pasado a `socket()` para indicar que se trabajará con ICMP. |
| `sockaddr_in` | Socket address, Internet | Estructura que guarda una dirección IPv4 y un puerto. |
| `inet_pton` | Internet, Presentation to Network | Convierte una dirección IPv4 en texto (`127.0.0.1`) a su forma binaria. |
| `getaddrinfo` | Get address info | Función de libc que resuelve un nombre o servicio a una o varias direcciones (`addrinfo`). |
| `htons` | Host to Network Short | Convierte un entero de 16 bits del orden del host (little-endian en x86) al orden de red (big-endian). |
| `ntohs` | Network to Host Short | Inverso de `htons`: de orden de red a orden del host. |
| big-endian | Extremo grande primero | Orden de bytes de la red: el byte más significativo va primero. |
| puerto | Port | Concepto de transporte (TCP/UDP); ICMP no usa puertos, así que no aplica aquí. |

## Envío y recepción

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `sendto` | Send to | Syscall que envía un datagrama a una dirección concreta. |
| `recvfrom` | Receive from | Syscall que recibe un datagrama e indica de qué dirección llega. |
| `SO_RCVTIMEO` | Socket Option, Receive Timeout | Opción de socket que fija el tiempo máximo de espera en `recvfrom`. |
| `gettimeofday` | Get time of day | Función que devuelve el tiempo real; sirve para medir el RTT con precisión de microsegundos. |
| `timeval` | Time value | Estructura con segundos y microsegundos, usada por `gettimeofday` y los timeouts. |
| cabecera IPv4 | IPv4 header | Cabecera del paquete IP que envuelve al ICMP. Al recibir hay que saltarla según su longitud `ihl`. |
| `ihl` | IP Header Length | Campo de la cabecera IPv4 con su longitud en palabras de 32 bits; multiplicado por 4 da los bytes a saltar. |

## Señales y estadísticas

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `SIGINT` | Signal Interrupt | Señal enviada con Ctrl-C. Ping la usa para detener el bucle y mostrar las estadísticas finales. |
| min / avg / max | Mínimo, medio, máximo | Resumen del RTT en las estadísticas finales. |
| paquetes perdidos | Lost packets | Diferencia entre Echo Request enviados y Reply recibidos, con su porcentaje. |

## Herramientas de verificación

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `make` | Make | Ejecuta las reglas del Makefile para construir solo lo que cambió. |
| `tcpdump` | TCP dump | Muestra los paquetes que pasan por la red; sirve para verificar que se envían y reciben Echos. |
| `strace` | System call trace | Muestra las syscalls del proceso: `socket`, `sendto`, `recvfrom`, `setsockopt`. |
| `gdb` | GNU Debugger | Permite detener el programa y observar buffers y campos de cabecera. |
| `getent` | Get entries | Comprueba la resolución de nombres (FQDN) en el sistema. |
| `inetutils-2.0` | GNU inetutils | Referencia de comportamiento de `ping`: su formato de salida es el modelo a reproducir, salvo excepciones. |

## Regla de lectura

Cuando leas una función o syscall nueva, pregúntate:

1. ¿Qué parámetros recibe y en qué orden?
2. ¿Qué estructura o buffer leo o escribo?
3. ¿El valor es de red (big-endian) o del host (little-endian)? ¿Aplico `htons`/`ntohs`?
4. ¿Puede fallar? ¿Cómo se detecta el fallo y cómo se maneja sin salir inesperadamente?
