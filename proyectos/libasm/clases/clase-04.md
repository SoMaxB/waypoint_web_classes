# Clase 4: NASM, ELF64 y las herramientas

## Objetivo

Entender el viaje completo de un archivo `.s` hasta convertirse en un ejecutable o en `libasm.a`, y conocer las herramientas que permiten inspeccionar cada etapa (`nasm`, `ld`, `ar`, `readelf`, `objdump`, `nm`, `gdb`). Al terminar, debes poder explicar qué diferencia hay entre un objeto y un ejecutable, qué significan las columnas de una tabla de símbolos, por qué una biblioteca va al final del enlace, y qué hace un breakpoint de GDB.

## 1. El viaje del código

```
archivo.s ──nasm──▶ archivo.o ──ld──▶ programa (o libasm.a)
                    "objeto"    "enlazador"
```

Un `.o` no es el mismo archivo que el ejecutable con otro nombre: es la **misma información incompleta**. El objeto contiene el código máquina pero con instrucciones a medio rellenar; el enlazador completa esos huecos.

Los tres verbos son distintos:

```
nasm  = ENSAMBLAR   (texto .s  → bytes .o, con huecos)
ld    = ENLAZAR     (resolver huecos uniendo objetos)
gcc   = COMPILAR    (C → ensamblador; llega en la clase 5)
```

## 2. El objeto `.o`: secciones, símbolos y relocaciones

### Secciones

Un objeto se divide en secciones. En NASM se declaran con `section`:

```nasm
section .text     ; código: se ejecuta, no se escribe
section .data     ; variables que cambian en tiempo de ejecución
section .rodata   ; constantes de solo lectura (cadenas, tablas)
section .bss      ; variables sin valor inicial (se reservan, no se guardan)
```

Dentro del objeto, todas las secciones aparecen en dirección `0x0000...0000`: todavía no tienen dirección final. Se la asigna el enlazador.

### Tabla de símbolos

Un objeto tiene una tabla de símbolos. Las columnas que importan:

```text
UND    = "necesito esto, viene de fuera"   → lo resuelve el enlazador
GLOBAL = "estoy definido y visible"        → otros objetos pueden usarme
LOCAL  = "existo pero no salgo"            → útil para etiquetas internas
```

En NASM, `global ft_x` declara un símbolo visible y `extern ft_y` declara que el símbolo viene de otro objeto.

### Relocaciones

Cuando un objeto referencia un símbolo externo, el ensamblador deja un hueco con un marcador. La sección de relocaciones es la lista de "huecos por rellenar". Por ejemplo, para `call ft_destino`, la relocación dice:

```text
en el desplazamiento 1 de .text hay 4 bytes que deben rellenarse
con la dirección de ft_destino
```

El enlazador es quien rellena esos huecos con la dirección real.

## 3. El enlazador `ld`

`ld` une objetos y bibliotecas, asigna direcciones a las secciones y resuelve todas las referencias `UND`.

Demostración real: si `salta.o` llama a `ft_destino` definido en `dest.o`, después de enlazar:

```text
Antes  (en salta.o):      ft_destino aparece como UND y hay una relocación
Después (en el ejecutable): ft_destino aparece DEFINIDO (p. ej. 0x401010)
                           y no quedan relocaciones
```

El desensamblado con `objdump -d -M intel` confirma que el hueco se rellenó:

```text
call 401010 <ft_destino>
```

Matiz importante: el símbolo no "se define al ensamblar". `ft_destino` ya estaba definido en su archivo; lo que ocurre en el enlace es que la **referencia** se **resuelve**.

## 4. Secciones y permisos en el ejecutable

En el ejecutable, cada sección ocupa su propia zona de memoria con permisos distintos:

```text
Sección   Dirección    Permisos
.text     0x401000     R E   (se lee y se ejecuta)
.rodata   0x402000     R     (solo se lee)
.data     0x403008     R W   (se lee y se escribe)
```

Ninguna sección se pierde ni se mezcla en un único bloque: el SO marca `.text` como no escribible y `.data` como no ejecutable. Es una medida de seguridad. Separarlas también significa que **escribir sobre `.rodata` o sobre `.text` produce un fallo de segmentación**. Por eso las cadenas que se modifican (destino de `ft_strcpy`, resultado de `ft_strdup`) viven en memoria de escritura, mientras que las literales van a `.rodata`.

## 5. La biblioteca estática

Un archivo `.a` es un **contenedor de objetos `.o`**, un "zip sin comprimir". Su firma de archivo lo delata: empieza con los bytes `!<arch>`.

```
ar  r  c  s  libx.a  a.o  b.o
    │  │  │   └──────────┐───────────┘
    │  │  │              └─ objetos que se meten en la caja
    │  │  └─ "s": generar índice de símbolos
    │  └─ "c": crear si no existe
    └─ "r": reemplazar/añadir objetos
```

El índice (`s`) permite al enlazador saber en qué miembro está cada símbolo sin leer toda la caja. Cuando un programa enlaza contra `libx.a`, el enlazador **solo extrae los objetos que resuelven símbolos pendientes**, no todos.

## 6. El orden del enlace

La regla más importante: **la biblioteca va al final del comando**, después de los objetos que la usan.

```text
ld main.o ft_c.o libx.a        → OK
ld libx.a main.o ft_c.o        → FALLA
ld main.o libx.a ft_c.o        → FALLA
ld main.o ft_c.o libx.a libx.a → OK (repetir la lib nunca rompe)
```

El enlazador procesa los argumentos de izquierda a derecha. Al llegar a una biblioteca, extrae solo los miembros que resuelven símbolos **ya pendientes en ese momento**; si la pasa sin pendientes, no extrae nada y no vuelve atrás. Por eso:

```text
libx.a main.o    → cuando se ve la lib, nadie ha pedido ft_a todavía: extrae NADA
main.o libx.a c.o → cuando se ve la lib, solo ft_c es pendiente (y libx.a no lo
                    tiene); la referencia a ft_a llega después, tarde
```

Consecuencia para el Makefile de la clase 10: el orden será `$(CC) tests.o libasm.a`.

### El peligro del comodín `*.o`

`ar rcs libasm.a *.o` funciona, pero arrastra **todo** lo que haya en la carpeta, incluidos objetos de prueba con su `_start`. Una biblioteca de entrega debe contener exactamente sus objetos:

```text
ar rcs libasm.a ft_strlen.o ft_strcpy.o ft_strcmp.o ft_write.o ft_read.o ft_strdup.o
```

Con `nm libasm.a | grep " T "` se verifica que la biblioteca exporta exactamente los seis símbolos obligatorios y nada más.

## 7. GDB: congelar el tiempo

GDB no sirve para "ejecutar", sino para **detener la ejecución en un punto y comparar el estado real con el esperado**.

- Un **breakpoint** (punto de parada) detiene la CPU **antes** de ejecutar la instrucción marcada: los registros muestran el estado previo.
- `info registers rax rdi` muestra el valor de esos registros en el instante congelado.
- `rip` indica la dirección de la instrucción congelada.
- `x/5bx $rdi+$rax` lee memoria en bruto (bytes hexadecimales), que es como el ensamblador ve el mundo. En el formato `x/5bx`: `x` = examine memoria, `5` = cantidad, `b` = unidades de 1 byte, `x` = mostrar en hexadecimal.

La primera pregunta ante cualquier bug en ensamblador no es "¿dónde está el error del algoritmo?" sino:

```text
¿En qué estado está la CPU ahora? ¿Coincide con el estado que yo esperaba?
```

En C, un bug suele ser una línea mal; en ensamblador casi siempre es un **desajuste de estado**: un registro con un valor inesperado, un puntero que avanzó de más, un flag distinto al esperado.

## 8. Herramientas de la clase

```text
nasm      texto .s → objeto .o  (nasm -f elf64 archivo.s -o archivo.o)
ld        objetos + libs → ejecutable (resuelve huecos y direcciones)
ar        agrupa objetos en bibliotecas .a (ar rcs lib.a a.o b.o)
readelf   inspecciona cabeceras, secciones, símbolos y relocaciones de un ELF
objdump   desensambla: muestra el código máquina con sintaxis Intel
nm        lista los símbolos de un objeto o biblioteca
gdb       depurador: breakpoints, registros, memoria
```

## Predicciones y ejercicios

1. ¿Son `.o` y el ejecutable el mismo archivo? No: el `.o` contiene la misma información pero incompleta, con referencias sin resolver. No es tampoco "la misma información": en el ejecutable los huecos están rellenados.

2. ¿Qué ocurre con la entrada `UND` y la relocación tras enlazar? La referencia se resuelve: `ft_destino` pasa a aparecer definida y la relocación desaparece. El símbolo no "se define al ensamblar"; ya estaba definido en su archivo, y el enlazador resuelve la referencia.

3. ¿Cómo quedan `.text`, `.data` y `.rodata` tras enlazar? Cada sección ocupa su propia zona de memoria con permisos distintos (R E / R W / R). No se juntan en un solo bloque ni se pierde ninguna.

4. ¿Qué hay dentro de un `.a`? Objetos `.o` concatenados, más cabeceras e índice de símbolos. Su firma es `!<arch>`.

5. ¿Importa el orden de la biblioteca? Sí: debe ir después de los objetos que la usan, porque solo extrae miembros que resuelven símbolos pendientes en el momento en que se la encuentra.

6. Con un breakpoint en `inc rax`, ¿qué muestra `info registers rax rdi`? Los valores **antes** de ejecutar la instrucción: el breakpoint congela la CPU pre-instrucción. La primera pregunta ante un bug debe ser sobre el estado real vs. el esperado, no sobre el algoritmo.

7. Ejercicio de comandos. Predice y luego verifica:

```text
nasm -f elf64 ft_strlen.s -o ft_strlen.o
ar rcs libasm.a ft_strlen.o ft_strcpy.o ft_strcmp.o ft_write.o ft_read.o ft_strdup.o
```

Ambos funcionan tal cual. La trampa: usar `ar rcs libasm.a *.o` arrastra los objetos de prueba (`_start`, etc.) y contamina la biblioteca. La entrega debe exportar exactamente seis símbolos:

```text
nm libasm.a | grep " T "
0000000000000000 T ft_strlen
0000000000000000 T ft_strcpy
0000000000000000 T ft_strcmp
0000000000000000 T ft_write
0000000000000000 T ft_read
0000000000000000 T ft_strdup
```

## Errores frecuentes

- Creer que el `.o` y el ejecutable son el mismo archivo con otro nombre; en el `.o` las referencias externas aún no están resueltas.
- Pensar que `extern` "define" un símbolo; `extern` solo declara que viene de otro objeto.
- Confundir `ENSAMBLAR` (nasm), `ENLAZAR` (ld) y `COMPILAR` (gcc).
- Escribir sobre `.rodata` o `.text` y obtener un fallo de segmentación.
- Colocar la biblioteca antes de los objetos que la usan en el comando de enlace.
- Usar `*.o` en `ar` y meter en `libasm.a` objetos de prueba o `_start`.
- Esperar que un breakpoint muestre el estado posterior a la instrucción.
- Buscar el bug en el algoritmo antes de comprobar el estado real de registros y memoria.

## Has aprendido que

- Un `.o` es la misma información que el ejecutable pero incompleta: con secciones sin dirección, símbolos `UND` y relocaciones por resolver.
- `ENSAMBLAR`, `ENLAZAR` y `COMPILAR` son tres verbos distintos para tres herramientas.
- `UND` = referencia externa pendiente; `GLOBAL` = definido y visible; `LOCAL` = interno.
- El enlazador resuelve las relocaciones rellenando huecos con direcciones reales.
- `.text` se ejecuta y no se escribe, `.data` se lee y escribe, `.rodata` solo se lee, `.bss` reserva sin guardar.
- Un `.a` es un contenedor de objetos `.o` con un índice de símbolos; se crea con `ar rcs`.
- La biblioteca va al final del enlace: solo extrae miembros que resuelven símbolos ya pendientes.
- Un breakpoint de GDB congela la CPU antes de la instrucción, mostrando el estado previo.
- La primera pregunta ante un bug de ensamblador es sobre el estado real de la CPU, no sobre el algoritmo.

## Preguntas tipo defensa

1. ¿Qué diferencia hay entre el `.o` y el ejecutable final?
2. ¿Qué significa `UND` en una tabla de símbolos y quién lo resuelve?
3. ¿Qué es una relocación?
4. ¿En qué secciones pondrías código, variables mutables, constantes y buffers sin inicializar?
5. ¿Por qué el SO da permisos distintos a `.text` y `.data`?
6. ¿Qué hay literalmente dentro de `libasm.a`?
7. ¿Por qué `ar rcs` usa esas tres letras?
8. ¿Por qué la biblioteca debe ir al final del comando de enlace?
9. ¿Detiene un breakpoint antes o después de ejecutar la instrucción?
10. ¿Cuál es la primera pregunta ante un bug de ensamblador?

## Criterio de finalización

La clase queda completada cuando puedes explicar qué hace cada herramienta (`nasm`, `ld`, `ar`, `readelf`, `objdump`, `nm`, `gdb`), por qué una biblioteca va al final del enlace, qué significan las columnas de una tabla de símbolos, y por qué los permisos de las secciones del ejecutable no son casualidad.

## Siguiente clase

Con la herramienta en mano, la clase 5 cierra el salto del modelo mental a la primera función real: recorrer memoria con el terminador `\0`, mantener invariantes y devolver `size_t`, hasta implementar y probar `ft_strlen` contra `strlen`.
