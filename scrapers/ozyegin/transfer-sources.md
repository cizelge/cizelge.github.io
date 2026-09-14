# Özyeğin yatay geçiş / ÇAP verisi: kaynaklar

Çıktı: `data/ozyegin/transfer.json` (`TransferData`, `src/lib/transfer/types.ts`). Doğrulama: `src/lib/transfer/data.test.ts`.
Toplama tarihi: 2026-09-14. sis.ozyegin.edu.tr kullanılmadı. Tarayıcı kullanılmadı.

## Yöntem

Her sayfa `curl -sL -A "Mozilla/5.0"` ile ham HTML olarak indirildi (sırayla, birer kez). Tablolar küçük bir Python
`html.parser` betiğiyle `<tr>/<td>` düzeyinde ayrıştırıldı; WebFetch özetine güvenilmedi. PDF `pdftotext -layout` ile
metne çevrildi. Program adları `programs.json` adlarına elle eşlendi (dil eki "(İngilizce)/(Türkçe)" atılarak;
"Yapay Zekâ" = "Yapay Zeka"; "İletişim ve Tasarımı" = `BSCOD` İletişim Tasarımı; "Mimarlık (İngilizce)" = `BSARCH (ENG)`).

## Kaynaklar

| Kaynak | Ne alındı |
|---|---|
| https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/basvuru-kabul/lisans-programlarina-yatay-gecisler/kurum-ici-basariya-gore-yatay | Takvim (2026-2027 Güz: başvuru 3-14 Ağustos 2026), öğrenim süresi (en az 2, en fazla 5 dönem), kontenjan tablosu (2. ve 3. sınıf) → `internalQuota`; programa özel sıra şartları → `notes` |
| https://www.ozyegin.edu.tr/sites/default/files/upload/OgrenciHizmetleri/kurum_ici_programlar_arasi_yatay_gecis_icin_lisans_programlari_ek_basvuru_kosullari.pdf | 2027-2028 başvurularından itibaren programa özel en az GNO ve ders/not koşulları → `notes` |
| https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/basvuru-kabul/lisans-programlarina-yatay-gecisler/merkezi-yerlestirme-puani-ile | Kurumlar arası Ek Madde-1: kontenjan tablosu (hazırlık, 1-4. sınıf) → `centralQuota`; sıra şartları, Gastronomi 2015-2016 şartı → `notes` |
| https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/basvuru-kabul/lisans-programlarina-yatay-gecisler/merkezi-yerlestirme-puani-ile-0 | Kurum içi Ek Madde-1 sayfası. Kontenjan tablosu kurumlar arası sayfanınkiyle hücre hücre aynı (betikle karşılaştırıldı); koşul metinleri de aynı |
| https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/basvuru-kabul/cift-anadal-ogrenimi-cap | GNO 2,72; 3./4./5. dönem başı için 48/84/120 kredi; başarısız not olmaması; ilk %20; Hukuk / Mimarlık (İng.) / Mühendislik sıra şartları → `capRankRules`; Gastronomi ve Pilotaj kapalı → `capOpen: false` |
| https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/basvuru-kabul/yandal-ogrenimi | GNO en az 2.50 → `rules.yandalMinGpa` |
| https://aday.ozyegin.edu.tr/taban-puanlari-ve-kontenjanlar/ | 2025 YKS en düşük/en yüksek puan ve başarı sırası (80. yüzdelik dilim sütunu alınmadı), 2025 kontenjanı, 2026 genel kontenjanı → `baseScores` (62 satır, 23 program) |
| YÖK Atlas (yokatlas.yok.gov.tr) | Alınamadı, aşağıya bakın |

## Toplam kontrolleri

- **Kurum içi (başarıya göre)**: program satırlarının toplamı 207 (2. sınıf) ve 194 (3. sınıf); sayfadaki TOPLAM satırıyla aynı.
  Ama sayfanın **fakülte ara toplamları** 3. sınıfta tutmuyor: İşletme Fakültesi satırı 46 diyor, programlar 7+11+5+14+6 = 43;
  Mimarlık ve Tasarım Fakültesi satırı 34 diyor, programlar 6+6+5+12 = 29. Fakülte satırları toplanırsa 202 çıkıyor, TOPLAM 194.
  Program satırları TOPLAM ile tutarlı olduğu için program değerleri olduğu gibi alındı; ara toplamlar veride yok.
- **Merkezi yerleştirme (Ek Madde-1)**: hazırlık/1/2/3/4 toplamları 429/429/424/424/404; hem fakülte ara toplamları hem TOPLAM tutuyor.
- **aday sayfası**: kaynakta toplam satırı yok. Hesaplanan toplam kontenjan 2025: 1371, 2026 (genel): 1375.

## Yorum ve şüpheli noktalar

- `applicationTerm`: bütün sayfalarda takvim başlığı "2026-2027 Akademik Yılı Güz Dönemi".
- ÇAP Hukuk kuralı kaynakta "2019 yıllarında ... (EA) 190.000" diye yazıyor (baştaki yıl listesi eksik görünüyor).
  `fromYear: null, toYear: 2019` olarak alındı; 2020-2025 için 125.000 (`fromYear: 2020, toYear: 2025`).
- ÇAP Mimarlık (İng.) ve Mühendislik kuralları "2019 yılı sonrasında" diyor. Kelimesi kelimesine "2019'dan sonra" (2020+) da okunabilir;
  `fromYear: 2019` alındı (daha kapsayıcı okuma). Mühendislik kuralı Mühendislik Fakültesi'nin 6 programına uygulandı
  (BSCS, BSEE, BSIE, BSCE, BSME, BSAI). Endüstriyel Tasarım Mimarlık ve Tasarım Fakültesi'nde olduğu için kapsam dışı.
- Kurum içi (başarıya göre) sayfasındaki sıra şartları ÇAP'takinden farklı (Hukuk 2022+ Y-EA 125.000; Mimarlık (İng.) 2021+ Y-SAY 250.000;
  Mühendislik 2021+ Y-SAY 300.000). Sözleşmede ayrı alan olmadığı için `notes` içinde.
- Otel Yöneticiliği puan türü: aday sayfası 2025 için EA diyor, iki kontenjan tablosu SÖZ diyor. `scoreType: "EA"` (2025 yerleşme verisi), fark `notes` içinde.
- aday tablosunda ondalık ve binlik ayırıcıları tutarsız: çoğu puan "460,67311", biri "488.0588" (İşletme Tam Burslu en yüksek puan);
  sıraların çoğu "2.336", bazıları "1,314", "62,341", "2,615", "66,045", "59,588", "8,055". Puanlarda tek ayırıcı ondalık,
  sıralarda her ayırıcı binlik sayıldı. Bütün satırlarda en düşük puan ≤ en yüksek puan ve en düşük sıra ≥ en yüksek sıra tutuyor.
  Endüstriyel Tasarım Ücretli 80. yüzdelik değeri "430/387" bozuk ama o sütun alınmadı.
- 2026 kontenjanı olarak "Genel" sütunu alındı; "Şehit ve Gazi Yak. Ek Kont." sütunu dahil değil. 2026 satırlarında puan/sıra null.
  "*" işareti (2025-2026'ya göre artış) atıldı.
- `programs.json` içinde olup hiçbir kaynakta geçmeyen programlar veriye eklenmedi: `BAENT` Girişimcilik ve `BSARCH (TR)` Mimarlık (Türkçe).
  2025 taban puan tablosunda, kurum içi ve Ek Madde-1 kontenjan tablolarında yoklar.
- Kurum içi geçişteki "Türkiye'deki eşdeğer programların en düşük taban puanı" şartı için veri yok (ÖSYM kitabı gerekir).

## YÖK Atlas (2019-2024) neden yok

- `https://yokatlas.yok.gov.tr/lisans-univ.php?u=2034` ve `https://yokatlas.yok.gov.tr/2023/lisans.php?y=203410057`: HTTP 200 ama
  yalnızca 945 baytlık bir React kabuğu (`<div id="root">`, "Javascript çalıştırılmasına izin vermelisiniz"). Veri tarayıcıda JS ile yükleniyor. (Buradaki kodlar denemeydi; kabuk hangi URL istenirse istensin aynı döndü, bu yüzden gerçek program kodları aranmadı.)
- `https://yokatlas.yok.gov.tr/2023/lisans-univ.php?u=2034`: HTTP 418 (bot engeli).
- Başsız tarayıcı yasak olduğundan 2019-2024 verisi alınmadı. `baseScores` yalnız 2025 (puan+sıra+kontenjan) ve 2026 (kontenjan) içeriyor.
  Sonuç: kayıt yılı 2025 olmayan öğrenciler için `evaluateCentral` taban puan karşılaştırması "unknown" kalacak.
- 2026 satırlarında yalnız genel kontenjan var; 2026 puanları kaynakta yayımlanmamış. (Bu not verideki program notlarından kaldırıldı, sayfada görünmesin diye.)
