# Clase 8: parseo de la CLI y gestión robusta de errores

## Objetivo

Hacer que el programa nunca crashee ante entradas adversas y que `-v` informe sin abortar. Al terminar debes parsear `-v/-?`, centralizar errores en helpers (`ft_error/ft_fatal/ft_verbose`), soportar tablas de entradas adversas con `valgrind` limpio y códigos de salida compatibles con la referencia.

## 1. `-v` y `-?` según el subject

- `-v` = verbose: muestra problemas a nivel de paquete (p. ej. TTL forzado) sin detener el bucle.
- `-?` = ayuda y salida correcta.
- El programa nunca puede salir inesperadamente; toda syscall (`socket/sendto/recvfrom/getaddrinfo...`) se comprueba y sale controlada con mensaje limpio.

## 2. Helper centralizado

```c
void ft_error(const char *ctx);        // estilo perror, usa errno
void ft_fatal(const char *fmt, ...);   // mensaje + salida controlada
void ft_verbose(const char *fmt, ...); // no-op sin -v
```

Después convierte todos los errores existentes a estos helpers y haz `grep` de `perror/exit` fuera de ellos — cualquier aparición es una fuga de abstracción.

## 3. Tabla de entradas adversas (mínimo)

| Entrada | Esperado |
|---|---|
| `./ft_ping` (sin args) | error de uso, `!=0` |
| `./ft_ping ""` | error de resolución limpio |
| `./ft_ping -z` | opción desconocida |
| `./ft_ping 999.999.999.999` | error de resolución |
| `./ft_ping $(python3 -c 'print("a"*5000)')` | sin overflow |
| `./ft_ping -- -v` | tratado con sensatez |
| `./ft_ping host1 host2` | como la referencia |

Valida con `valgrind --leak-check=full --show-leak-kinds=all` en cada fila y en `Ctrl+C`; olvidos típicos: `freeaddrinfo` y `close(sock)` en salidas de error. Compara `echo $?` con el ping de referencia: 0 si hubo replies, `!=0` si pérdida total o error.

## Predicciones y ejercicios

### Ejercicio 1 — ¿por qué `-v` no debe abortar?

Recibes `Time Exceeded` (type 11) en vez de Echo Reply. Con `-v` informas y sigues; sin `-v` lo ignoras y sigues. ¿Cuándo abortarías?

<details><summary>Solución</summary>

Nunca por un paquete individual. Los errores de paquete se informan (si `-v`) y se sigue ejecutando; solo errores de setup (socket, resolución) terminan el programa.

</details>

### Ejercicio 2 — `getopt` vs parser manual

Tu subject permite `getopt` pero no todos los proyectos lo listan. ¿Qué verificas?

<details><summary>Solución</summary>

La lista de funciones autorizadas del PDF; si `getopt` no está, haz parser manual con `argv` y `optopt/opterr`.

</details>

### Ejercicio 3 — fuga en ruta de error

En `getaddrinfo` éxito → `socket` falla → haces `perror` y `exit` sin `freeaddrinfo`. ¿Cómo lo detectas?

<details><summary>Solución</summary>

`valgrind` muestra `definitely lost` de `getaddrinfo`. La ruta de error debe liberar antes de salir.

</details>

### Ejercicio 4 — 5000 `a`

`python3 -c 'print("a"*5000)'` como hostname. ¿Qué debe pasar con tu buffer `char host[256]`?

<details><summary>Solución</summary>

Si copias sin comprobar longitud, overflow. Debes acotar y, si excede, error controlado "hostname too long" sin escribir fuera.

</details>

## Errores frecuentes

- `perror` disperso en lugar de helpers centralizados.
- Olvidar `freeaddrinfo/close` en alguna salida.
- Tratar `getaddrinfo` con `perror/errno`.
- Abortando en errores de paquete que `-v` solo debe mostrar.

## Has aprendido que

- `-v` informa sin detener; `-?` imprime ayuda; nunca segfault.
- Helpers centralizados dan consistencia y un punto de cambio.
- La tabla de entradas adversas y `valgrind` en cada fila definen "terminado".
- Códigos de salida deben casar con la referencia.

## Preguntas tipo defensa

1. ¿Qué diferencia hay entre error de setup y error de paquete para `-v`?
2. ¿Por qué centralizas `perror/exit` en 3 helpers?
3. ¿Cómo detectas una fuga de `freeaddrinfo` en rutas de error?
4. ¿Qué hace tu programa con `999.999.999.999` y con 5000 `a`?
5. ¿Cómo verificas que tu `echo $?` coincide con `inetutils`?

## Criterio de finalización

- Las 7 filas de la tabla salen limpio, sin crash, con `valgrind` sin leaks.
- `grep` de `perror/exit` fuera de helpers da vacío.
- `echo $?` coincide con la referencia en éxito, pérdida total y error.

## Siguiente clase

La clase 9 compara tu salida con `inetutils-2.0` (`diff`/`cat -A`) y hace que tu Makefile sea incremental con `-MMD -MP`.

## Lecturas

- `man 3 getopt` — `optopt/opterr`
- `man 3 perror` / `man 3 errno` — `errno` solo justo tras el fallo
- `man 3 strerror` / `strerror_r`
- `man 1 valgrind` — `--leak-check=full --show-leak-kinds=all --track-origins=yes`
- PDF del subject — lista de funciones autorizadas y cláusula "nunca puede caerse"
