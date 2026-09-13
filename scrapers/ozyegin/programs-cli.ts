// Kullanım: npm run import:programs -- <program-plan-export.json>
// Doğrulamayı geçerse data/ozyegin/programs.json dosyasını yazar; geçmezse eski dosyaya dokunmaz.
import fs from "node:fs";
import path from "node:path";
import { validateProgramsData } from "../validate";
import { buildProgramsData, type RawProgramsExport } from "./programs";

const file = process.argv[2];
if (!file) {
  console.error("Program planı dışa aktarma dosyasını verin.");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(file, "utf8")) as RawProgramsExport;
const outFile = path.join("data", "ozyegin", "programs.json");

let result: ReturnType<typeof buildProgramsData>;
try {
  result = buildProgramsData(raw);
} catch (err) {
  console.error(`İçeri alma başarısız, ${outFile} değiştirilmedi: ${(err as Error).message}`);
  process.exit(1);
}
const { data, warnings } = result;
if (warnings.length > 0) console.warn(`Uyarılar (${warnings.length}):\n- ${warnings.join("\n- ")}`);

const errors = validateProgramsData(data);
if (errors.length > 0) {
  console.error(`Doğrulama başarısız, ${outFile} değiştirilmedi:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n");
const items = data.programs.reduce((n, p) => n + p.semesters.reduce((m, s) => m + s.items.length, 0), 0);
console.log(`${outFile}: ${data.programs.length} program, ${items} plan satırı.`);
