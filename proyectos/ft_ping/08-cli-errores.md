# Etapa 8 — Parseo de la CLI y gestión robusta de errores

*CLI = **C**ommand-**L**ine **I**nterface — los argumentos y flags que el usuario escribe después
del nombre del programa.*

**Requisito previo:** [07-senales-estadisticas.md](07-senales-estadisticas.md) · **Siguiente:** [09-salida-makefile.md](09-salida-makefile.md)

---

**Versión llana:** `-v` significa verbose (sacar a la luz los problemas a nivel de paquete en lugar
de ignorarlos en silencio); `-?` significa imprimir el uso y salir.

**Innegociable según el subject:** el programa nunca puede caerse de forma inesperada (ni segfault,
ni bus error, ni double free). Toda syscall que pueda fallar — `socket`, `sendto`, `recvfrom`,
`getaddrinfo`, … — necesita que se compruebe su valor de retorno, con un mensaje de error limpio y
una salida controlada.

**Patrón de diseño:** centraliza el reporte de errores (un pequeño helper estilo
`ft_error()`/`perror`) para que todas las rutas de fallo se comporten igual.

> **Nombres, desglosados** — `perror` = **p**rint **error** · `errno` = **err**or **n**umber, la
> global con el último fallo (solo tiene sentido *inmediatamente* después de la llamada fallida) ·
> `EPERM` = **E**rror: **PERM**ission denied · `EINVAL` = **E**rror: **INVAL**id argument ·
> `getopt` = **get** **opt**ion. Todas las constantes de error empiezan por **E** de **E**rror.
> Lista completa en [GLOSARIO.md](GLOSARIO.md).

---

## Preguntas de control

<details><summary>P1: ¿Por qué el subject asocia -v específicamente a sacar a la luz problemas a nivel de paquete?</summary>

Los problemas que aparecen al parsear respuestas individuales (por ejemplo un error inducido por el
TTL) no deben detener el programa entero — el comportamiento esperado es informar de ellos (cuando
`-v` está activo) y seguir ejecutándose, no tratarlos como fatales.
</details>

<details><summary>P2: ¿Qué ventaja tiene un helper de errores centralizado frente a llamadas a perror() dispersas?</summary>

Consistencia y mantenibilidad — todas las rutas de error salen con el mismo formato, y si más
adelante necesitas cambiar el comportamiento (códigos de salida, filtrado por `-v`) lo cambias en un
solo sitio en lugar de perseguir cada punto de llamada.
</details>

---

## Ejercicio

1. Escribe el parser de argumentos a mano (`getopt` suele estar permitido en ft_ping, pero comprueba
   la lista de funciones autorizadas de tu subject antes de depender de él). Soporta como mínimo
   `-v` y `-?`.
2. Escribe el helper centralizado desde el principio, antes de necesitarlo:
   ```c
   void ft_error(const char *ctx);          /* estilo perror, usa errno */
   void ft_fatal(const char *fmt, ...);     /* mensaje + salida controlada */
   void ft_verbose(const char *fmt, ...);   /* no hace nada salvo con -v */
   ```
   Después convierte a estos helpers todos los puntos de error existentes. Luego haz grep de
   `perror(` y `exit(` en tu código — cualquier aparición fuera de estas tres funciones es una fuga
   en la abstracción.
3. **Pasada de entradas adversas.** Cada una de estas debe producir un mensaje limpio y una salida
   controlada, nunca un crash:

   | Entrada | Esperado |
   |---|---|
   | `./ft_ping` (sin argumentos) | error de uso, salida distinta de cero |
   | `./ft_ping ""` | error de resolución limpio |
   | `./ft_ping -z` | error de opción desconocida |
   | `./ft_ping 999.999.999.999` | error de resolución limpio |
   | `./ft_ping $(python3 -c 'print("a"*5000)')` | sin desbordamiento de buffer |
   | `./ft_ping -- -v` | tratado con sensatez |
   | `./ft_ping host1 host2` | igual que la implementación de referencia |

4. **Comprueba fugas en todas las rutas de salida**, no solo en la buena:
   `valgrind --leak-check=full --show-leak-kinds=all ./ft_ping ...` en cada fila de arriba, más en
   la ruta de Ctrl+C. `freeaddrinfo` y `close(sock)` son las dos cosas que se olvidan en las salidas
   por error.
5. Confirma que los códigos de salida coinciden con los del ping de referencia (`echo $?`): 0 si se
   recibieron respuestas, distinto de cero si hubo pérdida total o error.

**Terminado cuando:** cada fila de la tabla salga limpiamente, con cero errores de valgrind y cero
fugas.

---

## Lecturas

- `man 3 getopt` — incluidos los mecanismos de reporte de error `optopt`/`opterr`
- `man 3 perror` y `man 3 errno` — y la advertencia de que `errno` solo tiene sentido inmediatamente
  después de una llamada fallida
- `man 3 strerror` / `strerror_r` — para construir tu propio formato de mensaje
- `man 1 valgrind` — `--leak-check=full`, `--show-leak-kinds=all`, `--track-origins=yes`
- El PDF del subject de ft_ping — relee la lista de funciones autorizadas y la cláusula de "nunca
  puede caerse"
