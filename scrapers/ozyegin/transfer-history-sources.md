# Geçmiş yatay geçiş, ÇAP ve yandal başvuru sonuçları

Özyeğin her dönem "Kurum İçi Yatay Geçiş, ÇAP ve Yandal Başvuru Sonuçları" duyurusunda sonuç PDF'leri yayınlıyor
(ör. https://www.ozyegin.edu.tr/tr/duyurular/27094/2023-2024-guz-donemi-kurum-ici-yatay-gecis-cap-ve-yandal-basvuru-sonuclari).
PDF'ler herkese açık `my.ozyegin.edu.tr/sites/default/files/users/2278/` altında, dönem koduyla adlandırılmış:

- `<kod> ÇAP web ilanı - Türkçe.pdf` (2024 Güz: `ÇAP Başvuru Sonuçları_TR.pdf`)
- `<kod> Yandal Başvuru Sonuçları_TR.pdf`
- `<kod> Kurum İçi (Programlar Arası) Yatay Geçiş - web ilanı_TR.pdf`
- `<kod> Merkezi Yerleştirme Puanı ile Kurum İçi Yatay Geçiş - web ilanı_TR.pdf`

Dönem kodu: YYYY10 = YYYY-YYYY+1 Güz, YYYY20 = Bahar. 2018–2026 arası bütün kodlar ve bu ad biçimleri denendi;
bulunanlar `data/ozyegin/transfer-history.json` içindeki `sources` listesinde (26 dosya, 201910–202410).
202420 ve sonrası bu adlarla bulunamadı (başka adla ya da başka yerde yayınlanmış olabilir).

## Ayrıştırma

- PyMuPDF ile metin çıkarıldı; her "KABUL / RET / RED / ŞARTLI KABUL" (büyük/küçük harf fark etmez) bir başvuru satırı.
- Satırın bölümü, sonuçtan önceki metinde programs.json bölüm adı aranarak bulundu (en uzun eşleşme; "BSIE-…" gibi kodlar
  doğrudan; "İletişim ve Tasarımı" → BSCOD, "Özel Hukuk"/"Kamu Hukuku" yandalı → BLAW, "Mimarlık" dil belirtilmeden → BSARCH (TR)).
- 2375 satırın hepsi bir bölüme eşleşti; her dosyada sonuç sayıları toplam satır sayısına eşit.
- `firstChoice`: satırda tercih sırası "1" olanlar.

## Kişisel veri

PDF'lerde kimlik numarası ve ad var (2019–2021 dosyalarında adlar maskelenmemiş). Yalnızca bellekte okundu;
depoya ve veri dosyasına yalnızca bölüm bazında sayılar yazıldı. İndirilen PDF'ler işlendikten sonra silindi.

## Sınırlar

- Listelerde not ortalaması yok: kabul oranı şartları sağlamayan başvuruları da içerir.
- Her tercih ayrı satır: iki tercih yapan öğrenci iki başvuru sayılır.
