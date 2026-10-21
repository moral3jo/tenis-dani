/* =========================================================
   Campeonato de Tenis — lógica (lee Google Sheets en vivo)
   ⚠ NO hace falta editar este archivo. Ajustes en config.js
   ========================================================= */

const $ = (s, c = document) => c.querySelector(s);

/* Normaliza texto para comparar nombres/categorías
   (sin acentos, minúsculas, espacios colapsados) */
const norm = (s) => (s == null ? "" : String(s))
  .trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ");

let VISTA_ACTIVA = null;

/* Espacios limpios y, si lo escribieron todo en minúsculas/mayúsculas, Mayúscula Inicial */
const limpiaNombre = (s) => {
  s = s.trim().replace(/\s+/g, " ");
  return s === s.toLowerCase() || s === s.toUpperCase()
    ? s.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase()) : s;
};

const ckey = (s) => norm(s).replace(/^grupo /, "");

/* ---------- Lectura de la hoja (endpoint gviz CSV) ---------- */
function urlHoja(pestana) {
  const id = encodeURIComponent(CONFIG.SHEET_ID);
  const hoja = encodeURIComponent(pestana);
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${hoja}&t=${Date.now()}`;
}

async function leerPestana(pestana) {
  const res = await fetch(urlHoja(pestana));
  if (!res.ok) throw new Error(`No se pudo leer la pestaña "${pestana}" (${res.status})`);
  const texto = await res.text();
  return aObjetos(parseCSV(texto));
}

/* ---------- Parser CSV robusto (comillas, comas, saltos) ---------- */
function parseCSV(texto) {
  const filas = []; let fila = [], campo = "", i = 0, enComillas = false;
  while (i < texto.length) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 2; continue; }
        enComillas = false; i++; continue;
      }
      campo += c; i++; continue;
    }
    if (c === '"') { enComillas = true; i++; continue; }
    if (c === ",") { fila.push(campo); campo = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; i++; continue; }
    campo += c; i++;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

/* Convierte filas en objetos usando la primera fila como cabecera */
function aObjetos(filas) {
  if (!filas.length) return [];
  const cab = filas[0].map(norm);
  return filas.slice(1)
    .filter(r => r.some(c => c.trim() !== ""))
    .map(r => { const o = {}; cab.forEach((h, i) => o[h] = (r[i] ?? "").trim()); return o; });
}

/* Lee una columna admitiendo varios nombres posibles de cabecera */
function col(obj, ...nombres) {
  for (const n of nombres) { const k = norm(n); if (obj[k] !== undefined) return obj[k]; }
  return "";
}

/* ¿Es un número de juegos válido? */
const esNum = (v) => v !== "" && !isNaN(Number(v));
const ES_NP = (v) => ["np", "wo", "w.o.", "n.p.", "-", "x"].includes(norm(v));

/* ---------- Construcción de datos ---------- */
function construir(jugadoresRaw, resultadosRaw) {
  const categorias = new Map(); // catNorm -> { nombre, jugadores:[], jugadoresNorm:Set }

  const sinGrupo = [], repetidos = [];
  jugadoresRaw.forEach(j => {
    let nombre = col(j, "Nombre", "Jugador", "Nombre y apellido");
    const cat = col(j, "Categoría", "Categoria", "Cat", "Grupo");
    if (!nombre) return;
    nombre = limpiaNombre(nombre);
    if (!cat) { sinGrupo.push(nombre); return; }
    const ck = ckey(cat);
    if (!categorias.has(ck)) categorias.set(ck, { nombre: "Grupo " + ckey(cat).toUpperCase(), jugadores: [], activos: [], bajas: new Set(), edad: new Map(), set: new Set() });
    const c = categorias.get(ck);
    if (c.set.has(norm(nombre))) { repetidos.push(nombre); return; }
    c.set.add(norm(nombre));
    c.jugadores.push(nombre);   // conserva su hueco aunque se dé de baja
    if (col(j, "Baja", "Baja?").trim()) c.bajas.add(nombre); else c.activos.push(nombre);
    c.edad.set(nombre, col(j, "Edad", "Año", "Nacimiento"));
  });

  // Orden de partidos de cada grupo: solo depende de la fila de cada niño
  // (una baja deja libre su hueco: sus partidos desaparecen y el resto no se mueve)
  categorias.forEach(c => {
    c.partidos = ordenGrupo(c.jugadores, CONFIG.HUECOS_GRUPO).filter(([a, b]) => !c.bajas.has(a) && !c.bajas.has(b));
  });

  // Índice de resultados por clave: catNorm | nombreA | nombreB (ordenados)
  const resultados = new Map();
  resultadosRaw.forEach(r => {
    const cat = col(r, "Categoría", "Categoria", "Cat");
    const j1 = col(r, "Jugador1", "Jugador 1", "Local", "Jugadora1");
    const j2 = col(r, "Jugador2", "Jugador 2", "Visitante", "Jugadora2");
    const g1 = col(r, "Juegos1", "Juegos 1", "Sets1", "Resultado1");
    const g2 = col(r, "Juegos2", "Juegos 2", "Sets2", "Resultado2");
    if (!j1 || !j2) return;
    const ck = ckey(cat);
    const clave = [ck, norm(j1), norm(j2)].sort().join("|");
    resultados.set(clave, { cat: ck, j1, j2, g1, g2 });
  });

  return { categorias, resultados, sinGrupo, repetidos };
}

function claveCruce(catNorm, a, b) {
  return [catNorm, norm(a), norm(b)].sort().join("|");
}

/* Devuelve el resultado de un cruce orientado a (a,b) o null si pendiente */
function resultadoDe(datos, catNorm, a, b) {
  const r = datos.resultados.get(claveCruce(catNorm, a, b));
  if (!r) return null;
  // orientar al orden (a,b)
  let g1 = r.g1, g2 = r.g2, p1 = r.j1, p2 = r.j2;
  if (norm(r.j1) !== norm(a)) { [g1, g2] = [g2, g1]; [p1, p2] = [p2, p1]; }
  const np1 = ES_NP(g1), np2 = ES_NP(g2);
  const n1 = esNum(g1), n2 = esNum(g2);
  if (!n1 && !n2 && !np1 && !np2) return null; // sin datos => pendiente
  return { g1, g2, np1, np2, n1, n2 };
}

/* ---------- Clasificación de una categoría ---------- */
function clasificacion(datos, catNorm, jugadores) {
  const P = CONFIG.PUNTOS;
  const tabla = new Map();
  jugadores.forEach(nombre => tabla.set(norm(nombre), {
    nombre, pj: 0, v: 0, e: 0, d: 0, jf: 0, jc: 0, pts: 0,
  }));

  // recorrer todos los pares
  for (let i = 0; i < jugadores.length; i++) {
    for (let j = i + 1; j < jugadores.length; j++) {
      const a = jugadores[i], b = jugadores[j];
      const r = resultadoDe(datos, catNorm, a, b);
      if (!r) continue;
      const A = tabla.get(norm(a)), B = tabla.get(norm(b));
      const ga = r.n1 ? Number(r.g1) : 0, gb = r.n2 ? Number(r.g2) : 0;

      // No presentado
      if (r.np1 || r.np2) {
        A.pj++; B.pj++;
        if (r.np1 && !r.np2) { B.v++; A.d++; B.pts += P.victoria; A.pts += P.noPresentado; }
        else if (r.np2 && !r.np1) { A.v++; B.d++; A.pts += P.victoria; B.pts += P.noPresentado; }
        else { A.pts += P.noPresentado; B.pts += P.noPresentado; } // ambos NP
        continue;
      }
      // Resultado numérico
      A.pj++; B.pj++;
      A.jf += ga; A.jc += gb; B.jf += gb; B.jc += ga;
      if (ga > gb) { A.v++; B.d++; A.pts += P.victoria; B.pts += P.derrota; }
      else if (gb > ga) { B.v++; A.d++; B.pts += P.victoria; A.pts += P.derrota; }
      else { A.e++; B.e++; A.pts += P.derrota; B.pts += P.derrota; } // empate raro en tenis
    }
  }

  const lista = [...tabla.values()].map(x => ({ ...x, dif: x.jf - x.jc }));

  // Desempates: puntos → victorias → diferencia → enfrentamiento directo → juegos a favor
  lista.sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.v !== x.v) return y.v - x.v;
    if (y.dif !== x.dif) return y.dif - x.dif;
    const h = headToHead(datos, catNorm, x.nombre, y.nombre);
    if (h !== 0) return h;
    return y.jf - x.jf;
  });
  return lista;
}

/* Enfrentamiento directo: -1 si gana x, 1 si gana y, 0 si nada */
function headToHead(datos, catNorm, x, y) {
  const r = resultadoDe(datos, catNorm, x, y);
  if (!r) return 0;
  if (r.np1 && !r.np2) return 1;
  if (r.np2 && !r.np1) return -1;
  if (r.n1 && r.n2) { const a = Number(r.g1), b = Number(r.g2); if (a > b) return -1; if (b > a) return 1; }
  return 0;
}

/* ===================== RENDER ===================== */
function el(tag, opts = {}, ...hijos) {
  const n = document.createElement(tag);
  if (opts.class) n.className = opts.class;
  if (opts.text != null) n.textContent = opts.text;
  for (const h of hijos) if (h != null) n.append(h);
  return n;
}

const VISTA_ORDEN = "__orden", VISTA_ELIM = "__elim", VISTA_LISTAS = "__listas";
const ck_elim = norm(CONFIG.CAT_ELIM);

function pintar(datos) {
  const cats = [...datos.categorias.entries()];
  const secLis = $("#listas-sec"), secCru = $("#cruces-sec"), secCla = $("#clasificacion-sec"), secOrd = $("#orden-sec"), secEli = $("#elim-sec");
  [secLis, secCru, secCla, secOrd, secEli].forEach(s => s.hidden = true);
  if (!cats.length) {
    mensaje("La hoja no tiene jugadores todavía. Añade filas en la pestaña «" + CONFIG.PESTANA_JUGADORES + "».");
    $("#cat-tabs").replaceChildren();
    return;
  }
  const vistas = [[VISTA_LISTAS, "Listas"], [VISTA_ORDEN, "Partidos"], ...cats.map(([ck, c]) => [ck, ck.toUpperCase()]), [VISTA_ELIM, "Final"]];
  if (!VISTA_ACTIVA || !vistas.some(v => v[0] === VISTA_ACTIVA)) VISTA_ACTIVA = VISTA_ORDEN;

  const tabs = $("#cat-tabs");
  tabs.replaceChildren();
  vistas.forEach(([k, nombre]) => {
    const b = el("button", { class: "tab" + (nombre.length <= 2 ? " tab--mini" : "") + (k === VISTA_ACTIVA ? " tab--on" : ""), text: nombre });
    b.addEventListener("click", () => { VISTA_ACTIVA = k; pintar(datos); window.scrollTo({ top: 0 }); });
    tabs.append(b);
  });

  if (VISTA_ACTIVA === VISTA_LISTAS) { secLis.hidden = false; pintarListas(datos); }
  else if (VISTA_ACTIVA === VISTA_ORDEN) { secOrd.hidden = false; pintarOrden(datos); }
  else if (VISTA_ACTIVA === VISTA_ELIM) { secEli.hidden = false; pintarElim(datos); }
  else {
    const cat = datos.categorias.get(VISTA_ACTIVA);
    pintarClasificacion(datos, VISTA_ACTIVA, cat);
    pintarCruces(datos, VISTA_ACTIVA, cat);
    secCru.hidden = false;
  }
}

/* Listas limpias de cada grupo + avisos de lo que no cuadra en la hoja */
function pintarListas(datos) {
  const cont = $("#listas");
  cont.replaceChildren();
  const avisos = [];
  if (datos.sinGrupo.length) avisos.push("Sin grupo (no juegan hasta ponerlo): " + datos.sinGrupo.join(", "));
  if (datos.repetidos.length) avisos.push("Repetidos (se ignoran): " + datos.repetidos.join(", "));
  avisos.forEach(t => cont.append(el("p", { class: "aviso-lista", text: "⚠ " + t })));

  const cols = el("div", { class: "cols" });
  datos.categorias.forEach(c => {
    const col = el("div", { class: "col" }, el("h3", { class: "col__titulo", text: `${c.nombre} · ${c.activos.length}` }));
    c.jugadores.forEach((n, i) => {
      const e = c.edad.get(n);
      col.append(el("div", { class: "jug" + (c.bajas.has(n) ? " jug--baja" : "") },
        el("span", { class: "jug__n", text: String(i + 1) }),
        el("span", { class: "jug__nom", text: n }),
        e ? el("span", { class: "jug__edad", text: e }) : null));
    });
    cols.append(col);
  });
  cont.append(cols);
}

/* ¿Tiene resultado este partido de la cola? */
/* Nombre corto para pantallas estrechas: el nombre de pila (+ inicial del apellido si se repite) */
function nombreCorto(cat, nombre) {
  const pila = nombre.trim().split(/\s+/)[0];
  const rep = cat.jugadores.filter(n => norm(n.trim().split(/\s+/)[0]) === norm(pila)).length > 1;
  const ap = nombre.trim().split(/\s+/)[1];
  return rep && ap ? pila + " " + ap[0] + "." : pila;
}

/* Vista principal: una columna por grupo con sus próximos partidos (también en móvil) */
function tarjetaPartido(datos, ck, cat, a, b, n, clase) {
  const res = resultadoDe(datos, ck, a, b);
  const gana = res ? headToHead(datos, ck, a, b) : 0;
  const card = el("div", { class: "partido " + clase });
  card.append(el("span", { class: "partido__n", text: String(n) }));
  const lado = (nom, marca, w) => el("div", { class: "partido__lado" + (gana === w ? " gana" : "") },
    el("span", { class: "partido__nom", text: nombreCorto(cat, nom) }),
    res ? el("span", { class: "partido__marca", text: marca }) : null);
  card.append(lado(a, res && (res.np1 ? "NP" : res.g1), -1));
  card.append(el("span", { class: "partido__vs", text: "vs" }));
  card.append(lado(b, res && (res.np2 ? "NP" : res.g2), 1));
  return card;
}

function pintarOrden(datos) {
  const cont = $("#orden");
  cont.replaceChildren();
  const cats = [...datos.categorias.entries()];
  const total = cats.reduce((s, [, c]) => s + c.partidos.length, 0);
  if (!total) { cont.append(el("p", { class: "vacio", text: "Aún no hay suficientes jugadores." })); return; }
  const hechosN = cats.reduce((s, [ck, c]) => s + c.partidos.filter(([a, b]) => resultadoDe(datos, ck, a, b)).length, 0);
  $("#orden-resumen").textContent = `${hechosN} de ${total} partidos jugados`;

  const cols = el("div", { class: "cols" });
  const hechos = [];
  cats.forEach(([ck, c]) => {
    const col = el("div", { class: "col" }, el("h3", { class: "col__titulo", text: c.nombre }));
    let sig = 0;
    c.partidos.forEach(([a, b], i) => {
      if (resultadoDe(datos, ck, a, b)) { hechos.push([ck, c, a, b, i + 1]); return; }
      col.append(tarjetaPartido(datos, ck, c, a, b, i + 1, sig === 0 ? "partido--siguiente" : sig < 3 ? "partido--proximo" : ""));
      sig++;
    });
    if (!sig) col.append(el("p", { class: "vacio", text: "¡Grupo terminado!" }));
    cols.append(col);
  });
  cont.append(cols);

  if (hechos.length) {
    const d = el("details", { class: "jugados" }, el("summary", { text: `Jugados (${hechos.length})` }));
    const g = el("div", { class: "cols" });
    cats.forEach(([ck, c]) => {
      const col = el("div", { class: "col" });
      hechos.filter(h => h[0] === ck).forEach(([, cc, a, b, n]) => col.append(tarjetaPartido(datos, ck, cc, a, b, n, "")));
      g.append(col);
    });
    d.append(g);
    cont.append(d);
  }
}

/* Clasificación de un grupo (nombres ordenados) y si ya ha terminado */
function estadoGrupo(datos, ck, c) {
  const lista = clasificacion(datos, ck, c.activos).map(x => x.nombre);
  const terminado = c.partidos.length > 0 && c.partidos.every(([a, b]) => resultadoDe(datos, ck, a, b));
  return { lista, terminado };
}

/* Eliminatorias entre los mejores de cada grupo */
function pintarElim(datos) {
  const cont = $("#elim");
  cont.replaceChildren();
  const cats = [...datos.categorias.entries()];
  if (cats.length < 2) { cont.append(el("p", { class: "vacio", text: "Hacen falta dos grupos para las eliminatorias." })); return; }
  const [ckA, cA] = cats[0], [ckB, cB] = cats[1];
  const A = estadoGrupo(datos, ckA, cA), B = estadoGrupo(datos, ckB, cB);
  const prov = !(A.terminado && B.terminado);
  const N = CONFIG.CLASIFICAN;
  const a = i => A.lista[i], b = i => B.lista[i];

  $("#elim-resumen").textContent = (prov ? "Cruces provisionales: cambian según la clasificación de los grupos. " : "Cruces definitivos. ")
    + `Primeros ${N} de cada grupo.`;

  const ganador = (p) => {
    if (!p.a || !p.b) return null;
    const g = headToHead(datos, ck_elim, p.a, p.b);
    return g === -1 ? p.a : g === 1 ? p.b : null;
  };
  const tarjeta = (titulo, p, ck) => {
    const r = p.a && p.b ? resultadoDe(datos, ck, p.a, p.b) : null;
    const g = r ? headToHead(datos, ck, p.a, p.b) : 0;
    const card = el("div", { class: "cruce" + (r ? " cruce--jugado" : "") });
    [[p.a, p.ta, r && (r.np1 ? "NP" : r.g1), -1], [p.b, p.tb, r && (r.np2 ? "NP" : r.g2), 1]].forEach(([n, t, m, w]) => {
      const lado = el("div", { class: "cruce__lado" + (g === w ? " gana" : "") });
      lado.append(el("span", { class: "cruce__nombre", text: n || t }));
      lado.append(el("span", { class: "cruce__marca" + (r ? "" : " cruce__pend"), text: r ? String(m) : "·" }));
      card.append(lado);
    });
    card.append(el("span", { class: "cruce__estado", text: titulo }));
    return card;
  };

  const qf = [
    { a: a(0), b: b(N - 1), ta: "1º " + cA.nombre, tb: N + "º " + cB.nombre },
    { a: b(1), b: a(N - 2), ta: "2º " + cB.nombre, tb: (N - 1) + "º " + cA.nombre },
    { a: b(0), b: a(N - 1), ta: "1º " + cB.nombre, tb: N + "º " + cA.nombre },
    { a: a(1), b: b(N - 2), ta: "2º " + cA.nombre, tb: (N - 1) + "º " + cB.nombre },
  ];
  const sf = [
    { a: ganador(qf[0]), b: ganador(qf[1]), ta: "Ganador C1", tb: "Ganador C2" },
    { a: ganador(qf[2]), b: ganador(qf[3]), ta: "Ganador C3", tb: "Ganador C4" },
  ];
  const fin = { a: ganador(sf[0]), b: ganador(sf[1]), ta: "Ganador S1", tb: "Ganador S2" };

  const bloque = (titulo, tarjetas) => {
    cont.append(el("h3", { class: "elim__fase", text: titulo }));
    const g = el("div", { class: "cruces cruces--elim" });
    tarjetas.forEach(t => g.append(t));
    cont.append(g);
  };
  bloque("Cuartos de final", qf.map((p, i) => tarjeta("C" + (i + 1), p, ck_elim)));
  bloque("Semifinales", sf.map((p, i) => tarjeta("S" + (i + 1), p, ck_elim)));
  bloque("Final", [tarjeta("Final", fin, ck_elim)]);
}

function pintarClasificacion(datos, ck, cat) {
  const lista = clasificacion(datos, ck, cat.activos);
  const cont = $("#clasificacion");
  const sec = $("#clasificacion-sec");
  cont.replaceChildren();
  // La clasificación solo se muestra si ya hay algún resultado en la categoría
  if (!lista.some(p => p.pj > 0)) { sec.hidden = true; return; }
  sec.hidden = false;

  const wrap = el("div", { class: "tabla-wrap" });
  const tabla = el("table", { class: "tabla" });
  const thead = el("thead");
  const trh = el("tr");
  [["#", "pos"], ["Jugador", "name"], ["PJ", ""], ["V", ""], ["D", ""], ["JF", "hide-s"], ["JC", "hide-s"], ["+/–", ""], ["Pts", "pts"]]
    .forEach(([t, cls]) => trh.append(el("th", { class: cls, text: t })));
  thead.append(trh);
  tabla.append(thead);

  const tb = el("tbody");
  lista.forEach((p, i) => {
    const tr = el("tr", { class: i < 2 ? "fila-top" : "" });
    tr.append(el("td", { class: "pos", text: String(i + 1) }));
    tr.append(el("td", { class: "name", text: p.nombre }));
    tr.append(el("td", { text: String(p.pj) }));
    tr.append(el("td", { text: String(p.v) }));
    tr.append(el("td", { text: String(p.d) }));
    tr.append(el("td", { class: "hide-s", text: String(p.jf) }));
    tr.append(el("td", { class: "hide-s", text: String(p.jc) }));
    tr.append(el("td", { text: (p.dif > 0 ? "+" : "") + p.dif }));
    tr.append(el("td", { class: "pts", text: String(p.pts) }));
    tb.append(tr);
  });
  tabla.append(tb);
  wrap.append(tabla);
  cont.append(wrap);
}

function pintarCruces(datos, ck, cat) {
  const cont = $("#cruces");
  cont.replaceChildren();
  const pares = cat.partidos;

  if (!pares.length) { cont.append(el("p", { class: "vacio", text: "Aún no hay suficientes jugadores en esta categoría." })); return; }

  pares.forEach(([a, b]) => {
    const r = resultadoDe(datos, ck, a, b);
    const card = el("div", { class: "cruce" + (r ? " cruce--jugado" : "") });

    const linA = el("div", { class: "cruce__lado" });
    const linB = el("div", { class: "cruce__lado" });
    linA.append(el("span", { class: "cruce__nombre", text: a }));
    linB.append(el("span", { class: "cruce__nombre", text: b }));

    if (r) {
      const ga = r.np1 ? "NP" : (r.n1 ? r.g1 : "–");
      const gb = r.np2 ? "NP" : (r.n2 ? r.g2 : "–");
      const gana = headToHead(datos, ck, a, b); // -1 a, 1 b
      if (gana === -1) linA.classList.add("gana"); else if (gana === 1) linB.classList.add("gana");
      linA.append(el("span", { class: "cruce__marca", text: String(ga) }));
      linB.append(el("span", { class: "cruce__marca", text: String(gb) }));
    } else {
      linA.append(el("span", { class: "cruce__marca cruce__pend", text: "·" }));
      linB.append(el("span", { class: "cruce__marca cruce__pend", text: "·" }));
      card.append();
    }
    card.append(linA, linB);
    if (!r) card.append(el("span", { class: "cruce__estado", text: "Pendiente" }));
    cont.append(card);
  });
}

/* ---------- Estados / utilidades de pantalla ---------- */
function mensaje(txt, tipo = "info") {
  const m = $("#aviso");
  m.className = "aviso aviso--" + tipo;
  m.textContent = txt;
  m.hidden = false;
}
function ocultarAviso() { $("#aviso").hidden = true; }

/* ---------- Carga + auto-refresco ---------- */
let cargando = false;
async function cargar() {
  if (cargando) return;
  if (!CONFIG.SHEET_ID || CONFIG.SHEET_ID === "PEGA_AQUI_EL_ID_DE_TU_HOJA") {
    mensaje("⚙️ Falta conectar la Google Sheet. Abre config.js y pega el ID de tu hoja. Mira INSTRUCCIONES.md.", "config");
    return;
  }
  cargando = true;
  try {
    const [jug, resu] = await Promise.all([
      leerPestana(CONFIG.PESTANA_JUGADORES),
      leerPestana(CONFIG.PESTANA_RESULTADOS),
    ]);
    ocultarAviso();
    pintar(construir(jug, resu));
  } catch (e) {
    mensaje("No se pudo leer la hoja. Revisa que el ID sea correcto y que esté compartida como «Cualquiera con el enlace: Lector». (" + e.message + ")", "error");
  } finally {
    cargando = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.title = CONFIG.TITULO;
  cargar();
  setInterval(cargar, Math.max(10, CONFIG.REFRESCO_SEGUNDOS) * 1000);
});
