# Clase 2: entorno, cargador manual de OpenGL y primer triangulo

## Objetivo

Montar el esqueleto real de Scop sobre el que se construiran todas las demas clases: ventana GLFW, contexto OpenGL core 3.3, cargador manual de las funciones de OpenGL, shaders minimos, VBO/VAO y bucle de render. Al terminar esta clase debes poder explicar que aporta GLFW, que es un contexto OpenGL y por que debe ser actual, por que las funciones de OpenGL hay que cargarlas en runtime y no enlazarlas, que diferencia hay entre declarar, definir y asignar un puntero a funcion, como se conectan los atributos del shader con los datos del buffer y por que el bucle de render necesita `glfwSwapBuffers()` y `glfwPollEvents()`.

Esta clase se tomo de forma interactiva y cumple la regla del proyecto: se escribio, compilo con `-Wall -Wextra -Werror` y se ejecuto codigo real. El resultado observable fue una ventana clara y un triangulo naranja dibujado por nuestro propio pipeline.

## 1. Que estamos aislando

Esta clase no carga todavia `.obj`, no usa matrices MVP y no aplica texturas. Aisla dos preguntas:

```text
1. Que tiene que existir antes de que el GPU pueda dibujar algo?
2. Como se obtienen las funciones de OpenGL que el GPU va a ejecutar?
```

El flujo minimo es:

```text
programa
  ↓
inicializar libreria de ventana (glfwInit)
  ↓
pedir contexto core 3.3 (glfwWindowHint ANTES de crear ventana)
  ↓
crear ventana + contexto OpenGL (glfwCreateWindow)
  ↓
hacer el contexto actual (glfwMakeContextCurrent)
  ↓
cargar funciones OpenGL (cargador manual, despues del contexto)
  ↓
crear shaders y compilarlos
  ↓
crear datos del triangulo y subirlos a VBO/VAO
  ↓
bucle de eventos (glfwWindowShouldClose)
  ↓
dibujar cada frame
  ↓
swap buffers + poll events
```

La ventana no es la escena. Es el destino donde OpenGL presentara el framebuffer final.

## 2. Que permite el subject

El subject permite librerias externas para ventana y eventos. Por eso una libreria como GLFW puede encargarse de:

- Crear la ventana.
- Crear el contexto OpenGL.
- Gestionar teclado, raton y cierre de ventana.
- Mantener el bucle de eventos.
- Exponer `glfwGetProcAddress`, el punto de entrada para resolver funciones de OpenGL en runtime.

Pero no debe encargarse de las partes que el subject exige implementar o entender personalmente:

- Parser de `.obj`.
- Matrices y transformaciones.
- Carga/compilacion de shaders como caja negra externa.
- Renderizador completo.
- El cargador de funciones de OpenGL: conviene hacerlo a mano para poder defender que no se usan librerias externas mas alla de la de ventana/eventos.

GLFW esta permitido porque resuelve infraestructura de ventana/contexto/eventos, no el problema central de Scop.

## 3. Ventana, contexto y bucle minimo

El esqueleto real que se escribio es:

```c
glfwSetErrorCallback(error_callback);

if (!glfwInit())
    return 1;

glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

GLFWwindow *window = glfwCreateWindow(800, 600, "scop", NULL, NULL);
if (!window)
    return 1;

glfwMakeContextCurrent(window);

init_gl_functions();   /* el cargador manual */

while (!glfwWindowShouldClose(window))
{
    /* ... limpiar, dibujar ... */
    glfwSwapBuffers(window);
    glfwPollEvents();
}

glfwTerminate();
```

Dos detalles criticos de orden:

- Los `glfwWindowHint` se llaman **antes** de `glfwCreateWindow`. La peticion de contexto (version y perfil) se formaliza en el instante de crear la ventana: los hints se consumen ahi y quedan fijados para la vida de esa ventana. Si se llaman despues, crean un contexto con el perfil por defecto (legacy) y no se cambia retroactivamente.
- `glfwMakeContextCurrent(window)` hace el contexto actual para el hilo. Sin contexto actual, llamadas como crear buffers, compilar shaders o limpiar la pantalla no tienen estado OpenGL valido sobre el que operar. El cargador manual va **despues** de esta llamada, porque solo a partir de ahi `glfwGetProcAddress` devuelve punteros validos del driver.

## 4. Por que hay que cargar las funciones de OpenGL a mano

En Linux, las funciones de OpenGL 3.3+ no se exponen como simbolos normales enlazados en compilacion. Se resuelven en runtime apuntando a direcciones de memoria del driver. La razon tiene dos capas:

- El API de OpenGL es **extensible por diseno**: extensiones (`GL_ARB_...`) y vendors pueden anadir funciones que la libreria base ni conoce. Las firmas de esas funciones futuras no existen en el momento de compilar, asi que el punto de entrada (`glfwGetProcAddress`) no puede declarar un tipo concreto: devuelve un puntero generico que luego se castea a la firma real de cada funcion.
- La implementacion la decide el driver de la GPU (Mesa, NVIDIA, AMD...) que se carga cuando se crea el contexto. Hasta que existe contexto no hay una direccion unica y valida para cada funcion.

Por eso el flujo es: window library carry el contexto, el driver se carga con el contexto, y `glfwGetProcAddress` consulta al driver "dame tu implementacion de tal funcion". El puntero-cast es el puente entre lo generico del loader y lo concreto de cada firma.

## 5. El cargador manual: header, tipos y constantes

GLFW, por defecto, incluye `<GL/gl.h>` al incluir su header. Ese header del sistema declara algunas funciones legacy como simbolos reales (por ejemplo `glClearColor`, `glClear`, `glDrawArrays`). Si nosotros declaramos punteros a funcion con esos mismos nombres, el compilador responde: `'glClearColor' redeclared as different kind of symbol`. La solucion canonica (la misma que usa GLAD) es evitar que GLFW meta `gl.h` y declarar nosotros los tipos y constantes minimos que consumimos:

```c
/* src/gl_loader.h */
#ifndef GL_LOADER_H
#define GL_LOADER_H

#include <stddef.h>
#include <stdint.h>

#define GLFW_INCLUDE_NONE          /* GLFW no incluye <GL/gl.h> */
#include <GLFW/glfw3.h>

typedef uint32_t   GLenum;
typedef uint32_t   GLbitfield;
typedef uint32_t   GLuint;
typedef int32_t    GLint;
typedef int32_t    GLsizei;
typedef uint8_t    GLboolean;
typedef uint8_t    GLubyte;
typedef float      GLfloat;
typedef char       GLchar;
typedef ptrdiff_t  GLsizeiptr;

enum {
    GL_COLOR_BUFFER_BIT = 0x00004000, /* glClear : buffer de color */
    GL_VERSION          = 0x1F02,     /* glGetString : version */
    GL_FLOAT            = 0x1406,
    GL_FALSE            = 0,
    GL_VERTEX_SHADER    = 0x8B31,
    GL_FRAGMENT_SHADER  = 0x8B30,
    GL_ARRAY_BUFFER     = 0x8892,
    GL_STATIC_DRAW      = 0x88E4,
    GL_TRIANGLES        = 0x0004
};

void init_gl_functions(void);

extern void (*glClearColor)(GLfloat, GLfloat, GLfloat, GLfloat);
extern void (*glClear)(GLbitfield);
extern const GLubyte *(*glGetString)(GLenum);
/* ... resto de punteros a funcion con su firma exacta ... */

#endif
```

Un detalle que se pago caro en la sesion: los valores de `GL_COLOR_BUFFER_BIT` y `GL_VERSION` son de la spec de Khronos, no inventados. Y en el `enum`, cada constante va separada por coma; olvidar una coma rompe la compilacion.

## 6. Declarar, definir y asignar: las tres vidas de un puntero a funcion

El error de enlazado mas instructivo de la sesion fue:

```text
referencia a 'glClearColor' sin definir
```

Porque hay tres momentos distintos para un puntero a funcion global, y confundirlos rompe el build:

- **Declarar** (`extern void (*glClearColor)(...);` en el header): "existe un simbolo con esta firma, sera definido en otro lado". Repetible en cada archivo que lo necesite.
- **Definir** (`void (*glClearColor)(...);` en el `.c`): reserva el almacenamiento real del simbolo. Debe existir exactamente una vez en todo el programa; si dos archivos definieran el mismo simbolo, el linker fallaria con *multiple definition*.
- **Asignar** (`glClearColor = (void *)glfwGetProcAddress("glClearColor");`): ponerle un valor en runtime. Asignar no define: sin la definicion previa, el simbolo no existe para el linker.

Las definiciones van en el `.c` del loader (no en el header, que solo declara). Con las definiciones en un solo `.c`, main y loader comparten las declaraciones del header, el `.c` posee el almacenamiento, e `init_gl_functions()` lo inicializa con las direcciones del driver.

Las 22 asignaciones se hacen con una macro que tambien incluye el guard de error:

```c
#define GL_LOAD(name)                                                       \
    do {                                                                    \
        name = (void *)glfwGetProcAddress(#name);                           \
        if (name == NULL) {                                                 \
            fprintf(stderr, "GL: %s no disponible (contexto core?)\n", #name); \
            exit(1);                                                        \
        }                                                                   \
    } while (0)
```

La macro resuelve dos problemas a la vez:

- `#name` (stringification) convierte el nombre del parametro en string para el mensaje de error, sin repetir el nombre a mano.
- `do { } while (0)` hace que la macro se comporte como una sentencia normal y no rompa estructuras de control (`if (x) GL_LOAD(a); else ...`).
- Las barras `\` al final de cada linea pegan la macro en una sola directiva del preprocesador; deben ser el ultimo caracter de la linea, sin espacios despues, o la macro se corta y aparecen errores raros del tipo `stray '#' in program`.

El guard es obligatorio: si el driver no implementa una funcion (o el contexto no es core), `glfwGetProcAddress` devuelve `NULL`. Un programa que llamara a un puntero `NULL` crashearia sin aviso; el guard lo convierte en un mensaje claro y salida con codigo de error.

## 7. El primer triangulo

El dato minimo es un array de posiciones hardcodeadas:

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

Por tanto: `9 floats / 3 floats por vertice = 3 vertices`.

Estos datos no aparecen en pantalla por estar en un array C. El GPU no lee automaticamente la RAM del programa; hay que subirlos a memoria del GPU:

```c
GLuint vao, vbo;
glGenVertexArrays(1, &vao);
glBindVertexArray(vao);

glGenBuffers(1, &vbo);
glBindBuffer(GL_ARRAY_BUFFER, vbo);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void *)0);
glEnableVertexAttribArray(0);
```

- **VBO** (Vertex Buffer Object): guarda los datos crudos de vertices en memoria del GPU. Responde "donde estan los datos".
- **VAO** (Vertex Array Object): recuerda como se interpretan esos datos (location, tamano, stride, offset). Responde "como se leen".
- `glVertexAttribPointer` conecta el dato con el shader: el atributo `location 0` se lee con 3 floats por vertice, stride de 3 floats, offset 0.
- `(void *)0` es un offset en bytes desde el inicio del buffer, no un puntero real: es deuda historica del API. Para un segundo atributo que empiece despues de la posicion, iria `(void *)(3 * sizeof(float))`.

Mas adelante, cuando cada vertice tenga posicion, color y UV, el VAO describira tres atributos:

```text
location 0: posicion, 3 floats, offset 0
location 1: color,    3 floats, offset tras posicion
location 2: UV,       2 floats, offset tras color
```

## 8. Shaders minimos

Los shaders en esta clase van como strings; en el proyecto real se cargaran desde archivos con codigo propio.

```c
const char *vs_src =
    "#version 330 core\n"
    "layout(location = 0) in vec3 aPos;\n"
    "void main() { gl_Position = vec4(aPos, 1.0); }\n";

const char *fs_src =
    "#version 330 core\n"
    "out vec4 FragColor;\n"
    "void main() { FragColor = vec4(0.8, 0.4, 0.2, 1.0); }\n";
```

La conexion importante es:

```text
VAO dice:  location 0 contiene 3 floats por vertice
shader:    layout(location = 0) in vec3 aPos
```

Si el VAO configura `location = 0` pero el shader espera `location = 1`, el shader esta mirando otra entrada: puede no verse nada o leerse datos incorrectos.

El flujo de compilacion y enlazado:

```text
glCreateShader → glShaderSource → glCompileShader
glCreateProgram → glAttachShader(vertex) → glAttachShader(fragment) → glLinkProgram
glDeleteShader(vs) → glDeleteShader(fs) → glUseProgram
```

El subject no prohibe escribir funciones propias como `load_shader_file()` o `compile_shader()`. Lo que no se debe hacer es delegar esa responsabilidad a una libreria externa que oculte la carga, compilacion, enlazado y reporte de errores. Ademas, en el proyecto real convendra comprobar los errores de compilacion con `glGetShaderiv`/`glGetShaderInfoLog` y los de enlazado con `glGetProgramiv`/`glGetProgramInfoLog`.

## 9. Dibujar cada frame

Un frame minimo hace esto:

```c
glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
glClear(GL_COLOR_BUFFER_BIT);

glUseProgram(program);
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
| `glBindVertexArray` | Activa la receta para leer vertices. Rebindear cada frame es la convencion que no falla: el binding del VAO es estado global de GL, y con varios objetos cada draw usa su receta. |
| `glDrawArrays` | Ordena dibujar vertices secuenciales como triangulos. |
| `glfwSwapBuffers` | Muestra el frame renderizado (doble buffer). |
| `glfwPollEvents` | Procesa teclado, raton, cierre, resize y otros eventos. |

Si olvidas `glfwPollEvents()`, la ventana puede no responder a cierre, teclado o raton. Si olvidas `glfwSwapBuffers()`, el frame no se presenta.

## 10. Verificacion real de la sesion

Al ejecutar el programa, la terminal imprimio:

```text
OpenGL 4.6 (Core Profile) Mesa 25.2.8-0ubuntu0.24.04.2 (cargador manual OK)
```

Leccion de la salida: se pidio un contexto core 3.3, pero el driver entrego 4.6. Los hints piden el **minimo** (`>= 3.3`), y el driver da el contexto mas nuevo compatible hacia atras. El codigo sigue siendo valido en 3.3 y en 4.6: el loader resuelve funciones por nombre, no por version fija.

El criterio observable de la clase: se abrio una ventana, se dibujo un triangulo naranja (fragment shader con `vec4(0.8, 0.4, 0.2, 1.0)`, RGBA) sobre fondo azul-negro (`glClearColor(0.1, 0.1, 0.12, 1.0)`), sin avisos de compilacion con `-Wall -Wextra -Werror`, con el cargador manual cargando las 22 funciones sin ningun fallo de `NULL`.

## 11. Que queda para el Scop real

El triangulo hardcodeado es temporal, pero la infraestructura seguira existiendo:

```text
ventana
contexto
cargador manual de OpenGL
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

2. Quien carga las funciones de OpenGL en Linux y como? (respuesta correcta de la sesion)

<details><summary>Solucion</summary>

El cargador las resuelve en runtime con `glfwGetProcAddress` para cada funcion, casteando el puntero generico a la firma exacta. `glfwGetProcAddress` devuelve un puntero generico (`void (*)(void)`); no puede devolver `char*` ni una firma concreta porque el API es extensible y las firmas futuras no existen al compilar.

</details>

3. Que tipo devuelve `glfwGetProcAddress` y que hay que hacer con el para poder llamar a la funcion?

<details><summary>Solucion</summary>

Devuelve un puntero generico a funcion. Hay que declarar un puntero con la firma exacta de la funcion y asignar el generico con un cast. Y el unpacking de la funcion llama a ese puntero. Sin el cast y la firma correcta, C no sabe como invocarla.

</details>

4. Que problema practico aparece si llamas a `init_gl_functions()` antes de crear la ventana/contexto?

<details><summary>Solucion</summary>

El driver aun no se ha cargado, asi que `glfwGetProcAddress` devuelve `NULL` para las funciones 3.x y el guard de la macro aborta con un mensaje de error. La cadena correcta es: contexto primero, loader despues.

</details>

5. Si olvidas las llaves `\` al final de cada linea de la macro, que tipo de error de preprocesador aparece?

<details><summary>Solucion</summary>

La macro se corta en la primera linea y el cuerpo queda suelto como codigo normal: errores del estilo `expected identifier or '(' before 'do'` y `stray '#' in program` por el `#` de la stringification. El `\` debe ser el ultimo caracter de la linea.

</details>

6. Por que las definiciones de los punteros van en el `.c` y no en el header?

<details><summary>Solucion</summary>

Porque un simbolo se define una sola vez en todo el programa. Si dos `.c` definieran el mismo simbolo, el linker fallaria con *multiple definition*. En el header solo van las declaraciones `extern`, repetibles en cada archivo que las necesite.

</details>

7. Que esperas que imprima `glGetString(GL_VERSION)` si pediste un contexto 3.3 en un driver que soporta mas?

<details><summary>Solucion</summary>

Puede imprimir la version exacta pedida (3.3) o la del contexto mas nuevo que el driver decida crear (en la sesion real imprimio `4.6 (Core Profile) Mesa ...`). Los hints piden el minimo, no fijan el valor exacto.

</details>

8. Completa con una frase cada pieza:

```text
GLFW:
Contexto OpenGL:
Cargador manual:
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
Cargador manual: codigo propio que resuelve los punteros de las funciones de OpenGL en runtime con glfwGetProcAddress.
VBO: buffer en memoria del GPU que contiene datos crudos de vertices.
VAO: objeto que recuerda como interpretar los datos del VBO: location, tamano, stride y offset.
Vertex shader: programa que corre por vertice y produce `gl_Position`.
Fragment shader: programa que corre por fragmento y decide el color final.
glDrawArrays: draw call que ordena dibujar vertices secuenciales desde el VAO activo.
glfwSwapBuffers: intercambia el back buffer dibujado con el front buffer visible.
glfwPollEvents: procesa eventos pendientes de teclado, raton, cierre, resize y foco.
```

</details>

9. Ejercicio ejecutado (obligatorio): crea un `Makefile` con `-Wall -Wextra -Werror` y la linea de dependencias usando `pkg-config --cflags --libs glfw3`. Compila y ejecuta. El criterio observable: la ventana se abre con un triangulo naranja sobre fondo azul-negro, la terminal imprime la linea del driver, y no hay ningun aviso del compilador.

<details><summary>Solucion</summary>

Makefile de referencia:

```make
NAME    = scop
CC      = cc
CFLAGS  = -Wall -Wextra -Werror
GLFW    = $(shell pkg-config --cflags --libs glfw3)
SRCS    = src/main.c src/gl_loader.c
OBJ     = $(SRCS:.c=.o)

all: $(NAME)

$(NAME): $(OBJ)
	$(CC) $(CFLAGS) -o $@ $(OBJ) $(GLFW)

%.o: %.c src/gl_loader.h
	$(CC) $(CFLAGS) $(shell pkg-config --cflags glfw3) -c $< -o $@

clean:
	rm -f $(OBJ)

fclean: clean
	rm -f $(NAME)

re: fclean all

.PHONY: all clean fclean re
```

En la sesion real el makefile se guardo inicialmente en `src/` y hubo que moverlo a la raiz del repo: `make` se ejecuta desde la raiz y sus rutas `src/...` se resuelven ahi, no desde dentro de `src/`.

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
- Usar el cargador manual antes de `glfwMakeContextCurrent`.
- Poner los `glfwWindowHint` despues de `glfwCreateWindow`: el contexto nace con el perfil por defecto.
- Olvidar las comas en el `enum` de constantes y ver errores de declaracion confusos.
- Olvidar las definiciones de los punteros en el `.c` y sufrir *undefined reference* en el enlazado.
- Dejar espacios despues de las `\` de la macro y ver `stray '#' in program`.
- Confundir `(void *)0` de `glVertexAttribPointer` con un puntero real, cuando es un offset en bytes.

## Has aprendido que

- Antes de dibujar necesitas ventana, contexto OpenGL actual, shaders, buffers y bucle de render.
- GLFW esta permitido porque gestiona ventana, contexto y eventos, no el parser ni las matematicas del renderer.
- OpenGL necesita un contexto actual antes de ejecutar llamadas validas.
- Las funciones de OpenGL se resuelven en runtime con `glfwGetProcAddress` porque el API es extensible y el driver se carga con el contexto; no hay simbolos enlazables para OpenGL 3.3+.
- `GLFW_INCLUDE_NONE` evita que GLFW meta `<GL/gl.h>` y choque con nuestros punteros a funcion.
- Extern declara, el `.c` define, y la asignacion en runtime llena el valor; los tres momentos son distintos.
- La macro `GL_LOAD` con `#name` y `do { } while (0)` carga cada funcion y aborta con mensaje claro si el driver no la da.
- El VBO contiene datos; el VAO recuerda como leerlos; `layout(location = N)` debe coincidir con `glVertexAttribPointer`.
- El vertex shader trabaja por vertice; el fragment shader decide colores por fragmento.
- `glDrawArrays(GL_TRIANGLES, 0, 3)` dibuja tres vertices secuenciales como un triangulo.
- `glfwSwapBuffers()` presenta el frame terminado y `glfwPollEvents()` procesa eventos.
- Pedir un contexto 3.3 pide un minimo, no un valor exacto: el driver puede entregar una version mayor compatible.

## Preguntas tipo defensa

1. Por que GLFW esta permitido por el subject?
2. Por que las funciones de OpenGL 3.3+ no se enlazan en compilacion y hay que cargarlas en runtime?
3. Por que hay que llamar a `glfwMakeContextCurrent(window)` antes del cargador manual?
4. Que diferencia hay entre declarar, definir y asignar un puntero a funcion global?
5. Por que los `glfwWindowHint` van antes de `glfwCreateWindow` y no despues?
6. Que significa `(void *)0` en `glVertexAttribPointer` y que indicaria un segundo atributo?
7. Que hace `#name` en la macro `GL_LOAD` y por que el cuerpo va enfrascado en `do { } while (0)`?
8. Por que el `layout(location = 0)` del shader debe coincidir con el atributo configurado en `glVertexAttribPointer`?
9. Por que rebindear el VAO en cada frame es la convencion segura con varios objetos?
10. Que parte del primer triangulo desaparecera cuando empecemos a cargar `.obj`, y que parte seguira existiendo?

## Criterio de finalizacion

- Puedes explicar que responsabilidades cubre GLFW y cuales no debe cubrir.
- Puedes explicar que es un contexto OpenGL y por que debe ser actual.
- Puedes explicar por que las funciones de OpenGL se cargan en runtime y como se hace con `glfwGetProcAddress`.
- Puedes distinguir declarar, definir y asignar un puntero a funcion, y ubicar cada paso en el codigo del loader.
- Puedes contar cuantos vertices hay en un array de floats segun el stride.
- Puedes distinguir VBO de VAO sin confundir datos con interpretacion.
- Puedes explicar la relacion entre `glVertexAttribPointer` y `layout(location = ...)`.
- Puedes ordenar mentalmente un frame: limpiar, usar shader, bind VAO, draw call, swap buffers, poll events.
- Has escrito, compilado con `-Wall -Wextra -Werror` y ejecutado el codigo: la ventana se abrio y el triangulo naranja se vio en pantalla.
- Puedes explicar que desaparece del triangulo hardcodeado cuando el `.obj` sea la fuente de datos.

## Siguiente clase

En la siguiente clase entraremos en el parser `.obj`: leeremos lineas `v`, `vt`, `vn` y `f`, adaptaremos indices base uno a arrays base cero y convertiremos caras en triangulos. El resultado sera leer y validar un `.obj` sencillo y cargarlo en el mismo esqueleto de clases 2, antes de conectarlo al pipeline grafico.

## Lista de lecturas

- Documentacion oficial de GLFW — `glfwCreateWindow`, `glfwWindowHint`, `glfwMakeContextCurrent`, `glfwPollEvents`, `glfwSwapBuffers` y `glfwGetProcAddress`.
- Khronos, OpenGL 3.3 Core Profile spec — buffer objects (VBO), vertex array objects (VAO) y `glVertexAttribPointer`; espacio de clip y division por perspectiva.
- Khronos, GLSL 3.30 spec — compilar, enlazar y usar shaders (`glShaderSource`/`glLinkProgram`).
- Especificacion de Khronos de las constantes de OpenGL — valores de `GL_COLOR_BUFFER_BIT`, `GL_VERTEX_SHADER`, `GL_ARRAY_BUFFER`, `GL_STATIC_DRAW` y `GL_TRIANGLES`.