# Özyeğin Erasmus+ öğrenim hareketliliği verisi: kaynaklar

Çıktı: `data/ozyegin/erasmus.json` (`ErasmusData`, `src/lib/erasmus/types.ts`). Doğrulama: `src/lib/erasmus/data.test.ts`.
Toplama tarihi: 2026-09-14. Tarayıcı kullanılmadı.

## Yöntem

Sayfalar `curl -sL -A "Mozilla/5.0"` ile ham HTML olarak indirildi, küçük bir Python `html.parser` betiğiyle metne
çevrildi (tablolar `<td>` düzeyinde). SSS PDF'i `pdftotext -layout` ile metne çevrildi. WebFetch özetine güvenilmedi.

## Kaynaklar

| Kaynak | Ne alındı |
|---|---|
| https://www.ozyegin.edu.tr/tr/uluslararasi-degisim-ve-isbirligi-programlari/erasmus-ogrenim-hareketliligi/giden-ogrenci | Tüm sayısal değerler (aşağıda). **`/tr/` adresinde de içerik İngilizce.** |
| https://www.ozyegin.edu.tr/en/international-exchange-and-partnership-programs/erasmus-study-mobility/outgoing-students | İngilizce sayfa. İçerik bölümü `/tr/` sayfasıyla satır satır aynı (`diff` ile karşılaştırıldı; tek fark menü başlığı). |
| https://www.ozyegin.edu.tr/tr/uluslararasi-degisim-ve-isbirligi-programlari/sikca-sorulan-sorular-sss | Yalnızca PDF bağlantıları. |
| https://www.ozyegin.edu.tr/sites/default/files/upload/Uluslararasi/sss_tr.pdf | Türkçe SSS: puan formülü ve fakülte bazlı sıralamanın teyidi, en fazla 4 ay hibe (örnek: 600 € × 4 = 2.400 €), önceki katılım −10. Sayısal çelişki yok. |
| https://my.ozyegin.edu.tr/tr/duyurular/39729 | 2026-27 başvuru ilanı (sayfadaki "this link"). **Microsoft oturum açma sayfasına yönleniyor; okunamadı.** |
| https://www.ozyegin.edu.tr/tr/uluslararasi-degisim-ve-isbirligi-programlari/erasmus-programi | Yıl/çağrı bilgisi arandı; ilgili bilgi yok. |

## Alan alan (Giden Öğrenci sayfasındaki özgün ifade)

- `callYear: "2026-27"`: "The application announcement for the 2026-27 academic year has been published on MyOzU."
  Görevde verilen "2024-25" sayfada hiçbir yerde geçmiyor. Hibe tablosunun hangi yıla ait olduğu **yazmıyor**
  ("The allocation varies from year to year"). Sayfada geçen tek diğer yıl: "2024 Erasmus Language Exam (ELE)".
- `eligibility.minGpa: 2.2`: "Minimum 2.20/4.00 CGPA for undergraduate students" (lisansüstü 3.00/4.00, alınmadı).
- `eligibility.minEle: 60`: "Getting a minimum 60/100 points from the 2024 Erasmus Language Exam (ELE)".
- `eligibility.minEctsAtApplication: 24`: "Having completed a minimum of 24 ECTS credits at the time of the application."
- `eligibility.minEctsAtNomination: 54`: "At the time of nomination to the partner institution, applicants must have completed at least 54 ECTS credits in their current programs from which they applied."
- `score`: "Erasmus Score = CGPA 50% + ELE Score 50% + additional Turkish National Agency Additional Criteria (if applicable)", "Ranking will be faculty/school-based."
- `score.gpaTo100`: **yayımlanmamış.** Ne sayfada ne SSS PDF'inde 4'lük GNO'nun 100'lüğe nasıl çevrildiği var. Varsayım: ×25.
- `criteria` (sayfadaki sırayla):
  - `previous` −10, `perCount: true`: "previously participated ... at the same study level will have 10 points deducted for each participation."
  - `withdrew` −10, `perCount: true`: "withdrew from the program in previous years after submitting the commitment form will have 10 points deducted **for each withdrawal**" (görev listesinde "her biri için" yoktu).
  - `homeCountry` −10: "wish to participate in the program in their countries of citizenship".
  - `eleAbsent` −5: "register for the ELE and not attend without a valid excuse ... **if they reapply**".
  - `orientationAbsent` −5: "Placed students who did not attend the mandatory orientation sessions before without a valid excuse".
  - `disability` +10: "Students with disabilities" (dipnot: Erişkinler için Engellilik Değerlendirmesi Yönetmeliği sağlık kurulu raporu).
  - `veteran` +15: "children of Veterans/Martyrs".
  - `disaster` +10: "themselves or their first-degree relatives receive disaster financial support from AFAD". Hem öğrenim hem staja başvuranda yalnız birine uygulanır.
  - `socialProtection` +10: "under the protection, care, and shelter of Act No. 2828 ... or 5395".
  - Ek puanlar her öğrenim kademesi ve proje türü (KA131/KA171) için bir kez uygulanır (dipnot). Arayüzde gösterilmedi.
  - SSS'de ayrıca: hem öğrenim hem staja başvurup öğrenime yerleşen ve onaylayanın **staj** başvurusunda −10. Öğrenim skoru için değil, alınmadı.
- `grant.monthly`: tablo "Group 1 & 2 program countries with higher living costs" 600 €, "Group 3 program countries with lower living costs" 450 €.
  Ülke listeleri Türkçeye çevrildi, sıra korundu. Özgün: Grup 1-2 "Denmark, Ireland, Finland, Sweden, Liechtenstein, Norway, Luxembourg, Iceland, Belgium, Germany, France, Italy, Austria, Greece, Spain, Cyprus, Netherlands, Portugal, Malta, Estonia, Latvia, Czech Republic, Slovenia, Slovakia"; Grup 3 "Bulgaria, Lithuania, Hungary, Poland, Romania, former Yugoslav Republic of Macedonia, Croatia, Serbia, Türkiye" ("former Yugoslav Republic of Macedonia" → "Kuzey Makedonya").
  `group` değerleri ("Grup 1-2", "Grup 3") bu projede verildi; `grantEstimate` bunlarla eşleşir.
- `grant.maxFundedMonths: 4`: "the student can be funded for four months at most" (SSS: "en fazla 4 aylık süresi için").
- `grant.disadvantagedMonthly: 250`: "The monthly amount of the additional grant is 250 EUR per month." KYK bursu/kredisi bu ek hibe için geçerli belge değil.
- `grant.travel`: "Travel Support and Green Travel" tablosu, 7 bant: 10-99 28/56, 100-499 211/285, 500-1999 309/417,
  2000-2999 395/535, 3000-3999 580/785, **4000-7999 1188/1188, 8000 ve üzeri 1735/1735** (standart/yeşil, €).
  Km, AB mesafe hesaplayıcısının verdiği değerdir; tutar ikiyle çarpılmaz. Tek yönlü yolculukta yeşil destek yok.
  10 km altı için bant yok (`grantEstimate` seyahati null verir).
- `durationMonths: {min: 2, max: 12}`: "studying abroad in an EU country for a period of 2 to 12 months". SSS: kademe başına toplam en fazla 12 ay (öğrenim + staj).

## Yayımlanmamış / alınmayanlar

- GNO → 100'lük çevirme yöntemi (varsayım ×25, yukarıda).
- Hibe tablosunun ait olduğu yıl ve 2026-27 ilanının kendisi (MyOzU girişi gerekiyor): başvuru tarihleri, kontenjanlar, partner listesi.
- Hibe ödemesi: %80 başta, %20 belgeler ve başarı sonrası (SSS: en az 20 AKTS başarı). Sözleşmede alan yok, alınmadı.
- Kısa süreli karma hareketlilik günlük hibesi (5-14. gün 79 €/gün, 15-30. gün 56 €/gün): sözleşmede alan yok, alınmadı.
- SSS: Erasmus döneminde ÖzÜ'de en az 30 AKTS mezuniyet yükü kalmış olmalı; partner okulda dönem başına 30 AKTS beklenir. Sözleşmede alan yok.
