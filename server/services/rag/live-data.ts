// These answers require a live service or explicitly current records, not FAQ similarity.
export function liveDataNotice(message: string): string {
  if (
    /(?:yurt|yemek|kurs).*(?:kaç\s*(?:tl|lira)|fiyatı|ücreti\s*(?:ne kadar|kaç))|(?:güncel|bu yılki).*(?:ücret|fiyat)/i.test(
      message,
    )
  )
    return "Güncel tutarı doğrulayabileceğim bir ücret kaydı bulunmuyor. Eski rehber metninden bugünün fiyatını çıkaramam; ilgili kurumun ödeme veya duyuru sayfasını kontrol etmelisin.";
  if (
    /boş (?:yurt|oda|kontenjan)|anlık kontenjan|şu an.*(?:boş|açık)|bugün.*(?:sefer|otobüs)|otobüs.*(?:saat kaç|kaç dakika)/i.test(
      message,
    )
  )
    return "Bu bilgi canlı kontenjan, işletme veya ulaşım verisi gerektiriyor. Şu an böyle bir canlı bağlantı bulunmadığı için kesin durum ya da saat veremiyorum.";
  if (
    /(?:kupon|indirim).*(?:aktif|geçerli|var mı)|(?:aktif|geçerli).*(?:kupon|indirim)/i.test(
      message,
    )
  )
    return "Henüz doğrulanmış aktif kampanya kaydı bulunmuyor. İşletmelerden gerçek kampanya verisi alınmadan kupon veya indirim varmış gibi gösteremem.";
  return "";
}
