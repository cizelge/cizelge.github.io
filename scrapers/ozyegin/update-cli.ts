// Kullanım: npm run update:offerings [-- --dry-run] [--delay=1500]
//
// Açılan Dersler sayfasını gezer; izlenen her dönemi (data/ozyegin/<yyyy-yyyy-donem>.json) günceller ve
// izlenenlerden daha yeni bir dönem saatleriyle yayındaysa onun dosyasını oluşturur. Doğrulama geçmezse ya da
// güvenlik eşiği tutmazsa o dosyaya dokunmaz ve sıfırdan farklı kodla çıkar. İçerik değişmediyse yazmaz.
// GitHub Actions'ta: GITHUB_STEP_SUMMARY'ye tek satır, GITHUB_OUTPUT'a changed ve summary yazar.
import fs from "node:fs";
import path from "node:path";
import { compareTerms, parseTermLabel, type TermInfo } from "../../src/lib/terms";
import type { TermData } from "../../src/lib/types";
import { validateTermData } from "../validate";
import { countParts, hasChanges, mergeOfferings, sameContent, type MergeReport } from "./merge-offerings";
import { fetchTermOfferings, fetchTermOptions, sleep, termFromOption } from "./public-offerings";

const DATA_DIR = path.join("data", "ozyegin");
const TERM_FILE_RE = /^(\d{4}-\d{4}-(?:guz|bahar|yaz))\.json$/;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 1500);
const verbose = args.includes("--verbose");

function readTracked(): Map<string, TermData> {
  const out = new Map<string, TermData>();
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!TERM_FILE_RE.test(f)) continue;
    const term = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8")) as TermData;
    out.set(term.termId, term);
  }
  return out;
}

function list(label: string, items: readonly string[], max = 15): string | null {
  if (items.length === 0) return null;
  const shown = verbose ? items : items.slice(0, max);
  return `  ${label} (${items.length}): ${shown.join(", ")}${items.length > shown.length ? ", ..." : ""}`;
}

function printReport(r: MergeReport): void {
  const lines = [
    list("Eklenen ders", r.addedCourses),
    list("Silinen ders", r.removedCourses),
    list("Sayfada yok, SIS kotası olduğu için korunan ders", r.keptVerified),
    list("Eklenen şube", r.addedSections),
    list("Silinen şube", r.removedSections),
    list("Saat değişikliği", r.timeChanges.map((c) => `${c.key} [${c.before} → ${c.after}]`), 10),
    list("Hoca değişikliği", r.instructorChanges.map((c) => `${c.key} [${c.before.join("/") || "-"} → ${c.after.join("/") || "-"}]`), 10),
    list("Ad değişikliği", r.titleChanges, 10),
  ].filter(Boolean);
  for (const l of lines) console.log(l);
  console.log(
    `  Bulunan kapsam içi şube: %${Math.round(r.foundRatio * 100)}; sayfada olmayan, korunan kapsam dışı ders: ${r.keptOutOfScope}.`,
  );
}

function writeGithub(summary: string, changed: boolean): void {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (process.env.GITHUB_OUTPUT) {
    const oneLine = summary.replace(/[\r\n]+/g, " ");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nsummary=${oneLine}\n`);
  }
}

async function main(): Promise<number> {
  const tracked = readTracked();
  if (tracked.size === 0) throw new Error(`${DATA_DIR} içinde dönem dosyası yok`);
  const trackedInfos = [...tracked.values()].map((t) => parseTermLabel(t.termLabel));
  const newest = trackedInfos.sort(compareTerms).at(-1)!;

  const options = await fetchTermOptions();
  // İzlenen dönemler ve izlenenlerden yeni olanlar; eskiden yeniye.
  const candidates = options.terms
    .map((o) => ({ code: o.value, info: termFromOption(o) }))
    .filter((c): c is { code: string; info: TermInfo } => c.info !== null)
    .filter((c) => tracked.has(c.info.id) || compareTerms(c.info, newest) > 0)
    .sort((a, b) => compareTerms(a.info, b.info));
  for (const id of tracked.keys()) {
    if (!candidates.some((c) => c.info.id === id)) console.log(`${id}: sayfanın dönem listesinde yok, atlandı.`);
  }

  const fetchedAt = new Date().toISOString();
  const totals: MergeReport[] = [];
  const messages: string[] = [];
  let failed = false;
  let changedFiles = 0;

  for (const cand of candidates) {
    await sleep(delayMs);
    console.log(`${cand.info.label} (${cand.code}) getiriliyor...`);
    const offerings = await fetchTermOfferings(cand.code, { delayMs, log: verbose ? console.log : undefined });
    if (!offerings) {
      console.log(`${cand.info.id}: sayfada ders yok (henüz yayında değil), dokunulmadı.`);
      continue;
    }
    const sections = offerings.courses.reduce((n, c) => n + c.sections.length, 0);
    console.log(`${cand.info.id}: ${offerings.programs.length} program, ${offerings.courses.length} ders, ${sections} şube okundu.`);
    if (offerings.warnings.length) console.log(`  Uyarılar (${offerings.warnings.length}): ${offerings.warnings.slice(0, 5).join("; ")}`);

    const file = path.join(DATA_DIR, `${cand.info.id}.json`);
    const previous = tracked.get(cand.info.id) ?? null;
    let next: TermData;
    let report: MergeReport;

    if (previous) {
      ({ term: next, report } = mergeOfferings(previous, offerings.courses, { fetchedAt }));
      printReport(report);
      if (report.refusal) {
        console.error(`${cand.info.id}: YAZILMADI: ${report.refusal}`);
        failed = true;
        continue;
      }
    } else {
      const hasTimes = offerings.courses.some((c) => c.sections.some((s) => s.meetings.length > 0));
      if (!hasTimes) {
        console.log(`${cand.info.id}: yeni dönem ama saatler yok, dosya oluşturulmadı.`);
        continue;
      }
      next = { schoolId: "ozyegin", termId: cand.info.id, termLabel: cand.info.label, fetchedAt, courses: offerings.courses };
      report = {
        addedCourses: next.courses.map((c) => c.code),
        removedCourses: [],
        keptVerified: [],
        addedSections: next.courses.flatMap((c) => c.sections.map((s) => `${c.code}.${s.id}`)),
        removedSections: [],
        timeChanges: [],
        instructorChanges: [],
        titleChanges: [],
        keptOutOfScope: 0,
        foundRatio: 1,
        refusal: null,
      };
      console.log(`${cand.info.id}: yeni dönem dosyası (${next.courses.length} ders).`);
    }

    const errors = validateTermData(next, previous);
    if (errors.length > 0) {
      console.error(`${cand.info.id}: doğrulama başarısız, YAZILMADI:\n- ${errors.slice(0, 20).join("\n- ")}`);
      failed = true;
      continue;
    }
    if (previous && (sameContent(previous, next) || !hasChanges(report))) {
      console.log(`${cand.info.id}: değişiklik yok.`);
      continue;
    }
    totals.push(report);
    changedFiles++;
    const parts = countParts(report);
    messages.push(`${cand.info.label}: ${previous ? parts.join(", ") : "yeni dönem"}`);
    if (dryRun) {
      console.log(`${cand.info.id}: --dry-run, ${file} yazılmadı.`);
    } else {
      fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
      console.log(`${cand.info.id}: ${file} yazıldı.`);
    }
  }

  const merged = {
    addedCourses: totals.flatMap((r) => r.addedCourses),
    removedCourses: totals.flatMap((r) => r.removedCourses),
    keptVerified: totals.flatMap((r) => r.keptVerified),
    addedSections: totals.flatMap((r) => r.addedSections),
    removedSections: totals.flatMap((r) => r.removedSections),
    timeChanges: totals.flatMap((r) => r.timeChanges),
    instructorChanges: totals.flatMap((r) => r.instructorChanges),
    titleChanges: totals.flatMap((r) => r.titleChanges),
  };
  const counts = countParts(merged).join(", ");
  const summary =
    changedFiles === 0
      ? `Açılan dersler: değişiklik yok${failed ? " (bazı dönemler hatalı, yazılmadı)" : ""}.`
      : `Açılan dersler güncellendi${dryRun ? " (deneme, yazılmadı)" : ""}: ${messages.join("; ")}${failed ? " (bazı dönemler hatalı)" : ""}.`;
  console.log(`\n${summary}`);
  writeGithub(summary, changedFiles > 0 && !dryRun);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `counts=${counts}\n`);
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`Güncelleme başarısız: ${(err as Error).stack ?? err}`);
    process.exit(1);
  },
);
