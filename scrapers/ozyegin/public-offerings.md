# Açılan Dersler sayfası (günlük otomatik güncelleme)

Kod: `public-offerings.ts` (ayrıştırma + getirme), `merge-offerings.ts` (birleştirme), `update-cli.ts`
(`npm run update:offerings [-- --dry-run] [--verbose] [--delay=1500]`), iş akışı `.github/workflows/data-update.yml`.

## Kaynak

- `https://www.ozyegin.edu.tr/tr/acilan-dersler?term=<kod>&program=<program>` (SIS girişi gerekmez, düz HTML).
- Dönem kodu: `YYYY10` Güz, `YYYY20` Bahar, `YYYY30` Yaz (`202610` = 2026 - 2027 Güz). Dönem adı `#selectTerm`
  listesinden okunur ("2026 -2027 Bahar" gibi tutarsız yazımlar `parseTermLabel` ile düzeltilir).
- Filtresiz sayfa (`/tr/acilan-dersler`) tablo göstermez; program seçmek zorunludur. `area=` verilmezse
  programın bütün alanları gelir.
- `/en/acilan-dersler` aynı veriyi İngilizce ad ve gün adlarıyla verir; kullanılmıyor (ayrıştırıcı İngilizce günleri de okur).
- 2026-09-15 itibarıyla yalnızca güncel dönem (202610) satır döndürüyor; Bahar, geçmiş ve gelecek dönemler boş tablo
  döner. Bahar saatleri yayınlanınca aynı yoldan gelmesi bekleniyor.

## Yapı

- Her müfredat alanı ayrı bir `<table id="myTable">`, başlığı `<th colspan="3">BSCS Zorunlu</th>`.
- Bir satır = bir şube, üç hücre:
  1. `<td width="130"><a href="…sis…">CS 201.A</a></td>`
  2. `<td>Veri Yapıları ve Algoritmalar, <a href="…/akademik-kadro/…">EMRE SEFER</a> <a>(pdf)</a></td>`
     — ad kadro bağlantısına kadar olan metin; tek hoca; bazı satırlarda bağlantının adı boş.
  3. `<td width="180"><span>Çarşamba 16:40 - 18:30</span><br/>…</td>` — saatsiz şubede boş.
- HTML bozuk (`<tbody></td>`, tablonun son satırında kapanmayan `</td></tr>`), bu yüzden DOM değil
  `<td width="130">` çapasıyla satır satır okunur.
- Sayfalama yok; arama kutusu yalnızca tarayıcıda süzer.
- Program listesi (`#selectProgram`) yalnızca seçili programın fakültesi için gelir; fakülte değişimi Drupal AJAX
  ile yapılır ve betik isteğine kapalıdır. Bu yüzden her fakülteden bir tohum program (`SEED_PROGRAMS`) ile başlanıp
  listelerde görünen programlar gezilir. 2026-09-15'te 28 lisans programı, program başına bir istek, istekler arası
  1,5 sn. Aynı şube birçok programın/alanın tablosunda tekrar eder; birleştirilir.

## Kapsam (2026-2027 Güz, 2026-09-15)

| | Mevcut veri (SIS) | Sayfa |
|---|---|---|
| Ders | 895 | 634 |
| Şube | 1548 | 1036 |

Sayfada bulunan her dersin bütün şubeleri, hocaları ve (1 gerçek değişiklik dışında) saatleri mevcut veriyle aynı.
Sayfada olmayanlar: lisansüstü (500+) dersler, lab/recitation (`L`/`R` ekli) dersler, `_U` ekli seminerler — bunlar
hiçbir lisans müfredat alanında listelenmiyor.

## Sınırlar

- Kapasite, derslik, AKTS, yerel kredi, ön/yan koşul sayfada yok. Birleştirme bunları mevcut veriden korur:
  şube (kod + şube harfi) eşleşirse kapasite kalır; oturum aynı gün + başlangıç saatiyle eşleşirse derslik kalır.
  Yeni şubelerde kapasite ve derslik `null`. Bunları tazelemek için SIS ayrıntı akışı (`import:details`) gerekir.
- Tek hoca gösteriliyor; adı boş bağlantı hocasız sayılır.
- Yeni ders AKTS/koşulsuz eklenir.

## Birleştirme kuralları

- Kapsam içi ders: numarası 100-499 ve eksiz (`CS 201`; `CS 201L`, `MATH 101R`, `SAS 405_U`, `PSY 481-03`, `MGMT 501`
  kapsam dışı). Sayfada görünmeyen kapsam içi ders silinir; kapsam dışı ders sayfada yoksa olduğu gibi korunur,
  varsa güncellenir.
- Sayfada görünen dersin sayfada olmayan şubesi silinir, yeni şubesi eklenir.
- Saat kümesi aynıysa oturumlar hiç değişmez (sıra dahil); farklıysa sayfadaki oturumlar alınır.
- Yeni dönem: izlenen en yeni dönemden daha yeni bir dönem sayfada saatleriyle görünürse
  `data/ozyegin/<id>.json` oluşturulur. Dönem listesindeki daha yeni dönemler her çalıştırmada tek istekle yoklanır.
- İçerik (fetchedAt hariç) değişmediyse dosya yazılmaz.

## Güvenlik

- **Eşik:** mevcut kapsam içi şubelerin %50'sinden azı sayfada bulunursa (`MIN_FOUND_RATIO`) ya da sayfada hiç ders
  yoksa o dönem yazılmaz ve komut 1 ile çıkar. Bugün oran %100.
- `scrapers/validate.ts` geçmezse (ör. ders sayısı %30'dan fazla düşerse) yazılmaz, çıkış 1.
- İstenen dönem yerine başka dönem gösteren sayfa hata sayılır.
- İş akışında adım başarısız olursa commit atılmaz. Bir dönem yazılıp diğeri reddedilirse de iş başarısız olur ve o gün
  hiçbir şey commit edilmez.

## Bilinen risk

Sayfada görünmeyen kapsam içi ders iptal edilmiş sayılır. Serbest seçmeli alanları neredeyse bütün lisans derslerini
listelediği için bu genelde doğru; ama hiçbir müfredat alanına girmeyen lisans dersi yanlışlıkla silinebilir.
İlk deneme çalıştırmasında böyle 2 ders çıktı: `EEC 398`, `FIN 421`.
