# Clase 5: color por triangulo y el identificador de primitive

## Objetivo

Hacer que las caras del objeto sean visualmente distinguibles sin romper el EBO existente. Al terminar debes poder explicar por que un color almacenado en un vertice compartido no basta para pintar cada cara, que representa `gl_PrimitiveID` y por que el fragment shader puede usarlo para mantener un color constante en todo un triangulo.

## 1. El requisito que falta

El cubo de la clase 4 ya se renderiza en perspectiva, pero todas sus caras usan el mismo color naranja. El subject exige que las caras sean distinguibles.

El problema aparece porque el cubo reutiliza vertices mediante un EBO. Un mismo vertice pertenece a varias caras y solo puede tener un valor en un atributo `aColor`. Si asignamos al vertice 0 el rojo de una cara, no puede ser simultaneamente azul para otra cara.

Hay tres soluciones habituales:

| Solucion | Coste | Decision para esta clase |
|---|---|---|
| Duplicar vertices por triangulo | Mas memoria, shader simple | Se usara mas adelante si necesitamos UV distintos por esquina |
| Una draw call por cara | Muchas llamadas de dibujo | Correcta, pero mas compleja de organizar |
| `gl_PrimitiveID` en el fragment shader | Sin datos adicionales por vertice | Elegida ahora |

La tercera opcion conserva el parser, el VBO y el EBO. Cada triangulo recibe automaticamente un identificador consecutivo: 0, 1, 2...

## 2. De donde sale el color

`gl_PrimitiveID` es una variable integrada de GLSL. En un draw de `GL_TRIANGLES`, vale el indice del triangulo que se esta rasterizando. Como no es un atributo interpolado, todos los fragmentos de un mismo triangulo ven el mismo valor.

El fragment shader actualiza el color a partir de ese identificador:

```glsl
void main()
{
    float id = float(gl_PrimitiveID);
    vec3 color = vec3(
        0.55 + 0.35 * sin(id * 1.7),
        0.55 + 0.35 * sin(id * 1.7 + 2.1),
        0.55 + 0.35 * sin(id * 1.7 + 4.2)
    );
    FragColor = vec4(color, 1.0);
}
```

No estamos calculando iluminacion: solo generamos una paleta determinista. El color cambia entre triangulos, pero permanece plano dentro de cada uno.

## 3. El EBO no ha desaparecido

El parser sigue produciendo 36 indices para el cubo:

```text
8 vertices -> 6 caras cuadradas -> 12 triangulos -> 36 indices
```

La llamada sigue siendo:

```c
glBindVertexArray(vao);
glDrawElements(GL_TRIANGLES, (GLsizei)mesh.i_count,
               GL_UNSIGNED_INT, (void *)0);
```

El orden de los indices determina que grupos de tres forman cada primitive. Por eso `gl_PrimitiveID` empieza en cero y aumenta una vez por cada triangulo dibujado.

## 4. Que significa "por cara"

En esta implementacion una cara OBJ de cuatro vertices se triangula en dos primitives. Por tanto, el requisito se cumple a nivel de triangulo, que es una de las opciones permitidas por el subject.

```text
f 1 2 3 4
  -> triangulo 0: 1 2 3
  -> triangulo 1: 1 3 4
```

Los dos triangulos pueden tener colores distintos aunque procedan de la misma cara original. Esto es correcto porque el renderer trabaja con triangulos despues de la triangulacion.

## Predicciones y ejercicios

1. El cubo produce 36 indices. Cuantos valores distintos de `gl_PrimitiveID` se esperan?

<details><summary>Solucion</summary>

36 indices / 3 indices por triangulo = 12 triangulos. Los identificadores van de 0 a 11.

</details>

2. Por que no basta con anadir un `vec3 aColor` al VBO actual si queremos un color distinto para cada cara?

<details><summary>Solucion</summary>

Porque el VBO reutiliza vertices. Un vertice compartido tendria que tener varios colores simultaneamente, uno por cada cara que lo usa.

</details>

3. Que ocurre si usamos `gl_PrimitiveID` en el vertex shader?

<details><summary>Solucion</summary>

No resuelve el problema de color por fragmento de la misma forma. El identificador que necesitamos esta disponible para identificar la primitive durante la rasterizacion; el fragment shader recibe el valor correspondiente al triangulo que esta pintando.

</details>

4. Ejercicio ejecutado: compila y arranca el renderer.

```sh
make test
make
timeout 3s ./scop
```

<details><summary>Solucion</summary>

`make test` termina correctamente, `make` compila sin avisos y el programa imprime el mesh del cubo y la version de OpenGL. Durante el tiempo de ejecucion, el cubo debe mostrar triangulos con colores diferentes y conservar la perspectiva.

</details>

## Errores frecuentes

- Confundir un triangulo con una cara OBJ original de cuatro o mas vertices.
- Intentar pintar una cara compartiendo un unico color por vertice.
- Reiniciar el identificador por cada draw call sin tenerlo en cuenta al diseñar la paleta.
- Eliminar el EBO al anadir color, aunque sigue siendo quien define las primitives.
- Usar un color aleatorio por frame y producir una imagen que parpadea.
- Olvidar que `gl_PrimitiveID` identifica triangulos, no necesariamente caras poligonales originales.

## Has aprendido que

- Los vertices compartidos no pueden representar colores distintos por cara sin duplicacion adicional.
- Un EBO agrupa indices de tres en tres cuando se usa `GL_TRIANGLES`.
- `gl_PrimitiveID` identifica el triangulo que se esta rasterizando.
- Un valor constante por primitive produce color plano dentro de cada triangulo.
- La triangulacion del parser define la unidad visual que Scop puede distinguir.
- La implementacion mantiene el EBO y no necesita una libreria externa.

## Preguntas tipo defensa

1. Por que el color por vertice no basta cuando hay vertices compartidos?
2. Que es una primitive en un draw con `GL_TRIANGLES`?
3. Que valor tiene `gl_PrimitiveID` para el segundo triangulo?
4. Por que el color no cambia dentro de un mismo triangulo?
5. Una cara OBJ cuadrilateral genera un solo identificador o dos? Por que?
6. Que responsabilidad conserva el EBO despues de este cambio?
7. Que alternativa usarias si cada esquina necesitara tambien una UV distinta?
8. Por que la paleta debe ser determinista y no aleatoria en cada frame?

## Criterio de finalizacion

- Puedes explicar el conflicto entre vertices compartidos y colores por cara.
- Puedes calcular cuantos triangulos produce el cubo del ejercicio.
- Puedes explicar que representa `gl_PrimitiveID`.
- Puedes justificar por que el EBO sigue siendo necesario.
- `make test` termina correctamente.
- `make` termina sin avisos con `-Wall -Wextra -Werror`.
- `timeout 3s ./scop` arranca el renderer y muestra el cubo con triangulos distinguibles por color.

## Siguiente clase

En la siguiente clase anadiremos una textura propia, coordenadas UV de fallback y una transicion gradual entre la paleta de triangulos y la imagen usando `mix()` en el fragment shader.

## Lista de lecturas

- GLSL 3.30: variables integradas de fragment shader y `gl_PrimitiveID`.
- Khronos OpenGL 3.3: `GL_TRIANGLES`, primitives y draw calls indexadas.
- `src/main.c`: shader de fragmentos y llamada `glDrawElements`.
- `src/obj_parser.c`: triangulacion en abanico y orden de indices.
