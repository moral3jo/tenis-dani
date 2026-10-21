/* =========================================================
   Generación de cruces (sin dependencias, sin estado guardado)
   ---------------------------------------------------------
   El orden de los partidos se calcula SIEMPRE igual a partir
   de la hoja, así que al apuntar a alguien tarde los partidos
   existentes conservan su orden relativo:
     1. Los jugadores sin marca «Tarde» forman el cuadro base
        (método del círculo: todos contra todos, por rondas).
     2. Cada jugador «Tarde» se va insertando, en orden de fila,
        repartiendo sus partidos por la cola SIN tocar los
        primeros partidos (los que ya se han anunciado).
   ========================================================= */

/* Todos contra todos por rondas (método del círculo) */
function rondasCirculo(jugadores) {
  const p = [...jugadores];
  if (p.length % 2) p.push(null);
  const n = p.length, out = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = p[i], b = p[n - 1 - i];
      if (a && b) out.push([a, b]);
    }
    p.splice(1, 0, p.pop());
  }
  return out;
}

/* Mete a `nuevo` contra todos los `rivales` en la lista, sin reordenar
   los partidos existentes ni tocar los primeros `protegidos`. */
function insertarJugador(lista, nuevo, rivales, protegidos) {
  const m = rivales.length;
  if (!m) return lista.slice();
  const s = Math.min(protegidos, lista.length);
  const total = lista.length + m;
  const span = total - s;

  // posiciones finales de los partidos nuevos, repartidas por la cola
  const pos = new Set();
  for (let k = 0; k < m; k++) {
    let x = s + Math.floor((k + 0.5) * span / m);
    while (pos.has(x)) x++;
    pos.add(x);
  }

  const res = lista.slice(0, s);
  const ultimo = new Map(); // jugador -> índice de su último partido colocado
  res.forEach((pt, i) => { ultimo.set(pt[0], i); ultimo.set(pt[1], i); });
  const resto = new Set(rivales);
  let viejo = s;

  for (let i = s; i < total; i++) {
    if (pos.has(i)) {
      // rival que más lleva sin jugar (y que no juegue justo después)
      const sig = lista[viejo];
      let mejor = null, mejorD = -Infinity;
      for (const q of resto) {
        let d = i - (ultimo.has(q) ? ultimo.get(q) : -99);
        if (sig && (sig[0] === q || sig[1] === q)) d = Math.min(d, 1);
        if (d > mejorD) { mejorD = d; mejor = q; }
      }
      resto.delete(mejor);
      res.push([nuevo, mejor]);
      ultimo.set(mejor, i);
    } else {
      const pt = lista[viejo++];
      res.push(pt);
      ultimo.set(pt[0], i); ultimo.set(pt[1], i);
    }
  }
  return res;
}

/* Orden de partidos de un grupo: base + tardíos en orden de llegada */
function ordenGrupo(base, tarde, protegidos) {
  let lista = rondasCirculo(base);
  const jug = [...base];
  for (const t of tarde) {
    lista = insertarJugador(lista, t, jug, protegidos);
    jug.push(t);
  }
  return lista;
}

/* Mezcla las listas de los grupos (A1,B1,A2,B2…) en una sola cola */
function intercalar(listas) {
  const cola = [];
  const max = Math.max(0, ...listas.map(l => l.partidos.length));
  for (let i = 0; i < max; i++)
    for (const l of listas)
      if (l.partidos[i]) cola.push({ cat: l.cat, a: l.partidos[i][0], b: l.partidos[i][1] });
  return cola;
}

/* Reparte la cola en rondas de `pistas` partidos sin repetir jugador
   dentro de la ronda (mira como mucho `ventana` partidos por delante). */
function armarRondas(cola, pistas, ventana = pistas * 3) {
  const pend = cola.slice(), rondas = [];
  while (pend.length) {
    const r = [], usados = new Set();
    for (let i = 0; i < pend.length && i < ventana && r.length < pistas;) {
      const p = pend[i];
      if (!usados.has(p.a) && !usados.has(p.b)) {
        r.push(p); usados.add(p.a); usados.add(p.b); pend.splice(i, 1);
      } else i++;
    }
    if (!r.length) r.push(pend.shift());
    rondas.push(r);
  }
  return rondas;
}

if (typeof module !== "undefined") module.exports = { rondasCirculo, insertarJugador, ordenGrupo, intercalar, armarRondas };
