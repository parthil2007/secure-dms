/** Convert a snake_case key to camelCase. */
function camel(key) {
  return key.replace(/_([a-z0-9])/g, (m, c) => c.toUpperCase());
}

/** Map a DB row (snake_case) to a camelCase object, parsing json/array columns. */
export function camelizeRow(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[camel(key)] = value;
  }
  return out;
}

/** Map an array of rows. */
export function camelizeRows(rows = []) {
  return rows.map(camelizeRow);
}

/** Coerce pg bigint/numeric strings into JS numbers. */
export function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a Postgres text[] into a plain array. */
export function toTags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value.replace(/^\{|\}$/g, '').replace(/"/g, '"'));
    } catch {
      return value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];
    }
  }
  return [];
}
