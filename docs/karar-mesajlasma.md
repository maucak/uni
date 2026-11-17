# Karar kaydı: uçtan uca şifreli mesajlaşma

Tarih: 17 Kasım 2026 · Durum: kabul edildi (ekip itiraz ederse güncellenir) · Migration: 019

## Karar

Bu sürüm yeni bir kriptografik protokol tasarlamaz; incelenmiş bir kütüphanenin hazır yapısını kullanır.

- **Kütüphane:** `libsodium-wrappers-sumo` (libsodium'un resmî JavaScript derlemesi). Sumo derlemesi seçildi, çünkü Argon2id (`crypto_pwhash`) yalnızca o derlemede var.
- **Mesaj şifreleme:** `crypto_box_easy`, yani X25519 + XSalsa20-Poly1305 ile kimlik doğrulamalı açık anahtar şifrelemesi. Her mesaj için rastgele 24 baytlık bir nonce üretilir.
- **Gönderici kopyası:** Her mesaj iki kez şifrelenir: bir kopya alıcının açık anahtarına, bir kopya göndericinin kendi açık anahtarına. Böylece gönderici de geçmişini okuyabilir.
- **Anahtar saklama:** Özel anahtar istemcide üretilir. Sunucuya yalnızca sarmalanmış hâli gider: Argon2id ile kullanıcının giriş parolasından türetilen anahtar ve `crypto_secretbox_easy` kullanılır. Bu sayede kullanıcı başka bir tarayıcıdan girdiğinde de geçmişine erişebilir. Sunucu parolayı ve özel anahtarı hiçbir zaman düz metin olarak görmez.
- **Kimlik doğrulama:** İki tarafın açık anahtarlarının özetinden "güvenlik kodu" (60 haneli) üretilir ve sohbet ekranında gösterilir. Kullanıcılar bu kodu başka bir kanaldan karşılaştırabilir.
- **İzin:** Sohbet yalnızca kabul edilmiş bir mentorluk talebiyle açılır. Engelleme mesaj gönderimini durdurur.

## Neden bu yapı?

- Plan (§13.1) "AES/ECDH/RSA birleştirerek yeni protokol icat edilmez" diyor. crypto_box, iyi bilinen tek parça bir yapı.
- Signal protokolü (libsignal) ileri gizlilik sağlar. Ancak web istemcisi, cihaz yönetimi ve oturum durumu bir ayda güvenle bitirilecek kapsamın dışında kalıyor.

## Bilinen sınırlar (raporda ve arayüzde açıkça yazılır)

- **İleri gizlilik yok:** Statik anahtar kullanılıyor. Özel anahtar ele geçirilirse geçmiş mesajlar da okunabilir.
- **Parola sıfırlama eski mesajları açmaz:** Sıfırlamada yeni bir anahtar çifti üretilir ve eski mesajlar okunamaz hâle gelir. Arayüz bunu sıfırlamadan önce söyler. Parola değiştirmede (eski parola bilindiği için) özel anahtar yeni parolayla yeniden sarmalanır.
- **Parola gücüne bağımlılık:** Sarmalanmış anahtarın güvenliği parolaya bağlıdır. Sunucu ele geçirilirse çevrim dışı parola denemesi yapılabilir. Argon2id parametreleri (`OPSLIMIT_MODERATE`, `MEMLIMIT_MODERATE`) bu denemeyi pahalılaştırır.
- **Sunucunun görebildikleri:** Metadata (kim kime, ne zaman, şifreli metnin boyutu) sunucuda görünür.
- **İstemci tarafı riskler:** XSS ya da kötü niyetli bir bağımlılık anahtarı çalabilir. Bu yüzden katı bir CSP uygulanır (helmet) ve üçüncü taraf script yüklenmez.
- **Moderasyon:** Sunucu mesajları okuyamaz. Şikâyette kullanıcı, açık onayıyla seçtiği mesajları düz metin olarak paylaşır.

## Test kabulü

- Veritabanında düz metin bulunmaz: Test, bilinen bir metni gönderir ve `messages` tablosunun hiçbir sütununda o metnin geçmediğini doğrular.
- **Yetki:** İzni olmayan kullanıcı mesaj gönderemez ve başkasının sohbetini okuyamaz.
- **Anahtar ömrü:** Parola değiştirme anahtarı korur, sıfırlama yeni anahtar üretir.
- **Tekrar gönderim:** Aynı `client_id` ile gelen mesaj çift kayıt oluşturmaz.
