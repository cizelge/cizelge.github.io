// Kullanım: npm run import:details -- <ayrinti-disa-aktarma.json>
// data/ozyegin/<termId>.json dosyasına şube kotalarını ve derslikleri işler; doğrulama geçmezse dokunmaz.
import fs from "node:fs";
import path from "node:path";
import type { TermData } from "../../src/lib/types";
import { parseTermLabel } from "../../src/lib/terms";
import { validateTermData } from "../validate";
import { applySectionDetails, type RawDetailsExport } from "./details";

const file = process.argv[2];
if (!file) {
  console.error("Ayrıntı dışa aktarma dosyasını verin.");
  process.exit(1);
}

const details = JSON.parse(fs.readFileSync(file, "utf8")) as RawDetailsExport;
if (details.source !== "ozyegin-sis-section-detail") {
  console.error(`Beklenmeyen kaynak: ${details.source}`);
  process.exit(1);
}
const termId = parseTermLabel(details.termLabel).id;
const termFile = path.join("data", "ozyegin", `${termId}.json`);
const term = JSON.parse(fs.readFileSync(termFile, "utf8")) as TermData;

const { term: updated, report } = applySectionDetails(term, details);
const errors = validateTermData(updated, term);
if (errors.length > 0) {
  console.error(`Doğrulama başarısız, ${termFile} değiştirilmedi:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

fs.writeFileSync(termFile, JSON.stringify(updated, null, 2) + "\n");
console.log(
  [
    `${termFile}: ${report.sectionsUpdated} şube güncellendi.`,
    `Dersliği olan oturum: ${report.meetingsWithRoom}, olmayan: ${report.meetingsWithoutRoom}.`,
    `Ayrıntısı alınamayan şube: ${report.sectionsWithoutDetail.length}${report.sectionsWithoutDetail.length ? ` (${report.sectionsWithoutDetail.slice(0, 10).join(", ")}${report.sectionsWithoutDetail.length > 10 ? ", ..." : ""})` : ""}.`,
    report.unknownKeys.length ? `Dönem verisinde olmayan anahtarlar: ${report.unknownKeys.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n"),
);
