# Clase 9: formato de salida exacto y el Makefile

## Objetivo

Clavar la presentación y la construcción. Al terminar debes reproducir la salida de `inetutils-2.0` (diff vacío salvo líneas de RTT/DNS inverso exentas, verificado con `diff` y `cat -A`) y tener un `Makefile` con `all/clean/fclean/re` que recompila/reenlaza solo lo necesario vía `-MMD -MP`.

## 1. Qué se puntúa en la salida

El subject compara con `diff` tu indentación contra `inetutils-2.0`, salvo la línea de RTT y la de DNS inverso. Espacios finales y tabuladores cuentan; `diff` puede ocultarlos, así que usa `cat -A` para verlos.

Ejemplo de salida canónica:

```
PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.
64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.043 ms
```

Notas: `icmp_seq` empieza en **1** (no 0), cabecera `56(84)` completa, no `PING 8.8.8.8 (8.8.8.8)` a secas.

## 2. Comparar contra la referencia

Tu imagen Docker ya instala `ping-ref` (ver `docker/Dockerfile` / `docker/check-env.sh`; falla explícito si falta):

```sh
which ping-ref && ping-ref --version
```

Si no está, compila `inetutils-2.0` correctamente:

```sh
curl -O https://ftp.gnu.org/gnu/inetutils/inetutils-2.0.tar.gz
tar xf inetutils-2.0.tar.gz && cd inetutils-2.0
./configure --disable-servers --disable-ftp
make -k -j"$(nproc)" || true
test -f ping/ping
```

Detalles: no limites a `ping/` (necesita `libicmp/`), `--disable-ftp` evita `rpl_glob` con glibc moderno, `-k` es red de seguridad.

Comparación (recuerda que `-c` no es tu flag; acota con `timeout` o con tu `-t` cuando exista):

```sh
sudo ping-ref -c 3 8.8.8.8 > ref.txt 2>&1
sudo timeout 3 ./ft_ping 8.8.8.8 > mine.txt 2>&1
diff <(sed -E 's/[0-9]+\.[0-9]+ ms//' ref.txt) \
     <(sed -E 's/[0-9]+\.[0-9]+ ms//' mine.txt)
cat -A ref.txt; cat -A mine.txt  # compara espacios
```

Compara también rutas de error: host desconocido, inalcanzable y `-v`.

## 3. Makefile incremental correcto

```make
CFLAGS += -Wall -Wextra -Werror -MMD -MP
-include $(OBJS:.o=.d)
```

- `-MMD` genera `.d` con headers reales incluidos por cada `.c`.
- `-MP` añade phony targets para que borrar/renombrar un `.h` no rompa.
- Cada `.o` depende de su `.c` y sus `.h`; `make` dos veces sin cambios dice `nothing to be done`; `touch` a un `.c` solo recompila ese objeto + reenlaza; `touch` a `.h` recompila a los que lo incluyen.

Verifica:

```sh
make        # compila
make        # nada
touch foo.c && make  # solo foo.o + link
touch foo.h && make  # todos los que incluyen foo.h
make re && make fclean  # limpio sin .o/.d/bin
```

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué líneas eximes al comparar?

`ref.txt` y `mine.txt` difieren en `time=0.042 ms` y en `64 bytes from host.example.com (1.2.3.4)` vs `64 bytes from 1.2.3.4`. ¿Filtras?

<details><summary>Solución</summary>

Sí: RTT (`[0-9]+\.[0-9]+ ms`) y DNS inverso (línea con hostname). El resto debe casar incluso en espacios; verifica con `cat -A`.

</details>

### Ejercicio 2 — ¿por qué `-MMD -MP` y no lista manual de `.h`?

Lista manual `foo.o: foo.c foo.h` funciona hoy; añades `#include "bar.h"` y se olvida actualizar. ¿Qué pasa con `touch bar.h`?

<details><summary>Solución</summary>

`make` no recompila `foo.o` aunque depende de `bar.h` → binario obsoleto. Con `-MMD`, el `.d` se regenera y `make` sí lo sabe.

</details>

### Ejercicio 3 — `cat -A` revela un espacio final

`diff` dice vacío pero `cat -A ref.txt` muestra ` bytes from 1.2.3.4: $` y el tuyo ` bytes from 1.2.3.4:  $` (dos espacios). ¿Pasa la evaluación?

<details><summary>Solución</summary>

No: la indentación se puntúa y `cat -A` delata el espacio extra. Ajusta tu `printf` al formato exacto de `ping/ping.c` de `inetutils` (ancho `%-*s`, precisión).

</details>

## Errores frecuentes

- Compilar `inetutils` solo en `ping/` (falta `libicmp`).
- Olvidar `--disable-ftp` → fallo de enlace `rpl_glob`.
- Lista manual de headers sin `-MMD` → recompilación incompleta.
- Regla que siempre reenlaza aunque nada cambió (`make` nunca dice `nothing to be done`).
- Comparar `diff` sin normalizar RTT/DNS inverso → falsos positivos.

## Has aprendido que

- La salida debe casar con `inetutils-2.0` salvo RTT/DNS inverso; `cat -A` es tu verdad en espacios.
- `ping-ref` viene de la imagen Docker; si lo compilas, haz `./configure --disable-servers --disable-ftp` y `make -k` en la raíz.
- `-MMD -MP` + `-include` dan dependencias automáticas correctas.

## Preguntas tipo defensa

1. ¿Qué dos líneas están exentas de comparación exacta y por qué?
2. ¿Cómo demuestras con `cat -A` que tu indentación es correcta?
3. ¿Por qué `--disable-ftp` al configurar `inetutils`?
4. ¿Qué hace `-MMD` y `-MP` y por qué no listas `.h` a mano?
5. ¿Cómo demuestras que tu `Makefile` es incremental (tres pruebas)?

## Criterio de finalización

- `diff` tras normalizar RTT es vacío y `cat -A` coincide en cada línea (éxito, error, `-v`).
- `make` → `make` no recompila; `touch .c` solo ese `.o`+link; `touch .h` recompila dependientes; `make fclean` limpia `.o/.d/bin`.

## Siguiente clase

La clase 10 hace la auditoría completa de la parte obligatoria y ensaya la defensa; la 11 (bonus) solo si la obligatoria es perfecta.

## Lecturas

- inetutils-2.0 `ping/ping.c` / `ping/ping_echo.c` — `printf` reales
- `man 3 printf` — `%.3f`, `%-*s`
- GNU Make "Generating Prerequisites Automatically" — patrón `-MMD -MP`
- `man 1 diff`, `man 1 cat` (`-A`)
