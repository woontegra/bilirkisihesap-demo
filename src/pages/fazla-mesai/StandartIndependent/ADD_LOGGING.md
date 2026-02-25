# STANDART FAZLA MESAİ SAYFASI - LOGLAMA SİSTEMİ

## ✅ Eklenen Loglama Sistemi

### 1. Logger Utility (Dosya başında)
- `logger.input()` - Input değişiklikleri
- `logger.state()` - State değişiklikleri  
- `logger.effect()` - useEffect tetiklemeleri
- `logger.calc()` - Hesaplama sonuçları
- `logger.error()` - Hatalar
- `logger.warn()` - Uyarılar
- `logger.row()` - Satır işlemleri
- `logger.api()` - API çağrıları

### 2. Global Error Handler
- Tüm window error'ları yakalanıyor
- Unhandled promise rejection'lar loglanıyor

## 🔍 Kullanım

Console'da şu filtreleri kullanabilirsiniz:
- `[STANDART FM] [INPUT]` - Sadece input değişiklikleri
- `[STANDART FM] [STATE]` - Sadece state değişiklikleri
- `[STANDART FM] [ERROR]` - Sadece hatalar
- `[STANDART FM] [CALC]` - Sadece hesaplama logları

## 📝 Şimdi Yapılacaklar

Aşağıdaki kritik noktalara manuel log eklenecek:
1. ✅ iseGiris input
2. ✅ istenCikis input  
3. ✅ haftalikMesai input
4. ✅ weeklyDays input
5. ✅ include270 checkbox
6. ✅ zamanaşımı modal
7. ✅ rows state değişiklikleri
8. ✅ exclusions değişiklikleri
9. ✅ handleHesapla fonksiyonu
10. ✅ Tüm try-catch blokları
