# Veri modeli v2: topluluk, doğrulama, mentorluk, bildirim, mesajlaşma, moderasyon

Tarih: 17 Kasım 2026. Kaynak: `docs/proje-plani.md` §5, §7.4–7.7, §13. Bu belge migration 015–020'nin sözleşmesidir. Uygulayan PR, tasarımdan ayrılırsa bu belgeyi de aynı PR'da günceller.

Genel kurallar:

- Bütün kimlikler `uuid`.
- Durum alanları `text` + `CHECK` olarak tutulur, PostgreSQL enum tipi kullanılmaz.
- Silme yumuşaktır (`status`); bir kullanıcı silinirse içeriği "silinmiş kullanıcı" olarak görünür.
- Yetki kontrolü yalnızca sunucuda yapılır.

## Roller

Proje planındaki rol ve doğrulama ayrımı:

- **Beyan edilen rol:** `profile.role` (`candidate | student | graduate`). Kullanıcı kendisi değiştirir; hiçbir yetki vermez.
- **Yetki rolleri:** `users.roles text[] NOT NULL DEFAULT '{}'`. Değerler `reviewer`, `moderator`, `admin` olabilir. Yalnızca `admin` atar. Geliştirme hesabına `admin` verilir. Üretimde ilk yönetici `ADMIN_EMAILS` ortam değişkeninden gelir; `SOURCE_MANAGER_EMAILS` için de aynı desen kullanılır. Migration 016'da eklenir.
- **Doğrulanmış iddia:** `verification_requests` tablosunda `approved` durumundaki kayıt. Rozet yalnızca bu kayıttan gelir.

## 015 · Topluluk genişletme ve deneyimler

```sql
ALTER TABLE communities ADD COLUMN kind text NOT NULL DEFAULT 'general'
  CHECK (kind IN ('general','university','program'));
ALTER TABLE communities ADD COLUMN university_id uuid REFERENCES universities(id);
-- Mevcut program toplulukları kind='program' olarak güncellenir.
-- Katalogdaki her gerçek üniversite için tek bir 'university' topluluğu eklenir (idempotent).
ALTER TABLE questions ADD COLUMN status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted'));
ALTER TABLE questions ADD COLUMN accepted_answer_id uuid REFERENCES answers(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN search tsvector GENERATED ALWAYS AS
  (to_tsvector('turkish', title || ' ' || body)) STORED;  -- GIN indeksi
ALTER TABLE answers ADD COLUMN status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted'));
CREATE TABLE experiences (
  id uuid PRIMARY KEY, community_id uuid NOT NULL REFERENCES communities(id),
  author_id uuid NOT NULL REFERENCES users(id), program_id uuid REFERENCES programs(id),
  topic text NOT NULL CHECK (topic IN ('ders','hazirlik','staj','kampus','barinma','kariyer','diger')),
  experience_year integer NOT NULL CHECK (experience_year BETWEEN 1990 AND 2100),
  author_status text NOT NULL CHECK (author_status IN ('student','graduate')),  -- deneyim anındaki durum
  title text NOT NULL, body text NOT NULL,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE experience_votes (experience_id uuid REFERENCES experiences(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (experience_id, user_id));
```

API (`server/routes/community.ts` genişletilir; deneyimler ayrı bir `experiences.ts` dosyasında):

- `GET /communities?kind=&universityId=&q=`
- `GET /questions?communityId=&tag=&q=&sort=new|unanswered`
- `PUT /questions/:id/accepted-answer` (yalnızca soru sahibi) ve `DELETE` karşılığı
- `GET /experiences?communityId=&programId=&topic=`, `POST /experiences`, `PUT /experiences/:id`, `DELETE /experiences/:id` (yazar veya moderatör), `PUT|DELETE /experiences/:id/vote`

Kabul ölçütleri:

- Soru doğru topluluğa bağlanır.
- Oy tekrarlanamaz ve kişi kendi içeriğine oy veremez.
- `hidden` ve `deleted` içerik listelerde görünmez.
- Deneyim kartı "öğrenci deneyimi · <yıl>" etiketiyle resmi bilgiden ayrı görünür.

Uygulama notları (PR, migration 015):

- Program toplulukları `university_id` alanını da taşır; böylece `GET /communities?universityId=` bir üniversitenin hem üniversite hem bölüm topluluklarını döndürür. Üniversite topluluğu `communities(university_id) WHERE kind='university'` kısmi unique indeksiyle tekildir. "Gerçek üniversite", en az bir `is_sample=false` programı olan üniversitedir. `catalog:osym` içe aktarımı yeni üniversite ve program topluluklarını aynı işlemde oluşturur.
- `sort=unanswered` filtre değil sıralamadır: yanıtsız sorular önce gelir. Arama `websearch_to_tsquery('turkish', q)` ile yapılır, sonuç `ts_rank` ile sıralanır. Eski `search` parametresi `q` için takma ad olarak kabul edilir.
- Deneyimde tekrar oy `409 DUPLICATE_VOTE`, kendine oy `400 SELF_VOTE` döner. Deneyim yazmak için beyan edilen rol `student` veya `graduate` olmalıdır; `author_status` bu rolden alınır. Mezunun etiketi "mezun deneyimi · <yıl>" olur.
- Moderatör ile silme, `users.roles` gelince (016) eklenecek. 015'te yalnızca yazar düzenler veya siler. İtibar olayları `server/services/community-rules.ts` içindeki `onContributionEvent` kancasına bağlanacak.

## 016 · Doğrulama ve itibar

```sql
ALTER TABLE users ADD COLUMN roles text[] NOT NULL DEFAULT '{}';
CREATE TABLE university_email_domains (university_id uuid REFERENCES universities(id), domain text PRIMARY KEY);
CREATE TABLE verification_requests (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim text NOT NULL CHECK (claim IN ('student','graduate')),
  university_id uuid NOT NULL REFERENCES universities(id), program_id uuid REFERENCES programs(id),
  method text NOT NULL CHECK (method IN ('institution_email','document')),
  institution_email text, email_token_hash text, email_token_expires_at timestamptz,
  document_path text, document_mime text, document_bytes integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  reviewer_id uuid REFERENCES users(id), reviewed_at timestamptz, decision_note text,
  created_at timestamptz NOT NULL DEFAULT now());
-- Bir kullanıcının aynı iddia için tek bir açık (pending) başvurusu olabilir: kısmi unique indeks.
CREATE TABLE reputation_events (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, source_type text NOT NULL, source_id uuid NOT NULL, actor_id uuid,
  delta integer NOT NULL, rule_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, source_type, source_id, actor_id));
```

Kurallar:

- **Kurumsal e-posta yöntemi:** Alan adı `university_email_domains` tablosunda o üniversiteyle eşleşmeli. Başlangıçta yalnızca kaynağı bulunan alan adları eklenir; tahmin edilmez. Gelen belirteç tıklanınca başvuru `approved` olur. Bu yöntem yalnızca üniversite düzeyinde öğrencilik kanıtı sayılır. Bölüm, mezuniyet ve güncel öğrencilik ancak belgeyle onaylanır.
- **Belge yöntemi:** PDF, JPEG veya PNG; en fazla 5 MB. Dosya türü uzantıdan değil içeriğin ilk baytlarından kontrol edilir. Belge `var/private-uploads/` altında rastgele bir adla saklanır. Statik sunucu bu klasörü sunmaz. Belgeyi yalnızca `reviewer` veya `admin` rolündeki kullanıcı yetkili bir uç nokta üzerinden indirebilir. Karar verildikten 30 gün sonra belge silinir.
- **Kendi kendini onaylama:** Kullanıcı kendi başvurusunu onaylayamaz, inceleyici olsa bile.
- **Rozet:** `revoked` durumuna geçen başvurunun rozeti hemen kalkar. Rozet kapsamı açıkça yazılır, ör. "İSUBÜ öğrencisi (kurumsal e-posta)".
- **İtibar kuralları (`rule_version='v1'`):**
  - Yanıta gelen faydalı oy: +2
  - Kabul edilen yanıt: +5
  - Deneyime gelen faydalı oy: +1
  - Oy geri alınırsa aynı kurala karşılık negatif bir olay yazılır.
  - Kişinin kendi içeriğine verdiği oy itibar olayı üretmez.
- **İtibar puanı:** `SUM(delta)` ile hesaplanır. Her değişimin nedeni olay kaydından izlenebilir.
- **Ön koşul:** Doğrulama başvurusu doğrulanmış e-posta ister (`requireVerifiedEmail`, migration 014).

API:

- Kullanıcı: `POST /verifications`, `GET /verifications/mine`, `GET /verifications/confirm?token=`
- İnceleyici: `GET /admin/verifications?status=`, `GET /admin/verifications/:id/document`, `PUT /admin/verifications/:id` (approve, reject veya revoke + not)
- Herkese açık: `GET /users/:id/public` (ad, rozetler, itibar)

Uygulama notları (PR, migration 016):

- `reputation_events` üzerindeki `UNIQUE (kind, source_type, source_id, actor_id)` uygulanmadı: oy → geri al → yeniden oy aynı anahtarla birden çok olay gerektirir. Bunun yerine olay, aynı kural/kaynak/oy veren için net toplam 0 iken yalnız pozitif, pozitifken yalnız negatif yazılır (danışma kilidiyle). Negatif olay aynı `kind` değerini taşır. Kabul edilen yanıt değişirse eski yanıt için −5 yazılır.
- `users.roles` yalnızca `reviewer|moderator|admin` değerlerini kabul eder (CHECK). `ADMIN_EMAILS` API açılışında mevcut hesaplara uygulanır; geliştirme hesabı dev-login ile admin olur. Yönetici kendi admin rolünü kaldıramaz.
- Rol atama: `GET /admin/users?q=`, `PUT /admin/users/:id/roles` (yalnızca admin). Moderasyon: `PUT /moderation/{questions|answers|experiences}/:id` gövde `{status:'visible'|'hidden'}` (moderatör veya admin); `DELETE /experiences/:id` moderatöre de açıktır.
- Kurumsal e-posta yalnızca `claim='student'` ve program seçilmeden kabul edilir; bağlantı `/dogrulama?token=` sayfasına gelir, sayfa `GET /verifications/confirm` çağırır. Aynı kurumsal adres başka hesapta açık/onaylı başvuruda kullanılamaz. İnceleyici e-posta başvurusunu onaylayamaz, yalnızca reddedebilir. Ret ve kaldırmada not zorunludur.
- Belge `POST /verifications?claim=&universityId=&programId=` ile ham gövde olarak gönderilir (`express.raw`, 5 MB). Alan adı seed'i katalogdaki tam adla eşleşir; katalog migration'dan sonra yüklenirse API açılışında tamamlanır. Form verisi: `GET /verifications/options?universityId=`.
- Kart yanıtları `authorId`, `authorBadges`, `authorReputation` alanlarını taşır.

## 017 · Mentorluk

```sql
CREATE TABLE mentor_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accepting boolean NOT NULL DEFAULT true, topics text[] NOT NULL DEFAULT '{}',
  bio text NOT NULL DEFAULT '', university_id uuid REFERENCES universities(id), program_id uuid REFERENCES programs(id),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mentorship_requests (
  id uuid PRIMARY KEY, mentee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL, message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz,
  CHECK (mentee_id <> mentor_id));
CREATE UNIQUE INDEX mentorship_open_pair ON mentorship_requests(mentee_id, mentor_id)
  WHERE status IN ('pending','accepted');
```

Kurallar:

- Mentor profili açmak için onaylı bir doğrulama gerekir.
- Kabul veya ret yalnızca mentor tarafından yapılır. İptal yalnızca mentee tarafından yapılır. Tamamlama ikisinden biri tarafından yapılabilir.
- Engelleme varsa (migration 020) yeni talep reddedilir. 020'den önce bu kontrol bir yardımcı fonksiyonla bağlanır; tablo gelince fonksiyon gerçek kontrolü yapar.
- Kabul edilen talep mesajlaşma iznini açar (019).

API: `GET /mentors?universityId=&programId=&topic=`, `PUT /mentor-profile`, `POST /mentorship-requests`, `GET /mentorship-requests?box=incoming|outgoing`, `PUT /mentorship-requests/:id` (`accept`, `decline`, `cancel` veya `complete`).

## 018 · Bildirimler

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, payload jsonb NOT NULL, read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);
```

- **Bildirim türleri:** `answer_received`, `answer_accepted`, `verification_decided`, `mentorship_request`, `mentorship_response`, `message_received`.
- **Payload:** Yalnızca kimlik ve başlık taşır. Mesaj içeriği veya belge bilgisi asla yazılmaz.
- **Teslim:** Arayüz bildirimleri 30 saniyede bir yoklar.
- **API:** `GET /notifications?unread=`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`.

## 019 · Şifreli mesajlaşma

Ayrıntılar `docs/karar-mesajlasma.md` içinde.

```sql
CREATE TABLE user_keys (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key text NOT NULL, wrapped_private_key text NOT NULL, wrap_nonce text NOT NULL,
  kdf_salt text NOT NULL, kdf_ops integer NOT NULL, kdf_mem integer NOT NULL,
  key_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE conversations (id uuid PRIMARY KEY, user_a uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, origin text NOT NULL CHECK (origin IN ('mentorship')),
  mentorship_request_id uuid REFERENCES mentorship_requests(id), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b), UNIQUE (user_a, user_b));
CREATE TABLE messages (id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ct_recipient text NOT NULL, nonce_recipient text NOT NULL, ct_sender text NOT NULL, nonce_sender text NOT NULL,
  sender_key_version integer NOT NULL, recipient_key_version integer NOT NULL,
  client_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (sender_id, client_id));
```

- Sunucu düz metin görmez. `client_id` ile aynı mesajın tekrar gönderilmesi aynı kaydı döndürür (idempotent).
- **API:**
  - `PUT /keys/me`, `GET /keys/:userId`
  - `GET /conversations`
  - `GET /conversations/:id/messages?after=`
  - `POST /conversations/:id/messages`
- Mesajlar 5 saniyede bir yoklanır.

## 020 · Engelleme, şikâyet, moderasyon, denetim kaydı

```sql
CREATE TABLE blocks (blocker_id uuid REFERENCES users(id) ON DELETE CASCADE, blocked_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (blocker_id, blocked_id), CHECK (blocker_id <> blocked_id));
CREATE TABLE reports (id uuid PRIMARY KEY, reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('question','answer','experience','user','message')),
  target_id uuid NOT NULL, reason text NOT NULL CHECK (reason IN ('spam','harassment','misinformation','privacy','other')),
  details text NOT NULL DEFAULT '', shared_excerpt text,  -- yalnızca mesaj şikâyetinde, kullanıcının açık onayıyla
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  handled_by uuid REFERENCES users(id), handled_at timestamptz, resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE moderation_flags (id uuid PRIMARY KEY, target_type text NOT NULL, target_id uuid NOT NULL,
  score real NOT NULL, rule_version text NOT NULL, matched text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE user_sanctions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('warning','mute','suspend')), until timestamptz, reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), lifted_at timestamptz);
CREATE TABLE audit_log (id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
  target_type text NOT NULL, target_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
```

- **Engelleme:** Her iki yönde de geçerlidir. Mentorluk talebi, mesaj gönderimi ve bildirim üretimi engellenir. Engellenen kullanıcının içeriği, engelleyen kullanıcının akışında gizlenir. Kontrol tek bir `isBlocked(a, b)` yardımcısıyla yapılır.
- **Yaptırımlar:**
  - `mute`: içerik ve mesaj üretimini durdurur.
  - `suspend`: oturum açmayı engeller.
  - Her yönetim işlemi `audit_log` tablosuna yazılır. `audit_log` yalnızca eklemeye açıktır; uygulama UPDATE veya DELETE çalıştırmaz.
- **Toksisite işaretleme:**
  - `rule_version` ile sürümlenen Türkçe kural listesi kullanılır.
  - İçerik oluşturulunca puanlanır.
  - Eşiği aşan içerik moderatör kuyruğuna düşer ama otomatik gizlenmez.
  - Yanlış pozitifler, moderatör kararıyla (`dismissed`) birlikte kaydedilir.
- **Özel mesaj şikâyeti:** İstemci, kullanıcının seçtiği mesajların düz metnini kullanıcının açık onayıyla `shared_excerpt` alanına koyar. Sunucunun mesajları çözebileceği bir arka kapı yoktur.
- **API:**
  - `PUT|DELETE /blocks/:userId`
  - `POST /reports`
  - Moderatör: `GET /admin/reports`, `PUT /admin/reports/:id`, `GET /admin/flags`, `PUT /admin/content/:type/:id` (gizle veya geri getir), `POST /admin/sanctions`, `GET /admin/audit`
  - Yönetici: `PUT /admin/users/:id/roles`

## Arayüz sayfaları

| Sayfa | Yol |
|---|---|
| Topluluk ana sayfası (üniversite/bölüm seçimi, sorular, deneyimler) | `/topluluk`, `/topluluk/:slug` |
| Deneyim yaz | `/topluluk/:slug/deneyim` |
| Doğrulama başvurusu ve durumu | `/dogrulama` |
| Mentorlar ve talepler | `/mentorlar`, `/mentorluk` |
| Bildirimler | Üst çubukta zil ikonu + `/bildirimler` |
| Mesajlar | `/mesajlar`, `/mesajlar/:id` |
| Yönetim (inceleme, şikâyetler, işaretler, yaptırımlar, denetim) | `/yonetim/*` (rol kontrollü) |
