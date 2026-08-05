# Guía de aprendizaje y desarrollo de Scop

Esta guía traduce el `en.subject.pdf` v5.0 a un itinerario práctico de gráficos por GPU. No sustituye al subject: si una indicación futura contradice el PDF, manda el PDF.

El objetivo no es pegar un método mágico de render, sino entender el pipeline gráfico completo —parseo de `.obj`, matemáticas de matrices, shaders, buffers y texturas— hasta poder explicar cada decisión durante la defensa. Tú tomas las decisiones técnicas y las defiendes; las restricciones del subject prohíben delegar la arquitectura a una IA sin entenderla.

## 1. Qué exige exactamente el proyecto

### Parte obligatoria

Debes construir un programa que:

| Requisito del subject | Qué significa en la práctica |
|---|---|
| Mostrar un objeto 3D de un `.obj` | Parsear un fichero OBJ (vértices, caras; opcionalmente normales y coordenadas UV) y renderizarlo |
| En una ventana, en **perspectiva** | Proyección en perspectiva: los objetos lejanos se ven más pequeños |
| **Rotar y trasladar** sobre los tres ejes | Modelo con origen en el centro del objeto, controlable por teclado/mouse a tu elección |
| Caras distinguibles por **colores** | Cada cara (o triángulo) con un color distinto; si triangulas el modelo, por triángulo |
| **Key** que alterna textura ↔ color con **transición suave** | Pulsando la misma tecla se aplica y se quita la textura sin cortes bruscos |
| Mostrar el **42 logo** girando sobre su eje central | Durante la defensa; giro sobre el eje central, no sobre una esquina |
| Caras del logo en **tonos de gris**, textura alegre | Estética acordada con el subject |

### Reglas que pueden invalidar la entrega

- Lenguaje libre (C, C++ o Rust preferido) y API gráfica libre (**OpenGL, Vulkan o Metal**).
- **Una línea de comando** para comprobar/instalar dependencias (p. ej. un `Makefile`).
- Bibliotecas externas **solo** para ventana y eventos.
- **Nada de librerías externas** para cargar el objeto, crear matrices ni cargar shaders: todo implementado por ti sobre la API elegida.
- README obligatorio (más abajo).
- Solo se evalúa lo que esté en el repositorio entregado.

### Bonus

El bonus solo se corrige si la parte obligatoria está perfecta:

- [10pt] Manejo correcto de `.obj` complejos (cóncavos / no coplanares), p. ej. la tetera original con artefactos en los bordes.
- [5pt] Aplicar texturas más sutiles, sin *stretching* visible en ciertas caras.
- [10pt] Características adicionales impresionantes que inventes.

## 2. Entorno objetivo y herramientas

- API gráfica: OpenGL (común), con GLFW/GLAD u otra librería de ventana + contexto.
- Compilador C/C++: `cc`/`g++`. Gestor de paquetes según el sistema (apt, etc.).

Herramientas recomendadas:

| Herramienta | Uso |
|---|---|
| `cc`/`g++` | Compilar el renderer y los shaders |
| `make` | Automatizar la compilación (la "one-line command" de dependencias) |
| Blender | Crear/exportar los modelos `.obj` de prueba |
| `nano`/editor | Inspeccionar el `.obj` y los fuentes de shader |
| glslangValidator / GLSL | Validar sintaxis de shaders si se usa GLSL |
| `renderdoc` u otro debugger de GPU | Inspeccionar draw calls, buffers y texturas |

## 3. Modelo mental mínimo

### El pipeline gráfico simplificado

1. **Vértices**: el `.obj` define las posiciones de los vértices (y a veces normales y UV).
2. **Transformaciones**: matrices model (posiciona el objeto) → view (cámara) → projection (perspectiva).
3. **Rasterización**: el GPU convierte triángulos en fragmentos (píxeles).
4. **Fragmentos**: el shader de fragmento decide el color final (color fijo, vértice, o textura).
5. **Framebuffer**: el resultado se muestra en la ventana.

### Matrices (notación de homogeneidad)

Para mover, escalar y rotar un objeto usas matrices 4x4 y coordenadas homogéneas:

```text
v' = M * v        (M: model, v: vértice en coordenadas homogéneas [x,y,z,w])
```

Composición típica (premultiplicación, el orden importa):

```text
final = Projection * View * Model * Vertex
```

En OpenGL la multiplicación final suele llamarse **MVP** (Model · View · Projection). El orden correcto de aplicación es: model primero, luego view, luego projection.

### Proyecto en perspectiva

Dentro de la matriz de proyección usas un volumen de visión (frustum) con un campo de visión (FOV), plano cercano (`near`) y lejano (`far`). Después de proyectar, la coordenada `w` divide las `x,y,z` (división de perspectiva): es lo que hace que lo lejano parezca pequeño.

## 4. Carga y parseo del `.obj`

Un `.obj` mínimo:

```text
o Cube
v -0.5 -0.5  0.5
v  0.5 -0.5  0.5
v  0.5  0.5  0.5
v -0.5  0.5  0.5
...
f 1 2 3 4
```

- `v x y z`: posición de un vértice.
- `vt u v`: coordenada de textura.
- `vn x y z`: normal.
- `f a b c (d…)`: una cara, referenciando vértices (y opcionalmente `vértice/textura/normal`). El índice es 1-based.
- Si el modelo triangula, cada cara es un triángulo; si no, debes triangularte las caras con vértices-polígonos (fan triangulation).

Implementa tú el parser: no uses librerías de carga de objetos.

## 5. Buffers y dibujo (OpenGL)

Los datos de vértices se suben a la GPU:

```text
VBO (Vertex Buffer Object): almacena los atributos de los vértices
VAO (Vertex Array Object):   recuerda cómo se leen esos atributos
EBO (Element Buffer Object): índices para reutilizar vértices
```

Flujo típico:

1. Crear un VBO con las posiciones de los vértices.
2. Configurar el VAO para que el shader sepa qué atributo está en qué offset.
3. Dibujar con `glDrawArrays(GL_TRIANGLES, ...)` o `glDrawElements` con un EBO.

## 6. Shaders

- **Vertex shader**: recibe cada vértice, aplica la matriz MVP y pasa datos (color, UV, normal) hacia el fragmento.
- **Fragment shader**: decide el color final de cada fragmento (píxel).

Ejemplo conceptual de vertex shader:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
uniform mat4 mvp;
void main() {
    gl_Position = mvp * vec4(aPos, 1.0);
}
```

Ejemplo conceptual de fragment shader:

```glsl
#version 330 core
out vec4 FragColor;
void main() {
    FragColor = vec4(1.0, 0.5, 0.2, 1.0);
}
```

Los shaders se compilan y enlazan en tiempo de ejecución. Implementa la carga/compilación de shaders tú mismo; no uses librerías externas de carga de shaders.

## 7. Color por cara y transición textura

- Para distinguir caras por color, asigna a cada vértice (o por draw call por cara) un color distinto en el atributo de vértice, o pinta con un color uniforme por cara.
- Para la **textura**, generas un `GL_TEXTURE_2D` desde una imagen, y en el fragment shader muestreas con las coordenadas UV.
- La **transición suave** color ↔ textura se hace mezclando ambos en el fragment shader según un factor interpolado (p. ej. `mix(color, texColor, factor)`) en el tiempo, en vez de un cambio instantáneo.

## 8. Controles de cámara y transformaciones en vivo

- Guarda ángulos de rotación y un vector de traslación.
- En cada frame, reconstruyes las matrices y las subes como uniform al shader antes de dibujar.
- El giro del **42 logo** sobre su eje central se logra rotando la matriz model alrededor de ese eje; si el modelo está centrado en el origen, el eje central ya es el eje del objeto.

## 9. README obligatorio

Al final, `README.md` en la raíz del repo con:

- **Primera línea en cursiva**: `This project has been created as part of the 42 curriculum by <login1>[, <login2>, ...]`.
- Sección **Description**: meta y visión general.
- Sección **Instructions**: compilación, instalación y ejecución.
- Sección **Resources**: referencias clásicas + descripción de **cómo se usó IA** (para qué tareas y qué partes).

## 10. Orden de implementación recomendado

1. Entorno: librería de ventana + contexto gráfico + línea de comando de dependencias.
2. Parseo del `.obj` (posiciones y caras) y dibujo de un rectángulo/triángulo de color.
3. Matrices MVP y proyección en perspectiva; rotación/traslación básica del objeto.
4. Color por cara (cada cara diferenciable).
5. Cargar una textura y alternar color ↔ textura con transición suave.
6. Controles finales (teclado/mouse) y giro del 42 logo sobre su eje central con tonos de gris.
7. Probar con objetos adicionales y refinar.
8. README completo con la sección de IA.
9. Auditoría de la obligatoria; solo entonces bonus.

## 11. Programa de clases interactivas

Cada sesión sigue el formato general: repaso, explicación con el modelo mental, predicciones, ejercicio, implementación conjunta, depuración real, preguntas tipo defensa, resumen y tarea.

- **Clase 1:** subject, pipeline gráfico y qué significa "renderizar un `.obj`". Resultado: explicar el subject completo y el pipeline.
- **Clase 2:** entorno: ventana, contexto, primer triángulo y línea de dependencias. Resultado: abrir una ventana y dibujar un triángulo.
- **Clase 3:** parseo del `.obj` (vértices y caras). Resultado: leer y validar un `.obj` sencillo.
- **Clase 4:** matrices, MVP y proyección en perspectiva. Resultado: el objeto se muestra en perspectiva y rota.
- **Clase 5:** buffers (VBO/VAO/EBO) y color por cara. Resultado: caras distinguibles por color.
- **Clase 6:** shaders (vertex + fragment) y carga de textura. Resultado: textura aplicada y transición suave color ↔ textura.
- **Clase 7:** controles completos y giro del 42 logo con tonos de gris. Resultado: demo del logo girando sobre su eje central.
- **Clase 8:** README, prueba con objetos adicionales y auditoría. Resultado: obligatoria cerrada y defendible.
- **Clase 9+:** bonus (OBJ complejo, texturas sutiles, extras) — solo cuando lo anterior es perfecto.

## 12. Auditoría de la parte obligatoria

No empieces bonus hasta poder responder afirmativamente:

- El programa abre una ventana y muestra un objeto `.obj` propio.
- El objeto se ve en perspectiva y puede rotarse/trasladarse en sus tres ejes.
- Las caras son distinguibles por color.
- Una tecla alterna textura ↔ color con transición suave, sin cortes.
- El 42 logo gira sobre su eje central con tonos de gris, y una textura alegre se muestra desde atrás.
- No se usaron librerías externas para parser de `.obj`, matrices ni shaders.
- La línea de comando de dependencias funciona.
- El README cumple la primera línea en cursiva y las secciones requeridas, incluida la de IA.
- Puedes explicar el pipeline, las matrices MVP, los shaders, los buffers y las texturas sin depender de una solución memorizada.

## 13. Cómo pedir la siguiente clase

Puedes iniciar con una petición como:

```text
Empecemos la clase 1 de Scop. No asumas conocimientos previos de OpenGL ni de matrices 3D.
```

En sesiones posteriores indica qué código has escrito y qué no entiendes. El profesor debe pedirte predicciones y explicaciones, no pegar la solución. Recuerda la política de IA del subject: la arquitectura y las decisiones son tuyas y debes poder defenderlas.

## 14. Referencias

- `en.subject.pdf`, Scop v5.0: especificación normativa.
- Documentación de OpenGL: <https://www.opengl.org/> y LearnOpenGL: <https://learnopengl.com/>.
- Especificación del formato `.obj` de Wavefront: referencias clásicas (documentación del formato, no librerías).
- GLM (solo como referencia de matemáticas; el subject pide implementar matrices tú mismo).
- Manuales locales: `man 7 opengl`, documentación de GLFW/contexto elegido.

---

La regla de trabajo del proyecto será: comprender, predecir, implementar, inspeccionar y probar. Scop no está terminado cuando "se ve algo", sino cuando el objeto se renderiza correctamente en perspectiva, es controlable, añade textura con transición suave, cumple el README y puedes explicar por qué cada parte del pipeline hace lo que hace.