// Özyeğin "Açılan Dersler" ekranındaki sonuç ızgarasını ham JSON olarak dışa aktarır (biçim v2).
//
// Kullanım: normal tarayıcıda ekranı açın, dönemi seçip arama yapın, sonra bu dosyanın tüm içeriğini
// geliştirici konsoluna yapıştırıp Enter'a basın. Izgara sanal kaydırmalıdır (yalnızca görünen
// satırlar sayfada durur); betik ızgarayı baştan sona kendisi kaydırıp her satırı toplar ve
// sonuç bir .json dosyası olarak iner. Sonra: npm run import:ozyegin -- <indirilen.json>
//
// - Hiçbir ağ isteği atmaz; yalnızca sayfada zaten çizilen tabloyu okur.
// - Zamanlayıcı kullanmaz (arka plandaki sekmelerde yavaşlatılırlar); her şey eşzamanlıdır.
// - Sayfadaki "( N Kayıt Bulundu )" ile toplanan satır sayısı çıktıya {expected, collected} olarak
//   yazılır; farklıysa konsolda uyarı çıkar.
//
// Satır biçimi: { subject, number, section, title, creditsText, infoCells: string[], meetings: [{dayText, timeText}] }
// infoCells: şube başlığının altındaki bilgi tablosunun bütün hücreleri, sırasıyla
// (ör. ["Yan koşul: CS 201L Ön koşul: (CS 102 or CS 105)", "HASAN SÖZER"]).
(() => {
  const FORMAT_VERSION = 2;
  const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const CODE_RE = /^([A-ZÇĞİÖŞÜ]{2,6})\s?(\d{3,4}[A-ZÇĞİÖŞÜ0-9_]*)\.([A-ZÇĞİÖŞÜ0-9]+)$/;
  const TIME_RE = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/;
  const COUNT_RE = /\(\s*(\d+)\s*Kayıt Bulundu\s*\)/;
  const SCROLL_STEP = 300;
  const MAX_STEPS = 20000;
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  const codeCells = () =>
    [...document.querySelectorAll('td')].filter((td) => td.childElementCount === 0 && CODE_RE.test(text(td)));

  function readRow(codeCell) {
    const [, subject, number, section] = text(codeCell).match(CODE_RE);

    // Başlık satırı: [kod.şube][ad][kredi]
    const headTds = [...codeCell.parentElement.children];
    const title = text(headTds[1]);
    const creditsText = text(headTds[2]);

    // Hemen altındaki bilgi tablosu: [koşullar][hoca] — bütün hücreler olduğu gibi
    const headTable = codeCell.closest('table');
    const infoCells = [...(headTable.nextElementSibling?.querySelectorAll('td') ?? [])].map(text);

    // Izgaranın dış satırı: gün/saat tablosu burada
    let gridRow = headTable.parentElement;
    while (gridRow && !(gridRow.tagName === 'TR' && gridRow.querySelector('td') && gridRow.cells.length >= 3)) {
      gridRow = gridRow.parentElement;
    }
    const meetings = [];
    if (gridRow) {
      for (const tr of gridRow.querySelectorAll('tr')) {
        const tds = [...tr.children].filter((c) => c.tagName === 'TD');
        if (tds.length !== 2) continue;
        const dayText = text(tds[0]);
        const timeText = text(tds[1]);
        if (DAY_NAMES.includes(dayText) && TIME_RE.test(timeText)) meetings.push({ dayText, timeText });
      }
    }

    return { subject, number, section, title, creditsText, infoCells, meetings };
  }

  function collectVisible(into) {
    for (const cell of codeCells()) {
      const [, subject, number, section] = text(cell).match(CODE_RE);
      const key = `${subject} ${number}.${section}`;
      if (!into.has(key)) into.set(key, readRow(cell));
    }
  }

  // Izgara gövdesi: bir kod hücresinin, içeriği görünen yüksekliğinden belirgin uzun olan en yakın DIV atası.
  function findGridBody() {
    const [cell] = codeCells();
    for (let el = cell?.parentElement; el; el = el.parentElement) {
      if (el.tagName === 'DIV' && el.scrollHeight > el.clientHeight + 50) return el;
    }
    return null;
  }

  function collectAll() {
    const rows = new Map();
    collectVisible(rows);
    const body = findGridBody();
    if (body) {
      const original = body.scrollTop;
      for (let step = 0, top = 0; top <= body.scrollHeight + 500 && step < MAX_STEPS; step++, top += SCROLL_STEP) {
        body.scrollTop = top;
        body.dispatchEvent(new Event('scroll'));
        void body.offsetHeight; // yerleşimi zorla: satırlar şimdi çizilsin
        collectVisible(rows);
      }
      body.scrollTop = original;
      body.dispatchEvent(new Event('scroll'));
    }
    return rows;
  }

  const rows = [...collectAll().values()];
  const pageText = document.body.innerText || document.body.textContent || '';
  const countMatch = pageText.match(COUNT_RE);
  const expected = countMatch ? Number(countMatch[1]) : null;
  const collected = rows.length;
  if (expected !== null && expected !== collected) {
    console.warn(`Sayfa ${expected} kayıt bildiriyor ama ${collected} şube satırı toplandı.`);
  }

  const termSelect = [...document.querySelectorAll('input,select')]
    .map((el) => el.value)
    .find((v) => /\d{4}\s*-\s*\d{4}/.test(v ?? ''));
  const data = {
    formatVersion: FORMAT_VERSION,
    source: 'ozyegin-sis-offer-ui',
    termLabel: termSelect ?? null,
    exportedAt: new Date().toISOString(),
    expected,
    collected,
    rows,
  };
  if (window.__OZU_EXPORT_DRY_RUN__) return data;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ozyegin-export-${Date.now()}.json`;
  a.click();
  console.log(`${collected} şube satırı dışa aktarıldı${expected !== null ? ` (sayfada ${expected} kayıt)` : ''}.`);
  return collected;
})();
