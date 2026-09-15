// Ders sayfası ön koşul zinciri (sunucu bileşeni, istemci durumu yok):
// solda önce alınması gerekenler, ortada ders, sağda önünü açtığı dersler.
import Link from "next/link";
import { buildCourseChain } from "@/lib/prereq-graph/graph";
import type { ChainLevel, GraphNode } from "@/lib/prereq-graph/types";
import type { Program, TermData } from "@/lib/types";
import { codeKey, splitVisible } from "@/components/roadmap/prereq-map-helpers";

interface Props {
  code: string;
  programs: Program[];
  terms: TermData[];
  /** Ders sayfaları bu dönemin dersleri için üretilir; bağlantı yalnızca onlara verilir. */
  currentTerm: TermData;
  depth?: number;
}

const LEVEL_CAP = 8;

// Derlemede yüzlerce sayfa aynı dönem nesnesini kullanır: kod -> adres dizini bir kez kurulur.
const slugIndexCache = new WeakMap<TermData, Map<string, string>>();
function slugIndex(term: TermData): Map<string, string> {
  let index = slugIndexCache.get(term);
  if (!index) {
    index = new Map(term.courses.map((c) => [codeKey(c.code), c.slug]));
    slugIndexCache.set(term, index);
  }
  return index;
}

function levelLabel(depth: number): string {
  return depth === 1 ? "Doğrudan" : `${depth}. adım`;
}

type Unit =
  | { type: "one"; node: GraphNode; kind: "and" | "or" }
  | { type: "either"; via: string; group: number | null; nodes: GraphNode[] };

/** Ön koşul tarafında aynı dersin seçenekleri tek grupta ("ya da"); diğerleri tek tek. */
function unitsOf(level: ChainLevel, groupOr: boolean): Unit[] {
  const units: Unit[] = [];
  const seen = new Set<string>();
  const groups = new Map<string, Extract<Unit, { type: "either" }>>();
  for (const it of level.items) {
    if (seen.has(it.node.code)) continue;
    seen.add(it.node.code);
    if (groupOr && it.kind === "or") {
      // Aynı dersin koşulundaki farklı seçenek grupları ayrı kutular: (A ya da B) ve (C ya da D).
      const key = `${it.via}|${it.group ?? "?"}`;
      let g = groups.get(key);
      if (!g) {
        g = { type: "either", via: it.via, group: it.group, nodes: [] };
        groups.set(key, g);
        units.push(g);
      }
      g.nodes.push(it.node);
    } else {
      units.push({ type: "one", node: it.node, kind: it.kind });
    }
  }
  // Tek seçenekli grup, düz öğe olarak gösterilir.
  return units.map((u) => (u.type === "either" && u.nodes.length === 1 ? { type: "one", node: u.nodes[0], kind: "or" } : u));
}

function Pill({ node, slugs, dashed }: { node: GraphNode; slugs: Map<string, string>; dashed?: boolean }) {
  const slug = slugs.get(codeKey(node.code));
  const inner = (
    <>
      <span className="pc-code num">{node.code}</span>
      {node.title && <span className="pc-name">{node.title}</span>}
      {dashed && <span className="sr-only"> (seçeneklerden biri olarak)</span>}
    </>
  );
  const cls = `pc-pill${dashed ? " is-or" : ""}`;
  return slug ? (
    <Link href={`/ozyegin/${slug}`} className={cls} title={`${node.code} ${node.title}`.trim()}>
      {inner}
    </Link>
  ) : (
    <span className={cls} title={`${node.code} ${node.title}`.trim()}>
      {inner}
    </span>
  );
}

function UnitView({ unit, slugs, side }: { unit: Unit; slugs: Map<string, string>; side: "requires" | "unlocks" }) {
  if (unit.type === "one") {
    return (
      <li className="pc-item">
        <Pill node={unit.node} slugs={slugs} dashed={unit.kind === "or"} />
      </li>
    );
  }
  return (
    <li className="pc-item pc-either">
      <span className="pc-either-label">{side === "requires" ? `${unit.via} için ${unit.group ? "ayrıca " : ""}biri yeter` : "Biri yeter"}</span>
      <ul className="pc-either-list">
        {unit.nodes.map((n, i) => (
          <li key={n.code} className="pc-either-row">
            {i > 0 && <span className="pc-or">ya da</span>}
            <Pill node={n} slugs={slugs} dashed />
          </li>
        ))}
      </ul>
    </li>
  );
}

function LevelView({
  level,
  slugs,
  side,
}: {
  level: ChainLevel;
  slugs: Map<string, string>;
  side: "requires" | "unlocks";
}) {
  const units = unitsOf(level, side === "requires");
  const { visible, hidden } = splitVisible(units, LEVEL_CAP);
  const hiddenCount = hidden.reduce((n, u) => n + (u.type === "one" ? 1 : u.nodes.length), 0);
  const key = (u: Unit) => (u.type === "one" ? u.node.code : `or:${u.via}:${u.group ?? "?"}`);
  return (
    <div className="pc-level">
      <h4 className="pc-level-title">{levelLabel(level.depth)}</h4>
      <ul className="pc-items">
        {visible.map((u) => (
          <UnitView key={key(u)} unit={u} slugs={slugs} side={side} />
        ))}
      </ul>
      {hidden.length > 0 && (
        <details className="pc-more">
          <summary>+{hiddenCount} ders daha</summary>
          <ul className="pc-items">
            {hidden.map((u) => (
              <UnitView key={key(u)} unit={u} slugs={slugs} side={side} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PrereqChain({ code, programs, terms, currentTerm, depth = 3 }: Props) {
  const chain = buildCourseChain(code, programs, terms, depth);
  const requires = chain.requires.filter((l) => l.items.length > 0);
  const unlocks = chain.unlocks.filter((l) => l.items.length > 0);

  if (requires.length === 0 && unlocks.length === 0) {
    return (
      <section className="pc pc-empty" aria-labelledby="pc-title">
        <h2 className="group-title pc-title" id="pc-title">
          Ön koşul zinciri
        </h2>
        <p className="hint">Bu dersin ön koşulu yok ve başka bir derse ön koşul değil.</p>
      </section>
    );
  }

  const slugs = slugIndex(currentTerm);
  // Ön koşullarda en uzaktaki adım önce gelir: okuma sırası alınma sırasıyla aynı olur.
  const requiresOrdered = [...requires].sort((a, b) => b.depth - a.depth);

  return (
    <section className="pc" aria-labelledby="pc-title">
      <h2 className="group-title pc-title" id="pc-title">
        Ön koşul zinciri
      </h2>
      <p className="hint pc-lede">Kesik çerçeveli dersler seçeneklerden biri; hepsini almak gerekmez.</p>
      <div className="pc-grid">
        <div className="pc-col pc-requires">
          <h3 className="rm-h3 pc-col-title">Önce alınması gerekenler</h3>
          {requiresOrdered.length === 0 ? (
            <p className="hint">Ön koşulu yok.</p>
          ) : (
            requiresOrdered.map((l) => <LevelView key={l.depth} level={l} slugs={slugs} side="requires" />)
          )}
        </div>

        <div className="pc-col pc-center">
          <span className="pc-arrow" aria-hidden="true">
            →
          </span>
          <div className="pc-self hl-0">
            <span className="pc-code num">{chain.node.code}</span>
            {chain.node.title && <span className="pc-name">{chain.node.title}</span>}
            {chain.node.minEcts !== null && <span className="pc-ects num">En az {chain.node.minEcts} AKTS</span>}
          </div>
          <span className="pc-arrow" aria-hidden="true">
            →
          </span>
        </div>

        <div className="pc-col pc-unlocks">
          <h3 className="rm-h3 pc-col-title">Önünü açtığı dersler</h3>
          {unlocks.length === 0 ? (
            <p className="hint">Başka bir derse ön koşul değil.</p>
          ) : (
            unlocks.map((l) => <LevelView key={l.depth} level={l} slugs={slugs} side="unlocks" />)
          )}
        </div>
      </div>
      {chain.node.unreadable && (
        <p className="hint pc-note">? Ön koşul metninin bir kısmı okunamadı. Kesin bilgi için SIS&apos;e bak.</p>
      )}
    </section>
  );
}
