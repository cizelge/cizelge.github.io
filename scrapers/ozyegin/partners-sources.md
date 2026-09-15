# Özyeğin anlaşmalı okullar ve ECHE listesi: kaynaklar

Çıktılar:

- `data/ozyegin/partners.json` (`PartnersData`, `src/lib/erasmus/universities.ts`): 162 okul.
- `public/data/eche-institutions.json`: Avrupa Komisyonu ECHE listesi, 5932 kurum, `[ad, ülke, şehir, Erasmus kodu][]`,
  ada göre sıralı. 454 KB, gzip ile yaklaşık 134 KB. Sayfaya gömülmez; üniversite kutusu ilk odakta indirir.

Doğrulama: `src/lib/erasmus/universities.test.ts` ("data files" bölümü). Toplama tarihi: 2026-09-15. Tarayıcı kullanılmadı;
sis.ozyegin.edu.tr ve MyOzU kullanılmadı.

## Yöntem

Sayfalar `curl -sL -A "Mozilla/5.0"` ile indirildi, Python `html.parser` betiğiyle `<table>/<tr>/<td>` düzeyinde okundu.
WebFetch özetine güvenilmedi. ECHE dosyası `openpyxl` ile okundu. Betikler oturumun geçici klasöründe kaldı (depoya
eklenmedi); adımlar aşağıda.

## Özyeğin kaynakları

| Kaynak | Ne alındı |
|---|---|
| https://www.ozyegin.edu.tr/en/international-exchange-and-partnership-programs/partner-institutions | **Ana kaynak.** Uluslararası Ofis'in tablosu: Faculty/School, Department, Study Level, Agreement Type, University Name, Country. 243 satır. |
| https://www.ozyegin.edu.tr/tr/uluslararasi-degisim-ve-isbirligi-programlari/ortak-kurumlar | Aynı tablonun Türkçe sayfası. Tablo içeriği İngilizce sayfayla aynı (iki sayfa da aynı 3 tabloyu veriyor). |
| https://www.ozyegin.edu.tr/tr/hukuk-fakultesi/partnerlerimiz | Hukuk Fakültesi'nin kendi tablosu (eski sayfa şablonu, "© 2016"). 22 Erasmus satırı. |
| https://www.ozyegin.edu.tr/tr/psikoloji-bolumu/partnerlerimiz | 7 Erasmus+ ortağı ve 2 "Diğer Hareketlilik" ortağı (adlar Türkçe). Hepsi ana tabloda da var; yalnızca bölüm bilgisi eklendi. |
| https://www.ozyegin.edu.tr/tr/havacilik-yonetimi/erasmus (ve `/en/aviation-management/erasmus`) | 6 Erasmus+ ortağı, şehirleriyle. |
| https://www.ozyegin.edu.tr/tr/uluslararasi-degisim-ve-isbirligi-programlari, https://www.ozyegin.edu.tr/tr/degisim-programlari-ve-isbirlikleri | Liste yok; "Ortak Kurumlar" sayfasına bağlantı. |
| https://www.ozyegin.edu.tr/en/architecture/international | Liste yok; ana tabloya yönlendiriyor. |

Aranan ama bulunamayanlar: diğer fakülte/bölümlerin ayrı "Partnerlerimiz" sayfası (WebSearch `site:ozyegin.edu.tr`
ile arandı). Bulunan bütün bölüm sayfaları ya ana tabloya bağlantı veriyor ya da yukarıdakiler.

### Alanlar

- `name`: tablodaki yazım. Değişiklikler:
  - "(inactive for the 2025/26 academic year)" (IE University) ve "(inactive for the 2026/27 academic year)"
    (University of North Carolina at Charlotte) notları addan çıkarıldı. **Bu bilgi dosyada yok**; UNC Charlotte
    2026/27'de kapalı.
  - Aynı kurumun farklı yazımları birleştirildi: "Free University Bozen-Bolzano" / "Free University of Bozen-Bolzano",
    "Universite De Liege" / "University of Liege", "Europa Universiteit Viadrina" / "European University Viadrina",
    "Martin Luther Halle-Wittenberg" / "Martin-Luther University Halle-Wittenberg", "Ruhr-Universitat Bochum" /
    "Ruhr-Universität Bochum", "Universita Degli Studi Di Napoli Federico II" (büyük/küçük harf), "University of Texas
    At/at Dallas", "Università degli Studidella Campania" (bitişik yazım).
  - Hukuk sayfasındaki "Seconda Universita Degli Studi di Napoli", Vanvitelli ile birleştirildi (üniversite 2016'da
    "Università degli Studi della Campania Luigi Vanvitelli" adını aldı; ECHE kodu aynı kurum).
  - Bariz yazım hataları: "Universitad degli Studi di Palermo" → "Università degli Studi di Palermo",
    "Université de BretagneOccidentale" → "Université de Bretagne Occidentale", "Universita Roma Tre" → "Università Roma Tre".
  - Havacılık sayfasında "Lazarsky University" (EN) / "Lazarski Üniversitesi" (TR): "Lazarski University".
- `country`: tablodaki İngilizce ülke adı Türkçeye çevrildi (ör. "The Netherlands" → Hollanda, "Republic of Korea" →
  Güney Kore, "People's Republic of China (Taiwan)" → Tayvan, "Hong Kong (SAR)" → Hong Kong, "Czech Republic" → Çekya).
- `departments`: tablodaki bölüm adları (İngilizce), virgül ve satır sonundan bölündü; "(UG & GR)", "(UG only)" gibi
  seviye notları atıldı; "Entrepreneurship (MA)" gibi derece adları korundu. Hukuk sayfası "Law", psikoloji "Psychology",
  havacılık "Aviation Management" ekler.
- `programs`: "Erasmus+", "Erasmus+ International Credit Mobility (KA171)" ve hukuk sayfasındaki "Erasmus" → `erasmus`;
  "Global Exchange" → `bilateral`; "Swiss European Mobility Program (SEMP)" ve psikolojinin "Diğer Hareketlilik
  Partnerlerimiz" başlığı → `other`.
- Alınmayanlar: "Non-Exchange Bilateral Agreements" / "İkili Anlaşmalar (Değişim Harici)" tabloları (MoU; öğrenci
  değişimi değil), hukuk tablosundaki tek MoU satırı (Lomonosov), psikoloji ve hukuk sayfalarındaki dernek, hastane,
  kurum protokolleri.
- `erasmusCode` ve `city`: Özyeğin sayfalarında yok. Avrupa'daki okullar ECHE listesinde **elle** eşlendi (ülke içinde
  aday listesi çıkarıldı, her eşleşme tek tek kontrol edildi; ör. "University of Porto" → "Universidade do Porto"
  P PORTO02, "Riga Graduate School of Law" → "Rigas Juridiska Augstskola" LV RIGA34, "FHWien ... of WKW" → "Fhw
  Fachhochschul-Studiengange ... der Wiener Wirtschaft" A WIEN21, "Universite Toulouse Paul Sabatier III" →
  "Universite de Toulouse" F TOULOUS03, üniversite 2023'te bu adı aldı). 113 okulun kodu var. Şehir ECHE'deki
  şehirdir; ECHE'de düzensiz olanlar düzeltildi ("Harju Maakond Tallinn" → Tallinn, "Tartu County" → Tartu,
  "Kallithea Athina"/"Aigaleo"/"Athens" → Athina, "Fisciano Sa" → Fisciano, "Ostrava Poruba" → Ostrava, "Praha 3" → Praha,
  CEU Cardenal Herrera için "Madrid" → Valencia, EBS için "Wiesbaden" → Oestrich-Winkel, P MATOSIN01 için Matosinhos).
  Avrupa dışı okullar ile şu Avrupa okullarında kod ve şehir `null`, çünkü ECHE'de emin olunacak bir kayıt bulunamadı:
  AANT, Emlyon Business School, ESDES Lyon Business School, IESEG School of Management, IPSA, Mainz Catholic University of
  Applied Sciences, Thomas More (Belçika'da iki ayrı Thomas More kaydı var), Université de Bretagne Occidentale,
  University of Fribourg (İsviçre ECHE'de yok). Havacılık sayfasındaki şehirler yalnızca kodu olmayan okul kalmadığı
  için kullanılmadı.

### Yalnızca bölüm sayfalarında olanlar (ana tabloda yok)

Hukuk sayfası: EBS Universität, Ghent University, Riga Graduate School of Law, Université de Bretagne Occidentale,
School of Law and Public Administration in Przemyśl. Havacılık sayfası: Lazarski University. Hukuk sayfası eski; bu
anlaşmaların hâlâ geçerli olup olmadığı **doğrulanamadı**. Arayüzdeki not öğrenciyi MyOzU'daki güncel çağrıya yönlendiriyor.

## ECHE listesi

| Kaynak | Ne alındı |
|---|---|
| https://erasmus-plus.ec.europa.eu/document/higher-education-institutions-holding-an-eche-2021-2027 | Sayfadaki güncel dosya bağlantısı. |
| https://erasmus-plus.ec.europa.eu/sites/default/files/2026-08/accredited-HEIs-Erasmus-2021-2027_17082026_1.xlsx | 17.08.2026 tarihli liste, oturum açmadan indirildi. Sayfa "Report", başlık 2. satırda: Proposal Number, Erasmus code, PIC, OID, Legal Name, Street, Post Cd, City, Country Cd, Website Url, Erasmus Eche Start, Erasmus Eche End. 6139 satır. |

Dönüşüm:

- Alınan sütunlar: Legal Name, Country Cd, City, Erasmus code.
- Türkiye (TR, 206 kurum) çıkarıldı: Özyeğin öğrencisi için karşı okul yurt dışında.
- Erasmus kodundaki bölünmez boşluk ve çoklu boşluk teke indirildi ("D  MUNCHEN02" → "D MUNCHEN02").
- Tamamı büyük harfle yazılmış adlar ve şehirler başlık düzenine çevrildi ("TECHNISCHE UNIVERSITAET MUENCHEN" →
  "Technische Universitaet Muenchen"; "of, de, di, und, i ..." gibi bağlaçlar küçük; II, III gibi Romen rakamları ve
  Fransa/Belçika/Lüksemburg'da tek başına "I"/"V" büyük kalır; "GMBH" → "GmbH"). Karışık yazılmış adlara dokunulmadı.
  Harf çevirisi geri alınmadı ("Muenchen" kalır; arama "münchen" ve "munchen" ile de bulur).
- Ülke kodu Türkçe ada çevrildi (EL → Yunanistan, XK → Kosova, MK → Kuzey Makedonya, CZ → Çekya, CY → Kıbrıs ...).
- Aynı Erasmus kodu iki kez geçen tek kayıt (E VIGO13) bir kez alındı. Sonuç 5932 kurum.
- Listede yalnızca üniversiteler yok; ECHE sahibi meslek yüksekokulu, lise sonrası kurum ve bazı liseler de var.
  Arayüz grubu "Diğer Avrupa üniversiteleri" diye adlandırıyor.

## Yenileme

1. Ana tabloyu ve bölüm sayfalarını indir, tabloları satır satır oku; yeni ya da kaybolan okulları karşılaştır.
2. ECHE sayfasındaki güncel `.xlsx` bağlantısını al (dosya adı tarihle değişiyor), yukarıdaki dönüşümü uygula.
3. Yeni Avrupa okulları için ECHE kodunu elle eşle; `npx vitest run src/lib/erasmus` her kodun ECHE listesinde aynı
   ülkeyle bulunduğunu denetler.
