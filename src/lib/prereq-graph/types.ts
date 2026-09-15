// Ön koşul diyagramı: parçalar arasındaki ortak sözleşme.
// Mantık: src/lib/prereq-graph/graph.ts (+ layout.ts). Arayüz: yol haritasında program haritası, ders sayfasında zincir.
// Ön koşul metinleri src/lib/roadmap/prereq.ts ile okunur (parsePrerequisite).

export type EdgeKind = "and" | "or";

export interface GraphNode {
  /** Kanonik ders kodu: "CS 201". */
  code: string;
  title: string;
  credits: number | null;
  /** Müfredattaki yer (program haritasında sütun); program dışı derslerde null. */
  slot: { year: number; season: "guz" | "bahar" | "yaz" | "other" } | null;
  /** Ön koşul metninde okunamayan kısım var. */
  unreadable: boolean;
  /** Ham ön koşul metni ("" yok). */
  prerequisiteText: string;
  /** Ek AKTS şartı (ör. "en az 90 AKTS"), yoksa null. */
  minEcts: number | null;
}

export interface GraphEdge {
  /** Ön koşul olan ders. */
  from: string;
  /** Onu gerektiren ders. */
  to: string;
  /** "or": alternatiflerden biri yeter (kesik çizgi). "and": zorunlu. */
  kind: EdgeKind;
  /** "or" kenarlarında hedefin koşulundaki seçenek grubu (0, 1, ...): aynı gruptakilerden biri yeter,
   *  farklı gruplardan birer ders gerekir. "and" kenarında null. */
  group: number | null;
}

export interface PrereqGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

/*
 * graph.ts dışa aktarır:
 *   buildProgramGraph(program: Program, terms: TermData[]): PrereqGraph
 *     // düğümler: programdaki "course" kalemleri (seçmeliler hariç). Ön koşul metni kalemden, boşsa dönem verisinden.
 *     // kenarlar: yalnızca iki ucu da programda olan dersler arası. Program dışı ön koşul kodları
 *     // `external` olarak düğüme eklenmez; bunun yerine GraphNode.prerequisiteText'te kalır.
 *     // "or" grubundaki her kod "or" kenarı, "and" altındakiler "and" kenarı olur (iç içe or içindeki and -> "or").
 *   buildCourseChain(code: string, programs: Program[], terms: TermData[], depth = 3):
 *     { node: GraphNode; requires: ChainLevel[]; unlocks: ChainLevel[] }
 *     // requires: code'un ön koşulları, sonra onların ön koşulları... (seviye seviye, depth kadar);
 *     // unlocks: code'u ön koşul olarak isteyen dersler (bütün programlar + dönem verisi), seviye seviye.
 *   ancestors(graph, code): Set<string>; descendants(graph, code): Set<string>
 *
 * layout.ts dışa aktarır:
 *   layoutProgramGraph(graph: PrereqGraph, opts?: { nodeWidth?: number; nodeHeight?: number; colGap?: number; rowGap?: number }):
 *     { width: number; height: number;
 *       columns: { key: string; label: string; x: number }[];          // "1. yıl Güz" ...; Hazırlık/yaz/diğer de sütun
 *       nodes: { code: string; x: number; y: number; w: number; h: number }[];
 *       edges: { from: string; to: string; kind: EdgeKind; path: string }[] }  // SVG path "M..C..."
 *     // Sütunlar slot sırasına göre; sütun içi sıra kenar kesişimini azaltmak için barycenter ile (birkaç tur, deterministik).
 *     // Aynı sütundaki dersler arası kenar olursa kavisli yan yol çizilir.
 */

export interface ChainLevel {
  depth: number;                   // 1 = doğrudan
  /** via: bir önceki seviyedeki ders. group: "or" ise via'nın koşulundaki seçenek grubu (requires tarafında), yoksa null. */
  items: { node: GraphNode; kind: EdgeKind; via: string; group: number | null }[];
}
