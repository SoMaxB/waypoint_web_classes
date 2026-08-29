# Etapa 9 — Formato de salida y el Makefile

**Requisito previo:** [08-cli-errores.md](08-cli-errores.md) · **Siguiente:** [10-flags-bonus.md](10-flags-bonus.md)

---

**Versión llana:** la evaluación compara explícitamente con `diff` la indentación de tu salida
contra la del ping de inetutils-2.0 (salvo la línea del RTT y la de DNS inverso, que están
exentas) — el formato se puntúa, no es cosmético.

**Paso práctico:** compila el ping de inetutils-2.0 en local y compara tu salida en paralelo, en
lugar de adivinar los espacios.

**Makefile:** reglas estándar de 42 (`all`, `clean`, `fclean`, `re`), y debe recompilar y reenlazar
solo lo que haya cambiado de verdad — seguimiento de dependencias en condiciones (los archivos
objeto dependiendo de su `.c` y de los `.h` relevantes), no una regla que reconstruya todo siempre.

> **Nombres, desglosados** — `fclean` = **f**ull **clean** (limpieza completa) · `OBJS` = **obj**ect
> file**s**, los archivos `.o`, compilados pero aún sin enlazar entre sí · **GNU** = un chiste
> recursivo, "**G**NU's **N**ot **U**nix" — el proyecto detrás de `make`, `gcc` y del paquete
> inetutils contra el que comparas · **DNS** = **D**omain **N**ame **S**ystem; el DNS *inverso* es
> la consulta al revés, de dirección a nombre · **RTT** = **R**ound-**T**rip **T**ime.
> Lista completa en [GLOSARIO.md](GLOSARIO.md).
>
> **"Reenlazar"** es volver a ejecutar el paso final que une los `.o` compilados en un solo binario.
> **"Seguimiento de dependencias"** es que el Makefile sepa de qué archivos se construyó cada `.o`,
> para poder decidir qué hay que rehacer de verdad.

---

## Preguntas de control

<details><summary>P1: ¿Por qué el subject menciona explícitamente la indentación exacta?</summary>

El proyecto lo evalúa una persona contra la salida de una implementación de referencia concreta.
Reproducir el formato con precisión — más allá de que sea "funcionalmente correcto" — forma parte de
lo que se puntúa, así que adivinar los espacios te arriesga a perder puntos aunque la lógica de
debajo sea perfecta.
</details>

<details><summary>P2: ¿Qué significa en la práctica "recompilar solo si es necesario"?</summary>

La regla de cada archivo objeto declara sus dependencias reales de fuentes y cabeceras, de modo que
ejecutar `make` dos veces sin cambios no hace nada, y editar un `.c` solo recompila y reenlaza ese
archivo más el binario final — no todo el proyecto.
</details>

---

## Ejercicio

### Parte A — comparar la salida

1. **No hace falta que compiles la referencia tú mismo** — tu imagen Docker ya lo hace en el momento
   de construirse y la instala como `ping-ref` (ver `docker/Dockerfile` y `docker/check-env.sh`, que
   falla de forma explícita si falta). Confirma primero que está:
   ```sh
   which ping-ref && ping-ref --version
   ```
   Solo compílala tú a mano si eso no devuelve nada. Si la compilas a mano, no limites la
   compilación a `ping/` — ping también necesita otras librerías internas (p. ej. `libicmp/`), así
   que eso falla con `No rule to make target '../libicmp/libicmp.a'`. También necesitas
   `--disable-ftp` al configurar: sin eso, `make` intenta compilar `ftp`, que falla al enlazar con
   el glibc moderno (`undefined reference to rpl_glob`/`rpl_globfree`, un desajuste entre gnulib y
   glibc que no merece la pena pelear). `-k` ("keep going") es una red de seguridad adicional por
   si esa opción alguna vez no se reconoce:
   ```sh
   curl -O https://ftp.gnu.org/gnu/inetutils/inetutils-2.0.tar.gz
   tar xf inetutils-2.0.tar.gz && cd inetutils-2.0
   ./configure --disable-servers --disable-ftp
   make -k -j"$(nproc)" || true
   test -f ping/ping   # confirma que ping se compiló
   ```
2. Captura ambas salidas y compáralas, normalizando solo las líneas exentas. **Nota:** `-c count` no
   es uno de los flags que estás implementando (elegiste `-t timeout`/`-o` en su lugar), así que acota
   la referencia con su propio `-c` y la tuya desde fuera con `timeout` del shell:
   ```sh
   sudo ping-ref -c 3 8.8.8.8 > ref.txt 2>&1
   sudo timeout 3 ./ft_ping 8.8.8.8 > mine.txt 2>&1
   diff <(sed -E 's/[0-9]+\.[0-9]+ ms//' ref.txt) \
        <(sed -E 's/[0-9]+\.[0-9]+ ms//' mine.txt)
   ```
   Cuando `-t` funcione (Etapa 10), `sudo ./ft_ping -t 3 8.8.8.8` es la comparación más fiel — la misma
   idea, pero con tu propio flag en lugar de un wrapper de shell.
3. **Compara los espacios en blanco explícitamente** — `diff` puede ocultarlos. Ejecuta
   `cat -A ref.txt` y `cat -A mine.txt` y compara espacios finales y tabuladores. Este es el detalle
   que realmente se puntúa.
4. Compara también las rutas de error: host desconocido, host inalcanzable, salida con `-v`.

### Parte B — el Makefile

5. Usa dependencias autogeneradas en lugar de listar las cabeceras a mano (listarlas a mano se queda
   obsoleto en silencio):
   ```make
   CFLAGS += -Wall -Wextra -Werror -MMD -MP
   -include $(OBJS:.o=.d)
   ```
   `-MMD` = **M**ake **M**ake **D**ependencies (genera un archivo `.d` con las cabeceras que cada
   `.c` incluyó realmente). `-MP` = **M**ake **P**hony targets, para que renombrar o borrar una
   cabecera no rompa la compilación. `CFLAGS` = **C** compiler **flags**, flags del compilador de C.
6. **Verifica que la regla incremental funciona de verdad:**
   - `make` → compila. `make` otra vez → dice "nothing to be done". Si recompila, tu regla está mal.
   - `touch` a un `.c` → solo se recompila ese objeto y se reenlaza.
   - `touch` a un `.h` → se recompilan todos los objetos que lo incluyen. **Esto es lo que fallan
     los Makefiles escritos a mano**, y por eso importa `-MMD`.
7. `make re` desde limpio, luego `make fclean` — confirma que no queda ningún `.o`, `.d` ni binario.

**Terminado cuando:** el diff esté vacío salvo por las líneas exentas, `cat -A` coincida, y las tres
comprobaciones del paso 6 se comporten.

---

## Lecturas

- Código de inetutils-2.0: `ping/ping.c` y `ping/ping_echo.c` — las cadenas de formato de `printf`
  reales contra las que te comparan. Léelas en lugar de adivinar
- `man 3 printf` — especificadores de anchura y precisión (`%.3f`, `%-*s`)
- Manual de GNU Make, "Generating Prerequisites Automatically" — explica el patrón `-MMD -MP`
- `man 1 diff` — `-u`, y `man 1 cat` para `-A`
