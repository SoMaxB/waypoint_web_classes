# Glosario de Scop

Este documento reúne los términos, estructuras y herramientas del pipeline gráfico que aparecen durante el proyecto. No hace falta memorizarlo de una vez: úsalo como referencia mientras lees código o haces ejercicios.

## Pipeline gráfico

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| pipeline | Tubería / canal de trabajo | Cadena de etapas (vértices → transformaciones → rasterización → fragmentos) que convierte datos 3D en píxeles. |
| vértice (vertex) | Vértice | Punto 3D definido por coordenadas (y a veces normal y UV). Es la unidad básica que entra al GPU. |
| transformación | Transformación | Multiplicar coordenadas por matrices para mover, escalar o rotar. |
| rasterización | Rasterizar | Etapa del GPU que convierte triángulos en fragmentos (fragmentos candidatos a píxeles). |
| fragmento (fragment) | Fragmento | Cada posición de píxel aún sin color final; lo decide el fragment shader. |
| framebuffer | Búfer de fotograma | Destino donde queda el resultado final antes de mostrarlo en la ventana. |
| MVP | Model · View · Projection | Producto de las tres matrices que se aplica a cada vértice: `Projection * View * Model * v`. |
| proyección en perspectiva | Perspectiva | Proyección donde lo lejano se ve más pequeño; usa un frustum y división por `w`. |

## Formato `.obj`

| Nombre | Significado | Descripción de uso |
|---|---|---|
| `.obj` | Wavefront OBJ | Formato de texto que describe un modelo 3D: vértices, coordenadas de textura, normales y caras. |
| `v x y z` | Vertex | Línea con la posición de un vértice. |
| `vt u v` | Vertex texture | Línea con una coordenada de textura (UV). |
| `vn x y z` | Vertex normal | Línea con la dirección de la normal en un vértice. |
| `f a b c` | Face | Línea de una cara, referenciando vértices por índice 1-based (opcionalmente `v/vt/vn`). |
| índice 1-based | Índice base 1 | En OBJ el primer vértice es 1 (a diferencia de arrays de GPU, que empiezan en 0). |
| triangulación | Triangulation | Convertir una cara con muchos vértices en triángulos (fan triangulation). |
| modelado | Modeling | Crear el modelo con una herramienta como Blender y exportarlo a `.obj`. |

## Matemáticas de matrices

| Nombre | Significado | Descripción de uso |
|---|---|---|
| matriz 4x4 | Matriz 4×4 | Representación usada para transformaciones con coordenadas homogéneas. |
| coordenadas homogéneas | Homogeneous | Notación `[x, y, z, w]` que permite trasladar y proyectar con una sola matriz. |
| model | Matriz de modelo | Posiciona/escala/rota el objeto; origen en el centro del objeto. |
| view | Matriz de vista | Coloca la cámara; define desde dónde se mira la escena. |
| projection | Matriz de proyección | Define el frustum con FOV, `near` y `far`; produce la perspectiva. |
| FOV | Field of View | Ángulo de visión horizontal/vertical del frustum. |
| near / far | Plano cercano/lejano | Profundidades que delimitan la región visible del frustum. |
| perspective division | División de perspectiva | Dividir `x,y,z` entre `w` después de proyectar; es lo que achica los objetos lejanos. |
| orden de matrices | Multiplicación de matrices | En OpenGL se compone `Projection * View * Model * v`; el orden de multiplicación importa. |

## OpenGL y buffers

| Nombre | Significado | Descripción de uso |
|---|---|---|
| VBO | Vertex Buffer Object | Buffer del GPU que guarda los atributos de los vértices. |
| VAO | Vertex Array Object | Recuerda cómo el shader lee cada atributo del VBO (offsets y strides). |
| EBO | Element Buffer Object | Buffer de índices para reutilizar vértices entre caras. |
| `glDrawArrays` | GL draw arrays | Dibuja, leyendo los vertices secuencialmente desde el buffer. |
| `glDrawElements` | GL draw elements | Dibuja usando el índice guardado en el EBO. |
| `GL_TRIANGLES` | GL triangles | Modo de dibujo: cada 3 vértices forman un triángulo. |
| `glGen*` / `glDelete*` | GL generate/delete | Familias de gl para crear/eliminar recursos (buffers, texturas, programas). |

## Shaders y GLSL

| Nombre | Significado | Descripción de uso |
|---|---|---|
| shader | Shader | Programa pequeño que corre en el GPU para cada vértice o fragmento. |
| vertex shader | Shader de vértice | Recibe cada vértice, aplica el MVP y pasa datos al fragmento. |
| fragment shader | Shader de fragmento | Decide el color final de cada fragmento (color, UV, textura…). |
| GLSL | OpenGL Shading Language | Lenguaje de los shaders en OpenGL. |
| `gl_Position` | GL position | Variable de salida del vertex shader: posición del vértice en clip-space. |
| uniform | Uniform | Variable global del shader, igual para todos los vértices (p. ej. la matriz MVP). |
| `in` / `out` | Entrada / salida | Calificadores que pasan datos del vertex shader al fragment shader. |
| compile / link | Compilar y enlazar | Fases para cargar y dejar listo un programa de shaders; se implementan a mano. |
| `mix()` | GLSL mix | Interpola entre dos valores según el factor (usado para transiciones suaves). |

## Texturas

| Nombre | Significado | Descripción de uso |
|---|---|---|
| textura | Textura | Imagen mapeada sobre la superficie del objeto para darle detalle. |
| UV | Símbolo de textura | Coordenadas de la imagen a muestrear por vértice/fragmento. |
| `GL_TEXTURE_2D` | GL texture 2D | Target de una textura bidimensional. |
| muestreo | Sampling | Leer el color de la textura en una coordenada UV. |
| texel | Texture element | Píxel de una textura; lo que devuelve al muestrear. |
| stretching | Estirado | Distorsión visible al aplicar una textura a caras de forma muy lejana. |
| transición suave | Smooth transition | Cambio gradual (color → textura) interpolando en el fragment shader, sin cortes bruscos. |

## Ventana, eventos y defensa

| Nombre | Significado | Descripción de uso |
|---|---|---|
| GLFW / GLAD | Librerías de ventana/contexto | Única librería externa permitida: crear la ventana, el contexto GL y manejar eventos. |
| bucle de eventos | Event loop | Ciclo que refresca frames y procesa entrada (teclado/mouse) hasta cerrar. |
| eje central | Central axis | Eje de simetría del objeto (pasa por su centro). El 42 logo debe girar sobre él. |
| tonos de gris | Shades of gray | Color base del 42 logo: caras en grises suaves; la textura coincide desde atrás. |
| one-line command | Línea de comando | Comando único (p. ej. `make`) que comprueba/instala las dependencias. |

## Herramientas de verificación

| Nombre | Significado | Descripción de uso |
|---|---|---|
| `make` | Make | Automatiza la compilación; es la "one-line command" de dependencias del proyecto. |
| `cc` / `g++` | Compiladores | Compilan el renderer y los shaders. |
| Blender | Modelado 3D | Crear/exportar los modelos `.obj` de prueba. |
| `glslangValidator` | Validador GLSL | Comprueba la sintaxis de los shaders GLSL. |
| renderdoc | Debugger de GPU | Inspecciona draw calls, buffers y texturas. |
| `man` | Manual | Documentación local de la API y del contexto elegido. |

## Regla de lectura

Cuando leas una función o término nuevo, pregúntate:

1. ¿En qué etapa del pipeline se usa (vértice, transformación, raster, fragmento)?
2. ¿Qué recurso toca (buffer/VAO, shader, uniform, textura) y con qué tiempo de vida?
3. ¿De dónde sale el dato (parseado del `.obj`, calculado por ti, o del GPU)?
4. ¿Puede fallar (archivo con formato mal, shader que no compila)? ¿Cómo se detecta y maneja sin cerrar bruscamente?