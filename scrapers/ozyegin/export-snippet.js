// Özyeğin "Açılan Dersler" ekranındaki sonuç tablosunu ham JSON olarak dışa aktarır.
// Kullanım: normal tarayıcıda ekranı açın, arama yapın, bu dosyanın içeriğini
// geliştirici konsoluna yapıştırın. Ekranda görünen satırlar bir .json dosyası olarak iner.
// Hiçbir istek atmaz; yalnızca sayfada zaten görünen tabloyu okur.
(() => {
  const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const CODE_RE = /^([A-Z]{2,6})\s?(\d{3,4}[A-Z]?)\.([A-Z0-9]+)$/;
  const TIME_RE = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/;
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  function extract() {
    const codeCells = [...document.querySelectorAll('td')].filter(
      (td) => td.childElementCount === 0 && CODE_RE.test(text(td)),
    );

    const rows = codeCells.map((codeCell) => {
      const [, subject, number, section] = text(codeCell).match(CODE_RE);

      // Başlık satırı: [kod.şube][ad][kredi]
      const headTds = [...codeCell.parentElement.children];
      const title = text(headTds[1]);
      const creditsText = text(headTds[2]);

      // Hemen altındaki tablo: [Yan koşul: ...][hoca]
      const headTable = codeCell.closest('table');
      const infoTds = [...(headTable.nextElementSibling?.querySelectorAll('td') ?? [])];
      const coreqText = infoTds.map(text).find((t) => t.startsWith('Yan koşul')) ?? '';
      const instructorText = infoTds.map(text).find((t) => t && !t.startsWith('Yan koşul')) ?? '';

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

      return { subject, number, section, title, creditsText, coreqText, instructorText, meetings };
    });

    const termSelect = [...document.querySelectorAll('input,select')]
      .map((el) => el.value)
      .find((v) => /\d{4}\s*-\s*\d{4}/.test(v ?? ''));
    return { source: 'ozyegin-sis-offer-ui', termLabel: termSelect ?? null, exportedAt: new Date().toISOString(), rows };
  }

  const data = extract();
  if (window.__OZU_EXPORT_DRY_RUN__) return data;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ozyegin-export-${Date.now()}.json`;
  a.click();
  console.log(`${data.rows.length} şube satırı dışa aktarıldı.`);
  return data.rows.length;
})();
