# Oy servisi (Deno Deploy + Deno KV)

Ders ve hoca oylarını saklar. Site (ozuhelper.github.io) yalnızca özetleri okur.
Adres: https://oylar.cizelge-oy.deno.net

Neden Cloudflare değil: `*.workers.dev` ve `*.pages.dev` adresleri Türkiye'den açılmıyor,
öğrenciler servise ulaşamazdı. `deno.net` açık.

## Uçlar

- `GET /ratings?school=ozyegin` — ders ve hoca özetleri (yeterli oy almayanlar hiç dönmez)
- `POST /ratings` — oy ver ya da kendi oyunu değiştir

## Yerelde çalıştırma

```sh
cd server
npm install                  # deno ikilisini kurar
IP_SALT=deneme PORT=8790 npx deno run --allow-net --allow-env --unstable-kv main.ts
```

## Yayın

Deno Deploy, master dalına her gönderimde `server/` klasörünü kendiliğinden yayınlar
(uygulama: cizelge-oy/oylar). Uygulamaya bir Deno KV veritabanı bağlı olmalı ve
`IP_SALT` ortam değişkeni dolu olmalıdır; boşsa IP özetleri tahmin edilebilir olur.

Sitenin bu adresi kullanması için `NEXT_PUBLIC_RATINGS_API` derlemede verilir
(.github/workflows/pages.yml).

## İsteğe bağlı: Turnstile (bot koruması)

Cloudflare panelinden bir Turnstile widget'ı açıp gizli anahtarı `TURNSTILE_SECRET` ortam
değişkenine yaz; sitede de `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ver. Boşsa doğrulama atlanır,
cihaz ve ağ sınırları yine çalışır.

## Saklananlar

Her oy için: okul, ders kodu, hoca adı (öğrencinin seçtiği), üç ile beş arası sayı, cihaz kimliği
(tarayıcıda üretilen rastgele metin) ve zaman. Ayrıca sınırları uygulamak için IP adresinin gizli
anahtarla karılmış özetinden türeyen, süresi dolunca silinen işaretler. Ad, öğrenci numarası ve
yazılı yorum alınmaz; IP adresinin kendisi saklanmaz.

## Geri bildirim e-postası (isteğe bağlı)

Geri bildirimler her hâlükârda veritabanına yazılır. Üstüne e-posta almak istersen
Deno Deploy panelinde iki değişken tanımla:

- `RESEND_KEY` — resend.com hesabından alınan API anahtarı
- `FEEDBACK_TO` — mesajların düşeceği adres (kendi e-postan)
- `FEEDBACK_FROM` — isteğe bağlı; kendi alan adını doğruladıysan "OzuHelper <mail@alanadin>" yazabilirsin.
  Tanımlanmazsa Resend'in `onboarding@resend.dev` adresi kullanılır; bu adresle yalnızca
  Resend hesabının kendi e-postasına gönderilebilir, başka adrese gitmez.

İkisi tanımlı değilse e-posta gönderimi kapalıdır, servis normal çalışır.
