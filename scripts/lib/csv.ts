/** Minimal dependency-free RFC4180 CSV parser — handles quoted fields with
 * embedded commas, newlines, and escaped `""` quotes (needed for the
 * embedded JSON blobs in TruMarket's deal export columns). */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize line endings so \r\n inside/outside quotes behaves the same.
  const src = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  // Final field/row (files may or may not end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  return body.map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h] = r[idx] ?? "";
    });
    return rec;
  });
}
