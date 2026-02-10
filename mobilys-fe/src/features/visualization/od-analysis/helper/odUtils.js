import Papa from "papaparse";

export const OD_REQUIRED_FIELDS = [
  "date",
  "agency_id",
  "route_id",
  "stopid_geton",
  "stopid_getoff",
  "count",
];

export function normalizeOdHeader(header = "") {
  return String(header).replace(/^\uFEFF/, "").trim().toLowerCase();
}

export function validateOdHeaders(fields = []) {
  const normalized = fields.map(normalizeOdHeader);
  return OD_REQUIRED_FIELDS.every((f) => normalized.includes(f));
}

export async function parseOdCsvText(text) {
  return await new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data || []),
      error: reject,
    });
  });
}

export async function parseOdCsvFile(file) {
  return await new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeOdHeader,
      complete: (res) => resolve(res),
      error: (err) => reject(err),
    });
  });
}

