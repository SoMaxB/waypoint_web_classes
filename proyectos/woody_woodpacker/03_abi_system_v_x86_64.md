# ABI System V x86-64

*Guía de estudio para woody_woodpacker (42) — imprescindible para que el stub no rompa nada al saltar de vuelta*

## 1. Qué es un ABI y por qué es crítico aquí

El ABI (Application Binary Interface) es el "contrato" que define cómo funciones/código se comunican a nivel binario: en qué registros van los argumentos, quién debe preservar qué registro, cómo se alinea la pila. En un proyecto normal de C, el compilador lo respeta por vosotros sin que penséis en ello. **En woody_woodpacker no: vuestro stub es asm crudo insertado a mano, así que si violáis el ABI, el programa original puede comportarse distinto o crashear después de que vuestro stub le devuelva el control** — y el enunciado es explícito en que la ejecución debe ser idéntica.

## 2. Convención de paso de argumentos (para llamadas a función / syscalls)

Los primeros 6 argumentos enteros/punteros van en registros, en este orden:

| Orden | Registro (función C) | Registro (syscall) |
|-------|----------------------|---------------------|
| 1º    | `rdi`                | `rdi`               |
| 2º    | `rsi`                | `rsi`               |
| 3º    | `rdx`                | `rdx`               |
| 4º    | `rcx`                | `r10` *(¡ojo, cambia!)* |
| 5º    | `r8`                 | `r8`                |
| 6º    | `r9`                 | `r9`                |

El valor de retorno va en `rax`. Argumentos adicionales (7º en adelante) se pasan por la pila, pero para vuestro stub no debería haceros falta.

⚠️ Diferencia clave que se os puede olvidar: al hacer una **syscall directa** con la instrucción `syscall`, el 4º argumento va en `r10`, no en `rcx` (porque la instrucción `syscall` usa `rcx` internamente para guardar la dirección de retorno). Esto solo importa si vuestra syscall tiene 4+ argumentos (`mmap` los tiene).

## 3. Registros: quién los preserva (caller-saved vs callee-saved)

| Tipo | Registros | Qué significa |
|------|-----------|----------------|
| **Caller-saved** (volátiles) | `rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11` | Una función puede destruirlos libremente; si el que llama los necesita después, debe guardarlos él mismo antes de la llamada |
| **Callee-saved** (preservados) | `rbx, rbp, r12, r13, r14, r15` | Si la función los usa, **debe** guardar su valor original y restaurarlo antes de salir |
| Especiales | `rsp` (stack pointer) | Debe quedar exactamente como estaba (o en el estado que espera el código siguiente) |

**Aplicación directa a vuestro stub:** cuando terminéis de descifrar y vayáis a saltar de vuelta al entry point original, cualquier registro callee-saved que hayáis tocado debe quedar restaurado a como estaba al entrar (o, si estáis simulando el arranque limpio de `_start`, en el estado "virgen" que ese código espera — normalmente esto no es un problema porque `_start` no espera nada previo, pero sí importa si vuestro punto de re-entrada no es el arranque desde cero). Sed especialmente cuidadosos con `rsp`: si desalineáis la pila o dejáis basura empujada sin desapilar, el crash puede aparecer instrucciones (o incluso funciones) después del salto, lo cual es una pesadilla para depurar.

## 4. Alineación de la pila (stack alignment)

En el punto de entrada de una función (justo después del `call`), la ABI exige que `rsp % 16 == 0` **antes** de que se ejecute cualquier `call` dentro de esa función (es decir, en el momento del `call`, `rsp` debe quedar en 16 tras el `push` de la dirección de retorno). Esto es relevante si vuestro stub hace alguna llamada a función (poco probable si usáis solo syscalls crudas, pero si en el bonus usáis alguna función de libc, hay que respetarlo o podéis crashear en instrucciones SSE que la libc usa internamente, como `movaps`, que exige direcciones alineadas a 16 bytes).

Para `_start` específicamente: el kernel entrega el control con la pila en un estado concreto (con `argc` arriba, seguido de `argv[]`, `envp[]`, `auxv`), no como una llamada de función normal. No necesitáis tocar la pila para nada de esto — solo necesitáis **no habérsela dejado sucia** cuando saltéis de vuelta.

## 5. Salto de vuelta al entry point original: `jmp`, no `call`

Un detalle sutil pero importante: para transferir el control al `_start` original desde vuestro stub, usad `jmp` (salto directo), **no** `call`. Un `call` empuja una dirección de retorno a la pila que nadie va a usar (porque `_start` nunca hace `ret`, normalmente termina en `exit`), dejando la pila con basura extra respecto al estado esperado por el kernel al arrancar. Un `jmp` a la dirección guardada de `e_entry` original preserva exactamente el estado de pila que el kernel dejó preparado.

## 6. Direcciones absolutas vs. relativas — PIE

Si el binario original es `ET_DYN` (PIE, Position Independent Executable, el caso por defecto en binarios modernos de gcc/clang), todas las direcciones en el fichero son **relativas a una base de carga** que el kernel elige en runtime (ASLR). Esto afecta a cómo calculáis la dirección real del entry point original y a cómo escribís vuestro propio stub (usad direccionamiento `rip`-relativo, instrucción `lea reg, [rip + offset]`, en vez de direcciones absolutas hardcodeadas). Comprobad `e_type` en el ELF header para saber si estáis ante `ET_EXEC` (dirección fija) o `ET_DYN` (PIE) y ajustad los cálculos de dirección en consecuencia.

## 7. Ejercicio recomendado

Escribid a mano (en papel, entre los dos) la secuencia de instrucciones que:
1. Guarda los registros que vayáis a usar en el stub que sean callee-saved.
2. Ejecuta vuestro bucle de descifrado usando solo caller-saved o registros que restauréis.
3. Restaura todo.
4. Hace `jmp` (no `call`) a la dirección del entry point original.

Explicaos el uno al otro por qué cada paso es necesario. Si alguno no sabe justificar una línea, es la línea que más probablemente os va a dar un crash intermitente y difícil de reproducir dentro de un mes.
