# 🚨 TOPLU DÜZELTME REHBERİ

## ✅ BİTENLER:
1. ✅ `safeFormat.ts` utility oluşturuldu
2. ✅ UBGT Standart - Tamamen düzeltildi
3. ✅ UBGT Bilirkişi - Tamamen düzeltildi
4. ✅ Kıdem sayfaları - Print fonksiyonları düzeltildi

## 🔄 DEVAM EDENLER (Otomatik Devam Edecek):

### Fazla Mesai Sayfaları (15 sayfa):
Her sayfada yapılacaklar:
1. Import ekle: `import { safeNumber, safeCurrency } from "@/utils/safeFormat";`
2. handlePrint'i düzelt (window.print() yerine printReportContent veya iframe)
3. .toLocaleString() kullanımlarına ?? 0 ekle

### Kıdem Sayfaları (10 sayfa):
1. ✅ Print fonksiyonları zaten düzeltildi
2. Sadece safeFormat import ve kullan

### İhbar Tazminatı Sayfaları:
1. safeFormat import
2. handlePrint düzelt
3. Type'ları optional yap

### Diğer Sayfa Grupları:
- Hafta Tatili
- Ücret Alacağı
- Yıllık İzin
- vb.

## 🛠️ HER SAYFA İÇİN 3 ADIM:

### 1. Import Ekle (En üste):
```typescript
import { safeNumber, safeCurrency, safeDays } from "@/utils/safeFormat";
```

### 2. Type Güvenliği (Interface'lerde):
```typescript
interface MyRow {
  value?: number;  // Optional yap
  total?: number;  // Optional yap
}
```

### 3. Güvenli Kullanım:
```typescript
// ÖNCE:
{row.value.toLocaleString("tr-TR", {...})}

// SONRA:
{safeCurrency(row.value)}
// veya
{(row.value ?? 0).toLocaleString("tr-TR", {...})}
```

### 4. Print Düzeltme:
```typescript
// ÖNCE:
const handlePrint = () => {
  window.print();
};

// SONRA:
const handlePrint = () => {
  printReportContent('hesaplama-print', 'Başlık', 'Başlık');
};
```

## 📋 ÖNCELIK SIRASI:

### YÜK SEK ÖNCELİK (En çok kullanılan):
1. ✅ UBGT sayfaları
2. 🔄 Standart Fazla Mesai
3. 🔄 Bilirkişi sayfaları
4. 🔄 Kıdem 30 İşçi
5. 🔄 Vardiya sayfaları

### ORTA ÖNCELİK:
- Gemi adamları
- Basın işçileri
- Yeraltı işçileri
- Mevsimlik

### DÜŞÜK ÖNCELİK:
- Özel durumlar
- Az kullanılan hesaplamalar

## 🎯 HEDEF:
Satışa sunulmadan önce tüm sayfalarda:
- ✅ undefined hatası olmamalı
- ✅ Print düzgün çalışmalı
- ✅ Type güvenliği olmalı

## ⚡ HIZLI FIX KOMUTU:
Herhangi bir sayfada hata olursa:
1. `safeFormat` import et
2. `.toLocaleString()` yerine `safeNumber()` veya `safeCurrency()` kullan
3. Bitti!



