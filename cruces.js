/* =========================================================
   Generación de cruces (sin dependencias, sin estado guardado)
   ---------------------------------------------------------
   El orden de los partidos sale SIEMPRE igual de la hoja:
   solo depende de la fila que ocupa cada jugador en su grupo.
   Se apunta debajo y el calendario se amplía sin mover lo
   anterior. (No reordenes ni borres filas del medio.)
   ========================================================= */

/* Todos contra todos por rondas (método del círculo) con huecos fijos.
   Cada jugador ocupa un hueco del cuadro según su fila en la hoja (repartidos
   con un salto para que, aun con pocos jugadores, nadie juegue seguido). Los
   huecos vacíos son «descansos» que desaparecen del calendario. Al apuntar a
   alguien nuevo solo se rellena un hueco: sus partidos entran al FINAL de cada
   ronda y ningún partido existente cambia de orden.
   Si hay más jugadores que huecos, el cuadro crece al siguiente número par. */
const mcd = (a, b) => (b ? mcd(b, a % b) : a);

function ordenGrupo(jugadores, huecos = 14) {
  const n = Math.max(huecos, jugadores.length + (jugadores.length % 2));
  let paso = Math.round(n * 0.64);
  while (mcd(paso, n) !== 1) paso++;
  const hueco = new Array(n).fill(-1);                  // hueco -> índice de jugador
  jugadores.forEach((_, i) => { hueco[(i * paso) % n] = i; });
  const rueda = Array.from({ length: n }, (_, i) => i);
  const out = [];
  for (let r = 0; r < n - 1; r++) {
    const ronda = [];
    for (let i = 0; i < n / 2; i++) {
      const x = hueco[rueda[i]], y = hueco[rueda[n - 1 - i]];
      if (x >= 0 && y >= 0) ronda.push([Math.min(x, y), Math.max(x, y)]);
    }
    ronda.sort((p, q) => p[1] - q[1]);          // el más reciente, el último de la ronda
    ronda.forEach(([x, y]) => out.push([jugadores[x], jugadores[y]]));
    rueda.splice(1, 0, rueda.pop());
  }
  return out;
}

/* Mezcla las listas de los grupos (A1,B1,A2,B2…) en una sola cola.
   Como cada grupo ya viene ordenado por rondas, los partidos seguidos de
   la cola nunca repiten jugador: sirve igual con 2, 3 o más pistas. */
function intercalar(listas) {
  const cola = [];
  const max = Math.max(0, ...listas.map(l => l.partidos.length));
  for (let i = 0; i < max; i++)
    for (const l of listas)
      if (l.partidos[i]) cola.push({ cat: l.cat, a: l.partidos[i][0], b: l.partidos[i][1] });
  return cola;
}

if (typeof module !== "undefined") module.exports = { ordenGrupo, intercalar };
