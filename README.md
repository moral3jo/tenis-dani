# 🎾 Campeonato de Tenis — clasificación en vivo

Web estática que lee una **Google Sheet en directo** (vía endpoint `gviz` CSV), genera los
cruces **todos contra todos** por categorías y calcula la **clasificación** en el navegador.
Sin backend ni paso de compilación. Diseño responsive, pensado primero para móvil.

## Cómo funciona

- **Datos:** una Google Sheet con dos pestañas, `Jugadores` (Nombre, Categoría) y
  `Resultados` (Categoría, Jugador1, Jugador2, Juegos1, Juegos2).
- **Lectura:** `app.js` descarga cada pestaña como CSV desde
  `https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet={pestaña}`
  y se refresca solo (configurable).
- **Cálculo:** round-robin por categoría + tabla con PJ, V, D, juegos a favor/contra,
  diferencia y puntos. Desempates: puntos → victorias → diferencia → enfrentamiento
  directo → juegos a favor.

## Configurar

Edita **`config.js`**: `SHEET_ID`, nombres de pestañas, título y puntuación.
La hoja debe compartirse como «Cualquiera con el enlace: Lector».

## Desplegar

**Cloudflare Pages** con `Framework preset: None`, sin build command, output `/`
(o «Upload assets» por arrastre). Guía completa para no técnicos en
**[INSTRUCCIONES.md](INSTRUCCIONES.md)**.

## Probar en local

Doble clic en `index.html` (la lectura de la hoja requiere conexión a internet).

## Archivos

- `index.html` — estructura
- `styles.css` — diseño
- `app.js` — lectura de la hoja, round-robin y clasificación
- `config.js` — **configuración editable** (ID de la hoja, puntos)
