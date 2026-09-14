// Yatay geçiş ve çift anadal uygunluğu. Saf mantık, React/DOM yok.
// Kurallar Özyeğin'in kurum içi yatay geçiş, Ek Madde-1 ve Çift Anadal sayfalarından;
// sayılar veri dosyasının `rules` alanından okunur.
import type {
  Check,
  CheckStatus,
  PathResult,
  QuotaByYear,
  StudentProfile,
  TransferData,
  TransferProgram,
} from "./types";

type YearLevel = keyof QuotaByYear;

// Türkçe sayı yazımı: 2,72 / 125.000 / 450,12345
const fmtNum = (n: number, maxDigits = 5) => n.toLocaleString("tr-TR", { maximumFractionDigits: maxDigits });
const fmtGpa = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const levelLabel = (l: YearLevel) => (l === "hazirlik" ? "hazırlık" : `${l}. sınıf`);

/** Bir fail varsa fail; yoksa bir unknown varsa unknown; hepsi ok ise ok. */
function aggregate(checks: readonly Check[]): CheckStatus {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "unknown")) return "unknown";
  return "ok";
}

function result(path: PathResult["path"], checks: Check[], quota: number | null, scoreMargin: number | null): PathResult {
  return { path, status: aggregate(checks), checks, quota, scoreMargin };
}

/** Tamamlanan döneme göre geçilecek sınıf: 2-3 dönem -> 2, 4-5 -> 3, 6-7 -> 4; aksi halde null. */
export function targetYearLevel(profile: StudentProfile): "2" | "3" | "4" | null {
  const s = profile.completedSemesters;
  if (s === null || s < 2 || s > 7) return null;
  return String(Math.floor(s / 2) + 1) as "2" | "3" | "4";
}

// Kontenjan kontrolü: tablo yok / sınıf düzeyi yok -> unknown, 0 -> fail.
function quotaCheck(table: QuotaByYear | null, level: YearLevel | null): { check: Check; quota: number | null } {
  if (level === null) {
    return { check: { id: "quota", status: "unknown", text: "Geçeceğin sınıf belli değil; tamamladığın dönem sayısını gir." }, quota: null };
  }
  if (table === null) {
    return { check: { id: "quota", status: "unknown", text: "Bu dönem için kontenjan yayınlanmamış." }, quota: null };
  }
  const q = table[level];
  if (q === undefined) {
    return { check: { id: "quota", status: "unknown", text: `${levelLabel(level)} için kontenjan veride yok.` }, quota: null };
  }
  if (q <= 0) {
    return { check: { id: "quota", status: "fail", text: `${levelLabel(level)} için kontenjan yok (0).` }, quota: 0 };
  }
  return { check: { id: "quota", status: "ok", text: `${levelLabel(level)} için ${fmtNum(q)} kişilik kontenjan var.` }, quota: q };
}

// Kayıt yılına göre zorunlu başarı sırası şartları (yatay geçiş yolları). Hepsi sağlanmalı.
function requiredRankChecks(rules: TransferProgram["internalRankRules"], profile: StudentProfile): Check[] {
  if (rules.length === 0) return [];
  const y = profile.entryYear;
  if (y === null) {
    return [{ id: "rank", status: "unknown", text: "Bu bölümde kayıt yılına göre başarı sırası şartı var; kayıt yılını gir." }];
  }
  const applicable = rules.filter((r) => (r.fromYear === null || y >= r.fromYear) && (r.toYear === null || y <= r.toYear));
  return applicable.map((r): Check => {
    const need = `${r.scoreType} türünde en az ${fmtNum(r.maxRank)}. sıra gerekiyor`;
    if (profile.rank === null || (profile.scoreType !== null && profile.scoreType !== r.scoreType)) {
      return { id: "rank", status: "unknown", text: `${y} kayıtlılarda ${need}; ${r.scoreType} başarı sıranı gir.` };
    }
    return profile.rank <= r.maxRank
      ? { id: "rank", status: "ok", text: `Başarı sıran ${fmtNum(profile.rank)}; ${need}.` }
      : { id: "rank", status: "fail", text: `Başarı sıran ${fmtNum(profile.rank)}; ${need}.` };
  });
}

/** Kurum içi (başarıya göre) yatay geçiş. */
export function evaluateInternal(target: TransferProgram, profile: StudentProfile, data: TransferData): PathResult {
  const { min, max } = data.rules.internalSemesters;
  const checks: Check[] = [];

  const s = profile.completedSemesters;
  if (s === null) {
    checks.push({ id: "semesters", status: "unknown", text: "Tamamladığın dönem sayısını gir (hazırlık ve yaz hariç)." });
  } else if (s < min) {
    checks.push({ id: "semesters", status: "fail", text: `En az ${min} dönem okumuş olmalısın, ${s} dönem tamamladın.` });
  } else if (s > max) {
    checks.push({ id: "semesters", status: "fail", text: `En fazla ${max} dönem okumuş olabilirsin, ${s} dönem tamamladın.` });
  } else {
    checks.push({ id: "semesters", status: "ok", text: `${s} dönem tamamladın; ${min} ile ${max} arası olmalı.` });
  }

  if (profile.scoreType !== null && target.scoreType !== null && profile.scoreType !== target.scoreType) {
    checks.push({
      id: "scoreType",
      status: "fail",
      text: `Puan türün farklı: bölüm ${target.scoreType}, senin puan türün ${profile.scoreType}.`,
    });
  }
  // Eşdeğer programların taban puanı veride yok: her zaman unknown.
  checks.push({
    id: "score",
    status: "unknown",
    text: "Türkiye'deki eşdeğer programların en düşük taban puanı bu sitede yok; ÖSYM/YÖK Atlas'tan kontrol et.",
  });

  checks.push(...requiredRankChecks(target.internalRankRules, profile));

  const { check, quota } = quotaCheck(target.internalQuota, targetYearLevel(profile));
  checks.push(check);

  if (target.notes.length > 0) {
    checks.push({ id: "notes", status: "unknown", text: "Bölüme özel ek koşullar var; aşağıdaki notları oku." });
  }
  return result("internal", checks, quota, null);
}

/** Hedefin o yılki Özyeğin en düşük yerleşme puanı (tüm burs türleri); veri yoksa null. */
function lowestBaseScore(target: TransferProgram, year: number): number | null {
  const scores = target.baseScores.filter((b) => b.year === year && b.minScore !== null).map((b) => b.minScore as number);
  return scores.length > 0 ? Math.min(...scores) : null;
}

/** Merkezi yerleştirme puanı ile yatay geçiş (Ek Madde-1). */
export function evaluateCentral(target: TransferProgram, profile: StudentProfile, _data: TransferData): PathResult {
  void _data; // imza diğer yollarla aynı kalsın diye; bu yolda kural verisi gerekmiyor
  const checks: Check[] = [];
  let scoreMargin: number | null = null;

  let typeMismatch = false;
  if (target.scoreType === null) {
    checks.push({ id: "scoreType", status: "unknown", text: "Bölümün puan türü veride yok." });
  } else if (profile.scoreType === null) {
    checks.push({ id: "scoreType", status: "unknown", text: "Puan türünü gir." });
  } else if (profile.scoreType !== target.scoreType) {
    typeMismatch = true;
    checks.push({
      id: "scoreType",
      status: "fail",
      text: `Puan türün farklı: bölüm ${target.scoreType}, senin puan türün ${profile.scoreType}.`,
    });
  } else {
    checks.push({ id: "scoreType", status: "ok", text: `Puan türün aynı (${target.scoreType}).` });
  }

  // Puan türü farklıysa puan karşılaştırması anlamsız.
  if (!typeMismatch) {
    const year = profile.entryYear;
    if (year === null) {
      checks.push({ id: "score", status: "unknown", text: "YKS ile yerleştiğin yılı gir." });
    } else {
      const base = lowestBaseScore(target, year);
      if (base === null) {
        checks.push({ id: "score", status: "unknown", text: `${year} taban puanı veride yok.` });
      } else if (profile.score === null) {
        checks.push({ id: "score", status: "unknown", text: `${year} yerleşme puanını gir; bölümün o yılki tabanı ${fmtNum(base)}.` });
      } else {
        if (profile.scoreType !== null && profile.scoreType === target.scoreType) scoreMargin = profile.score - base;
        checks.push(
          profile.score >= base
            ? { id: "score", status: "ok", text: `Puanın ${fmtNum(profile.score)}; ${year} tabanı ${fmtNum(base)}.` }
            : { id: "score", status: "fail", text: `Puanın ${fmtNum(profile.score)}; ${year} tabanı ${fmtNum(base)}, altında kalıyor.` },
        );
      }
    }
  }

  checks.push(...requiredRankChecks(target.centralRankRules, profile));

  // Ek Madde-1'de hazırlık ve 1. sınıfa da geçilebilir.
  const s = profile.completedSemesters;
  const level: YearLevel | null = s !== null && s <= 1 ? "1" : targetYearLevel(profile);
  const { check, quota } = quotaCheck(target.centralQuota, level);
  checks.push(check);

  return result("central", checks, quota, scoreMargin);
}

// "İlk %20" yerine geçen başarı sırası kuralı: ok / fail / unknown.
function rankRuleStatus(rule: TransferProgram["capRankRules"][number], profile: StudentProfile): CheckStatus {
  const parts: CheckStatus[] = [];
  if (rule.fromYear !== null || rule.toYear !== null) {
    const y = profile.entryYear;
    if (y === null) parts.push("unknown");
    else parts.push((rule.fromYear === null || y >= rule.fromYear) && (rule.toYear === null || y <= rule.toYear) ? "ok" : "fail");
  }
  parts.push(profile.scoreType === null ? "unknown" : profile.scoreType === rule.scoreType ? "ok" : "fail");
  parts.push(profile.rank === null ? "unknown" : profile.rank <= rule.maxRank ? "ok" : "fail");
  return aggregate(parts.map((status) => ({ id: "", status, text: "" })));
}

/** Çift anadal (ÇAP) başvurusu. */
export function evaluateCap(target: TransferProgram, profile: StudentProfile, data: TransferData): PathResult {
  const { capMinGpa, capSemesters, capCreditsBySemester } = data.rules;
  const checks: Check[] = [];

  if (target.programId !== null && target.programId === profile.programId) {
    checks.push({ id: "self", status: "fail", text: "Bu zaten kendi bölümün." });
  }
  checks.push(
    target.capOpen
      ? { id: "open", status: "ok", text: "Bölüm çift anadal öğrencisi alıyor." }
      : { id: "open", status: "fail", text: "Bu bölüm çift anadal öğrencisi almıyor." },
  );

  if (profile.gpa === null) {
    checks.push({ id: "gpa", status: "unknown", text: `Ortalamanı gir. En az ${fmtGpa(capMinGpa)} gerekiyor.` });
  } else if (profile.gpa >= capMinGpa) {
    checks.push({ id: "gpa", status: "ok", text: `Ortalaman ${fmtGpa(profile.gpa)}; en az ${fmtGpa(capMinGpa)} gerekiyor.` });
  } else {
    checks.push({ id: "gpa", status: "fail", text: `Ortalaman ${fmtGpa(profile.gpa)}; en az ${fmtGpa(capMinGpa)} gerekiyor.` });
  }

  // Başvuru, tamamlanan dönemden sonraki dönemin başında yapılır.
  const s = profile.completedSemesters;
  const semester = s === null ? null : s + 1;
  if (semester === null) {
    checks.push({ id: "semesters", status: "unknown", text: "Tamamladığın dönem sayısını gir (hazırlık ve yaz hariç)." });
  } else if (semester < capSemesters.min || semester > capSemesters.max) {
    checks.push({
      id: "semesters",
      status: "fail",
      text: `Başvuru ${capSemesters.min}. ile ${capSemesters.max}. dönemin başında yapılır; sen ${semester}. dönemdesin.`,
    });
  } else {
    checks.push({ id: "semesters", status: "ok", text: `${semester}. dönemin başında başvurabilirsin.` });
  }

  const creditRule = semester === null ? undefined : capCreditsBySemester.find((r) => r.semester === semester);
  if (semester === null) {
    checks.push({ id: "credits", status: "unknown", text: "AKTS şartı döneme göre değişiyor; dönem sayını gir." });
  } else if (creditRule === undefined) {
    checks.push({ id: "credits", status: "unknown", text: `${semester}. dönem için AKTS şartı veride yok.` });
  } else if (profile.completedCredits === null) {
    checks.push({ id: "credits", status: "unknown", text: `Tamamladığın AKTS'yi gir. ${fmtNum(creditRule.minCredits)} AKTS gerekiyor.` });
  } else if (profile.completedCredits >= creditRule.minCredits) {
    checks.push({
      id: "credits",
      status: "ok",
      text: `${fmtNum(creditRule.minCredits)} AKTS gerekiyor, ${fmtNum(profile.completedCredits)} AKTS tamamladın.`,
    });
  } else {
    checks.push({
      id: "credits",
      status: "fail",
      text: `${fmtNum(creditRule.minCredits)} AKTS gerekiyor, ${fmtNum(profile.completedCredits)} AKTS tamamladın.`,
    });
  }

  if (profile.hasFailedCourse === null) {
    checks.push({ id: "failed", status: "unknown", text: "Kaldığın (F) ders olup olmadığını işaretle." });
  } else if (profile.hasFailedCourse) {
    checks.push({ id: "failed", status: "fail", text: "Kaldığın bir ders var; başvuru için kaldığın ders olmamalı." });
  } else {
    checks.push({ id: "failed", status: "ok", text: "Kaldığın ders yok." });
  }

  // İlk %20 ya da başarı sırası kurallarından biri yeterli.
  const ruleStatuses = target.capRankRules.map((r) => rankRuleStatus(r, profile));
  if (profile.top20 === true) {
    checks.push({ id: "rank", status: "ok", text: "Sınıfının ilk %20'sindesin." });
  } else if (ruleStatuses.includes("ok")) {
    const rule = target.capRankRules[ruleStatuses.indexOf("ok")];
    checks.push({ id: "rank", status: "ok", text: `Başarı sıran şartı karşılıyor: ${rule.text}` });
  } else if (profile.top20 === false && !ruleStatuses.includes("unknown")) {
    checks.push({
      id: "rank",
      status: "fail",
      text:
        target.capRankRules.length > 0
          ? "İlk %20'de değilsin ve başarı sırası şartlarını da karşılamıyorsun."
          : "Sınıfının ilk %20'sinde olman gerekiyor.",
    });
  } else {
    checks.push({
      id: "rank",
      status: "unknown",
      text:
        profile.top20 === null
          ? "Sınıfının ilk %20'sinde olup olmadığını gir."
          : "Başarı sırası şartı için puan türünü, sıranı ve kayıt yılını gir.",
    });
  }

  return result("cap", checks, null, null);
}

const collator = new Intl.Collator("tr");
const statusRank = (a: PathResult, b: PathResult) =>
  a.status === "ok" || b.status === "ok" ? 0 : a.status === "unknown" || b.status === "unknown" ? 1 : 2;

/** Tüm hedef programlar; öğrencinin kendi programı hariç. ÇAP/kurum içi ok olanlar önce, sonra unknown, sonra ada göre. */
export function evaluateAll(
  profile: StudentProfile,
  data: TransferData,
): { program: TransferProgram; internal: PathResult; central: PathResult; cap: PathResult }[] {
  return data.programs
    .filter((p) => p.programId === null || p.programId !== profile.programId)
    .map((program) => ({
      program,
      internal: evaluateInternal(program, profile, data),
      central: evaluateCentral(program, profile, data),
      cap: evaluateCap(program, profile, data),
    }))
    .sort((a, b) => statusRank(a.cap, a.internal) - statusRank(b.cap, b.internal) || collator.compare(a.program.name, b.program.name));
}
