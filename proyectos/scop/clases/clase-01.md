# Clase 1: subject y pipeline grafico

## Objetivo

Construir el modelo mental minimo de Scop: entender que pide exactamente el subject y como un archivo `.obj` termina convertido en pixeles dentro de una ventana. Al terminar esta clase debes poder explicar el pipeline grafico completo, distinguir geometria de imagen, justificar la triangulacion de caras, entender por que los indices del `.obj` se adaptan a arrays base cero y explicar la diferencia entre vertex shader y fragment shader.

## 1. Que pide Scop

Scop no consiste solo en conseguir que aparezca un modelo 3D en pantalla. El objetivo es construir un mini-renderizador defendible: cada parte debe estar entendida, implementada y explicada durante la defensa.

La parte obligatoria exige:

| Requisito | Que significa en la practica |
|---|---|
| Mostrar un objeto desde un `.obj` | Leer el archivo, extraer vertices/caras y convertirlo a datos utiles para el GPU. |
| Mostrarlo en una ventana | Crear una ventana, contexto grafico y bucle de eventos con una libreria permitida. |
| Usar perspectiva | Aplicar una proyeccion donde lo lejano se vea mas pequeno. |
| Rotar y trasladar en los tres ejes | Mantener transformaciones del objeto controlables por input. |
| Caras distinguibles por colores | Asignar colores por cara o por triangulo. |
| Alternar textura/color con una tecla | Cambiar entre color y textura mediante una transicion suave, no con un corte brusco. |
| Mostrar el logo de 42 girando sobre su eje central | Centrar correctamente el modelo para que rote sobre si mismo y no orbite desde una esquina. |
| No usar librerias externas para `.obj`, matrices ni shaders | Implementar esas piezas personalmente sobre la API grafica elegida. |
| README con uso de IA | Explicar compilacion, recursos y como se uso IA sin delegar el liderazgo intelectual. |

Una forma compacta de verlo:

```text
1. Cargo un .obj yo mismo.
2. Convierto sus caras en triangulos.
3. Centro el modelo para que rote sobre su eje.
4. Subo vertices, colores y UV al GPU.
5. Uso shaders propios cargados por mi programa.
6. Aplico MVP para verlo en perspectiva.
7. Dibujo caras distinguibles.
8. Mezclo color y textura suavemente.
9. Controlo rotacion y traslacion con input.
10. Documento compilacion, recursos y uso de IA.
```

## 2. Un `.obj` no es una imagen

Un archivo `.obj` es texto que describe geometria. No contiene pixeles ya preparados para pantalla.

Ejemplo minimo:

```text
v -0.5 -0.5 0.0
v  0.5 -0.5 0.0
v  0.0  0.5 0.0
f 1 2 3
```

Las lineas `v` definen posiciones de vertices. La linea `f` define una cara usando indices hacia esos vertices.

El parser del `.obj` transforma texto en datos:

```text
texto .obj
  ↓
lista de posiciones
  ↓
lista de caras
  ↓
lista de triangulos
  ↓
buffer que el GPU pueda leer
```

Si el archivo contiene:

```text
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3 4
```

el parser podria producir:

```text
positions:
  0: (0, 0, 0)
  1: (1, 0, 0)
  2: (1, 1, 0)
  3: (0, 1, 0)

triangles:
  (0, 1, 2)
  (0, 2, 3)
```

Hay dos conversiones importantes:

- La cara de cuatro vertices se convierte en dos triangulos.
- Los indices OBJ, que son base uno, se convierten a indices de array base cero.

## 3. Caras, triangulos e indices

El GPU suele dibujar con `GL_TRIANGLES`: cada grupo de tres vertices forma un triangulo. Por eso una cara con cuatro vertices no se puede enviar directamente como si fuera un triangulo.

Una conversion tipica es la triangulacion en abanico:

```text
f 1 2 3 4
```

se convierte en:

```text
triangulo 1: 1 2 3
triangulo 2: 1 3 4
```

Visualmente:

```text
4 ----- 3
|     / |
|   /   |
| /     |
1 ----- 2
```

Para una cara con mas vertices:

```text
f 1 2 3 4 5
```

la triangulacion en abanico produce:

```text
1 2 3
1 3 4
1 4 5
```

Esto funciona bien para poligonos simples y convexos. Puede fallar con caras concavas o no coplanares, que precisamente entran en la frontera de los `.obj` complejos mencionados en el bonus.

El otro detalle critico es que OBJ usa indices base uno. Si el archivo dice:

```text
f 3 7 10
```

en un array C/C++/Rust debes leer:

```text
vertices[2]
vertices[6]
vertices[9]
```

Si olvidas restar `1`, el modelo queda mal conectado o puedes acceder fuera del array.

## 4. Del modelo a la pantalla

Las coordenadas del `.obj` no van directas a pixeles. Pasan por transformaciones:

```text
posicion local del modelo
  ↓ model
posicion en el mundo
  ↓ view
posicion vista desde la camara
  ↓ projection
posicion en perspectiva
  ↓ viewport
pixeles en la ventana
```

La composicion habitual es:

```text
final = Projection * View * Model * Vertex
```

Cada matriz tiene una responsabilidad:

| Matriz | Responsabilidad |
|---|---|
| `Model` | Mover, rotar o escalar el objeto desde su espacio local. |
| `View` | Representar la camara: desde donde se mira y hacia donde. |
| `Projection` | Aplicar perspectiva para que la profundidad afecte al tamano aparente. |

En Scop es especialmente importante el centro del objeto. El subject pide que el 42 logo gire sobre su eje central, no sobre una esquina. Si el modelo esta lejos del origen y rotas alrededor del origen, el objeto orbita.

Para centrar un modelo se puede calcular su caja envolvente:

```text
1. leer todos los vertices
2. calcular min_x, max_x, min_y, max_y, min_z, max_z
3. calcular centro:
   cx = (min_x + max_x) / 2
   cy = (min_y + max_y) / 2
   cz = (min_z + max_z) / 2
4. restar ese centro a cada vertice
```

Ejemplo:

```text
vertice original: (10, 2, 0)
centro calculado: (10, 0, 0)
vertice centrado: (0, 2, 0)
```

Ahora una rotacion alrededor de `(0,0,0)` hace que el objeto gire sobre su propio centro.

## 5. Perspectiva

Sin perspectiva, una escena puede verse plana: un objeto lejos puede tener el mismo tamano aparente que uno cercano. En perspectiva, lo lejano se ve mas pequeno.

La matriz `Projection` prepara esa transformacion. La idea que debes retener ahora es:

```text
mas lejos en z
  ↓
w mas grande
  ↓
x/w e y/w mas pequenos
  ↓
se ve mas pequeno
```

No hace falta memorizar todavia la formula completa de una matriz de perspectiva. Lo importante para esta primera clase es entender que Scop pide una proyeccion en perspectiva real, no solo dibujar coordenadas en pantalla.

## 6. Shaders y framebuffer

En OpenGL moderno, el GPU ejecuta pequenos programas llamados shaders.

El **vertex shader** corre una vez por vertice. Su trabajo principal en Scop sera transformar la posicion:

```glsl
gl_Position = mvp * vec4(aPos, 1.0);
```

Traducido:

```text
toma la posicion local del vertice
la convierte en coordenada homogenea
aplica Model/View/Projection
devuelve la posicion final al pipeline
```

El **fragment shader** corre despues de la rasterizacion. Su trabajo es decidir el color final de cada fragmento:

```glsl
FragColor = vec4(0.7, 0.7, 0.7, 1.0);
```

Mas adelante tambien mezclara color y textura:

```glsl
FragColor = mix(faceColor, texColor, textureFactor);
```

Donde:

```text
textureFactor = 0.0  -> solo color
textureFactor = 1.0  -> solo textura
textureFactor = 0.5  -> mitad color, mitad textura
```

La rasterizacion es la etapa intermedia que convierte triangulos transformados en fragmentos candidatos a pixeles. El framebuffer guarda la imagen final que se mostrara en la ventana.

## 7. Transicion suave color/textura

El subject no pide solo una tecla que cambie entre color y textura. Pide una transicion suave.

Un cambio brusco seria:

```text
frame actual: textureFactor = 0.0
tecla pulsada
frame siguiente: textureFactor = 1.0
```

Eso es un corte. La idea correcta es que la tecla cambie el objetivo, y cada frame acerque el valor actual poco a poco:

```text
textureFactor = 0.00
textureFactor = 0.08
textureFactor = 0.16
textureFactor = 0.24
...
textureFactor = 1.00
```

El fragment shader mezcla con ese factor:

```glsl
mix(faceColor, texColor, textureFactor)
```

Asi la textura aparece o desaparece progresivamente.

## Predicciones y ejercicios

1. Si el `.obj` contiene una cara `f 1 2 3 4`, que problema aparece si el GPU dibuja con `GL_TRIANGLES`?

<details><summary>Solucion</summary>

La cara tiene cuatro vertices, pero un triangulo tiene tres. Hay que convertirla en triangulos, por ejemplo `(1,2,3)` y `(1,3,4)`.

</details>

2. Si el `.obj` tiene `f 3 7 10`, que indices de un array C/C++ debes leer?

<details><summary>Solucion</summary>

Debes leer `2`, `6` y `9`, porque OBJ usa indices base uno y los arrays normales usan base cero.

</details>

3. Si cambias los vertices de un triangulo de `(0,0,0)`, `(1,0,0)`, `(1,1,0)` a `(0,0,0)`, `(2,0,0)`, `(2,2,0)`, que cambia en pantalla?

<details><summary>Solucion</summary>

El triangulo se hace mas grande, porque sus posiciones ocupan mas espacio en el sistema de coordenadas.

</details>

4. Si un cuadrado tiene su centro real en `(10,0,0)` y lo rotas alrededor del origen sin centrarlo antes, que veras?

<details><summary>Solucion</summary>

El objeto orbitara alrededor del origen, como si estuviera atado a una cuerda. No girara sobre su propio centro.

</details>

5. Si dos triangulos tienen el mismo tamano real, pero uno esta mas lejos de la camara, que deberia pasar en perspectiva?

<details><summary>Solucion</summary>

El triangulo lejano debe verse mas pequeno.

</details>

6. Si al pulsar una tecla cambias `textureFactor` de `0.0` a `1.0` en un solo frame, cumples la transicion suave?

<details><summary>Solucion</summary>

No. Eso es un corte brusco. La tecla debe cambiar el objetivo y el valor actual debe acercarse gradualmente cada frame.

</details>

7. Completa con una frase cada etapa:

```text
.obj parser:
Model matrix:
View matrix:
Projection matrix:
Vertex shader:
Rasterizacion:
Fragment shader:
Framebuffer:
```

<details><summary>Solucion orientativa</summary>

```text
.obj parser: lee el archivo de texto y extrae vertices, caras, UVs/normales si existen, convirtiendo caras en triangulos utiles para el programa.
Model matrix: transforma el objeto desde su espacio local: moverlo, rotarlo o escalarlo.
View matrix: representa la camara: desde donde miro la escena y hacia donde.
Projection matrix: aplica perspectiva para que la profundidad afecte al tamano aparente.
Vertex shader: corre por cada vertice y transforma su posicion, normalmente aplicando MVP.
Rasterizacion: convierte triangulos ya transformados en fragmentos candidatos a pixeles.
Fragment shader: decide el color final de cada fragmento: color por cara, textura o mezcla de ambos.
Framebuffer: guarda la imagen final que se mostrara en la ventana.
```

</details>

## Errores frecuentes

- Pensar que un `.obj` es una imagen. Es geometria en texto, no pixeles.
- Enviar caras de cuatro o mas vertices como si fueran triangulos.
- Olvidar que los indices OBJ son base uno y usarlos directamente como indices de array.
- Rotar un modelo no centrado y obtener una orbita en vez de un giro sobre su eje.
- Confundir `Model`, `View` y `Projection` como si fueran una sola transformacion indistinta.
- Creer que dibujar algo en pantalla ya cumple la perspectiva del subject.
- Cambiar de color a textura en un solo frame y llamarlo transicion suave.
- Usar librerias externas para cargar `.obj`, crear matrices o cargar shaders, lo cual contradice las restricciones del subject.

## Has aprendido que

- Scop es un mini-renderizador defendible, no una demo visual improvisada.
- Un `.obj` describe vertices, caras y otros atributos; tu parser lo convierte en datos internos.
- El GPU suele dibujar triangulos, asi que las caras con mas vertices deben triangularse.
- Los indices de OBJ empiezan en `1`, pero los arrays empiezan en `0`.
- El pipeline transforma vertices mediante `Model`, `View` y `Projection` antes de llegar a pantalla.
- Centrar el modelo es clave para que rote sobre su eje central.
- La perspectiva hace que lo lejano se vea mas pequeno gracias a la proyeccion y la division por `w`.
- El vertex shader transforma vertices; el fragment shader decide colores.
- Una transicion suave color/textura se logra interpolando gradualmente un factor, no con un cambio instantaneo.

## Preguntas tipo defensa

1. Por que un `.obj` no se puede mostrar directamente como si fuera una imagen?
2. Por que hay que convertir caras de cuatro o mas vertices en triangulos?
3. Que error aparece si usas indices OBJ directamente como indices de array?
4. Por que hay que centrar el modelo antes de rotarlo?
5. Cual es la diferencia entre vertex shader y fragment shader?
6. Que papel tiene la matriz `Projection` en la perspectiva?
7. Por que una transicion color/textura en un solo frame no cumple la idea de suavidad?
8. Que partes prohibe el subject delegar a librerias externas?

## Criterio de finalizacion

- Puedes enumerar los requisitos obligatorios de Scop sin mirar la guia.
- Puedes dibujar el pipeline `.obj -> vertices/caras -> triangulos -> MVP -> shaders -> framebuffer -> ventana`.
- Puedes explicar por que `f 1 2 3 4` debe convertirse en dos triangulos.
- Puedes convertir indices OBJ base uno a indices de array base cero.
- Puedes explicar por que un modelo descentrado orbita al rotarlo alrededor del origen.
- Puedes distinguir `Model`, `View` y `Projection` con una frase cada una.
- Puedes diferenciar vertex shader, rasterizacion, fragment shader y framebuffer.
- Puedes explicar por que `mix(color, texture, factor)` permite una transicion suave.

## Siguiente clase

En la siguiente clase prepararemos el entorno: ventana, contexto grafico, bucle de eventos y primer triangulo. El resultado sera abrir una ventana y dibujar un triangulo de color, todavia sin parser `.obj`, para aislar primero la comunicacion minima con el GPU.

## Lista de lecturas

- Subject de Scop — lo que el proyecto pide cargar (`.obj` Wavefront).
- Especificación del formato Wavefront OBJ — caras, índices base 1 y conversión a triángulos.
- Khronos, OpenGL 3.3 Core Profile spec — espacio de clip y división por perspectiva en el pipeline de vértices.
- Khronos, GLSL 3.30 spec — vertex y fragment shaders; `layout(location = N)`.
