# Clase 6: `ft_strcpy` y `ft_strcmp`

## Objetivo

Dominar funciones con **dos punteros** y la semántica de `unsigned char`. Al terminar debes poder explicar por qué `ft_strcpy` debe guardar el `dst` original para el retorno, por qué debe copiar el terminador `\0`, y por qué `ft_strcmp` debe cargar bytes con `movzx` y devolver `byte1 - byte2` como `unsigned char`. Ambas son hojas: no tocan la pila.

## 1. Contratos

```c
char *ft_strcpy(char *dst, const char *src);
int   ft_strcmp(const char *s1, const char *s2);
```

ABI:

```text
ft_strcpy: rdi = dst, rsi = src, retorno rax = dst original
ft_strcmp: rdi = s1,  rsi = s2,  retorno eax = diff como unsigned
```

El llamador garantiza espacio en `dst`. Ambas con comportamiento indefinido si algún puntero es `NULL`.

## 2. `ft_strcpy`: copiar todo, incluido `\0`

### Algoritmo

```c
char *ft_strcpy(char *dst, const char *src) {
    char *orig = dst;
    while ((*dst++ = *src++) != '\0')
        ;
    return orig;
}
```

Versión con índices:

```c
char *ft_strcpy(char *dst, const char *src) {
    char *ret = dst;
    size_t i = 0;
    do {
        dst[i] = src[i];
    } while (src[i++] != '\0');
    return ret;
}
```

Invariante: *todo lo copiado hasta `i-1` coincide y aún no se ha copiado un `\0` salvo en la última iteración*.

### Tres errores que suspenden

1. Devolver `rdi` avanzado en lugar de `rax` original.
2. Parar antes de copiar el `\0` (dejar `dst` sin terminar).
3. Incrementar `rdi/rsi` antes de guardar `rax`.

### Implementación NASM

```nasm
default rel
section .text
global ft_strcpy
ft_strcpy:
    mov     rax, rdi          ; guardar dst original
.loop:
    mov     dl, byte [rsi]
    mov     byte [rdi], dl
    test    dl, dl
    je      .done
    inc     rdi
    inc     rsi
    jmp     .loop
.done:
    ret
section .note.GNU-stack noalloc noexec nowrite progbits
```

`dl` es el byte bajo de `rdx` (caller-saved, libre). `test dl,dl` fija `ZF` sin destruir el byte copiado. Alternativa con `al`:

```nasm
mov al, [rsi] / mov [rdi], al / test al,al
```

No uses `movzx` aquí: solo copias el byte, no lo interpretas.

## 3. `ft_strcmp`: comparar como `unsigned char`

### Por qué `unsigned`

La norma C dice que `strcmp` compara bytes como `unsigned char`. Diferencia crítica:

```text
s1 = {0xFF, 0}  // 255 si unsigned, -1 si signed
s2 = {0x01, 0}  // 1
signed:   -1 - 1 = -2  (signo <0, mal)
unsigned: 255 - 1 = 254 (signo >0, bien)
```

Debes evitar extensión de signo al cargar. `movzx eax, byte [rdi]` extiende con ceros; `movsx` extendería con el bit de signo.

### Algoritmo

```c
int ft_strcmp(const char *s1, const char *s2) {
    while (1) {
        unsigned char c1 = *s1;
        unsigned char c2 = *s2;
        if (c1 != c2) return c1 - c2;
        if (c1 == '\0') return 0;
        s1++; s2++;
    }
}
```

### Implementación NASM

```nasm
default rel
section .text
global ft_strcmp
ft_strcmp:
.loop:
    movzx   eax, byte [rdi]
    movzx   ecx, byte [rsi]
    cmp     al, cl
    jne     .diff
    test    al, al
    je      .equal
    inc     rdi
    inc     rsi
    jmp     .loop
.diff:
    sub     eax, ecx
    ret
.equal:
    xor     eax, eax
    ret
section .note.GNU-stack noalloc noexec nowrite progbits
```

`eax`/`ecx` son caller-saved. `sub eax,ecx` produce el diff con signo correcto porque ambos ya son 0..255. Retorno `int` en `eax` (32 bits, se extiende a `rax`).

No reduzcas el resultado a `-1/0/1`: el subject permite devolver la diferencia exacta y es lo que hace libc en esta plataforma.

## 4. Casos de prueba

`ft_strcpy`:

| src | verificación |
|---|---|
| `""` | copia solo `\0`, `ret == dst`, `dst[1]` intacto |
| `"a"` | un char + `\0` |
| `"hola"` | normal, `ret == dst` |
| buffer con `X` | `dst[strlen(src)]==0` y `dst[strlen+1]=='X'` |

`ft_strcmp`:

| s1 | s2 | esperado |
|---|---|---|
| `""` | `""` | 0 |
| `"a"` | `"a"` | 0 |
| `"a"` | `"b"` | <0 |
| `"b"` | `"a"` | >0 |
| `"abc"` | `"abcd"` | <0 (`0 - 'd' = -100`) |
| `"abcd"` | `"abc"` | >0 |
| `{0x80,0}` | `{0x00,0}` | >0 (128) |
| `{0xFF,0}` | `{0x01,0}` | >0 (254) |

Comparar signo con `strcmp` y, en esta plataforma, valor exacto.

## Predicciones y ejercicios

### Ejercicio 1: strcpy paso a paso

`src="Hi"` en `0x9000` (`48 69 00`), `dst` en `0x8000`, `rdi=0x8000 rsi=0x9000 rax=0x8000`.

1. ¿Qué valor se escribe en cada iteración y cuándo paras?
2. ¿Qué devuelve la función?

<details><summary>Solución</summary>

```text
rax = 0x8000 fijo
iter1: dl=0x48 -> [0x8000]=0x48, dl!=0 -> rdi=0x8001 rsi=0x9001
iter2: dl=0x69 -> [0x8001]=0x69, dl!=0 -> rdi=0x8002 rsi=0x9002
iter3: dl=0x00 -> [0x8002]=0x00, dl==0 -> je .done, ret rax=0x8000
3 iteraciones, la última copió el \0 y paró.
Si devuelves rdi (0x8003) es FAIL.
```

</details>

### Ejercicio 2: strcpy sin \0

¿Qué pasa si haces `je .done` antes de `mov [rdi],dl`?

<details><summary>Solución</summary>

```text
No copias el terminador. dst queda sin \0, strlen(dst) lee basura
hasta el siguiente 0 aleatorio. El tester de X detecta dst[len+1]!='X'.
```

</details>

### Ejercicio 3: cmp con signo

`s1={0xFF,0} s2={0x01,0}`. Calcula signed vs unsigned.

<details><summary>Solución</summary>

```text
signed (movsx): 0xFF -> -1, diff -2 (<0) mal
unsigned (movzx): 0xFF -> 255, diff 254 (>0) bien, coincide con strcmp
```

</details>

### Ejercicio 4: prefijo

`"abc"` vs `"abcd"`. ¿Qué bytes compara en `i=3` y qué signo devuelve?

<details><summary>Solución</summary>

```text
i=3: c1=0x00, c2='d'(0x64), c1!=c2 -> return 0 - 100 = -100 (<0)
"abc" < "abcd" porque \0 < 'd'.
```

</details>

### Ejercicio 5: retorno de strcmp

¿Debe `ft_strcmp` devolver solo -1/0/1?

<details><summary>Solución</summary>

```text
No. Debe devolver c1 - c2 como unsigned char. En esta plataforma
"abc" vs "abcd" devuelve -100, no -1. Reducir a -1 perdería test exacto
aunque el signo seguiría bien.
```

</details>

### Ejercicio 6: manejo de rdi/rsi

¿Por qué `ft_strcpy` hace `mov rax,rdi` al inicio y no al final?

<details><summary>Solución</summary>

```text
Porque rdi avanza durante la copia. Al final rdi apunta al \0 copiado,
no al inicio. Solo rax guardado al inicio conserva dst original.
```

</details>

## Errores frecuentes

- Devolver `rdi` avanzado en `ft_strcpy`.
- No copiar el `\0`.
- Usar `movsx` o `mov al,[rdi]` con extensión de signo en `ft_strcmp`.
- Comparar `rdi` vs `rsi` en lugar de `[rdi]` vs `[rsi]`.
- Devolver `-1/0/1` en lugar de `c1-c2`.
- Usar `eax` de 32 bits para contador en `strcpy` (no aplica, pero confundir con `strlen`).
- Tocar la pila sin necesidad en hojas.

## Has aprendido que

- `rdi`/`rsi` son 1º y 2º argumentos; `rax`/`eax` es retorno.
- `ft_strcpy` preserva `dst` original en `rax` y copia el `\0`.
- `ft_strcmp` carga con `movzx` para semántica `unsigned char`.
- `c1 - c2` con `sub eax,ecx` da signo y valor correctos.
- Prefijo: `\0` vs `char` decide el signo.
- Ambas son hojas: no necesitan `push`/`rsp`.

## Preguntas tipo defensa

1. ¿Qué hace `mov rax,rdi` en `ft_strcpy` y por qué al inicio?
2. ¿Por qué debes copiar el `\0` y cómo lo verificas con buffer de `X`?
3. ¿Qué diferencia hay entre `movzx` y `movsx` y cuál usa `strcmp`?
4. ¿Qué devuelve `strcmp({0xFF},{0x01})` y por qué?
5. ¿Qué signo da `"abc"` vs `"abcd"` y qué bytes se restan?
6. ¿Debe `ft_strcmp` devolver `-1/0/1` o `c1-c2`?
7. ¿Por qué `test dl,dl` tras `mov`?
8. ¿Qué registros puedes destruir en estas hojas?
9. ¿Cómo verificas `ret == dst` en el tester?
10. ¿Cómo compruebas `U` vs `T` con `nm`?

## Criterio de finalización

La clase está completa cuando puedes:

- Escribir ambos `.s` de memoria con plantilla `global` + `GNU-stack`.
- Explicar por qué `strcpy` guarda `rax` y copia `\0`.
- Explicar `unsigned char` y demostrar `movzx` con `0xFF` vs `0x01`.
- Pasar matriz `strcpy` (5 casos + ret) y `strcmp` (8 casos incluyendo `0x80`/`0xFF`) comparando signo y valor contra libc.
- Inspeccionar `nm` (`T ft_strcpy`, `T ft_strcmp`) y `objdump`.

## Siguiente clase

Clase 7: frontera usuario/kernel, registros de syscall (`rax` número, `rdi/rsi/rdx` args, `rcx/r11` destruidos), retornos negativos del kernel y `strace`. Base para `ft_write`/`ft_read`.

## Lista de lecturas

- `man 3 strcpy` — copia incluido `\0`, retorno `dst`.
- `man 3 strcmp` — comparación como `unsigned char`, retorno `c1-c2`.
- `man 7 ascii` — `0x00` vs `0x80` vs `0xFF`.
- Intel SDM Vol.2 `MOVZX`/`MOVSX`/`CMP`/`TEST`.
- `GUIA_LIBASM.md` §10-11 — casos de prueba y trampas.
