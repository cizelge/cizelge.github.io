// Kullanım: npm run import:ozyegin -- <export1.json> [export2.json ...]
// Doğrulamayı geçerse data/ozyegin/<termId>.json dosyasını yazar; geçmezse eski dosyaya dokunmaz.
import fs from "node:fs";
import path from "node:path";
import type { TermData } from "../../src/lib/types";
import { validateTermData } from "../validate";
import { buildTermData, type RawExport } from "./import";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("En az bir dışa aktarma dosyası verin.");
  process.exit(1);
}

const exports = files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as RawExport);
const fetchedAt = exports.map((e) => e.exportedAt).sort().at(-1)!;
const term = buildTermData(exports, { fetchedAt });

const outDir = path.join("data", "ozyegin");
const outFile = path.join(outDir, `${term.termId}.json`);
const previous: TermData | null = fs.existsSync(outFile)
  ? JSON.parse(fs.readFileSync(outFile, "utf8"))
  : null;

const errors = validateTermData(term, previous);
if (errors.length > 0) {
  console.error(`Doğrulama başarısız, ${outFile} değiştirilmedi:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(term, null, 2) + "\n");
const sections = term.courses.reduce((n, c) => n + c.sections.length, 0);
console.log(`${outFile}: ${term.courses.length} ders, ${sections} şube.`);
