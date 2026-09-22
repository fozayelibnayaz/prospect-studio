const enc = new TextEncoder();
const esc = (x) =>
  String(x ?? "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(b) {
  let c = -1;
  for (const n of b) c = table[(c ^ n) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function header(length, values) {
  const b = new Uint8Array(length),
    v = new DataView(b.buffer);
  for (const [offset, size, value] of values)
    size === 4
      ? v.setUint32(offset, value, true)
      : v.setUint16(offset, value, true);
  return b;
}
function join(parts) {
  const a = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    a.set(p, i);
    i += p.length;
  }
  return a;
}
function zip(files) {
  const locals = [],
    central = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = enc.encode(path),
      body = enc.encode(text),
      sum = crc(body);
    const h = header(30, [
      [0, 4, 0x04034b50],
      [4, 2, 20],
      [14, 4, sum],
      [18, 4, body.length],
      [22, 4, body.length],
      [26, 2, name.length],
    ]);
    locals.push(h, name, body);
    central.push(
      header(46, [
        [0, 4, 0x02014b50],
        [4, 2, 20],
        [6, 2, 20],
        [16, 4, sum],
        [20, 4, body.length],
        [24, 4, body.length],
        [28, 2, name.length],
        [42, 4, offset],
      ]),
      name,
    );
    offset += h.length + name.length + body.length;
  }
  const dir = join(central),
    n = Object.keys(files).length;
  return join([
    ...locals,
    dir,
    header(22, [
      [0, 4, 0x06054b50],
      [8, 2, n],
      [10, 2, n],
      [12, 4, dir.length],
      [16, 4, offset],
    ]),
  ]);
}
function col(i) {
  let r = "";
  for (i++; i; i = Math.floor((i - 1) / 26))
    r = String.fromCharCode(65 + ((i - 1) % 26)) + r;
  return r;
}
function sheet(rows) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="30" width="28" customWidth="1"/></cols><sheetData>' +
    rows
      .map(
        (row, i) =>
          `<row r="${i + 1}">` +
          row
            .map(
              (v, j) =>
                `<c r="${col(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`,
            )
            .join("") +
          "</row>",
      )
      .join("") +
    "</sheetData></worksheet>"
  );
}
export function xlsx(report) {
  const fields = [
    "id",
    "company",
    "website",
    "country",
    "type",
    "niche",
    "person",
    "email",
    "emailSource",
    "phone",
    "phoneSource",
    "address",
    "addressSource",
    "source",
    "evidence",
    "status",
    "stage",
    "consent",
    "contactEvidence",
    "createdAt",
    "firstContactAt",
    "replyAt",
    "notes",
  ];
  const summary = [
    ["Daily prospect research", report.id],
    ["Snapshot created", report.at],
    ["Research rows", report.rows.length],
    ["Held", report.counts.held],
    ["Target", report.target],
    [
      "Shortfall",
      Math.max(0, report.target - (report.rows.length - report.counts.held)),
    ],
    [
      "Important",
      "Machine research only. Public details are not permission, buyer interest or deliverability.",
    ],
  ];
  return zip({
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Daily summary" sheetId="1" r:id="rId1"/><sheet name="Prospects" sheetId="2" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": sheet(summary),
    "xl/worksheets/sheet2.xml": sheet([
      fields,
      ...report.rows.map((r) => fields.map((f) => r[f] ?? "")),
    ]),
  });
}
export function xlsxBook(sheets) {
  const clean = sheets.slice(0, 4).map((s) => ({
    name: String(s.name || "Sheet").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31),
    header: (s.header || []).map((h) => String(h)),
    rows: (s.rows || []).slice(0, 4000),
  }));
  const overrides = clean
    .map(
      (s, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  const sheetTags = clean
    .map(
      (s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");
  const rels = clean
    .map(
      (s, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("");
  const files = {
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      overrides +
      "</Types>",
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheetTags +
      "</sheets></workbook>",
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      rels +
      "</Relationships>",
  };
  clean.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = sheet([
      s.header,
      ...s.rows.map((r) => r.map((v) => (v == null ? "" : String(v)))),
    ]);
  });
  return zip(files);
}
