# Etapa 0 — Qué hace ping realmente

**Requisito previo:** ninguno. **Siguiente:** [01-sockets.md](01-sockets.md) · Acrónimos: [GLOSARIO.md](GLOSARIO.md)

---

**Versión llana:** tu máquina envía un paquete diminuto que dice "¿estás ahí?" a otra máquina. Si
es alcanzable, esa máquina responde "sí, aquí estoy". Tú mides cuánto ha tardado la ida y vuelta.

**Dónde encaja esto en la pila:** esto no es TCP (**T**ransmission **C**ontrol **P**rotocol) ni es
UDP (**U**ser **D**atagram **P**rotocol). Es un protocolo aparte llamado **ICMP** — **I**nternet
**C**ontrol **M**essage **P**rotocol — que viaja directamente encima de IP (**I**nternet
**P**rotocol). Protocolo número 1, y no es en absoluto un protocolo de la capa de transporte. Esa
es la razón de fondo por la que ping no puede abrir un socket normal como haría un cliente de chat
o un navegador.

**Por qué root, históricamente:** leer y escribir paquetes por debajo de la abstracción normal de
sockets exige un **raw socket**, y los raw sockets son una operación privilegiada en la mayoría de
sistemas operativos, porque permiten a un proceso ver o fabricar tráfico ajeno a sus propias
conexiones.

> **Nombres, desglosados** — **ICMP** = **I**nternet **C**ontrol **M**essage **P**rotocol ·
> **IP** = **I**nternet **P**rotocol · **TCP** = **T**ransmission **C**ontrol **P**rotocol ·
> **UDP** = **U**ser **D**atagram **P**rotocol · **RFC** = **R**equest **F**or **C**omments (los
> documentos que definen los protocolos de internet: pese al nombre modesto, *son* los estándares) ·
> **RTT** = **R**ound-**T**rip **T**ime. Lista completa en [GLOSARIO.md](GLOSARIO.md).

---

## Preguntas de control

<details><summary>P1: ¿Por qué ping no puede usar sin más un socket TCP o UDP?</summary>

No existe un "puerto ICMP" ni hay conexión que abrir — ICMP es un protocolo de la capa de red, no
de la capa de transporte. Necesitas un tipo de socket que te permita operar directamente en
términos de paquetes a nivel IP, que es justo para lo que existen los raw sockets.
</details>

<details><summary>P2: ¿Qué mide exactamente el "round-trip time", de extremo a extremo?</summary>

El tiempo entre enviar el Echo Request y recibir el Echo Reply correspondiente — el trayecto
completo de ida y vuelta, incluyendo el retardo de procesado y de colas en ambos extremos y en la
red intermedia.
</details>

---

## Ejercicio

Todavía nada de código. Observa la herramienta real:

1. Ejecuta `ping -c 3 127.0.0.1` y lee en voz alta cada campo de la salida. Di qué es cada uno.
2. En una segunda terminal, ejecuta `sudo tcpdump -i any -n icmp` mientras haces ping. Deberías ver
   líneas emparejadas de `ICMP echo request` / `ICMP echo reply`.
3. Anota, solo a partir de la salida de tcpdump: ¿cuántos bytes ocupa el mensaje ICMP? ¿Cuáles son
   el `id` y el `seq`? Esos mismos campos vuelven en la Etapa 2.

**Terminado cuando:** puedas señalar una línea de tcpdump y decir qué host la envió y por qué.

---

## Lecturas

- **RFC 792**, apartado "Echo or Echo Reply Message" — una página; léelo ya, es el contrato entero
- `man 8 ping` — ojea la descripción y la lista de opciones; implementarás un subconjunto
- `man 1 tcpdump` — basta con `-n` y la sintaxis de expresiones
