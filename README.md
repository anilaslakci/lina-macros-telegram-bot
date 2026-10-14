# Lina Macros Telegram Destek Botu

Cloudflare Workers, Telegram Bot API webhook ve D1 üzerinde çalışan hazır cevaplı destek botu. AI servisi kullanmaz.

## Güvenlik

- Telegram tokeni ve webhook doğrulama anahtarı yalnızca Cloudflare Secret olarak saklanır.
- Yönetici yetkisi yalnızca `1146589481` sayısal Telegram kimliğiyle doğrulanır.
- Webhook, Telegram'ın `X-Telegram-Bot-Api-Secret-Token` başlığını doğrular.
- Telegram güncellemeleri D1'da tekilleştirilir; başarısız işlem tekrar denenebilir.
- Bir kullanıcı aynı anda yalnızca bir açık talep oluşturabilir.
- `.dev.vars`, `.env`, yerel D1 ve günlük dosyaları Git dışında tutulur.

## Geliştirme

```powershell
npm install
npm run check
npm run db:migrate:local
npm run dev
```

Hazır cevaplar `src/config/answers.json` dosyasındadır. Kimlikleri değiştirmeden yeni kategori, soru ve ikinci seviye yanıt eklenebilir.

## İlk yayın

1. Cloudflare hesabında oturum açın: `npx wrangler login`
2. D1 oluşturun: `npx wrangler d1 create lina-macros-support`
3. Komutun verdiği `database_id` değerini `wrangler.jsonc` içindeki yer tutucuyla değiştirin.
4. Şemayı uygulayın: `npm run db:migrate:remote`
5. Worker'ı yayınlayın: `npm run deploy`
6. Çıktıdaki `https://...workers.dev` adresiyle güvenli kurulum betiğini çalıştırın:
   `powershell -ExecutionPolicy Bypass -File .\scripts\configure-webhook.ps1 -WorkerUrl "https://...workers.dev"`

Betik BotFather tokenini ekranda göstermeden ister, Cloudflare Secrets'a kaydeder ve Telegram webhook gizli anahtarını otomatik oluşturur. Tokeni dosyaya yazmaz.

## Komutlar

- Kullanıcı: `/start`, `/menu`, `/help`
- Yönetici: `/tickets`, `/reply LM-000001 mesaj`, `/close LM-000001`

Yönetici ayrıca talep bildirimindeki **Yanıtla** ve **Kapat** düğmelerini kullanabilir.

## Sağlık ve günlükler

- Sağlık kontrolü: `GET /health`
- Canlı hata günlükleri: `npx wrangler tail`
- Webhook durumu gerektiğinde Telegram Bot API `getWebhookInfo` ile kontrol edilebilir.

