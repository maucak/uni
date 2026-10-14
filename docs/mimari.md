# İlk temel mimarisi

React/Vite istemcisi `/api/v1` üzerinden Express 5 API'ye bağlanır. Geliştirmede Vite proxy kullanılır; istemci API gizli anahtarlarını bilmez. PostgreSQL kalıcı veri kaynağıdır. Yerel tarayıcı saklamasında yalnızca karşılaştırma seçimi bulunur; hesap veya tercih listeleri localStorage prototipi değildir.

API modülleri: `routes/auth`, `routes/catalog`, `routes/preferences`, `routes/community`. Öneri yöntemi ayrı saf servistir. SQL sorguları parametriktir; veri değişiklikleri gereken yerde transaction ve liste satırı kilidiyle yapılır. Migration'lar advisory lock ve checksum kullanır.

Üniversite, program ve yıllık veriler ayrıdır. Tercih listesi kullanıcıya aittir; liste başına `revision`, öğe başına sıra ve özel not vardır. Profil şu an doğrulanan JSONB sözleşmesinde tutulur; üniversite bağlantısı doğrulaması eklenince beyan/doğrulama ilişkisi ayrı tablolara taşınacaktır.

Mevcut oturum JWT içinde kullanıcı ve session kimliği taşır; her istekte session'ın veritabanında geçerli olması aranır. Çıkış session'ı siler. 12 saatlik ilk oturum, kısa erişim/refresh tasarımının tamamlandığı anlamına gelmez. Parola scrypt + benzersiz salt ile hash'lenir. Sınırları sonraki güvenlik aşamasında ele alınacak.

Üretim için Node sunucusu, PostgreSQL, HTTPS ve ortam anahtarları gereklidir. Embedded PostgreSQL yalnızca yerel kolay kurulum içindir. AI, mesajlaşma ve belge deposu bu ilk mimari diliminde henüz uygulanmamıştır.

Node'un yerleşik TypeScript type stripping desteği nedeniyle Node.js 24.12+ gerekir. Sunucu `node` ile çalışır; JSX istemci tarafında Vite ile derlenir. TypeScript tür kontrolü ayrıca `tsc --noEmit` ile yapılır.

Teknik kaynaklar: [Node TypeScript desteği](https://nodejs.org/api/typescript.html), [PostgreSQL initdb](https://www.postgresql.org/docs/current/app-initdb.html).
