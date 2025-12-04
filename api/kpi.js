// api/kpi.js (ESM)
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

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

export default async function handler(req, res) {
  try {
    // agregar al inicio del handler, antes de usar process.env y demás
    // Manejo CORS / Preflight
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Responder a preflight OPTIONS rápido
    if (req.method === "OPTIONS") {
    return res.status(204).end();
}


    // parseamos la key (si fue pasada como JSON string)
    const key = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;

    const auth = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      SCOPES
    );

    await auth.authorize();

    const sheets = google.sheets({ version: "v4", auth });
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange
    });

    const rows = resp.data.values || [];

    // Devolvemos también un "map" slug->values (10 columnas) para facilitar frontend
    const COLS = [
      "scz-meta","scz-real",
      "lpz-meta","lpz-real",
      "cbba-meta","cbba-real",
      "tja-meta","tja-real",
      "embol-meta","embol-real"
    ];

    const data = {};
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r].map(c => (c === undefined ? "" : String(c).trim()));
      if (!row || row.length < 2) continue;
      const label = row[1]; // segunda columna contiene el KPI label en tu sheet
      const slug = slugFromLabel(label);
      if (!slug) continue;
      const values = [];
      for (let i = 0; i < COLS.length; i++) {
        values.push(row[i + 2] ?? "");
      }
      data[slug] = values;
    }

    return res.status(200).json({ ok: true, data, rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
