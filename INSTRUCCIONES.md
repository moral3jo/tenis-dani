# 🎾 Manual paso a paso — Web del Campeonato de Tenis (datos en vivo)

Esta web muestra la **clasificación y los cruces todos-contra-todos en directo**.
Los datos NO se escriben en la web: se escriben en una **Google Sheet** (hoja de cálculo)
que tú y quien tú quieras editáis desde el móvil o el ordenador. La web lee esa hoja sola
cada 30 segundos.

> 🧩 Resumen: **Google Sheet** (datos) → **GitHub** (guarda la web) → **Cloudflare Pages** (la publica).

---

## 🗂️ Archivos de esta carpeta

| Archivo            | Para qué sirve                                            |
|--------------------|----------------------------------------------------------|
| `index.html`       | La página (no se toca).                                   |
| `styles.css`       | Diseño y colores (no se toca).                            |
| `app.js`           | Funcionamiento: lee la hoja y calcula la tabla (no se toca). |
| **`config.js`**    | **👈 AQUÍ pegas el ID de tu hoja y ajustas la puntuación.** |
| `INSTRUCCIONES.md` | Este manual.                                              |

---

## PARTE 1 · Crear la Google Sheet (la base de datos)

### Paso 1.1 — Crear la hoja
1. Entra en **https://sheets.google.com** y crea una **hoja en blanco**.
2. Ponle de nombre, por ejemplo, *Campeonato Tenis*.

### Paso 1.2 — Pestaña «Jugadores»
Abajo a la izquierda verás una pestaña («Hoja 1»). Haz doble clic y renómbrala a **`Jugadores`**.
En la **primera fila** escribe estas dos cabeceras (una por columna):

| Nombre   | Categoría |
|----------|-----------|
| Juan G.  | Benjamín  |
| Pedro L. | Benjamín  |
| Ana R.   | Alevín    |

> 🔒 Por ser menores: usa **nombre + inicial**, nunca apellidos completos (la web es pública).

### Paso 1.3 — Pestaña «Resultados»
Abajo, pulsa el **+** para crear otra pestaña y llámala **`Resultados`**.
Cabeceras en la primera fila (5 columnas):

| Categoría | Jugador1 | Jugador2 | Juegos1 | Juegos2 |
|-----------|----------|----------|---------|---------|
| Benjamín  | Juan G.  | Pedro L. | 6       | 3       |

- Pones **una fila por partido jugado**. No hace falta rellenar los que faltan.
- `Juegos1` y `Juegos2` son los juegos que hizo cada uno.
- Si alguien **no se presenta**, escribe **`NP`** en su casilla de juegos.
- Da igual el orden en que pongas a los dos jugadores: la web lo entiende.

### Paso 1.4 — (Recomendado) Desplegables para no equivocarse
Para que al meter resultados elijas los nombres de una lista en vez de teclearlos:
1. En la pestaña `Resultados`, selecciona la columna **Jugador1**.
2. Menú **Datos → Validación de datos → Añadir regla**.
3. Criterio **«Lista de un intervalo»** y pon: `=Jugadores!A2:A`.
4. Repite lo mismo para la columna **Jugador2**.

### Paso 1.5 — Compartir la hoja
1. Botón **Compartir** (arriba a la derecha).
2. **Acceso de edición:** añade los correos de quienes vayan a meter resultados como *Editor*.
3. **Acceso de lectura para la web:** en «Acceso general» elige
   **«Cualquiera con el enlace» → Lector**. *(Imprescindible para que la web pueda leerla.)*

### Paso 1.6 — Copiar el ID de la hoja
Mira la dirección de la hoja en el navegador:
```
https://docs.google.com/spreadsheets/d/  1A2B3C4D5e6F7g8H9...XYZ  /edit#gid=0
                                          └──────────  ESTO es el ID  ──────────┘
```
Copia el trozo que va **entre `/d/` y `/edit`**. Lo necesitas en la Parte 2.

---

## PARTE 2 · Conectar la web con tu hoja

1. En esta carpeta, abre **`config.js`** con el Bloc de notas (o desde GitHub con el lápiz ✏️).
2. Pega tu ID entre las comillas:
   ```
   SHEET_ID: "1A2B3C4D5e6F7g8H9...XYZ",
   ```
3. Si renombraste las pestañas, ajusta `PESTANA_JUGADORES` y `PESTANA_RESULTADOS`.
4. Cambia `TITULO` y `SUBTITULO` por el nombre de tu campeonato.
5. Guarda.

> La puntuación por defecto es **victoria = 2, derrota = 1, no presentado = 0**.
> Puedes cambiarla en `config.js` (apartado `PUNTOS`).

---

## PARTE 3 · Subir la web a GitHub

1. Crea cuenta en **https://github.com** (gratis) si no la tienes.
2. **+ (arriba) → New repository** → nombre `tenis` (o el que quieras) → **Public** → **Create**.
3. En la página del repo: **Add file → Upload files**.
4. Arrastra **todos** los archivos de esta carpeta (`index.html`, `styles.css`, `app.js`,
   `config.js`, `INSTRUCCIONES.md`).
5. Pulsa **Commit changes**.

---

## PARTE 4 · Publicar con Cloudflare Pages

1. Crea cuenta en **https://dash.cloudflare.com/sign-up** (gratis).
2. Menú izquierdo: **Workers & Pages → Create**.
3. ⚠️ **Pulsa la pestaña «Pages»** (NO «Workers»; el flujo de Workers pide un comando
   `npx wrangler deploy` que aquí NO queremos).
4. **Connect to Git** → autoriza GitHub → elige tu repositorio.
5. Configura así y **deja los comandos vacíos**:
   - Framework preset: **None**
   - Build command: **(vacío)**
   - Build output directory: **`/`**
6. **Save and Deploy**. En 1–2 minutos tendrás una dirección tipo
   **`https://tenis.pages.dev`**. ¡Esa es la que repartes! 🎉

> 💡 **Alternativa aún más simple sin comandos:** en el paso 3 elige **Pages → «Upload assets»**
> y arrastra directamente los archivos. No necesita Git ni ningún comando.

---

## PARTE 5 · El día a día del torneo

1. Quien organiza abre la **Google Sheet** desde el móvil (app *Google Sheets*) y va metiendo
   filas en **Resultados** según se juegan los partidos.
2. Los padres abren la **URL** `...pages.dev`.
3. La clasificación y los cruces se **actualizan solos** cada 30 segundos
   (o pulsando el botón **↻ Actualizar**).

No hay que volver a tocar GitHub ni Cloudflare salvo que cambies el diseño o el `config.js`.

---

## ❓ Problemas frecuentes

- **«⚙️ Falta conectar la Google Sheet»** → no pegaste el ID en `config.js` (Parte 2).
- **«No se pudo leer la hoja»** → revisa que esté compartida como
  **«Cualquiera con el enlace: Lector»** y que el ID sea correcto.
- **Un jugador no aparece** → comprueba que su categoría esté **escrita igual** en
  `Jugadores` y en `Resultados` (mayúsculas/acentos da igual, pero que no haya erratas).
- **Un resultado no sale** → los nombres del partido deben coincidir con los de `Jugadores`.
- **Tarda en aparecer un resultado** → Google tarda unos segundos; pulsa **↻ Actualizar**.
- **La web se ve rota** → asegúrate de haber subido los 4 archivos (`index.html`, `styles.css`,
  `app.js`, `config.js`) juntos.

---

## 🌐 (Opcional) Tu propio dominio
En Cloudflare: tu proyecto → **Custom domains → Set up a custom domain** y sigue los pasos.

¡A disfrutar del campeonato! 🎾
