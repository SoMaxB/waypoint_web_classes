# Clase 3: ABI System V x86-64

## Objetivo

Dominar el contrato binario que permite que tu stub en ensamblador crudo conviva con el código C del binario original sin corromper nada. Al terminar debes justificar qué registros preservar, por qué `rsp` debe quedar intacto, por qué el salto de vuelta es `jmp` y no `call`, y por qué el direccionamiento debe ser `rip`-relativo para PIE.

## 1. Qué es la ABI y por qué aquí sí te importa

La ABI es el acuerdo de bajo nivel: en qué registros viajan los argumentos, quién preserva qué, cómo se alinea la pila. Normalmente el compilador lo hace por ti; aquí tu stub es asm manual, así que si violas la ABI el programa puede crashear **después** del descifrado, lejos del bug real.

## 2. Paso de argumentos

| Orden | Función C | Syscall (`syscall` instr.) |
|---|---|---|
| 1º | `rdi` | `rdi` |
| 2º | `rsi` | `rsi` |
| 3º | `rdx` | `rdx` |
| 4º | `rcx` | `r10` ← ¡cambia! |
| 5º | `r8` | `r8` |
| 6º | `r9` | `r9` |

Retorno en `rax`. Args extra por pila, pero no los necesitarás.

> El `syscall` usa `rcx` internamente para guardar la dirección de retorno; por eso el 4º arg va en `r10`. Solo importa si llamas a `mmap` o similares con 4+ args.

## 3. Registros: quién preserva qué

| Tipo | Registros |
|---|---|
| **Caller-saved** (volátiles) | `rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11` |
| **Callee-saved** (preservados) | `rbx, rbp, r12, r13, r14, r15` |
| Especial | `rsp` — debe quedar como estaba |

Cuando termines de descifrar y saltes al entry original, todo callee-saved que hayas tocado debe estar restaurado. `rsp` es el más sensible: si dejas `push` sin `pop` o desalineas la pila, el crash puede aparecer funciones después.

## 4. Alineación de la pila

Antes de un `call`, `rsp % 16 == 0` (tras el `push` de la dirección de retorno, dentro de la función `rsp % 16 == 8`). Si tu stub llama a algo (poco probable si solo usas syscalls crudas), debes respetarlo o `movaps` dentro de la libc puede fallar por desalineación.

Para `_start` el kernel entrega la pila con `argc` arriba seguido de `argv/envp/auxv`, no como una llamada normal. No necesitas tocarla — solo no dejarla sucia.

## 5. Salto de vuelta: `jmp`, no `call`

Para transferir el control al `_start` original, usa `jmp` directo. Un `call` empujaría una dirección de retorno que nunca se usa (`_start` no hace `ret`, termina en `exit`), dejando basura en la pila respecto al estado que el kernel preparó.

```asm
; mal
call [rel orig_entry]  ; empuja ret addr
; bien
jmp  [rel orig_entry]  ; preserva la pila del kernel
```

## 6. Absoluto vs relativo — PIE

Si el original es `ET_DYN` (PIE, el caso por defecto moderno), todas las direcciones del fichero son relativas a una base aleatoria (ASLR). Tu stub debe usar `lea reg, [rel etiqueta]` para datos y un salto calculado como offset, no como dirección absoluta. Comprueba `e_type` y no asumas `ET_EXEC`.

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué registros puedes destruir libremente en el stub?

Usas `rax, rbx, r12` en el bucle de descifrado. ¿Cuáles debes restaurar?

<details><summary>Solución</summary>

`rax` es caller-saved: puedes destruirlo. `rbx` y `r12` son callee-saved: debes guardarlos al entrar (`push`) y restaurarlos (`pop`) antes del `jmp`.

</details>

### Ejercicio 2 — ¿por qué `jmp` y no `call`?

Un compañero propone `call orig_entry` porque "es como llamar a una función". ¿Qué deja mal en la pila?

<details><summary>Solución</summary>

`call` hace `push rip+len`. La pila del kernel al arrancar tiene `argc` en la cima; tras el `call` hay una palabra extra (la dirección de retorno) que `_start` no espera. Ninguna función hace `ret` para consumirla; queda desalineada.

</details>

### Ejercicio 3 — alineación

Tu stub hace `push rbx` (8 bytes) y luego `call write_wrapper`. ¿Sigue alineada la pila?

<details><summary>Solución</summary>

Al entrar al stub, `rsp % 16 == 8` (estado tras el `call` implícito del kernel no aplica, pero el kernel alinea la pila para `_start`). Tras `push rbx`, `rsp % 16 == 0`. El `call` empujará 8 y dejará `rsp % 16 == 8` dentro de la función llamada — correcto. Si haces dos `push` sin compensar, quedará desalineada.

</details>

### Ejercicio 4 — rip-relativo

Tienes `msg: db "....WOODY....", 10` en el stub. Accedes con `mov rsi, msg`. ¿Funciona con PIE?

<details><summary>Solución</summary>

No de forma robusta: `msg` sería una dirección absoluta del momento de enlazado de prueba. Usa `lea rsi, [rel msg]` para que sea relativa a `rip` y funcione en cualquier base de carga.

</details>

## Errores frecuentes

- Usar `rcx` como 4º arg de syscall en vez de `r10`.
- Tocar `rbx/rbp/r12-r15` sin guardar/restaurar.
- Dejar `rsp` desalineada o con `push` sin `pop`.
- Hacer `call` al entry original en vez de `jmp`.
- Hardcodear direcciones absolutas para datos/clave/entry en el stub.

## Has aprendido que

- Args 1-6 van en `rdi,rsi,rdx,rcx/r10,r8,r9`; retorno en `rax`.
- Caller-saved se pueden destruir; callee-saved deben preservarse.
- `rsp` y su alineación a 16 son sagrados.
- El salto al original es `jmp`, no `call`.
- Todo acceso a datos en el stub debe ser `rip`-relativo para PIE.

## Preguntas tipo defensa

1. ¿Qué registros deben preservarse y por qué `rsp` es especial?
2. ¿Por qué el 4º arg de syscall va en `r10`?
3. ¿Por qué `jmp` y no `call` para volver a `_start`?
4. ¿Qué pasa si desalineas la pila y la libc ejecuta `movaps`?
5. ¿Cómo escribes un acceso a `msg` que funcione con ASLR?

## Criterio de finalización

- Escribes en papel la secuencia `save callee-saved → descifrado con caller-saved → restore → jmp [orig_entry]` justificando cada paso.
- Señalas en un `objdump` del stub qué accesos son `rip`-relativos y cuál es el `jmp` final.
- Explicas el efecto de `call` vs `jmp` sobre `rsp` y `argc`.

## Siguiente clase

La clase 4 deja la teoría de la ABI y te da las syscalls concretas que el stub necesita: `write` para el banner, `mprotect` para descifrar y `exit` para tests aislados.

## Lecturas

- System V AMD64 ABI — secciones de calling convention y stack alignment (usa esta guía como intro, no como reemplazo).
- `man 2 syscall` — convención de registros y destrucción de `rcx/r11`.
- Intel SDM vol.1 §6.4 — `call`/`ret` y pila.
