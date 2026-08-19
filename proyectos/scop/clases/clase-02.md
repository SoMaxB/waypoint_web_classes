# Clase 2: entorno y primer triangulo

## Objetivo

Entender que piezas minimas hacen falta para abrir una ventana OpenGL y dibujar el primer triangulo. Al terminar esta clase debes poder explicar que aporta GLFW, que es un contexto OpenGL, para que sirven VBO y VAO, como se conectan los atributos del shader con los datos del buffer y por que el bucle de render necesita `glfwSwapBuffers()` y `glfwPollEvents()`.

## 1. Que estamos aislando

Esta clase no carga todavia `.obj`, no usa matrices MVP y no aplica texturas. Aisla una sola pregunta:

```text
Que tiene que existir antes de que el GPU pueda dibujar algo?
```

El flujo minimo es:

```text
programa
  ↓
inicializar libreria de ventana
  ↓
crear ventana + contexto OpenGL
  ↓
hacer el contexto actual
  ↓
cargar funciones OpenGL si hace falta
  ↓
crear shaders
  ↓
crear datos del triangulo
  ↓
subirlos a VBO/VAO
  ↓
bucle de eventos
  ↓
dibujar cada frame
  ↓
swap buffers
```

La ventana no es la escena. Es el destino donde OpenGL presentara el framebuffer final.

## 2. Que permite el subject

El subject permite librerias externas para ventana y eventos. Por eso una libreria como GLFW puede encargarse de:

- Crear la ventana.
- Crear el contexto OpenGL.
- Gestionar teclado, raton y cierre de ventana.
- Mantener el bucle de eventos.

Pero no debe encargarse de las partes que el subject exige implementar o entender personalmente:

- Parser de `.obj`.
- Matrices y transformaciones.
- Carga/compilacion de shaders como caja negra externa.
- Renderizador completo.

GLFW esta permitido porque resuelve infraestructura de ventana/contexto/eventos, no el problema central de Scop.

## 3. Ventana, contexto y bucle minimo

Un esqueleto conceptual con GLFW es:

```c
if (!glfwInit())
    fail();

GLFWwindow *window = glfwCreateWindow(800, 600, "scop", NULL, NULL);
if (!window)
    fail();

glfwMakeContextCurrent(window);

while (!glfwWindowShouldClose(window))
{
    render();

    glfwSwapBuffers(window);
    glfwPollEvents();
}

glfwTerminate();
```

La llamada critica es:

```c
glfwMakeContextCurrent(window);
```

OpenGL trabaja sobre un contexto actual asociado al hilo. Sin contexto actual, llamadas como crear buffers, compilar shaders o limpiar la pantalla no tienen un estado OpenGL valido sobre el que operar.

El contexto OpenGL no contiene el `.obj` parseado. El modelo parseado vive primero en memoria de CPU y despues sus datos se suben a buffers del GPU.

## 4. El primer triangulo

Un triangulo minimo puede escribirse como posiciones hardcodeadas:

```c
float vertices[] = {
    -0.5f, -0.5f, 0.0f,
     0.5f, -0.5f, 0.0f,
     0.0f,  0.5f, 0.0f,
};
```

Cada vertice tiene tres `float`:

```text
x y z
```

Por tanto:

```text
9 floats / 3 floats por vertice = 3 vertices
```

Estos datos no aparecen en pantalla por estar en un array C. El GPU no lee automaticamente la RAM de tu programa. Debes subirlos a memoria del GPU.

## 5. VBO y VAO

Dos objetos aparecen enseguida:

```text
VBO = Vertex Buffer Object
VAO = Vertex Array Object
```

La forma simple de recordarlos es:

```text
VBO:
  contiene los datos crudos de vertices en memoria del GPU

VAO:
  recuerda como interpretar esos datos
```

Ejemplo conceptual:

```text
VBO:
  -0.5 -0.5 0.0   0.5 -0.5 0.0   0.0 0.5 0.0

VAO:
  location 0 = leer 3 floats por vertice
  stride = 3 floats
  offset = 0
```

El VBO responde:

```text
Donde estan los datos?
```

El VAO responde:

```text
Como se leen esos datos?
```

Codigo conceptual:

```c
unsigned int vao;
unsigned int vbo;

glGenVertexArrays(1, &vao);
glGenBuffers(1, &vbo);

glBindVertexArray(vao);

glBindBuffer(GL_ARRAY_BUFFER, vbo);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

glVertexAttribPointer(
    0,                  // location = 0
    3,                  // 3 floats: x, y, z
    GL_FLOAT,
    GL_FALSE,
    3 * sizeof(float),  // stride
    (void *)0           // offset
);
glEnableVertexAttribArray(0);
```

Mas adelante, cuando cada vertice tenga posicion, color y UV, el VAO sera aun mas importante:

```text
x y z   r g b   u v
```

Entonces necesitaremos describir varios atributos:

```text
location 0: posicion, 3 floats, empieza en offset 0
location 1: color,    3 floats, empieza despues de posicion
location 2: UV,       2 floats, empieza despues de color
```

## 6. Shaders minimos

El vertex shader debe tener una entrada compatible con el atributo configurado en el VAO:

```glsl
#version 330 core

layout (location = 0) in vec3 aPos;

void main()
{
    gl_Position = vec4(aPos, 1.0);
}
```

La conexion importante es:

```text
VAO dice: location 0 contiene 3 floats por vertice
shader dice: layout(location = 0) in vec3 aPos
```

Si el VAO configura `location = 0` pero el shader espera `location = 1`, el shader esta mirando otra entrada. El resultado puede ser que no se vea nada o que se lean datos incorrectos.

El fragment shader puede devolver un color fijo:

```glsl
#version 330 core

out vec4 FragColor;

void main()
{
    FragColor = vec4(1.0, 0.5, 0.2, 1.0);
}
```

Ese `vec4` representa:

```text
rojo, verde, azul, alfa
```

con valores entre `0.0` y `1.0`.

## 7. Compilar y enlazar shaders

El flujo conceptual de shaders es:

```text
codigo fuente GLSL
  ↓
glCreateShader
  ↓
glShaderSource
  ↓
glCompileShader
  ↓
comprobar errores
  ↓
glCreateProgram
  ↓
glAttachShader(vertex)
  ↓
glAttachShader(fragment)
  ↓
glLinkProgram
  ↓
comprobar errores
  ↓
glUseProgram
```

El subject no prohibe escribir funciones propias como `load_shader_file()` o `compile_shader()`. Lo que no debes hacer es delegar esa responsabilidad a una libreria externa que oculte la carga, compilacion, enlazado y reporte de errores.

Para aprender, en esta clase los shaders pueden estar como strings. En el proyecto real convendra cargarlos desde archivos usando codigo propio.

## 8. Dibujar cada frame

Un frame minimo hace esto:

```c
glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
glClear(GL_COLOR_BUFFER_BIT);

glUseProgram(shader_program);
glBindVertexArray(vao);
glDrawArrays(GL_TRIANGLES, 0, 3);

glfwSwapBuffers(window);
glfwPollEvents();
```

Responsabilidades:

| Funcion | Responsabilidad |
|---|---|
| `glClearColor` | Define el color con el que se limpiara el fondo. |
| `glClear` | Limpia el framebuffer actual. |
| `glUseProgram` | Activa el programa de shaders. |
| `glBindVertexArray` | Activa la receta para leer vertices. |
| `glDrawArrays` | Ordena dibujar vertices secuenciales como triangulos. |
| `glfwSwapBuffers` | Muestra el frame renderizado. |
| `glfwPollEvents` | Procesa teclado, raton, cierre, resize y otros eventos. |

Si olvidas `glfwPollEvents()`, la ventana puede no responder a cierre, teclado o raton.

## 9. Doble buffer

Normalmente no dibujas directamente sobre la imagen visible. Se usa doble buffer:

```text
front buffer:
  imagen visible ahora

back buffer:
  imagen que estoy dibujando para el siguiente frame
```

Cuando terminas de dibujar:

```c
glfwSwapBuffers(window);
```

el back buffer pasa a verse y el programa empieza a preparar el siguiente frame. Esto evita parpadeos y frames parcialmente dibujados.

## 10. Que queda para el Scop real

El triangulo hardcodeado es temporal, pero la infraestructura seguira existiendo:

```text
ventana
contexto
carga/compilacion de shaders
VAO/VBO
render loop
swap buffers
poll events
cleanup
```

Lo que cambiara despues es la fuente de los datos:

```text
clase 2:
  vertices hardcodeados

clase 3+:
  vertices parseados desde .obj
```

Modelo final de conexion:

```text
.obj parseado
  ↓
datos en CPU
  ↓ glBufferData
VBO en GPU
  ↓ interpretado por
VAO
  ↓ leido por
vertex shader
```

## Predicciones y ejercicios

1. Si `vertices` contiene 9 floats y cada vertice tiene 3 floats, cuantos vertices hay?

<details><summary>Solucion</summary>

Hay 3 vertices, porque `9 / 3 = 3`.

</details>

2. Si configuras el VAO con `location = 0`, pero el vertex shader espera `layout(location = 1) in vec3 aPos;`, que problema conceptual hay?

<details><summary>Solucion</summary>

El shader esta mirando otra entrada distinta. El VAO puso los datos en `location 0`, pero el shader los pide en `location 1`.

</details>

3. Si olvidas llamar a `glfwPollEvents()` dentro del bucle, que problema practico esperas?

<details><summary>Solucion</summary>

La ventana puede dejar de responder a cierre, teclado, raton, redimensionado u otros eventos.

</details>

4. Si dibujaras directamente sobre la imagen visible, sin doble buffer, que efecto visual podria aparecer?

<details><summary>Solucion</summary>

Podrian aparecer parpadeos o frames parcialmente dibujados. El doble buffer evita mostrar la imagen mientras aun se esta construyendo.

</details>

5. En el proyecto final, que parte de esta clase seguira existiendo aunque ya no dibujemos un triangulo hardcodeado?

<details><summary>Solucion</summary>

Seguiran existiendo ventana, contexto, shaders, VAO/VBO, render loop, swap buffers, poll events y cleanup. Lo que desaparece es el triangulo hardcodeado como fuente fija de datos.

</details>

6. Completa con una frase cada pieza:

```text
GLFW:
Contexto OpenGL:
VBO:
VAO:
Vertex shader:
Fragment shader:
glDrawArrays:
glfwSwapBuffers:
glfwPollEvents:
```

<details><summary>Solucion orientativa</summary>

```text
GLFW: libreria permitida para crear ventana, contexto OpenGL y gestionar eventos.
Contexto OpenGL: estado OpenGL asociado a una ventana/hilo que permite hacer llamadas OpenGL validas.
VBO: buffer en memoria del GPU que contiene datos crudos de vertices.
VAO: objeto que recuerda como interpretar los datos del VBO: location, tamano, stride y offset.
Vertex shader: programa que corre por vertice y produce `gl_Position`.
Fragment shader: programa que corre por fragmento y decide el color final.
glDrawArrays: draw call que ordena dibujar vertices secuenciales desde el VAO activo.
glfwSwapBuffers: intercambia el back buffer dibujado con el front buffer visible.
glfwPollEvents: procesa eventos pendientes de teclado, raton, cierre, resize y foco.
```

</details>

## Errores frecuentes

- Pensar que GLFW resuelve el renderizador. Solo debe resolver ventana, contexto y eventos.
- Creer que el contexto OpenGL contiene el modelo `.obj`. El modelo vive en CPU y luego se sube a buffers.
- Confundir VBO y VAO: el VBO guarda datos; el VAO describe como leerlos.
- Configurar un `location` en el VAO y otro distinto en el shader.
- Olvidar comprobar errores de compilacion y enlazado de shaders.
- Olvidar `glfwPollEvents()` y obtener una ventana que no responde.
- Olvidar `glfwSwapBuffers()` y no presentar correctamente el frame.
- Creer que el triangulo hardcodeado es parte del proyecto final; solo es una prueba minima del pipeline.

## Has aprendido que

- Antes de dibujar necesitas ventana, contexto OpenGL actual, shaders, buffers y bucle de render.
- GLFW esta permitido porque gestiona ventana, contexto y eventos, no el parser ni las matematicas del renderer.
- OpenGL necesita un contexto actual antes de ejecutar llamadas validas.
- El VBO contiene datos de vertices en GPU.
- El VAO recuerda como interpretar esos datos para los atributos del shader.
- `layout(location = N)` debe coincidir con el atributo configurado en `glVertexAttribPointer`.
- El vertex shader trabaja por vertice; el fragment shader decide colores por fragmento.
- `glDrawArrays(GL_TRIANGLES, 0, 3)` dibuja tres vertices secuenciales como un triangulo.
- `glfwSwapBuffers()` presenta el frame terminado y `glfwPollEvents()` procesa eventos.

## Preguntas tipo defensa

1. Por que GLFW esta permitido por el subject?
2. Por que necesitas llamar a `glfwMakeContextCurrent(window)` antes de usar OpenGL?
3. Cual es la diferencia entre VBO y VAO?
4. Por que el `layout(location = 0)` del shader debe coincidir con el atributo configurado en `glVertexAttribPointer`?
5. Para que sirve `glfwSwapBuffers()`?
6. Para que sirve `glfwPollEvents()`?
7. Que parte del primer triangulo desaparecera cuando empecemos a cargar `.obj`, y que parte seguira existiendo?
8. Por que no conviene mezclar en una sola funcion ventana, parser `.obj`, shaders, buffers y render?

## Criterio de finalizacion

- Puedes explicar que responsabilidades cubre GLFW y cuales no debe cubrir.
- Puedes explicar que es un contexto OpenGL y por que debe ser actual.
- Puedes contar cuantos vertices hay en un array de floats segun el stride.
- Puedes distinguir VBO de VAO sin confundir datos con interpretacion.
- Puedes explicar la relacion entre `glVertexAttribPointer` y `layout(location = ...)`.
- Puedes describir el trabajo minimo de un vertex shader y de un fragment shader.
- Puedes ordenar mentalmente un frame: limpiar, usar shader, bind VAO, draw call, swap buffers, poll events.
- Puedes explicar que desaparece del triangulo hardcodeado cuando el `.obj` sea la fuente de datos.

## Siguiente clase

En la siguiente clase entraremos en el parser `.obj`: leeremos lineas `v`, `vt`, `vn` y `f`, adaptaremos indices base uno a arrays base cero y convertiremos caras en triangulos. El resultado sera leer y validar un `.obj` sencillo antes de conectarlo al pipeline grafico.

## Lista de lecturas

- Documentación de GLFW — `glfwCreateWindow`, `glfwMakeContextCurrent`, `glfwPollEvents` y `glfwSwapBuffers` (doble buffer).
- Khronos, OpenGL 3.3 spec — buffer objects (VBO) y vertex array objects (VAO); `glVertexAttribPointer`.
- Khronos, GLSL 3.30 spec — compilar, enlazar y usar shaders (`glShaderSource`/`glLinkProgram`).
