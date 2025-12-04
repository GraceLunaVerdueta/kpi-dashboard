// js/tabla-dinamica.js  (versión robusta por orden de celdas)
// Lee APP_CONFIG.csv_url desde js/config.js (o config.json si lo prefieres)
// Requiere PapaParse cargado previamente.

const COLS = [
  "scz-meta","scz-real",
  "lpz-meta","lpz-real",
  "cbba-meta","cbba-real",
  "tja-meta","tja-real",
  "embol-meta","embol-real"
];

// mismo slug generator que teníamos
function slugFromLabel(label) {
  if (!label) return null;
  const s = label.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if (s.includes("ltir")) return "ltir";
  if (s.includes("reclamos")) return "reclamos";
  if (s.includes("nivel") || s.includes("servicio")) return "servicio";
  if (s.includes("costo") && s.includes("transform")) return "costo-transf";
  if (s.includes("costo") && s.includes("bodega")) return "bodega";
  if (s.includes("ejecucion") && s.includes("plan")) return "plan";
  if (s.includes("auditor")) return "auditorias";
  return null;
}

function normalizeValueForDisplay(raw) {
  if (raw === undefined || raw === null) return "";
  let v = String(raw).trim();
  v = v.replace(/^"+|"+$/g, "");
  // si tiene coma decimal y no punto, convierto coma->punto
  if (v.includes(",") && !v.includes(".")) v = v.replace(/,/g, ".");
  return v;
}

// Construye map slug -> <tr> buscando en la tabla por el texto del <th>
function buildTableRowMap() {
  const map = {};
  const rows = document.querySelectorAll("#tabla-kpi tbody tr");
  rows.forEach(row => {
    // buscamos el <th> (cabecera de fila)
    const th = row.querySelector("th");
    if (!th) return;
    const labelText = (th.textContent || "").trim();
    const slug = slugFromLabel(labelText);
    if (slug) {
      map[slug] = row;
      console.log("Mapeada fila:", slug, "->", labelText);
    } else {
      console.log("Fila no mapeada (sin slug):", labelText);
    }
  });
  return map;
}

function fillRowByOrder(tr, valuesArray) {
  // tr: <tr> HTML, valuesArray: [v0, v1, ..., v9] correspondientes a las 10 celdas
  const tds = tr.querySelectorAll("td");
  // si no hay tds suficiente, avisamos
  if (tds.length < COLS.length) {
    console.warn("Fila encontrada pero tiene menos TDs de lo esperado:", tds.length, "esperado:", COLS.length, tr);
  }
  for (let i = 0; i < COLS.length; i++) {
    if (!tds[i]) continue;
    const v = normalizeValueForDisplay(valuesArray[i] ?? "");
    tds[i].textContent = v;
    // breve highlight para ver el llenado
    tds[i].style.transition = "background 0.2s";
    const prev = tds[i].style.backgroundColor;
    tds[i].style.backgroundColor = "#fffd8c"; // amarillo suave
    setTimeout(()=> { tds[i].style.backgroundColor = prev; }, 700);
    console.log("Rellenada celda:", { rowSlug: tr && slugFromLabel(tr.querySelector("th")?.textContent), index:i, value:v });
  }
}

function parseAndFillFromRows(rows) {
  console.log("CSV rows (preview):", rows.slice(0,12));
  // Construimos el mapa once
  const tableMap = buildTableRowMap();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r].map(c => (c === undefined ? "" : String(c).trim()));
    if (!row || row.length < 2) continue;

    const label = row[1]; // KPI en la segunda columna del CSV
    const slug = slugFromLabel(label);
    if (!slug) {
      // filas de encabezado o que no coinciden
      continue;
    }

    const values = [];
    // valores CSV empiezan en index 2 (3ª columna) y corren 10 columnas
    for (let i = 0; i < COLS.length; i++) {
      values.push(row[i + 2] ?? "");
    }

    const tr = tableMap[slug];
    if (tr) {
      fillRowByOrder(tr, values);
    } else {
      console.warn("No existe fila HTML para KPI (slug):", slug, "label CSV:", label);
    }
  }
}

async function getCsvUrlFromConfig() {
  if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.csv_url) {
    return APP_CONFIG.csv_url;
  }
  // fallback a config.json
  try {
    const res = await fetch("config.json", { cache: "no-store" });
    if (!res.ok) throw new Error("config.json no encontrado");
    const cfg = await res.json();
    if (cfg.csv_url) return cfg.csv_url;
    throw new Error("config.json no tiene csv_url");
  } catch (err) {
    console.error("No se pudo obtener csv_url desde config:", err);
    throw err;
  }
}

async function updateTableOnce() {
  try {
    const csvUrl = await getCsvUrlFromConfig();
    console.log("Cargando CSV desde:", csvUrl);
    // agregar parámetro anti-cache
    const noCacheUrl = csvUrl + "&t=" + Date.now();

    const res = await fetch(noCacheUrl, { cache: "no-store" });

    if (!res.ok) throw new Error("No se pudo obtener CSV: " + res.status);
    const text = await res.text();
    const parsed = Papa.parse(text, { skipEmptyLines: true });
    if (!parsed || !parsed.data) throw new Error("PapaParse no devolvió datos");
    parseAndFillFromRows(parsed.data);
    console.log("Tabla actualizada", new Date().toLocaleTimeString());
  } catch (err) {
    console.error("Error actualizando tabla:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateTableOnce();
  setInterval(updateTableOnce, 5_000); // 5 segundos

});
