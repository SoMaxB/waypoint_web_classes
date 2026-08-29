# Clase 3: parseo del .obj, triangulación y EBO

## Objetivo

Convertir texto en geometría: leer un `.obj` real con `fgets`, validar cada línea `v` y `f`, traducir índices base 1 a base 0, trocear caras de N vértices en N−2 triángulos con abanico y subir el resultado a VBO/EBO. Al terminar debes poder explicar por qué un `.obj` no es una imagen, por qué `f 1 2 3 4` no es un triángulo, dónde se rompe el parser si olvidas `-1`, cómo dos pasadas evitan pelearte con `realloc`, por qué `f 1/2/3` solo te interesa el `1`, y por qué el `EBO` vive dentro del `VAO` y necesita `GL_DEPTH_TEST`.

Esta clase se tomó de forma interactiva y cumple la regla del proyecto: se escribió, compiló con `-Wall -Wextra -Werror` y ejecutó código real. El resultado observable fue `OBJ OK: 8 vertices (24 floats), 36 indices (12 triangulos)` y un cubo naranja renderizado con `glDrawElements` en vez del triángulo hardcodeado, sin avisos de compilación y con el cubo validado índice a índice.

## 1. Qué estamos aislando

Esta clase no toca matrices MVP ni texturas. Aísla una sola pregunta:

```text
¿Cómo pasa una línea como "f 1 2 3 4" del disco a triángulos que el GPU entiende?
```

El flujo mínimo es:

```text
assets/cube.obj (texto)
  ↓ fgets línea a línea
pasada 1: contar v y caras → reservar exacto
  ↓ malloc + rewind
pasada 2: llenar vertices[] y indices[] (base 0, fan)
  ↓
t_mesh { vertices, v_count, indices, i_count }
  ↓ glBufferData(GL_ARRAY_BUFFER) + glBufferData(GL_ELEMENT_ARRAY_BUFFER)
VAO (location 0 = 3 floats, stride 3*sizeof(float), offset 0)
  ↓
glDrawElements(GL_TRIANGLES, 36, GL_UNSIGNED_INT, 0)
```

El parser es tonto a propósito: solo convierte texto en geometría. Centrar el modelo, proyectar y texturizar vendrán después.

## 2. El formato .obj línea a línea

Un `.obj` es texto plano, una instrucción por línea. Un cubo mínimo real usado en la sesión:

```text
o Cube
v -0.5 -0.5  0.5
v  0.5 -0.5  0.5
v  0.5  0.5  0.5
v -0.5  0.5  0.5
v -0.5 -0.5 -0.5
v  0.5 -0.5 -0.5
v  0.5  0.5 -0.5
v -0.5  0.5 -0.5
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 5 1 4 8
```

| Prefijo | Significado | Ejemplo | ¿Clase 3? |
|---|---|---|---|
| `v x y z` | posición | `v 0.5 -0.5 0.5` | sí, con `sscanf ==3` |
| `vt u v` | coordenada de textura | `vt 0.25 0.75` | ignorar |
| `vn x y z` | normal | `vn 0 0 1` | ignorar |
| `f a b c ...` | cara, índices base 1 | `f 1 2 3 4` | sí, con fan |
| `o`, `s`, `#`, `mtllib`, `usemtl` | objeto, suavizado, comentario, material | `o Cube` | ignorar |
| línea vacía | — | — | ignorar |

Un error que se pagó en la sesión: escribir una sola cara `f 1 2 3 4 5 6 7 8` no es un cubo — es un octógono plano que el fan convertiría en 6 triángulos colgando del vértice 1.

## 3. fgets, sscanf y la trampa de `v`

Para texto línea a línea `fopen` + `fgets` evita reimplementar buffering:

```c
FILE *fp = fopen(path, "r");
char line[1024];
while (fgets(line, sizeof(line), fp)) {
    const char *s = skip_ws(line);
    if (*s == '\0' || *s == '\n' || *s == '#') continue;
    // ...
}
```

`open/read` te da trozos crudos sin garantía de que un trozo acabe en `\n`; `fgets` te da una línea completa por llamada.

Para `v` basta `sscanf` porque el formato es fijo:

```c
float x, y, z;
if (sscanf(s, "v %f %f %f", &x, &y, &z) != 3) error;
```

El retorno de `sscanf` es tu validación gratis: pedir 3 y recibir 2 significa línea rota. Y OJO: `sscanf(s, "v %f ...")` sobre `"vt 0.1 0.2"` falla (la `t` no es float) pero es frágil; lo robusto es filtrar antes:

```c
if (s[0]=='v' && s[1]==' ') { /* v pura */ }
else if (s[0]=='v' && s[1]=='t') continue;
else if (s[0]=='v' && s[1]=='n') continue;
```

Para `f` no sirve `sscanf` con 8 `%d` fijos — un quad tiene 4 índices (`==4` != `==8`) y Blender escupe `1/2/3` o `1//3`. Hay que tokenizar:

```c
int tmp[64]; int n=0; const char *p = s+2; // tras "f "
while (*p && *p!='#' && n<64) {
    char *end; long v = strtol(p, &end, 10);
    if (end==p) break;
    tmp[n++] = (int)v;
    p = end;
    while (*p && *p!=' ' && *p!='\t' && *p!='\n') p++; // salta "/2/3"
    p = skip_ws(p);
}
```

`strtol` para en `/`, así `1/2/3` te deja el `1` y el bucle salta el resto hasta el espacio.

## 4. Dos pasadas vs realloc

No sabes cuántos `v` trae el archivo antes de leerlo. Dos estrategias:

- **Dos pasadas:** cuentas en la primera, `malloc` exacto, `rewind` y llenas en la segunda. Simple, memoria justa, dos lecturas.
- **Crecimiento dinámico:** `realloc` duplicando capacidad en una sola pasada. Una lectura, más código y cuidado con punteros invalidados.

Se eligió **dos pasadas por simplicidad de depuración**: el conteo es verificable (`8v` y `6 caras × (4−2)×3 = 36i`) antes de tocar memoria. El coste de releer un cubo es despreciable; para modelos gigantes se podría cambiar a `realloc` sin tocar el API.

## 5. De base 1 a base 0

OBJ es base 1: el primer `v` del archivo es el vértice 1. Tu array es base 0: `vertices[0]` es el primer vértice.

```text
f 1 2 3  →  indices 0 1 2  (siempre idx-1)
```

Olvidar el `-1` no da error de compilación: da geometría rota. Y la bomba: `f 8` sobre 8 vértices con `idx` sin restar lee `vertices[8]` → fuera de rango, basura o segfault.

En la pasada 2 se valida:

```c
if (a<1 || b<1 || c<1 || (size_t)a>v_count || ...) error;
out->indices[i++] = (unsigned)(a-1);
```

## 6. Fan triangulation

El GPU dibuja `GL_TRIANGLES`: cada 3 índices es un triángulo. Una cara con 4 vértices no se puede enviar directa.

Abanico fijando el primer vértice:

```text
f 1 2 3 4   →  (1,2,3) (1,3,4)
f 1 2 3 4 5 →  (1,2,3) (1,3,4) (1,4,5)
N vértices  →  N-2 triángulos → (N-2)*3 índices
```

Visualmente para un quad:

```text
4 ----- 3
|     / |
|   /   |
| /     |
1 ----- 2
```

Funciona para convexos simples; falla con cóncavas/no coplanares — justo el bonus de `.obj` complejos.

## 7. De la CPU al GPU: VBO, EBO y VAO

Hasta ahora `float vertices[]` vivía en RAM del programa. El GPU no lo lee solo; hay que subirlo:

```c
GLuint vao, vbo, ebo;
glGenVertexArrays(1, &vao);
glBindVertexArray(vao);

glGenBuffers(1, &vbo);
glBindBuffer(GL_ARRAY_BUFFER, vbo);
glBufferData(GL_ARRAY_BUFFER, mesh.v_count*3*sizeof(float), mesh.vertices, GL_STATIC_DRAW);

glGenBuffers(1, &ebo);
glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo);
glBufferData(GL_ELEMENT_ARRAY_BUFFER, mesh.i_count*sizeof(unsigned), mesh.indices, GL_STATIC_DRAW);

glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3*sizeof(float), (void*)0);
glEnableVertexAttribArray(0);
glEnable(GL_DEPTH_TEST);
```

- **VBO:** guarda datos crudos. "¿Dónde están los datos?"
- **EBO:** guarda índices. "¿En qué orden se usan?"
- **VAO:** recuerda cómo se leen (`location 0`, tamaño 3, stride, offset) **y qué EBO está bindeado**. No hagas `glBindBuffer(GL_ELEMENT_ARRAY_BUFFER,0)` mientras el VAO esté bindeado o lo desenganchas.
- `glDrawElements(GL_TRIANGLES, 36, GL_UNSIGNED_INT, 0)` dibuja 12 triángulos reutilizando 8 vértices. Con `glDrawArrays` habrías duplicado vértices (36×3 floats) en RAM.

Sin `GL_DEPTH_TEST` + `glClear(DEPTH_BUFFER_BIT)` el cubo se ve mal: caras traseras pisando delanteras.

El triángulo hardcodeado de la clase 2 muere aquí; la infraestructura (ventana, contexto, loader, shaders, `swap`, `poll`, `terminate`) sobrevive intacta.

## 8. Integración en main y verificación real

El parser no necesita ventana ni GL, así que se llama **antes** de `glfwInit()`:

```c
t_mesh mesh={0};
if (parse_obj("assets/cube.obj",&mesh)!=0) return 1;
printf("OBJ OK: %zu vertices (%zu floats), %zu indices (%zu tris)\n",
       mesh.v_count, mesh.v_count*3, mesh.i_count, mesh.i_count/3);
```

Al ejecutar:

```text
OBJ OK: 8 vertices (24 floats), 36 indices (12 triangulos)
  v1: -0.50 -0.50 0.50
  ...
  v8: -0.50 0.50 -0.50
  indices (base 0, fan):
   0 1 2
   0 2 3
   4 7 6
   4 6 5
   0 4 5
   0 5 1
   1 5 6
   1 6 2
   2 6 7
   2 7 3
   4 0 3
   4 3 7
OpenGL 4.6 (Core Profile) Mesa ... (cargador manual OK)
```

Ventana 800×600, fondo `0.1/0.1/0.12`, cubo naranja `0.8/0.4/0.2`, `fflush` para que el `printf` se vea incluso con `timeout`, compilación `cc -Wall -Wextra -Werror` + `pkg-config --cflags --libs glfw3` sin avisos, loader con 26 funciones sin `NULL`.

Errores provocados a mano:

| Prueba | Esperado |
|---|---|
| `assets/cube.obj` inexistente | `no se pudo abrir` → `ret 1`, sin ventana |
| `v 0 0` (faltan coords) | `linea 'v' malformada` → `ret 1` |
| `f 1 2` (<3 vértices) | `linea 'f' malformada` → `ret 1` |
| `f 1 2 99` (fuera de rango) | `indice fuera de rango` → `ret 1` |
| `f 1/2/3 2/3/4 3/4/5` (Blender) | parseado como `1 2 3` → OK |
| líneas `vt`, `vn`, `#`, `o`, vacías | ignoradas sin error |

## Predicciones y ejercicios

1. Si tu `vertices` contiene 9 floats y cada vértice tiene 3 floats, ¿cuántos vértices hay?

<details><summary>Solución</summary>

Hay 3 vértices, porque `9/3=3`.

</details>

2. Un `.obj` dice `f 1 2 3 4` y tu array es base 0. ¿Qué índices reales lees y cuántos triángulos generas?

<details><summary>Solución</summary>

Lees `0 1 2` y `0 2 3` (siempre `idx-1`). Un quad → 2 triángulos → 6 índices. Regla general: N vértices → N−2 triángulos.

</details>

3. ¿Por qué `sscanf(line, "v %f %f %f")` no basta para distinguir `v` de `vt` y qué harías?

<details><summary>Solución</summary>

`sscanf` sobre `vt ...` falla pero de forma implícita; lo robusto es filtrar por prefijo: `s[0]=='v' && s[1]==' '` para vértices, `s[1]=='t'`/`'n'` para ignorar. Evitas falsos positivos si una línea `vt` contiene floats.

</details>

4. `f 1/5/2 2/6/3 3/7/4` viene de Blender (`v/vt/vn`). ¿Qué parte te interesa y cómo la extraes sin morir?

<details><summary>Solución</summary>

Solo el primer entero de cada token (el índice de posición). Con `strtol(p,&end,10)` lees `1` y paras en `/`; luego saltas hasta el siguiente espacio. Así `1/5/2` → `1`.

</details>

5. ¿Por qué dos pasadas es más simple de depurar que `realloc` y cuándo cambiarías?

<details><summary>Solución</summary>

Cuentas primero (`8v`, `36i`) y reservas exacto; cualquier descuadre se ve antes de `malloc`. Con `realloc` una sola pasada pero más ramas y riesgo de invalidar punteros. Para modelos enormes o streaming cambiaría a `realloc` duplicando capacidad.

</details>

6. ¿Qué le pasa al loader si lo llamas antes de `glfwMakeContextCurrent` y cómo lo evitas?

<details><summary>Solución</summary>

`glfwGetProcAddress` devuelve `NULL` (el driver aún no está cargado) y la macro `GL_LOAD` aborta. Orden fijo: `glfwCreateWindow` → `glfwMakeContextCurrent` → `init_gl_functions()`.

</details>

7. ¿Por qué el EBO debe crearse con el VAO bindeado y qué rompe si lo desbindeas mal?

<details><summary>Solución</summary>

El binding de `GL_ELEMENT_ARRAY_BUFFER` se guarda **dentro del VAO**. Si haces `glBindBuffer(EBO,0)` mientras el VAO está bindeado, el VAO olvida su EBO y `glDrawElements` no tiene índices. Crea VBO/EBO con el VAO bindeado y no toques el EBO hasta desbindear el VAO.

</details>

8. Ejercicio ejecutado (obligatorio): escribe `assets/cube.obj` a mano con 8 `v` y 6 `f` quads consistentes, compila `src/obj_parser.c` con `-Wall -Wextra -Werror` y ejecuta `./scop`.

<details><summary>Solución</summary>

`cube.obj` de referencia (6 caras, índices entre 1 y 8, orden consistente visto desde fuera):

```text
o Cube
v -0.5 -0.5  0.5
v  0.5 -0.5  0.5
v  0.5  0.5  0.5
v -0.5  0.5  0.5
v -0.5 -0.5 -0.5
v  0.5 -0.5 -0.5
v  0.5  0.5 -0.5
v -0.5  0.5 -0.5
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 5 1 4 8
```

Makefile ya incluye `src/obj_parser.c`. Salida esperada:

```text
OBJ OK: 8 vertices (24 floats), 36 indices (12 triangulos)
OpenGL 4.6 (Core Profile) Mesa ... (cargador manual OK)
```

Ventana con cubo naranja sobre fondo azul-negro, `GL_DEPTH_TEST` activo. Sin este archivo el parser debe salir con `no se pudo abrir`.

</details>

## Errores frecuentes

- Escribir una sola cara `f 1 2 3 4 5 6 7 8` y creer que es un cubo.
- Hacer `sscanf(line, "f %d %d %d %d %d %d %d %d")==8` y que los quads (4 índices) nunca entren.
- Olvidar `idx-1` y leer `vertices[1]` para `f 1`, o peor `vertices[8]` para `f 8` → fuera de rango.
- Filtrar `v` con `sscanf` sin distinguir `vt`/`vn`.
- Parsear `1/2/3` como un entero grande en vez de tomar solo el `1`.
- Hacer `realloc` sin necesidad y pelearse con punteros invalidados.
- Crear el EBO sin VAO bindeado o desbindearlo a destiempo y perder los índices.
- Olvidar `GL_DEPTH_TEST` y `GL_DEPTH_BUFFER_BIT` y ver caras traseras por delante.
- Poner el parser después de `glfwInit` y no poder validar el `.obj` sin display.
- Dejar el triángulo hardcodeado conviviendo con el cubo y dibujar 3 vértices en vez de 36 índices.

## Has aprendido que

- Un `.obj` es texto: `v` son posiciones, `f` son caras con índices base 1, el resto se ignora en clase 3.
- `fgets` + `skip_ws` da una línea limpia por iteración; `open/read` te habría dado trozos crudos.
- `sscanf` valida `v` con su retorno `==3`; para `f` necesitas `strtol` token a token para soportar `1`, `1/2`, `1//3`, `1/2/3`.
- OBJ base 1 → array base 0 es siempre `idx-1`; validar `1..v_count` evita segfaults silenciosos.
- Fan triangulation: `f a b c d` → `(a,b,c)` `(a,c,d)`; N vértices → N−2 triángulos.
- Dos pasadas permiten `malloc` exacto y depuración por conteo (`8v`/`36i`); `realloc` se deja para cuando importe el streaming.
- El EBO comparte el VAO y se dibuja con `glDrawElements`; `glDrawArrays` habría duplicado vértices.
- `GL_DEPTH_TEST` es obligatorio para un cubo sólido; sin él el orden de dibujo decide qué se ve.
- El parser vive antes de `glfwInit()` y su criterio observable es `OBJ OK` + 8/36 + cubo visible con `-Wall -Wextra -Werror` limpio.

## Preguntas tipo defensa

1. ¿Por qué un `.obj` no se puede mostrar directamente como si fuera una imagen?
2. ¿Por qué `f 1 2 3 4` debe convertirse en dos triángulos y cuál es la regla para N vértices?
3. ¿Qué error aparece si usas índices OBJ directamente como índices de array y cómo lo detectas?
4. ¿Cómo distingues `v` de `vt`/`vn` sin que `sscanf` te engañe?
5. ¿Cómo extraes solo el primer entero de `1/5/2` y por qué `strtol` ayuda?
6. ¿Qué ventaja da hacer dos pasadas frente a `realloc` y qué coste tiene?
7. ¿Por qué el `EBO` se guarda dentro del `VAO`?
8. ¿Por qué `GL_DEPTH_TEST` es necesario para un cubo y qué pasa sin él?
9. ¿Qué líneas de un `.obj` puedes ignorar y cuáles son error?
10. ¿Qué parte del triángulo de la clase 2 desapareció y qué infraestructura sobrevivió?

## Criterio de finalización

- Puedes explicar por qué un `.obj` es geometría en texto, no píxeles.
- Puedes convertir `f 1 2 3 4` en `(1,2,3)` `(1,3,4)` y generalizar a N−2 triángulos.
- Puedes convertir índices OBJ base 1 a array base 0 y validar el rango.
- Puedes distinguir `v` de `vt`/`vn` y justificar el filtro por prefijo.
- Puedes extraer el primer entero de `v/vt/vn` con `strtol` y saltar el resto del token.
- Puedes defender dos pasadas vs `realloc` en una frase.
- Puedes explicar VBO vs EBO vs VAO sin confundir datos con receta.
- Puedes explicar por qué `glDrawElements` + EBO es más eficiente que duplicar vértices.
- Puedes ordenar un frame: `glClear(COLOR|DEPTH)`, `glUseProgram`, `glBindVertexArray`, `glDrawElements`, `swap`, `poll`.
- Has escrito `cube.obj` a mano, compilado con `-Wall -Wextra -Werror` y ejecutado: `OBJ OK: 8/36` y cubo naranja visible.

## Siguiente clase

En la siguiente clase entraremos en matrices MVP y perspectiva: coordenadas homogéneas, `Model`/`View`/`Projection`, `frustum` con `FOV`/`near`/`far` y el orden `P*V*M*vertex`. El resultado será ver el cubo en perspectiva y hacerlo rotar, antes de añadir color por cara.

## Lista de lecturas

- Especificación Wavefront OBJ — líneas `v`, `vt`, `vn`, `f`, índices base 1 y variantes `v/vt/vn`.
- Documentación de `fgets`, `sscanf`, `strtol`, `rewind`/`fseek` y `malloc`/`free`.
- Khronos, OpenGL 3.3 Core Profile — `GL_ARRAY_BUFFER`, `GL_ELEMENT_ARRAY_BUFFER`, `VAO`, `glVertexAttribPointer`, `glDrawElements`, `GL_DEPTH_TEST`.
- Khronos, GLSL 3.30 — `layout(location=0)` y paso de `aPos` a `gl_Position`.

