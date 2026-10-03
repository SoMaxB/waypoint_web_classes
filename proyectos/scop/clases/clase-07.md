# Clase 7: controles, recentrado y logo 42

## Objetivo

Convertir el renderer en una aplicacion interactiva: cargar cualquier OBJ desde la linea de comandos, recentrar su bounding box, rotarlo y trasladarlo en los tres ejes y preparar la demo del logo 42 con tonos grises y giro automatico sobre su centro.

## 1. Ruta de entrada

El ejecutable conserva el cubo como valor por defecto, pero ahora acepta un modelo:

```sh
./scop
./scop resources/42.obj
./scop resources/teapot2.obj
```

Esto separa el renderer del asset de prueba y permite que la defensa cambie de objeto sin recompilar.

## 2. Centrar antes de transformar

Un OBJ puede haber sido exportado lejos del origen. Si se rota directamente, orbita alrededor del origen mundial. `center_mesh()` calcula la caja envolvente:

```text
min_x, min_y, min_z
max_x, max_y, max_z

center = (min + max) / 2
vertex = vertex - center
```

El centrado ocurre una vez, en CPU, antes de subir el VBO. Asi `Model = T * R` rota alrededor del centro geometrico del objeto y despues aplica la traslacion elegida por el usuario.

## 3. Controles

| Teclas | Accion |
|---|---|
| Flechas arriba/abajo | Rotacion X |
| Flechas izquierda/derecha | Rotacion Y |
| Q/E | Rotacion Z |
| A/D | Traslacion X |
| S/W | Traslacion Y |
| F/R | Traslacion Z |
| T | Alternar textura suavemente |
| ESC / cerrar ventana | Salir |

El renderer consulta el estado de las teclas cada frame. La variacion se multiplica por `delta_time`, por lo que mantener una tecla produce la misma velocidad en diferentes tasas de refresco.

## 4. Logo 42

Al cargar una ruta que termina en `42.obj`, el fragment shader cambia a una paleta de grises sutiles. Ademas, el eje Y recibe un giro automatico para que la demo sea visible sin tocar el teclado.

```glsl
if (u_gray != 0) {
    float shade = 0.25 + 0.06 * mod(id, 8.0);
    color = vec3(shade);
}
```

El logo se centra antes de rotar. Esa es la diferencia entre girar el objeto sobre su eje y hacerlo orbitar alrededor de una esquina.

## 5. Resize y viewport

El callback de framebuffer actualiza el viewport cuando cambia el tamaño de la ventana:

```c
static void framebuffer_size_callback(GLFWwindow *window,
                                      int width, int height)
{
    (void)window;
    glViewport(0, 0, width, height);
}
```

Sin esta actualizacion, la imagen puede estirarse o dibujarse solo en una parte de la ventana.

## Predicciones y ejercicios

1. Si el bounding box va de `(-4, 2, 0)` a `(6, 8, 10)`, cual es su centro?

<details><summary>Solucion</summary>

El centro es `(1, 5, 5)`. Hay que restarlo a cada vertice.

</details>

2. Que diferencia hay entre `T * R * vertex` y `R * T * vertex`?

<details><summary>Solucion</summary>

En el primer caso se rota primero y se traslada despues. En el segundo se traslada primero y luego la rotacion puede hacer que el objeto orbite.

</details>

3. Por que los controles usan `delta_time`?

<details><summary>Solucion</summary>

Para expresar velocidad por segundo y no desplazamiento por frame. Sin el, el control depende de los FPS.

</details>

4. Ejercicio ejecutado:

```sh
make test
make
timeout 3s ./scop resources/42.obj
timeout 3s ./scop resources/teapot2.obj
```

<details><summary>Solucion</summary>

Los tres modelos se parsean y el contexto OpenGL arranca. El logo informa de 42 vertices y 76 triangulos; la tetera grande tambien se carga sin imprimir miles de lineas de diagnostico.

</details>

## Errores frecuentes

- Centrar la camara en lugar de centrar los vertices del modelo.
- Aplicar la traslacion antes de la rotacion y provocar una orbita.
- Usar desplazamiento fijo por frame en vez de `delta_time`.
- Confundir la tecla de textura con un estado que debe alternarse una sola vez.
- Detectar el logo por el nombre de cualquier objeto que contenga "42" sin documentar la convencion de ruta.
- Olvidar actualizar `glViewport` despues de un resize.
- Imprimir todos los indices de una tetera y ocultar los mensajes importantes.

## Has aprendido que

- El OBJ se puede seleccionar desde la linea de comandos.
- La bounding box permite recentrar un modelo arbitrario.
- `Model = T * R` conserva el giro sobre el centro.
- La entrada por polling y `delta_time` produce controles estables.
- El logo 42 necesita una paleta gris y un giro alrededor de su eje central.
- El viewport debe actualizarse cuando cambia el framebuffer.

## Preguntas tipo defensa

1. Por que un modelo descentrado orbita al rotarlo?
2. Como calculas el centro de una bounding box?
3. Por que el centrado se hace antes de subir el VBO?
4. Que orden tienen las transformaciones del modelo?
5. Que representan las teclas A/D, W/S y R/F?
6. Por que multiplicas el input por `delta_time`?
7. Como se selecciona otro OBJ sin recompilar?
8. Como demuestras que el logo gira sobre el centro y no sobre una esquina?
9. Que hace el callback de framebuffer?

## Criterio de finalizacion

- Puedes cargar el cubo, el logo y una tetera pasando su ruta al ejecutable.
- Puedes explicar y calcular el recentrado por bounding box.
- Puedes rotar X, Y y Z con el teclado.
- Puedes trasladar X, Y y Z con el teclado.
- Puedes explicar por que el logo gira sobre su centro.
- `make test` y `make` terminan correctamente.
- `./scop resources/42.obj` arranca con el logo en tonos grises.
- `./scop resources/teapot2.obj` arranca sin desbordar la salida de diagnostico.

## Siguiente clase

La ultima clase cerrara el README, las dependencias, las pruebas con objetos adicionales y la auditoria completa del subject. El bonus queda fuera hasta que todos estos puntos sean defendibles.

## Lista de lecturas

- GLFW: `glfwGetKey`, `glfwSetFramebufferSizeCallback` y constantes de teclado.
- OpenGL 3.3: `glViewport` y transformaciones de viewport.
- `src/obj_parser.c`: `center_mesh` y bounding boxes.
- `src/main.c`: controles, argumentos y seleccion de paleta gris.
