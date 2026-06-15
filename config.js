/* =========================================================
   ⚙️  CONFIGURACIÓN  —  EDITA SOLO ESTE ARCHIVO
   ---------------------------------------------------------
   Aquí conectas la web con tu Google Sheet y ajustas la
   puntuación. Los datos del torneo (jugadores y resultados)
   se editan EN LA HOJA DE GOOGLE, no aquí.
   Mira INSTRUCCIONES.md para el paso a paso.
   ========================================================= */

const CONFIG = {

  /* ── Nombre del torneo (sale en la cabecera) ── */
  TITULO: "Campeonato de Tenis",
  SUBTITULO: "Liga todos contra todos · 2026",

  /* ── ID de tu Google Sheet ──
     Está en la dirección de la hoja, entre /d/ y /edit:
     docs.google.com/spreadsheets/d/AQUI_VA_EL_ID/edit
     Pega ese código entre las comillas:                    */
  SHEET_ID: "1-TwlCeVNmyuTF3g47zL-RAM68Hp0fhAzLHmRWHLZN_Q",

  /* ── Nombres EXACTOS de las dos pestañas de la hoja ── */
  PESTANA_JUGADORES: "Jugadores",
  PESTANA_RESULTADOS: "Resultados",

  /* ── Cada cuántos segundos se refresca sola la web ── */
  REFRESCO_SEGUNDOS: 30,

  /* ── Puntuación (ajústala a tu gusto) ── */
  PUNTOS: {
    victoria: 2,
    derrota: 1,
    noPresentado: 0,   // al que no se presenta (pon "NP" en su casilla de juegos)
  },
};
