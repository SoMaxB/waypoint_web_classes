# Clase 4: matrices MVP y perspectiva

## Objetivo

Construir el puente entre las coordenadas del `.obj` y la pantalla: representar puntos con coordenadas homogeneas, implementar matrices 4x4 propias, componer `Model`, `View` y `Projection`, y enviar el resultado al vertex shader. Al terminar, el cubo del proyecto debe girar sobre su centro y verse en perspectiva sin usar GLM ni otra libreria matematica.

## 1. La pregunta que resolvemos

En la clase 3 el cubo ya llegaba al GPU, pero sus coordenadas se usaban directamente:

```glsl
gl_Position = vec4(aPos, 1.0);
```

Eso dibuja la geometria en el volumen visible sin decir donde esta el objeto, donde esta la camara ni como funciona la profundidad aparente. En esta clase el flujo pasa a ser:

```text
posicion del OBJ
  -> Model: transforma el objeto
  -> View: expresa el mundo desde la camara
  -> Projection: aplica perspectiva
  -> division por w
  -> rasterizacion
```

La composicion es:

```text
clip = Projection * View * Model * vertex
```

Usamos vectores columna. Por eso la matriz de la derecha actua primero.

## 2. Multiplicar una matriz por un vector

Una matriz no es magia: cada fila calcula una coordenada nueva. Para una escala uniforme por 2:

```text
S = [ 2  0  0  0 ]
    [ 0  2  0  0 ]
    [ 0  0  2  0 ]
    [ 0  0  0  1 ]
```

Aplicada a `(1, -3, 0, 1)`:

```text
x' = 2*1  + 0*(-3) + 0*0 + 0*1 = 2
y' = 0*1  + 2*(-3) + 0*0 + 0*1 = -6
z' = 0*1  + 0*(-3) + 2*0 + 0*1 = 0
w' = 0*1  + 0*(-3) + 0*0 + 1*1 = 1
```

Resultado: `(2, -6, 0, 1)`.

La implementacion usa esta convencion:

```c
typedef struct s_mat4
{
    float m[16];
} t_mat4;
```

`m[col * 4 + row]` significa que el array esta en *column-major*. La diagonal de la identidad esta en `m[0]`, `m[5]`, `m[10]` y `m[15]`.

## 3. Coordenadas homogeneas

Una posicion usa `w = 1`; una direccion usa `w = 0`:

```text
posicion:  (x, y, z, 1)
direccion: (x, y, z, 0)
```

La matriz de traslacion es:

```text
T = [ 1  0  0  tx ]
    [ 0  1  0  ty ]
    [ 0  0  1  tz ]
    [ 0  0  0  1  ]
```

Para una posicion produce `(x+tx, y+ty, z+tz, 1)`. Para una direccion no suma la traslacion porque su `w` es cero. En el array column-major, `tx`, `ty` y `tz` estan en `m[12]`, `m[13]` y `m[14]`.

La funcion real esta en `src/mat4.c`:

```c
t_mat4 mat4_translate(float x, float y, float z)
{
    t_mat4 out = mat4_identity();

    out.m[12] = x;
    out.m[13] = y;
    out.m[14] = z;
    return out;
}
```

## 4. Rotar sin orbitar

En 2D, una rotacion de angulo `theta` usa:

```text
x' = cos(theta)*x - sin(theta)*y
```

Alrededor del eje Z en 3D, `z` queda igual. `mat4_rotate_x`, `mat4_rotate_y` y `mat4_rotate_z` implementan las tres variantes en `src/mat4.c`.

Para que el cubo gire sobre su propio centro y luego se traslade, el modelo es:

```text
Model = T * R
```

La rotacion `R` actua primero porque esta a la derecha. Si el modelo estuviera descentrado, habria que centrar sus vertices o usar `T(centro) * R * T(-centro)`.

## 5. Multiplicar matrices

Para `C = A * B`, cada elemento es el producto fila por columna:

```text
C[row][col] = A[row][0]*B[0][col]
            + A[row][1]*B[1][col]
            + A[row][2]*B[2][col]
            + A[row][3]*B[3][col]
```

La funcion usa los indices column-major:

```c
out.m[col * 4 + row] +=
    a.m[k * 4 + row] * b.m[col * 4 + k];
```

La propiedad que permite componer el pipeline es:

```text
(A * B) * v = A * (B * v)
```

Por eso:

```c
model = mat4_mul(translation, rotation);
mvp = mat4_mul(projection, mat4_mul(view, model));
```

## 6. Camara y perspectiva

Si la camara esta en `(0, 0, 5)`, en vez de mover la camara movemos el mundo en sentido contrario:

```c
view = mat4_translate(0.0f, 0.0f, -5.0f);
```

La perspectiva necesita `FOV`, proporcion de ventana, `near` y `far`. La funcion propia implementa:

```text
f = 1 / tan(FOV / 2)

P = [ f/aspect  0  0                    0 ]
    [ 0         f  0                    0 ]
    [ 0         0  (far+near)/(near-far)  2*far*near/(near-far) ]
    [ 0         0 -1                    0 ]
```

Despues del vertex shader, OpenGL divide `x`, `y` y `z` por `w`. Esa division hace que un objeto lejano ocupe menos pantalla.

## 7. Conectar el MVP al shader

El vertex shader ya no usa directamente `aPos`:

```glsl
uniform mat4 u_mvp;
layout(location = 0) in vec3 aPos;

void main()
{
    gl_Position = u_mvp * vec4(aPos, 1.0);
}
```

En C se obtiene la posicion del uniform y se actualiza cada frame:

```c
GLint mvp_location = glGetUniformLocation(program, "u_mvp");
glUseProgram(program);
glUniformMatrix4fv(mvp_location, 1, GL_FALSE, mvp.m);
```

`GL_FALSE` indica que no se transpone la matriz: ya esta en column-major.

El frame real de `src/main.c` queda:

```c
model = mat4_mul(mat4_translate(0.0f, 0.0f, 0.0f),
                 mat4_rotate_y(angle));
view = mat4_translate(0.0f, 0.0f, -5.0f);
projection = mat4_perspective(60 grados, 800.0f / 600.0f, 0.1f, 100.0f);
mvp = mat4_mul(projection, mat4_mul(view, model));
```

Antes de dibujar tambien se limpia el depth buffer:

```c
```

## Predicciones y ejercicios

1. Explica con palabras por que `T * R` rota primero y traslada despues cuando usamos vectores columna.

<details><summary>Solucion</summary>

La matriz de la derecha actua primero. En `T * R * v`, `R` recibe el vertice antes que `T`.

</details>

2. Calcula `T * (1, 2, 0, 1)` para `T = translate(3, -1, 2)`.

<details><summary>Solucion</summary>

El resultado es `(4, 1, 2, 1)`.

</details>

3. Que indices del array contienen `tx`, `ty` y `tz` con `m[col * 4 + row]`?

<details><summary>Solucion</summary>

`m[12]`, `m[13]` y `m[14]`.

</details>

4. Ejecuta las pruebas matematicas y el renderer:

```sh
make test
make
timeout 3s ./scop
```

<details><summary>Solucion</summary>

`make test` termina correctamente; `./scop` imprime `OBJ OK: 8 vertices (24 floats), 36 indices (12 triangulos)` y la version de OpenGL. La ventana muestra el cubo girando en perspectiva.

</details>

## Errores frecuentes

- Aplicar `R * T` esperando que la traslacion no orbite.
- Mezclar row-major y column-major y colocar la traslacion en `m[3]`, `m[7]`, `m[11]`.
- Olvidar que los vectores columna reciben primero la matriz de la derecha.
- Usar grados directamente en `sinf`, `cosf` o `tanf`; las funciones reciben radianes.
- Enviar `M`, `V` o `P` por separado cuando el shader espera el `MVP`.
- Olvidar `glUniformMatrix4fv` despues de activar el programa.
- Omitir `GL_DEPTH_TEST` o no limpiar `GL_DEPTH_BUFFER_BIT` cada frame.
- Usar una libreria externa de matrices, prohibida por el subject.
- Olvidar `-lm` al enlazar las funciones matematicas de C.

## Has aprendido que

- Una matriz 4x4 codifica formulas para producir nuevas coordenadas.
- `w=1` representa una posicion y `w=0` una direccion.
- La traslacion vive en la ultima columna con la convencion column-major usada.
- Las transformaciones no conmutan; su orden cambia el resultado.
- `Model` transforma el objeto, `View` transforma el mundo respecto a la camara y `Projection` aplica perspectiva.
- `MVP = P * V * M` y la matriz de la derecha actua primero.
- La division por `w` produce el efecto de profundidad de la perspectiva.
- Las matrices propias de Scop estan en `src/mat4.c`, no en una libreria externa.
- `make test` valida algebra basica antes de abrir una ventana.

## Preguntas tipo defensa

1. Por que usamos cuatro componentes si el objeto tiene coordenadas x, y, z?
2. Que diferencia hay entre una posicion con `w=1` y una direccion con `w=0`?
3. Por que `T * R` y `R * T` no representan lo mismo?
4. Que significa `m[col * 4 + row]`?
5. Que responsabilidad tiene cada una de `Model`, `View` y `Projection`?
6. Por que la camara en z=5 produce una vista con traslacion z=-5?
7. Por que la matriz de perspectiva hace que lo lejano se vea mas pequeno?
8. Que hace `glUniformMatrix4fv` y por que se llama en cada frame?
9. Por que `GL_DEPTH_TEST` no sustituye a la matriz de perspectiva?
10. Por que el proyecto necesita `-lm` despues de añadir las matrices?

## Criterio de finalizacion

- Puedes calcular una fila de una matriz por un vector sin tratarla como una caja negra.
- Puedes explicar `w=1` y `w=0` con un ejemplo de traslacion.
- Puedes localizar `tx`, `ty` y `tz` en `m[12]`, `m[13]` y `m[14]`.
- Puedes justificar por que `Model = T * R` rota antes de trasladar.
- Puedes explicar `MVP = P * V * M` y el orden de ejecucion.
- Puedes leer `mat4.c` y relacionar cada funcion con su formula.
- `make test` termina correctamente.
- `make` termina sin avisos con `-Wall -Wextra -Werror`.
- `timeout 3s ./scop` muestra el cubo parseado, crea el contexto OpenGL y ejecuta el renderer.
- Puedes defender por que no se uso GLM ni otra libreria matematica.

## Siguiente clase

En la siguiente clase separaremos los datos de posicion y color. El parser y el EBO ya nos dan triangulos; ahora cada triangulo recibira un color para que las caras sean visualmente distinguibles, como exige el subject.

## Lista de lecturas

- Khronos, OpenGL 3.3 Core Profile: coordenadas de clip, viewport y division por `w`.
- GLSL 3.30: `mat4`, uniforms y `gl_Position`.
- `man 3 sinf`, `man 3 cosf` y `man 3 tanf`: radianes y enlace con `libm`.
- `src/mat4.c` y `tests/mat4_test.c`: implementacion y pruebas ejecutables de esta clase.
