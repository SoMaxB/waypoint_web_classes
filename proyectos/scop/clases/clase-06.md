# Clase 6: textura PPM y transicion suave

## Objetivo

Aplicar una textura sin usar una libreria externa de imagenes y alternarla suavemente con los colores por triangulo. Al terminar debes poder explicar la ruta imagen CPU -> textura GPU -> sampler -> fragment shader, por que estos OBJ necesitan UV de fallback y por que una tecla debe cambiar un objetivo animado en lugar de saltar directamente de 0 a 1.

## 1. Restricciones y decision

El subject solo permite librerias externas para ventana y eventos. Por eso no se usa stb_image ni otro cargador de imagen. Scop incluye un cargador PPM propio que acepta `P3` ASCII y `P6` binario. La textura se puede elegir como segundo argumento del ejecutable.

Los modelos disponibles (`cube.obj`, `42.obj` y las dos teteras) no contienen lineas `vt`. Para no bloquear el proyecto, el vertex shader genera una UV planar sencilla desde `aPos.xy`:

```glsl
v_uv = aPos.xy + vec2(0.5);
```

Es suficiente para demostrar la textura y deja una mejora clara para una futura clase: leer UV reales y escoger una proyeccion por objeto.

## 2. De PPM a OpenGL

El cargador valida el encabezado, ancho, alto y maximo de color, reserva `width * height * 3` bytes y acepta tanto componentes ASCII (`P3`) como bytes RGB (`P6`).

Despues del contexto OpenGL:

```c
glGenTextures(1, &texture);
glBindTexture(GL_TEXTURE_2D, texture);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB,
             image.width, image.height, 0,
             GL_RGB, GL_UNSIGNED_BYTE, image.pixels);
```

La CPU deja de ser necesaria despues de `glTexImage2D`, por eso se libera `image.pixels` inmediatamente.

## 3. El sampler y la mezcla

El vertex shader pasa las coordenadas al fragment shader:

```glsl
out vec2 v_uv;
v_uv = aPos.xy + vec2(0.5);
```

El fragment shader mantiene el color por triangulo de la clase 5, lee la imagen y mezcla ambos:

```glsl
uniform sampler2D u_texture;
uniform float u_texture_factor;

vec3 texture_color = texture(u_texture, v_uv).rgb;
FragColor = vec4(
    mix(face_color, texture_color, u_texture_factor),
    1.0
);
```

Los extremos son:

```text
factor = 0.0 -> solo color por triangulo
factor = 0.5 -> mezcla
factor = 1.0 -> solo textura
```

## 4. Transicion independiente de los FPS

La tecla `T` cambia `texture_target`, no `texture_factor` directamente. En cada frame se calcula el tiempo transcurrido y se acerca el valor actual al objetivo:

```c
if (texture_target && texture_factor < 1.0f)
    texture_factor += delta_time * 2.0f;
if (!texture_target && texture_factor > 0.0f)
    texture_factor -= delta_time * 2.0f;
```

La deteccion de flanco evita alternar muchas veces mientras la tecla permanece pulsada:

```c
if (texture_key_down && !texture_key_was_down)
    texture_target = !texture_target;
texture_key_was_down = texture_key_down;
```

## Predicciones y ejercicios

1. Que deberia verse cuando `u_texture_factor` vale `0.0`?

<details><summary>Solucion</summary>

Solo la paleta de colores generada con `gl_PrimitiveID`.

</details>

2. Por que no se puede llamar a `glTexImage2D` antes de crear el contexto?

<details><summary>Solucion</summary>

Porque las funciones OpenGL son punteros cargados despues de `glfwMakeContextCurrent`; antes no existe un estado OpenGL valido.

</details>

3. Si la tecla se mantiene pulsada durante 30 frames, cuantas veces debe cambiar el objetivo?

<details><summary>Solucion</summary>

Una sola vez, en el flanco de pulsacion. La variable `texture_key_was_down` evita repetir el toggle.

</details>

4. Ejercicio ejecutado:

```sh
make test
make
timeout 3s ./scop
```

Pulsa `T` durante la ejecucion y observa que la imagen cambia gradualmente, no en un corte.

<details><summary>Solucion</summary>

El programa debe cargar `assets/texture.ppm`, arrancar sin errores y conservar el render en perspectiva. El factor tarda aproximadamente medio segundo en recorrer el rango completo con la velocidad actual.

</details>

## Errores frecuentes

- Intentar usar una libreria externa de imagenes, contradiciendo el subject.
- Confundir una textura OpenGL con los bytes que aun viven en RAM.
- Olvidar activar la unidad de textura antes de enlazar el sampler.
- Cambiar directamente el factor de 0 a 1 y producir un corte.
- Alternar en cada frame mientras `T` esta pulsada.
- Asumir que un OBJ sin `vt` tiene automaticamente coordenadas de textura.
- No fijar filtros y obtener un muestreo impredecible.

## Has aprendido que

- PPM `P3` y `P6` permite cargar una textura con codigo propio y sin dependencia externa.
- `glTexImage2D` copia los pixels a memoria de OpenGL.
- Un sampler y unas UV conectan el fragment shader con la textura.
- `mix` interpola color y textura mediante un factor entre 0 y 1.
- El tiempo transcurrido hace que la transicion sea independiente de los FPS.
- La deteccion de flanco convierte una tecla mantenida en un toggle unico.

## Preguntas tipo defensa

1. Por que se eligio PPM para esta primera textura?
2. Que datos recibe `glTexImage2D`?
3. Que diferencia hay entre una textura y un sampler?
4. Que ocurre cuando el factor vale 0.5?
5. Por que se libera la imagen despues de `glTexImage2D`?
6. Por que la transicion usa `delta_time`?
7. Por que hace falta detectar el flanco de la tecla?
8. Que limitacion tiene la UV planar actual?

## Criterio de finalizacion

- Puedes explicar el recorrido PPM -> CPU -> textura OpenGL -> sampler -> fragmento.
- Puedes justificar por que no se usa una libreria de imagenes.
- Puedes explicar la UV planar de fallback.
- Puedes explicar `mix` en los dos extremos y en el punto medio.
- Puedes explicar `texture_target`, `texture_factor` y la deteccion de flanco.
- `make test` termina correctamente.
- `make` termina sin avisos con `-Wall -Wextra -Werror`.
- La tecla `T` produce una transicion visible entre color y textura.

## Siguiente clase

En la siguiente clase añadiremos controles completos de rotacion y traslacion, recentrado automatico y la demo del logo 42 girando sobre su eje central con tonos grises.

## Lista de lecturas

- OpenGL 3.3: `glTexImage2D`, texture units, filtros y `GL_TEXTURE_2D`.
- GLSL 3.30: `sampler2D`, `texture` y `mix`.
- Formato Netpbm PPM P3/P6.
- `src/main.c`: `load_ppm`, uniforms y animacion de `texture_factor`.
