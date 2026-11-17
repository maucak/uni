# Tek sunucuda dağıtım (Docker Compose)

Demo ve üretim için tek bir Linux sunucuda `compose.yaml` kullanılır. Servisler: `db` (PostgreSQL 16), `migrate` (tek seferlik), `api` (arayüz + API, ana makinede yalnızca `127.0.0.1:8080`) ve `worker` (`npm run sources:worker`). Derlenmiş arayüz (`dist/`) `NODE_ENV=production` iken API tarafından sunulur; ayrı bir web sunucusu gerekmez.

## 1. Kurulum

Gereksinim: Docker Engine 24+ ve Compose v2.

```bash
git clone https://github.com/maucak/uni.git && cd uni
cp .env.production.example .env.production
# POSTGRES_PASSWORD (openssl rand -hex 16), JWT_SECRET (openssl rand -hex 32) ve WEB_ORIGIN'i doldur
export COMPOSE_ENV_FILES=.env.production   # her komutta --env-file vermemek için
docker compose up -d --build
curl http://127.0.0.1:8080/api/v1/health
```

`.env.production` git'e girmez. Compose, değişken yerine koymayı bu dosyadan yapar (`--env-file .env.production` ya da `COMPOSE_ENV_FILES`); komut ortamda tanımlı değilse `POSTGRES_PASSWORD` hatası alırsın.

Notlar:

- `migrate` her `up`'ta çalışır, uygulanmış migration'lara dokunmaz; `api` ve `worker` bitmesini bekler.
- `WEB_ORIGIN`, tarayıcıda görülen adresle birebir aynı olmalı (ör. `https://kampus.example`). API, yazan isteklerde `Origin` başlığını bununla karşılaştırır.
- Üretimde çerez `Secure` işaretlidir; HTTPS olmadan (yalnızca `127.0.0.1` üzerinden) deneme dışında giriş yapılamaz.
- `MAIL_TRANSPORT=file`: gerçek e-posta gönderilmez, doğrulama bağlantıları `var/mail` altına yazılır (`docker compose exec api ls var/mail`).
- `/api/v1/auth/dev-login` üretimde kapalıdır.

### Katalog yükleme (bir kerelik)

```bash
docker compose run --rm api npm run db:seed          # örnek veri, isteğe bağlı
docker compose run --rm api npm run catalog:pilot
docker compose run --rm api npm run catalog:osym     # tam ÖSYM kataloğu
docker compose run --rm api npm run rag:index:local  # sözcük (lexical) arama dizini
```

### RAG modelleri ve Qdrant (isteğe bağlı)

Vektör modelleri imaja girmez. İstenirse `docker compose run --rm api npm run rag:models` modelleri `var/models` içine (`app_var` volume'u) indirir. Modeller yoksa yerel/sözcük tabanlı arama kullanılır (`RAG_SEARCH_BACKEND=local`).

Qdrant için mevcut `compose.rag.yaml` ayrı kalır, birleştirilmez. İki dosyayı birlikte kullan:

```bash
docker compose -f compose.yaml -f compose.rag.yaml up -d   # QDRANT_API_KEY de .env.production içinde olmalı
```

`.env.production` içine `RAG_SEARCH_BACKEND=qdrant`, `QDRANT_URL=http://qdrant:6333` ve `QDRANT_API_KEY` ekle; dizini `docker compose run --rm api npm run rag:qdrant:index` ile kur. Qdrant aynı Compose ağında olduğundan `qdrant` adıyla erişilir.

## 2. HTTPS için ters vekil

API yalnızca `127.0.0.1:8080` üzerinde dinler; dışarıya açan ters vekil sunucuda (konteyner dışında) çalışır. Vekil arkasında `.env.production` içine `TRUST_PROXY=1` yaz; böylece `req.secure`, istemci IP'si ve hız sınırı doğru çalışır, ve `WEB_ORIGIN=https://alanadi.example` olmalı. Sonra `docker compose up -d`.

Caddy (sertifikayı kendisi alır ve yeniler):

```
kampus.example {
    reverse_proxy 127.0.0.1:8080
}
```

Nginx (sertifika için certbot vb. ayrıca gerekir):

```nginx
server {
    listen 443 ssl;
    server_name kampus.example;
    # ssl_certificate ... ; ssl_certificate_key ... ;
    client_max_body_size 6m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 3. Yedekleme

İmajda PostgreSQL 16 istemci araçları (`pg_dump`) vardır. Yedek `app_var` volume'una (`/app/var/backups`) yazılır:

```bash
mkdir -p yedekler && sudo chown 1000:1000 yedekler   # imajdaki node kullanıcısı
docker compose run --rm -v "$PWD/yedekler:/app/var/backups" api npm run db:backup
```

Dump ve `.json` manifest ana makinedeki `yedekler/` klasörüne yazılır. Volume'a yazmak istersen `-v` olmadan çalıştır; dosyalar `app_var` içinde `/app/var/backups` altında kalır. Geri yükleme için `npm run db:restore` (bkz. README, "Yedekleme ve geri yükleme") aynı şekilde `docker compose run --rm api ...` ile çalışır; hedef veritabanı boş olmalıdır. Yedekler hesap verisi içerir: sunucu dışına güvenli biçimde kopyala, paylaşma.

## 4. Güncelleme

```bash
git pull
docker compose run --rm api npm run db:backup    # önce yedek
docker compose up -d --build                     # migrate yeni migration'ları uygular
curl http://127.0.0.1:8080/api/v1/health
docker compose logs --tail=50 api worker
```

Volume'lar (`db_data`, `app_var`) korunur. `docker compose down` volume'lara dokunmaz; **`down -v` veriyi siler**, kullanma.
