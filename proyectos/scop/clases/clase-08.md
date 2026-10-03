# Clase 8: README, auditoria y cierre de la obligatoria

## Objetivo

Cerrar Scop como entrega defendible: comprobar cada requisito del subject con una evidencia reproducible, documentar compilacion y uso, declarar honestamente las decisiones y separar la parte obligatoria del bonus.

## 1. La entrega no es solo el ejecutable

La defensa solo puede revisar lo que esta en el repositorio. Por eso el README debe permitir que otra persona compile y pruebe el proyecto sin conocer nuestras conversaciones.

El `README.md` real incluye:

- Primera linea en cursiva con el login.
- Descripcion del renderer y sus decisiones.
- Instalacion de dependencias y comandos `make`.
- Controles y ejemplos con el cubo, logo y teteras.
- Estructura del repositorio.
- Recursos clasicos.
- Uso de IA y limites del trabajo delegado.
- Tabla de auditoria del subject.

## 2. Auditoria reproducible

Desde `/home/max/code/42_projects/scop`:

```sh
make fclean
make test
make
timeout 3s ./scop
timeout 3s ./scop resources/42.obj
timeout 3s ./scop resources/teapot2.obj
```

Resultados esperados:

| Prueba | Evidencia |
|---|---|
| `make test` | Las operaciones de matrices pasan sus asserts. |
| `make` | Compila con `-Wall -Wextra -Werror`. |
| Cubo | 8 vertices, 36 indices y contexto OpenGL. |
| Logo | 42 vertices, 76 triangulos, recentrado y paleta gris. |
| Tetera | OBJ adicional cargado sin modificar el binario. |
| Ventana | Perspectiva, depth test, controles y textura. |

## 3. Correspondencia con el subject

| Requisito | Implementacion |
|---|---|
| Objeto desde `.obj` | `src/obj_parser.c` |
| Perspectiva | `mat4_perspective()` y `P * V * M` |
| Rotacion y traslacion en tres ejes | `key_axis()` y matrices propias |
| Caras distinguibles | `gl_PrimitiveID` en el fragment shader |
| Textura con transicion | PPM, `sampler2D`, `mix()` y `delta_time` |
| Logo 42 | `resources/42.obj`, `center_mesh()` y `u_gray` |
| Librerias permitidas | GLFW para ventana, contexto y eventos |

La clase se cerro inicialmente con triangulacion en abanico. El siguiente
trabajo de bonus sustituye esa estrategia por ear clipping sobre una
proyeccion dominante y añade una prueba concava.

## 4. Defensa en voz alta

Antes de dar la clase por terminada, responde sin mirar el codigo:

1. Por que el orden es `P * V * M`?
2. Por que un modelo descentrado orbita?
3. Como se convierten los indices OBJ base 1 a arrays base 0?
4. Por que un EBO y `gl_PrimitiveID` distinguen triangulos?
5. Como llega un PPM al fragment shader?
6. Por que la transicion usa un factor y `delta_time`?
7. Que librerias externas estan permitidas y cuales no se usaron?
8. Que limitacion tiene la triangulacion en abanico?
9. Como probarias un OBJ distinto sin recompilar?

## Predicciones y ejercicios

1. Si `make test` pasa pero el programa no abre una ventana, que parte del pipeline investigas primero?

<details><summary>Solucion</summary>

La inicializacion de GLFW, los hints, la creacion del contexto y el cargador manual. El test matematico no prueba el driver ni el display.

</details>

2. Que requisito no debes reclamar como bonus todavía?

<details><summary>Solucion</summary>

El manejo correcto de OBJ concavos o no coplanares: el parser usa fan triangulation y solo es correcto para caras simples adecuadas para ese metodo.

</details>

3. Ejercicio final: ejecuta la auditoria completa del README y marca solo lo que hayas observado.

<details><summary>Solucion</summary>

La auditoria esta completa cuando las compilaciones pasan, los tres modelos arrancan, la tecla `T` transiciona, los controles responden, el logo gira sobre el centro y puedes explicar las decisiones sin depender de una respuesta memorizada.

</details>

## Errores frecuentes

- Declarar el proyecto terminado solo porque compila.
- No probar un OBJ distinto del cubo.
- Documentar una dependencia que el Makefile no instala o comprueba.
- Reclamar bonus antes de cerrar la obligatoria.
- Ocultar el uso de IA en el README.
- Afirmar que el fan triangulation resuelve cualquier poligono.
- Marcar la auditoria sin probar textura, controles y logo.

## Has aprendido que

- Una entrega defendible necesita codigo, comandos, recursos y explicacion.
- El README es parte del requisito, no un adorno.
- Una auditoria relaciona cada frase del subject con una prueba concreta.
- Las limitaciones conocidas deben documentarse en lugar de ocultarse.
- El bonus solo tiene sentido despues de verificar la obligatoria.

## Preguntas tipo defensa

1. Que comando permite comprobar las dependencias?
2. Que hace `make test` y que no puede comprobar?
3. Como verificas que el logo gira sobre su centro?
4. Que parte del parser es manual?
5. Por que GLFW no viola la restriccion de librerias?
6. Que sucede al pulsar `T`?
7. Que objetos adicionales has probado?
8. Que parte queda deliberadamente fuera del bonus?
9. Como se uso IA y que responsabilidad conserva el alumno?

## Criterio de finalizacion

- `README.md` cumple la primera linea y las secciones obligatorias.
- `make fclean`, `make test` y `make` terminan correctamente.
- El cubo, `42.obj` y una tetera arrancan.
- La perspectiva y el depth test son observables.
- Las caras tienen colores distinguibles.
- `T` alterna textura con transicion suave.
- Las transformaciones X/Y/Z responden.
- El logo esta centrado, gira y usa grises.
- Puedes explicar el pipeline y las decisiones sin copiar una solucion.
- No reclamas bonus que no hayas implementado y probado.

## Siguiente clase

La parte obligatoria queda cerrada. La siguiente sesion estudia el bonus de
OBJ complejos y compara ear clipping con el abanico inicial usando
`resources/teapot.obj` y `tests/concave.obj`.

## Lista de lecturas

- Subject Scop v5.0, requisitos, README y bonus.
- `README.md` del repositorio.
- `Makefile` y targets `test`, `clean`, `fclean`.
- `src/main.c`, `src/obj_parser.c` y `src/mat4.c`.
