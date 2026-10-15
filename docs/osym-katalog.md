# ÖSYM 2026 tam tablo aktarımı

15 Ekim 2026. Tablo-3 ve Tablo-4 içindeki resmî program kodlu tüm 21.493 satır aktarıldı; kaynak satırlarıyla tam mutabakat sağlandı. Tablo-3: 9.254 TYT önlisans. Tablo-4: 12.239 lisans. Devlet 12.042, vakıf 8.095, KKTC/yurt dışı 1.356 seçenek. Dil, burs, fakülte, ortak program ve özel uyruk seçenekleri ayrı resmî kodlarıyla tutulur. Sayı farklı bölüm adı sayısı değildir. 229 ayrı kurum/kılavuz başlığı var; bakanlık adına kontenjan grupları da bulunduğundan bu sayı doğrudan üniversite sayısı değildir.

## Kaynaklar ve yeniden üretim

Kaynak sayfa: https://osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-yks-yuksekogretim-programlari-ve-kontenjanlari-kilavuzu
Tablo-3: https://dokuman.osym.gov.tr/web/2026/7/tablo-3-29u1s7pl.xls
Tablo-4: https://dokuman.osym.gov.tr/web/2026/7/tablo-4-hohu0j-30164357.xls

Kaynak SHA-256 özetleri manifestte tutulur. `data/osym-2026-all.json.report.json` her tablonun kaynak ve aktarılan satır sayısını, sınıflandırılmamış satırları ve konum eksiğini kaydeder. Sınıflandırılmamış satır veya tekrar eden kod varsa üretici hata verir.

Python + xlrd==2.0.2 ile yeniden üretim: `python scripts/osym_extract_all.py TABLO3.xls TABLO4.xls data/osym-2026-all.json`. Yeni kaynak içeriği için yeni manifest sürümü kullanılmalıdır. Uygulanmış sürümün verisi değiştirilmez. Manifestin dosya biçimlendirmesi içerik checksum'unu değiştirmez.

Uygulama: `npm run catalog:osym`. npm run dev yerel katalogları sırayla, idempotent uygular. Eski seçilmiş katalog dosyası tarihsel kaynak olarak korunur. Aynı kaynak yeniden uygulanınca kayıt çoğalmaz. Mevcut 637 program kodla eşleştirildi; UUID'ler ve özel not/liste referansları korunur. ISUBÜ programlarının 2023–2025 kaynaklı geçmişi ve editoryal içeriği korundu.

## Alanların anlamı

2026 genel kontenjanı ve 2025 başarı sırası ayrı yıllardır. Kontenjan özel kontenjanları içermez. Tüm kaynak sütunları `program_admissions` içinde yıl/kaynak/satırla tutulur; detay ekranındaki ÖSYM kayıt ayrıntılarında açılır. Tablo-3'ün 13, Tablo-4'ün 24 sütunu korunur. Ham alanlar ilgili kaynak başlıklarıyla gösterilir; 2025 taban puanı 2026 puanı diye etiketlenmez. Burs oranından yıllık ücret üretilmez. Boş ve .../---- alanları sayısal ölçütlerde null kalır; ham kaynakta orijinal değer korunur.

14 eğitim dili ve TYT desteği eklendi. Kaynakta açık dil etiketi olmayan programlar kılavuzdaki varsayılan Türkçe etiketiyle aktarılır; program koşulları ayrıca incelenmelidir. Üniversitenin merkez şehri programın fiziksel yerleşkesini garanti etmez. Şehri kaynak başlığından bulunamayan kayıtlar Belirtilmedi olarak kalır; raporda listelenir. KKTC/yurt dışı kurumları Türkiye şehri gibi etiketlenmez.

## Kapsamın sınırı

Bu çalışma iki 2026 kılavuz tablosunu tamamlar; bütün üniversite verilerinin tamamlandığı iddiası değildir. Geçmiş yılların tamamı, 2026 gerçekleşmiş yerleştirme sonuçları, güncel öğrenim ücretleri, ayrıntılı AKTS/ders içerikleri, barınma ve yaşam maliyetleri bu tablolarla tamamlanmaz. YÖK Atlas için hazır API/otomatik erişim izni varsayılmaz. Özel yetenekle alınan veya bu tablolarda olmayan programlar dahil değildir.

Özel uyruk, açık/uzaktan, M.T.O.K., ortak/yurt dışı seçenekleri listede görünür; tüm kabul koşulları henüz otomatik filtre kuralları değildir. Program adı, koşul numaraları ve resmî kılavuz birlikte incelenmelidir. Yeni programlarda subjects boş; açıklama kılavuz üst verisidir, doğrulanmış ders içeriği değildir.

## Doğrulama

17 mevcut davranış testi geçti. Canlı DB/API kontrolü: 21.493 tekil kod, kaynak tablolarla birebir sayılar, 24 ham sütunlu lisans detay kaydı, TYT/dil/yurt dışı filtreleri, son sayfa, topluluk araması ve eski ISUBÜ geçmişi doğrulandı. Yeniden aktarım applied=false verdi. Katalog kaynak/yıllık veri eşlemesi doğrusal gruplamayla, öneri corpus erişimi kimlik haritasıyla çalışır. Katalog sonuçları sürüm anahtarıyla bellekte paylaşılır; topluluk araması sunucuda sınırlandırılır.

---

Önceki 637 programlık aktarımın manifesti `data/osym-2026-selected.json` ve üreticisi `scripts/osym_extract.py` tarihsel kayıttır; güncel başlatıcı tam tablo manifestini kullanır.
