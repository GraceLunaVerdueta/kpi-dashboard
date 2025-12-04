// js/tabla-dinamica.js  (consume backend /api/kpi)
const API_URL = (typeof APP_CONFIG !== "undefined" && APP_CONFIG.api_url) ? APP_CONFIG.api_url : "/api/kpi";

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

function buildTableRowMap() {
  const map = {};
  const rows = document.querySelectorAll("#tabla-kpi tbody tr");
  rows.forEach(row => {
    const th = row.querySelector("th");
    if (!th) return;
    const labelText = (th.textContent || "").trim();
    const slug = slugFromLabel(labelText);
    if (slug) map[slug] = row;
  });
  return map;
}

function normalize(v){ return (v===undefined||v===null) ? "" : String(v).trim(); }

function fillRowByOrder(tr, values) {
  const tds = tr.querySelectorAll("td");
  for (let i=0;i<10;i++){
    if (!tds[i]) continue;
    tds[i].textContent = normalize(values[i]);
    // highlight momentáneo
    tds[i].style.transition = "background 0.25s";
    const prev = tds[i].style.backgroundColor;
    tds[i].style.backgroundColor = "#fffd8c";
    setTimeout(()=> { tds[i].style.backgroundColor = prev; }, 700);
  }
}

async function updateTableOnce() {
  try {
    const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("API error " + res.status);
    const json = await res.json();
    if (!json || !json.data) throw new Error("Bad API response");

    const tableMap = buildTableRowMap();
    for (const slug of Object.keys(json.data)) {
      const tr = tableMap[slug];
      if (tr) fillRowByOrder(tr, json.data[slug]);
      else console.warn("No HTML row for", slug);
    }

    console.log("Tabla actualizada (backend)", new Date().toLocaleTimeString());
  } catch (err) {
    console.error("updateTableOnce error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateTableOnce();
  setInterval(updateTableOnce, 5000); // cada 5s
});
