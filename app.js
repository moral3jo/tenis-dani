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

let CATEGORIA_ACTIVA = null;

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

  jugadoresRaw.forEach(j => {
    const nombre = col(j, "Nombre", "Jugador", "Nombre y apellido");
    const cat = col(j, "Categoría", "Categoria", "Cat") || "General";
    if (!nombre) return;
    const ck = norm(cat);
    if (!categorias.has(ck)) categorias.set(ck, { nombre: cat, jugadores: [], set: new Set() });
    const c = categorias.get(ck);
    if (!c.set.has(norm(nombre))) { c.jugadores.push(nombre); c.set.add(norm(nombre)); }
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
    const ck = norm(cat);
    const clave = [ck, norm(j1), norm(j2)].sort().join("|");
    resultados.set(clave, { cat: ck, j1, j2, g1, g2 });
  });

  return { categorias, resultados };
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

function pintar(datos) {
  const cats = [...datos.categorias.entries()];
  const secCru = $("#cruces-sec"), secCla = $("#clasificacion-sec");
  if (!cats.length) {
    mensaje("La hoja no tiene jugadores todavía. Añade filas en la pestaña «" + CONFIG.PESTANA_JUGADORES + "».");
    $("#cat-tabs").replaceChildren();
    secCru.hidden = true; secCla.hidden = true;
    return;
  }
  if (!CATEGORIA_ACTIVA || !datos.categorias.has(CATEGORIA_ACTIVA)) CATEGORIA_ACTIVA = cats[0][0];

  // pestañas de categoría (siempre visibles en la cabecera)
  const tabs = $("#cat-tabs");
  tabs.replaceChildren();
  cats.forEach(([ck, c]) => {
    const b = el("button", { class: "tab" + (ck === CATEGORIA_ACTIVA ? " tab--on" : ""), text: c.nombre });
    b.addEventListener("click", () => { CATEGORIA_ACTIVA = ck; pintar(datos); });
    tabs.append(b);
  });

  const cat = datos.categorias.get(CATEGORIA_ACTIVA);
  pintarClasificacion(datos, CATEGORIA_ACTIVA, cat);
  pintarCruces(datos, CATEGORIA_ACTIVA, cat);
  secCru.hidden = false;
}

function pintarClasificacion(datos, ck, cat) {
  const lista = clasificacion(datos, ck, cat.jugadores);
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
  const js = cat.jugadores;
  const pares = [];
  for (let i = 0; i < js.length; i++)
    for (let j = i + 1; j < js.length; j++) pares.push([js[i], js[j]]);

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

function setReloj() {
  const d = new Date();
  $("#actualizado").textContent = "Última actualización · " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

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
    setReloj();
  } catch (e) {
    mensaje("No se pudo leer la hoja. Revisa que el ID sea correcto y que esté compartida como «Cualquiera con el enlace: Lector». (" + e.message + ")", "error");
  } finally {
    cargando = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("#titulo").textContent = CONFIG.TITULO;
  $("#subtitulo").textContent = CONFIG.SUBTITULO;
  document.title = CONFIG.TITULO;
  cargar();
  setInterval(cargar, Math.max(10, CONFIG.REFRESCO_SEGUNDOS) * 1000);
});
