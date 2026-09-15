// Ön şart diyagramı sayfası (/ozyegin/on-sart-diyagrami) için sözleşme: dönemler satır, dersler kutu.
// Uygulama: src/lib/prereq-graph/rows-layout.ts ve src/lib/prereq-graph/chain-state.ts (bu dosyada yalnızca tipler).
import type { EdgeKind } from "./types";

export type RowNodeKind = "course" | "elective";

export interface RowNode {
  /** Kalıcı id: ders için kanonik kod ("CS 201"); seçmeli için yol haritası gereksinim id'si ("BSCS:y3-guz:4"). */
  id: string;
  kind: RowNodeKind;
  /** Satır anahtarı: "y1-guz". */
  row: string;
  /** Ders kodu; seçmelide seçilen dersin kodu ya da null. */
  code: string | null;
  /** Ders adı; seçmelide seçmeli etiketi ("BSCS Program-İçi Seçmeli") ya da seçilen dersin adı. */
  title: string;
  credits: number | null;
  /** Seçmeli havuzu (kind "elective"); null = serbest seçmeli. */
  pool: { code: string; title: string; credits: number | null }[] | null;
  prerequisiteText: string;
  unreadable: boolean;
  minEcts: number | null;
}

export interface RowEdge {
  from: string; // RowNode.id
  to: string;   // RowNode.id
  kind: EdgeKind;
  group: number | null;
}

export interface RowsModel {
  rows: { key: string; label: string; year: number; season: "guz" | "bahar" | "yaz" | "other" }[];
  nodes: RowNode[];
  edges: RowEdge[];
}

export interface RowsLayout {
  width: number;
  height: number;
  rows: { key: string; label: string; y: number; h: number }[];
  nodes: { id: string; x: number; y: number; w: number; h: number }[];
  edges: { from: string; to: string; kind: EdgeKind; path: string }[];
}

/*
 * rows-layout.ts dışa aktarır:
 *   buildRowsModel(program: Program, terms: TermData[], electiveChoices: Record<string, string>): RowsModel
 *     // Satırlar müfredat sırasıyla (Hazırlık dahil, boş satır yok). Her "course" kalemi bir düğüm (aynı kod tekrar ederse ilki),
 *     // her "elective" kalemi bir düğüm (id = requirement id; programRequirements ile aynı id biçimi: `${program.id}:y${year}-${season}:${index}`).
 *     // electiveChoices[id] = seçilen havuz kodu -> düğümün code/title/credits/prerequisiteText o derse göre, ve kenarları hesaba girer.
 *     // Kenarlar: ön koşul metnindeki kodlar (roadmap/prereq.ts parse) -> programdaki bir düğüm (ders kodu ya da seçimi o kod olan seçmeli).
 *     // Kind/group: prereq-graph/graph.ts'teki gibi ("or" grupları ayrı numaralı).
 *   layoutRows(model: RowsModel, opts?: { width?: number; nodeW?: number; nodeH?: number; gapX?: number; rowPadY?: number; rowGap?: number; labelW?: number }):
 *     RowsLayout
 *     // Varsayılan nodeW 112, nodeH 64, gapX 14, rowPadY 16, rowGap 14, labelW 96 (sol tarafta satır etiketi alanı).
 *     // Her satırın düğümleri satır içinde ORTALANIR; genişlik = max(opts.width, en kalabalık satır). Satır içi sıra: önce müfredat sırası,
 *     // sonra kesişimi azaltmak için yukarıdaki satıra göre barycenter (3 tur, kararlı).
 *     // Kenar yolu: kaynak kutunun alt ortasından hedefin üst ortasına dikey kübik eğri ("M x y C ..."); aynı satırdaysa yandan kavis.
 *
 * chain-state.ts dışa aktarır (saf; React yok):
 *   type Mode = "taken" | "plan" | "chain"
 *   closePrereqs(model, id): Set<string>      // id'nin bütün ön koşulları (dolaylı). "or" grubundan: zaten alınmış biri varsa ek yok,
 *                                             // yoksa gruptaki ilk düğüm (müfredatta önce gelen) seçilir.
 *   dependents(model, id): Set<string>        // id'yi doğrudan/dolaylı gerektiren düğümler
 *   toggleTaken(model, taken: Set<string>, id): Set<string>
 *     // eklerken closePrereqs ile ön koşulları da ekler (aynı satırdaki ön koşullar hariç — ITU örneğindeki gibi);
 *     // çıkarırken ona dayanan (bağımlı ve başka seçenekle karşılanmayan) alınmış düğümleri de çıkarır.
 *   toggleRow(model, taken, rowKey): Set<string>   // satırın hepsi alınmışsa hepsini çıkarır, değilse hepsini (ön koşullarıyla) ekler
 *   takeable(model, taken): Set<string>       // alınmamış ve her "and" ön koşulu alınmış, her "or" grubundan biri alınmış düğümler
 *                                             // (program dışı ön koşullar yok sayılır; minEcts yok sayılır)
 *   chainOf(model, id): { ancestors: Set<string>; descendants: Set<string>; edges: Set<string> } // edges: "from>to"
 */
