# Ders Planlayıcı — Parça 1: Temel + Akıllı Sıralama

Tarih: 2026-09-13
Durum: Tasarım onaylandı, uygulama planı bekleniyor

## Amaç

Özyeğin öğrencileri için UniPlanners'ı (uniplanners.org) geçen bir ders programı planlayıcısı.
UniPlanners'ın yaptığı her şeyi yapar; üstüne programları öğrencinin tercihine göre sıralar,
çözüm yoksa nedenini söyler ve ders sayfalarıyla Google'da bulunur.

**Hedef tarih:** Aralık 2026 ortası herkese açık, Bahar 2027 kayıtlarından önce.

## Yol haritasındaki yeri

| Parça | İçerik | Durum |
|---|---|---|
| **1** | Veri çekici, arama, sepet, program oluşturma, akıllı sıralama | **Bu belge** |
| 2 | Mezuniyet yol haritası (müfredat + ön koşullar) | Sonra |
| 3 | Arkadaşlarla birlikte (hesap sistemi gerekir) | Sonra |
| 4 | Hoca ve ders bilgisi (hukuki/moderasyon riski) | En son |

Her parça kendi tasarım belgesini alır.

## Kilitli kararlar

- **Okul:** İlk sürümde yalnızca Özyeğin. Altyapı okuldan bağımsız; yeni okul = yeni adaptör dosyası.
- **Teknoloji:** Next.js + TypeScript.
- **Giriş:** Yok. Durum tarayıcıda ve paylaşım linkinde tutulur. Kişisel veri saklanmaz.
- **Mimari:** Statik veri + tarayıcıda program oluşturma. Veritabanı ve uygulama sunucusu yok.

## Bu sürümde olmayanlar

Hesap sistemi, arkadaşlar, mezuniyet yol haritası, hoca yorumları/not dağılımı, Özyeğin dışındaki okullar,
kısa paylaşım linki servisi.

---

## 1. Veri

### Kaynak

Özyeğin "Açılan Dersler" ekranı: `https://sis.ozyegin.edu.tr/OZU_GWT/WEB/CourseCatalogOfferUI?locale=tr`.
Giriş gerektirmiyor (2026-09-13'te doğrulandı, 2026-2027 Güz seçili geliyor). GWT tabanlı; düz tablo yok.

**Açık risk — uygulamanın ilk adımı:** Veriyi (a) arka plandaki GWT-RPC isteğini doğrudan çağırarak mı,
(b) otomatik tarayıcıyla (Playwright) ekrandan mı alacağımız bilinmiyor. Kısa bir denemeyle karar verilir.
İkisi de çalışmazsa proje durdurulup yeniden değerlendirilir.

### Okul adaptörü

`scrapers/<okul>.ts` — tek sorumluluk: okulun kaynağından veriyi alıp ortak biçime çevirmek.
Sitenin geri kalanı okul adını yalnızca veri olarak bilir.

```ts
interface SchoolAdapter {
  schoolId: string;              // "ozyegin"
  fetchTerm(termId: string): Promise<TermData>;
}
```

### Ortak biçim (dönem başına bir JSON dosyası)

```ts
interface TermData {
  schoolId: string;
  termId: string;                // "2026-2027-guz"
  termLabel: string;             // "2026 - 2027 Güz"
  fetchedAt: string;             // ISO zaman
  courses: Course[];
}

interface Course {
  code: string;                  // "CS 101"
  slug: string;                  // "cs-101"
  title: string;
  ects: number | null;
  localCredits: number | null;   // ECTS ile ayrı tutulur, asla karıştırılmaz
  prerequisites: string;         // kaynaktaki metin
  corequisites: string[];        // ["CS 101L"]
  sections: Section[];
}

interface Section {
  id: string;                    // "A", "B"
  instructors: string[];
  capacity: number | null;
  restrictions: string | null;
  meetings: Meeting[];
}

interface Meeting {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Pazartesi … 7 = Pazar
  start: string;                 // "10:40"
  end: string;                   // "12:30"
  room: string | null;
}
```

### Doğrulama

Yeni veri yazılmadan önce:
- Zorunlu alanlar dolu (kod, ad, en az bir şube).
- Saatler geçerli ve `start < end`.
- Ders sayısı bir önceki çekime göre %30'dan fazla düşmemiş.

Herhangi biri başarısızsa **eski dosya yerinde kalır** ve iş başarısız sayılır (GitHub Actions bildirimi).

### Güncelleme

- GitHub Actions: kayıt dönemlerinde birkaç saatte bir, diğer zamanlarda günde bir.
- Veri değiştiyse dosya commit edilir, site yeniden yayınlanır.
- Arayüz `fetchedAt` bilgisini gösterir. Veri 48 saatten eskiyse sitenin üstünde uyarı çıkar.

---

## 2. Program oluşturma ve akıllı sıralama

### Kesin kurallar (programı eler)

1. Oturumlar çakışmaz.
2. Yan koşullu dersler birlikte alınır; biri sepete eklenince diğeri de eklenir.
3. Öğrencinin seçtiği boş günlerde oturum yoktur.
4. Kilitli şube zorunludur; hariç tutulan şube kullanılmaz.

### Tercihler (yalnızca puanı etkiler)

Her tercih 0–3 arası ağırlık alır (sürgü).

| Tercih | Ölçü |
|---|---|
| Az gün | Oturumu olan gün sayısı |
| Az boşluk | Aynı gündeki oturumlar arası toplam boş süre |
| Öğle arası | 12:00–14:00 arasında en az 1 saat boşluk olmayan gün sayısı |
| Sabah erken yok | Eşik saatten (vars. 09:40) önce başlayan oturum sayısı |
| Akşam geç yok | Eşik saatten (vars. 17:40) sonra biten oturum sayısı |

Program puanı = ağırlıklı ceza toplamı; düşük puan üstte.
Hazır ayarlar: "Az gün", "Sabah yok", "Sıkışık program" (ağırlık setleri).

Her programın yanında açıklama: `Kampüste 3 gün · toplam 1 saat boşluk · en erken 10:40`.

### Çözüm yoksa

"Bulunamadı" demek yerine en küçük çakışma nedenini göster:
- *"MATH 211 ile PHYS 101'in tüm şubeleri Salı 12:40'ta çakışıyor."*
- Bir kısıt gevşetilince çözüm çıkıyorsa öner: *"Salıyı boş günlerden çıkarırsan 4 program çıkıyor."*

Öneriler yalnızca tek kısıtı (bir boş gün, bir kilit, bir hariç tutma) kaldırarak denenir.

### Algoritma

- Web Worker içinde çalışır; ana arayüz donmaz.
- Haftanın zamanı 5 dakikalık dilimlere bölünür, her gün bir bit maskesi; çakışma kontrolü AND işlemi.
- Geri izleme (backtracking): en az şubesi olan ders önce; çakışan dal hemen bırakılır.
- En iyi 50 program bir yığında (heap) tutulur.
- 50.000 tam programa bakınca durur ve bunu arayüzde söyler.
- Tercih ağırlığı değişince arama yeniden yapılmaz; bulunan adaylar yeniden puanlanır.
  (Aday havuzu: en fazla 50.000 program saklanır; aşılırsa arama yeni ağırlıklarla yeniden çalışır.)

---

## 3. Sayfalar ve akış

### Sayfalar

| Yol | İçerik | Üretim |
|---|---|---|
| `/` | Tek cümle açıklama, okul seçimi, "Okulun yok mu?" bağlantısı | Statik |
| `/ozyegin` | Planlayıcı | Statik kabuk + istemci |
| `/ozyegin/[slug]` | Ders sayfası: şubeler, saatler, hocalar, koşullar, son güncelleme, "Sepete ekle ve planla" | Statik (her ders) |
| `/hakkinda` | Veri kaynağı, resmi olmama, kişisel veri tutulmaması | Statik |

Her sayfada gerçek `<h1>`, açıklama, Open Graph etiketleri. `sitemap.xml` ve `robots.txt` gerçek dosya.
Olmayan yol 404 döner.

### Planlayıcı akışı

1. **İlk açılış:** yönlendirme metni ("Ders kodu yaz, örn. CS 101"). Bölüm isteğe bağlı; seçilirse
   o bölümün dersleri öneri olarak çıkar (veri varsa). Kapatılamayan pencere yok.
2. **Arama:** yazarken sonuç; kod, ders adı ve hoca adıyla. Arama yapılmadan "bulunamadı" mesajı gösterilmez.
3. **Sepet:** toplam ECTS her zaman görünür.
4. **Sonuç:** masaüstünde solda tercihler, sağda liste + haftalık tablo. Telefonda sekmeler;
   sabit alt çubuk içeriğin üstüne binmez (içeriğe alt boşluk verilir).

### Paylaşma ve dışa aktarma

- Durum (sepet, kilitler, boş günler, ağırlıklar, seçili program) URL parametresinde sıkıştırılmış olarak.
- Takvime ekle (`.ics`) ve PNG olarak indir.
- Son durum `localStorage`'da; okunamazsa sessizce boş başlar.

### Diğer

- Açık/karanlık tema; Türkçe/İngilizce. Arayüz metinlerinin tamamı seçili dildedir.
  Kaynaktan gelen veri (ders adı, derslik) olduğu gibi gösterilir; bu, arayüz metni sayılmaz.
- Klavyeyle tam kullanım, pencerelerde Esc ile kapatma, ekran okuyucu etiketleri.
- Görsel yön (renk, tipografi, düzen) bu belgenin kapsamı dışında; uygulama aşamasında `frontend-design` ile belirlenir.

---

## 4. Hatalar, test, yayın

### Hata durumları

| Durum | Davranış |
|---|---|
| Veri çekimi başarısız / doğrulama geçmedi | Eski veri kalır; iş başarısız; 48 saati geçerse sitede uyarı |
| Arama sınıra takıldı | Durur, "ilk 50.000 olasılığa bakıldı" der |
| Paylaşım linkinde artık olmayan ders/şube | Hata ekranı yok; "Bazı şubeler artık yok" + kalanı yükle |
| Bozuk URL durumu | Yok say, boş planlayıcı aç |

### Test

- **Motor:** elle kurulmuş örnekler (çakışma, yan koşul, boş gün, kilit, çözümsüz durum ve neden metni).
  Küçük rastgele girdilerde sonuç, tüm olasılıkları deneyen yavaş bir yöntemle karşılaştırılır.
- **Adaptör:** kaydedilmiş gerçek Özyeğin yanıtlarıyla çevrimdışı.
- **Doğrulama:** kurallar için birim testleri.
- **Doğruluk:** yayından önce rastgele 10 ders, Özyeğin ekranıyla elle karşılaştırılır (zorunlu).
- **Görsel:** her ekran 375px ve 1440px, açık ve karanlık tema; ekran görüntüsü alınıp incelenir.
  UniPlanners'ta görülen hatalar ayrıca kontrol edilir: üst üste binen alt çubuk, kesilen adlar,
  içerikten önce görünen "bulunamadı" mesajı, ECTS/Kredi karışıklığı, karışık dil.

### Yayın

- Vercel ücretsiz plan; alan adı kullanıcı tarafından seçilip alınır.
- Ekim 2026 sonu: kapalı deneme (geliştirici + gerçek Özyeğin öğrencileri).
- Aralık 2026 ortası: herkese açık.

### Bilinen risk

Geliştirici Özyeğin öğrencisi değil. Kapalı denemede gerçek Özyeğin öğrencisi yoksa
"UniPlanners'tan daha iyi" iddiası doğrulanamaz. Deneme kullanıcıları şimdiden ayarlanmalı.
