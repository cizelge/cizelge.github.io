// Öğrencinin en çok arattığı kuralların sade anlatımı. Kaynak: Özyeğin Üniversitesi
// Lisans Eğitim ve Öğretim Yönetmeliği ile Öğrenci Hizmetleri sayfaları; madde numaraları metinde yazılıdır.
// Bu sayfalar resmi metin değildir, özettir: her rehberin sonunda kaynak bağlantısı ve uyarı vardır.

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

export interface GuideSection {
  heading: string;
  blocks: GuideBlock[];
}

export interface Guide {
  slug: string;
  /** Sayfa başlığı (arama sonucunda görünen). */
  title: string;
  /** Kartlarda ve arama açıklamasında kullanılır. */
  description: string;
  /** Sayfanın girişindeki tek cümle. */
  lede: string;
  sections: GuideSection[];
  sources: { label: string; url: string }[];
  /** Sitedeki ilgili araçlar. */
  related: { label: string; href: string }[];
}

const REGULATION = {
  label: "Özyeğin Lisans Eğitim ve Öğretim Yönetmeliği (Resmî Gazete)",
  url: "https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=8&MevzuatNo=36024&MevzuatTertip=5",
};

export const GUIDES: Guide[] = [
  {
    slug: "ders-yuku",
    title: "Özyeğin AKTS ders yükü sınırı: bir dönemde en fazla kaç ders alınır?",
    description:
      "Özyeğin'de dönemlik AKTS sınırı ortalamana göre 30, 36 ya da 42. İstisnalar, yaz okulu sınırı ve hesabın nasıl yapıldığı.",
    lede: "Bir dönemde alabileceğin en fazla AKTS, genel not ortalamana (GNO) bağlıdır. Üç kademe ve beş istisna var.",
    sections: [
      {
        heading: "Üç kademe",
        blocks: [
          {
            kind: "table",
            head: ["Genel not ortalaman", "Dönemde en fazla"],
            rows: [
              ["1,99 ve altı", "30 AKTS"],
              ["2,00 – 2,99", "36 AKTS"],
              ["3,00 – 4,00", "42 AKTS"],
            ],
          },
          {
            kind: "p",
            text: "Bu, güz ve bahar dönemleri için geçerlidir (Madde 20). Ortalaman yükselince sınırın da yükselir, yani bir sonraki dönem daha çok ders alabilirsin.",
          },
        ],
      },
      {
        heading: "Sınırın üstüne çıkabildiğin durumlar",
        blocks: [
          {
            kind: "p",
            text: "Yönetmelik beş ayrı istisna sayıyor. Hangisine girdiğini kimse sana söylemez, kendin bakman gerekir:",
          },
          {
            kind: "list",
            items: [
              "Ortalaman 1,60 ve üstüyse ve 198 AKTS tamamladıysan 42 AKTS'ye kadar alabilirsin.",
              "Güz sonunda 180 AKTS'yi tamamladıysan bahar döneminde sınırın yükselir.",
              "On dördüncü döneminde (azami sürenin son dönemi) isen ortalamaya bakılmaz.",
              "Çift anadal yapıyorsan sınırın 42 AKTS'dir.",
              "Yatay geçiş ya da transferle 24 AKTS üstü ders saydırdıysan sınırın yükselir.",
            ],
          },
        ],
      },
      {
        heading: "Yaz okulu ayrı hesaplanır",
        blocks: [
          {
            kind: "p",
            text: "Yaz okulunda sınır herkes için 18 AKTS'dir, ortalamana bakılmaz. Önemli ayrıntı: bu 18 AKTS'ye başka üniversiteden alacağın dersler ile staj ve sertifika programları da dahildir (Madde 20/3). Yani yaz planını yalnızca Özyeğin derslerinden ibaret sanma.",
          },
        ],
      },
      {
        heading: "Ortalaman 2,00'ın altındaysa",
        blocks: [
          {
            kind: "p",
            text: "GNO'su 2,00'ın altına düşen öğrenci sınamalı sayılır (Madde 34). Sınamalı olmak ders yükünü doğrudan 30 AKTS'ye kilitler; yani ortalamayı düzeltmek için daha çok ders alma seçeneğin yoktur. Çıkış yolu, aldığın az sayıda dersten yüksek not almaktır.",
          },
          {
            kind: "note",
            text: "Yol haritası sayfasına notlarını girersen ortalaman ve o dönemki AKTS sınırın kendiliğinden hesaplanır; planlayıcı sepetin sınırı aşarsa uyarır.",
          },
        ],
      },
    ],
    sources: [
      REGULATION,
      { label: "Öğrenci Hizmetleri: Derslere kayıt", url: "https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/donem-ve-ders-kayitlari/derslere-kayit" },
    ],
    related: [
      { label: "Mezuniyet yol haritası ve ortalama hesabı", href: "/ozyegin/yol-haritasi" },
      { label: "Program oluşturucu", href: "/ozyegin" },
    ],
  },

  {
    slug: "dersten-cekilme",
    title: "Özyeğin'de dersten çekilme (W): kaç ders, ne zaman, hangi tuzaklar?",
    description:
      "Dönemde en fazla iki dersten çekilebilirsin. Yan koşullu dersler birlikte gider ve tekrar dersinden çekilmek eski notunu geçerli bırakır.",
    lede: "Dersten çekilme, dönem ortasında bir dersi bırakmandır. Ders transkriptte W olarak görünür ve ortalamaya girmez. Ama üç kuralı bilmeden yapılırsa pahalıya mal olur.",
    sections: [
      {
        heading: "Dönemde en fazla iki ders",
        blocks: [
          {
            kind: "p",
            text: "Güz ve bahar dönemlerinde en fazla iki dersten çekilebilirsin ve aldığın derslerin hepsinden birden çekilemezsin (Madde 23). Bu sayacı üniversite senin için tutmaz; kaç hakkını kullandığını kendin takip etmelisin.",
          },
        ],
      },
      {
        heading: "Yan koşullu dersler birlikte gider",
        blocks: [
          {
            kind: "p",
            text: "Yan koşul, iki dersin aynı dönem birlikte alınması kuralıdır; laboratuvarlı dersler buna örnektir. Yan koşullu dersler birlikte alınmak, birlikte bırakılmak ve birlikte çekilmek zorundadır (Madde 19). Yani bir dersten çekilmek aslında iki dersini birden götürebilir.",
          },
        ],
      },
      {
        heading: "Asıl tuzak: tekrar dersinden çekilmek",
        blocks: [
          {
            kind: "note",
            text: "Tekrar ettiğin bir dersten çekilirsen o ders tekrar edilmemiş sayılır ve eski notun geçerli kalır (Madde 23/3).",
          },
          {
            kind: "p",
            text: "Bunun anlamı şu: F aldığın bir dersi silmek için tekrar alıp sonra çekilirsen, F yerinde durur ve iki çekilme hakkından birini de boşa harcamış olursun. Tekrar dersinden çekilmek seni başladığın yere döndürür.",
          },
        ],
      },
      {
        heading: "Yaz okulunda çekilme yok",
        blocks: [
          {
            kind: "p",
            text: "Yaz okulunda çekilme uygulanmaz; onun yerine ders iptali vardır ve iptal edilen ders transkripte hiç yazılmaz.",
          },
        ],
      },
    ],
    sources: [
      { label: "Öğrenci Hizmetleri: Dersten çekilme", url: "https://studentservices.ozyegin.edu.tr/tr/ogrenci-hizmetleri/donem-ve-ders-kayitlari/dersten-cekilme" },
      REGULATION,
    ],
    related: [
      { label: "Mezuniyet yol haritası", href: "/ozyegin/yol-haritasi" },
      { label: "Ön koşul zinciri", href: "/ozyegin/on-sart-diyagrami" },
    ],
  },

  {
    slug: "ders-tekrari-ve-ortalama",
    title: "Özyeğin'de ders tekrarı ve not yükseltme: hangi dersi tekrar alabilirsin?",
    description:
      "B ve üstü not aldığın ders tekrarlanamaz; B- ve altı, C veya daha yüksek alınana kadar tekrarlanabilir. GNO, MNO ve onur koşulları.",
    lede: "Not yükseltmenin bir sınırı var: her dersi istediğin kadar tekrar alamazsın.",
    sections: [
      {
        heading: "Hangi ders tekrarlanır",
        blocks: [
          {
            kind: "table",
            head: ["Aldığın not", "Durum"],
            rows: [
              ["F", "Tekrar almak zorundasın"],
              ["D, D+, C-, C, C+, B-", "Tekrar alabilirsin; C veya daha yükseğini alana kadar"],
              ["B, B+, A-, A", "Tekrar alamazsın"],
            ],
          },
          {
            kind: "p",
            text: "Kural Madde 24/3'te: B ve üstü not alınan ders tekrarlanamaz, B- ve altı ise C veya daha yüksek bir not alınana kadar tekrarlanabilir. Tekrarda geçerli olan son aldığın nottur.",
          },
        ],
      },
      {
        heading: "GNO ile MNO aynı şey değil",
        blocks: [
          {
            kind: "p",
            text: "Transkriptindeki genel not ortalaması (GNO) aldığın bütün dersleri kapsar. Mezuniyet not ortalaması (MNO) ise yalnızca mezuniyet için sayılan dersleri kapsar; müfredat dışında fazladan aldığın seçmeliler MNO'ya girmez (Madde 31 ve 35). Bu yüzden iki ortalama farklı çıkabilir.",
          },
          {
            kind: "p",
            text: "Mezun olmak için 240 AKTS'yi tamamlamak ve MNO'nun en az 2,00 olması gerekir.",
          },
        ],
      },
      {
        heading: "Onur ve yüksek onur",
        blocks: [
          {
            kind: "p",
            text: "Dönem ortalaman yüksek diye otomatik onur listesine girmezsin. Dört koşulun hepsi gerekir (Madde 34/2):",
          },
          {
            kind: "list",
            items: [
              "Genel not ortalaman en az 2,00 olmalı.",
              "O dönem, notu olmayan dersler hariç en az 24 AKTS almış olmalısın.",
              "Disiplin cezan olmamalı.",
              "O dönem aldığın bütün derslerden geçer not almalısın.",
            ],
          },
        ],
      },
    ],
    sources: [REGULATION],
    related: [
      { label: "Ortalama hesabı ve yol haritası", href: "/ozyegin/yol-haritasi" },
      { label: "Ders yükü sınırı", href: "/ozyegin/rehber/ders-yuku" },
    ],
  },

  {
    slug: "ders-kaydi-ve-ekle-birak",
    title: "Özyeğin ders kaydı ve ekle-bırak: adım adım ne yapman gerekiyor?",
    description:
      "Ders kaydı, ekle-bırak dönemi, kayıt yenilememenin sonucu, çakışma ve devam kuralları. Kayıt gününe hazırlık için kısa rehber.",
    lede: "Ders kaydı SIS üzerinden yapılır ve kayıt günü sistem yoğun olur. İşin büyük kısmını önceden bitirirsen o gün sadece kodları girersin.",
    sections: [
      {
        heading: "Kayıt gününden önce",
        blocks: [
          {
            kind: "list",
            items: [
              "Bu dönem alman gereken dersleri müfredattan çıkar.",
              "Çakışmayan program seçeneklerini önceden kur ve beğendiğini kaydet.",
              "Her ders için yedek şube belirle: seçtiğin şube dolarsa programın bozulmadan geçebileceğin bir alternatif olsun.",
              "Ön koşulunu sağlamadığın ders varsa kayıt sırasında sistem seni durdurur; bunu önceden gör.",
            ],
          },
          {
            kind: "note",
            text: "Planlayıcıda program kurup \"Kayıt günü planı\" panelinden yedek şubelerini çıkarabilirsin.",
          },
        ],
      },
      {
        heading: "Kaydını yenilemezsen ne olur",
        blocks: [
          {
            kind: "p",
            text: "Ekle-bırak dönemi bitene kadar kaydını yenilemezsen kayıtsız öğrenci sayılırsın: o dönem derslere ve sınavlara giremezsin, öğrencilik haklarından yararlanamazsın. Ama geçen süre yine de öğrenim sürenden sayılır (Madde 15). Yani dönemi kaybedersin, süren işlemeye devam eder.",
          },
        ],
      },
      {
        heading: "Çakışma kuralı tek değil",
        blocks: [
          {
            kind: "p",
            text: "İlk kez aldığın derslerde saat çakışması kesinlikle kabul edilmez. Tekrar aldığın derslerde ise çakışmaya izin verilip verilmeyeceğini fakülte yönetim kurulu belirler (Madde 21/4). Yani bu sorunun tek bir cevabı yok, kendi fakültenin kuralına bakman gerekir.",
          },
        ],
      },
      {
        heading: "Devam zorunluluğunu hoca belirler",
        blocks: [
          {
            kind: "p",
            text: "Merkezi bir devamsızlık sınırı yoktur. Her dersin öğretim üyesi kendi devam kuralını belirler ve dönem başında ilan eder (Madde 27). Sağlık raporu kural olarak mazeret sayılmaz; istisnai durumlarda karar fakülte kuruluna aittir. Bu yüzden her dersin izlencesini dönem başında okumak gerekir.",
          },
          {
            kind: "note",
            text: "Planlayıcıdaki devamsızlık takibi paneline kaçırdığın ders saatlerini girersen kalan hakkını gösterir; sınırı kendi dersine göre değiştirebilirsin.",
          },
        ],
      },
    ],
    sources: [
      { label: "Öğrenci Hizmetleri: Kayıt yenileme", url: "https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/donem-ve-ders-kayitlari/kayit-yenileme" },
      { label: "Öğrenci Hizmetleri: Derslere kayıt", url: "https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/donem-ve-ders-kayitlari/derslere-kayit" },
      REGULATION,
    ],
    related: [
      { label: "Program oluşturucu", href: "/ozyegin" },
      { label: "Akademik takvim", href: "/ozyegin/takvim" },
      { label: "Ön koşul zinciri", href: "/ozyegin/on-sart-diyagrami" },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
