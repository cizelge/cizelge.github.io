interface Props {
  critical: { code: string; blocks: string[] }[];
  unreadable: { requirementId: string; code: string; text: string }[];
}

function waitingText({ code, blocks }: { code: string; blocks: string[] }): string {
  const [first, ...rest] = blocks;
  return rest.length > 0 ? `${code}: ${first} ve ona bağlı ${rest.length} ders bekliyor.` : `${code}: ${first} bekliyor.`;
}

export function PrereqWarnings({ critical, unreadable }: Props) {
  // Aynı ders anadal ve çift anadalda ayrı gereksinim olabilir; bir kez gösterilir.
  const seen = new Set<string>();
  const uniqueUnreadable = unreadable.filter((u) => (seen.has(u.code) ? false : (seen.add(u.code), true)));

  if (critical.length === 0 && uniqueUnreadable.length === 0) return null;

  return (
    <section aria-labelledby="rm-uyari" className="rm-warnings">
      <h2 className="group-title rm-h2" id="rm-uyari">
        Ön koşul uyarıları
      </h2>
      {critical.length > 0 && (
        <div className="rm-warn-block">
          <h3 className="rm-h3">Kritik dersler</h3>
          <p className="hint">Bunları geciktirirsen arkalarındaki dersler de kayar.</p>
          <ul className="rm-list">
            {critical.map((c) => (
              <li key={c.code} className="num">
                {waitingText(c)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {uniqueUnreadable.length > 0 && (
        <details className="rm-more">
          <summary>
            Koşulu okunamayan dersler <span className="num">({uniqueUnreadable.length})</span>
          </summary>
          <p className="hint">Plan bu dersleri koşulu sağlanıyor sayarak yerleştirdi. SIS&apos;ten kontrol et.</p>
          <ul className="rm-list">
            {uniqueUnreadable.map((u) => (
              <li key={u.requirementId}>
                <span className="rm-req-code num">{u.code}</span> <span className="hint">{u.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
