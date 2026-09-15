# Oy servisi (Cloudflare Worker + D1)

Ders oylarını saklar. Site (cizelge.github.io) yalnızca özetleri okur.

## Kurulum

```sh
cd worker
npm install
npx wrangler login                       # tarayıcıda Cloudflare hesabına izin ver
npx wrangler d1 create cizelge-oy        # çıktıdaki database_id'yi wrangler.jsonc'a yaz
npm run db:remote                        # tabloları oluştur
npx wrangler secret put IP_SALT          # rastgele uzun bir metin gir
npm run deploy                           # adres: https://cizelge-oy.<hesap>.workers.dev
```

Sitenin bu adresi kullanması için `NEXT_PUBLIC_RATINGS_API` değişkeni derlemede verilir
(.github/workflows/pages.yml içinde).

## İsteğe bağlı: Turnstile (bot koruması)

Cloudflare panelinden bir Turnstile widget'ı açıp:

```sh
npx wrangler secret put TURNSTILE_SECRET
```

Sitede de `NEXT_PUBLIC_TURNSTILE_SITE_KEY` verilirse oy gönderirken doğrulama yapılır.
Secret verilmezse doğrulama atlanır, cihaz ve ağ sınırları yine çalışır.

## Saklananlar

`votes`: okul, ders kodu, hoca adı (öğrencinin seçtiği), üç sayı, cihaz kimliği (tarayıcıda üretilen
rastgele metin), IP adresinin gizli anahtarla karılmış özeti ve zaman. Ad, öğrenci numarası ve
yazılı yorum alınmaz; IP adresinin kendisi saklanmaz.
