/* =========================================================
   Generación de cruces (sin dependencias, sin estado guardado)
   ---------------------------------------------------------
   El orden de los partidos sale SIEMPRE igual de la hoja:
   solo depende de la fila que ocupa cada jugador en su grupo.
   Se apunta debajo y el calendario se amplía sin mover lo
   anterior. (No reordenes ni borres filas del medio.)
   ========================================================= */

/* Calendario todos contra todos, sin límite de jugadores.
   Los jugadores se agrupan de 8 en 8 según su fila en la hoja. La ronda de
   cada pareja sale solo de sus posiciones (i XOR j): ronda 1 = 1º-2º, 3º-4º,
   5º-6º, 7º-8º; ronda 2 = 1º-3º, 2º-4º, 5º-7º…; y dentro de cada ronda el
   más reciente va el último. Como el orden de una pareja no depende de
   cuántos jugadores haya, apuntar a alguien más NUNCA reordena lo existente:
   sus partidos entran al final de cada ronda. Una baja solo quita los suyos. */
function ordenGrupo(jugadores) {
  const partidos = [];
  for (let i = 0; i < jugadores.length; i++)
    for (let j = i + 1; j < jugadores.length; j++) {
      const ronda = (i & 7) ^ (j & 7) || 8;     // 1..7 entre posiciones distintas, 8 si coinciden
      partidos.push({ ronda, i, j });
    }
  partidos.sort((p, q) => p.ronda - q.ronda || p.j - q.j);
  return partidos.map(p => [jugadores[p.i], jugadores[p.j]]);
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
