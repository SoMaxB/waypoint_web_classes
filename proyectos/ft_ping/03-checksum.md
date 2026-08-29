# Etapa 3 — El Internet checksum

**Requisito previo:** [02-protocolo-icmp.md](02-protocolo-icmp.md) · **Siguiente:** [04-construir-enviar.md](04-construir-enviar.md)

---

**Versión llana:** un checksum es un número pequeño calculado a partir del resto del mensaje, para
que el receptor pueda detectar si se corrompió por el camino.

**El algoritmo:** suma todas las palabras de 16 bits del mensaje ICMP (trata el buffer como un array
de `uint16_t`), reintroduce por abajo cualquier acarreo que se salga de los 16 bits ("end-around
carry"), y aplica el complemento a uno (NOT bit a bit) al resultado.

> **Jerga, desmontada** — una *palabra de 16 bits* son simplemente dos bytes leídos como un solo
> número. El *carry-out* (acarreo de salida) es el desbordamiento cuando la suma supera lo que caben
> en 16 bits; *end-around carry* significa volver a sumar ese desbordamiento por abajo en lugar de
> tirarlo. *Complemento a uno* significa invertir todos los bits: los 0 pasan a 1 y al revés.
> Guardarlo invertido es el truco que hace funcionar la comprobación del receptor "súmalo todo y
> comprueba que da cero". Lista completa en [GLOSARIO.md](GLOSARIO.md).

**El orden importa:** pon a cero el propio campo del checksum antes de calcularlo — no puede
incluir su propio valor.

**Caso límite:** un número impar de bytes. Rellena el último byte suelto con un byte a cero antes
de sumarlo como palabra de 16 bits.

---

## Preguntas de control

<details><summary>P1: ¿Por qué hay que poner a cero el campo del checksum antes de calcularlo?</summary>

Forma parte del mismo buffer sobre el que estás sumando. Si ya contuviera un valor viejo, estarías
calculando un checksum que incluye un checksum anterior arbitrario, corrompiendo el valor que
intentas producir.
</details>

<details><summary>P2: ¿Qué haces con un byte impar sobrante al final del buffer?</summary>

Trátalo como el byte alto de una última palabra de 16 bits con el byte bajo a cero, y luego súmalo
al acumulado como cualquier otra palabra.
</details>

---

## Ejercicio

Esta es la única función que puedes testear por completo sin red. Hazlo.

1. Escribe `uint16_t checksum(const void *buf, size_t len)`.
2. **Testea la propiedad autoverificable:** calcula el checksum de un buffer, escríbelo en el campo
   del checksum, y vuelve a ejecutar `checksum()` sobre *todo* el buffer. El resultado debe ser `0`.
   Ese es el truco de validación del lado receptor y demuestra que tu acarreo es correcto.
3. **Testea la ruta de longitud impar** explícitamente con buffers de 7 y 9 bytes. Confirma que no
   lees un byte más allá del final (ejecútalo con `valgrind` o `-fsanitize=address` — un error de
   uno aquí es un clásico).
4. **Testea contra la realidad:** coge un paquete ICMP real de tu captura de tcpdump de la Etapa 2,
   pon su campo checksum a cero, pasa el tuyo por encima y confirma que reproduces exactamente el
   valor capturado.
5. Testea el buffer todo a ceros y el buffer todo a `0xff`.

**Terminado cuando:** los cinco casos pasen y ASan/valgrind estén limpios. Guarda este arnés de
tests: lo querrás de nuevo si alguna respuesta parece incorrecta.

> **Nota sobre aliasing:** convertir un buffer `char *` a `uint16_t *` puede chocar con las reglas
> de strict-aliasing y de acceso desalineado. Leer dos bytes y combinarlos, o usar `memcpy` a un
> `uint16_t`, es la vía portable. Conviene saberlo aunque el cast ingenuo funcione en x86.

---

## Lecturas

- **RFC 1071** — "Computing the Internet Checksum". Las secciones 1 y 4.1 dan el algoritmo y una
  implementación de referencia en C. Esta es la fuente definitiva
- **RFC 792** — el párrafo del campo Checksum en la especificación del mensaje Echo (dice qué rango
  cubre)
- `man 1 valgrind` o la documentación de `-fsanitize=address` de GCC — para el paso 3.
  **GCC** = **G**NU **C**ompiler **C**ollection · **ASan** = **A**ddress **San**itizer, una función
  del compilador que detecta lecturas y escrituras fuera de tus buffers en tiempo de ejecución ·
  *valgrind* no es un acrónimo, es solo un nombre
