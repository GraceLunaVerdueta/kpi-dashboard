// api/kpi.js (ESM) — versión corregida con CORS + preflight + validaciones
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
    // ---------- CORS y preflight ----------
    const origin = req.headers.origin || "*";
    // en pruebas permitimos cualquier origen; luego pon tu dominio
    res.setHeader("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    // ---------- leer ENV VARS ----------
    const keyJson = process.env.SERVICE_ACCOUNT_KEY;
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetRange = process.env.SHEET_RANGE || "Sheet1!A1:L100";

    if (!keyJson || !spreadsheetId) {
      // devolvemos CORS también en errores
      res.setHeader("Content-Type", "application/json");
      return res.status(500).json({ error: "CONFIG_MISSING", message: "SERVICE_ACCOUNT_KEY o SPREADSHEET_ID no configurados en env vars" });
    }

    // parsear credencial (puede venir como string JSON)
    let key;
    try {
      key = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    } catch (e) {
      return res.status(500).json({ error: "INVALID_SERVICE_KEY", message: "SERVICE_ACCOUNT_KEY no es JSON válido" });
    }

    // ---------- autenticación con Google ----------
    const auth = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      SCOPES
    );

    await auth.authorize();

    const sheets = google.sheets({ version: "v4", auth });

    // Traer valores
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange
    });

    const rows = resp.data.values || [];

    // Mapear a formato útil
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
      const label = row[1];
      const slug = slugFromLabel(label);
      if (!slug) continue;
      const values = [];
      for (let i = 0; i < COLS.length; i++) {
        values.push(row[i + 2] ?? "");
      }
      data[slug] = values;
    }

    // Responder con CORS y JSON
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({ ok: true, data, rows });
  } catch (err) {
    console.error("API error:", err);
    // aseguramos que la respuesta incluya headers CORS aunque haya error
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ error: err.message || String(err) });
  }
}
