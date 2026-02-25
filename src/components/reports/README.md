# 📊 Base Report System - Kullanım Kılavuzu

## 🎯 Amaç

Tüm hesaplama raporlarını (UBGT, Hafta Tatili, Fazla Mesai, Kıdem vb.) **tek bir standart** altında toplamak. 

**Artık**: Yamalı, tutarsız, her rapor farklı → **Profesyonel, bilirkişi standartlarına uygun, tek tip raporlar**

---

## 🏗️ Mimari

### `BaseReportLayout` Component

Tüm raporlar için ortak temel layout. İçerir:
- ✅ Header (rapor adı, tarih, butonlar)
- ✅ Kimlik Bilgileri Tablosu (çizgili grid)
- ✅ Bölümler (sections) - hesaplama, brüt-net, mahsuplaşma
- ✅ Export butonları (Yazdır, Word, PDF)
- ✅ Kapatma butonu

### Helper Components

1. **`ReportTable`**: Standart çizgili tablo (hesaplama detayları için)
2. **`BrutNetTable`**: Brüt → Net çeviri tablosu (yeşil net satırı, kırmızı kesintiler)
3. **`MahsuplasmaTable`**: Mahsuplaşma tablosu (yeşil sonuç satırı)

---

## 📝 Kullanım Örneği

### 1. Modal Component Oluşturma

```tsx
import BaseReportLayout, { 
  ReportTable, 
  BrutNetTable, 
  MahsuplasmaTable 
} from "@/components/reports/BaseReportLayout";

export default function MyReportModal({ open, onClose, data }: Props) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Yazdır
  const handlePrint = () => {
    const targetEl = document.getElementById("report-content");
    if (!targetEl) return;
    
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rapor Başlığı</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 8px 12px; font-size: 12px; }
    button { display: none !important; }
  </style>
</head>
<body>${targetEl.outerHTML}</body>
</html>`;
    
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    
    doc.open();
    doc.write(html);
    doc.close();
    
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 400);
    };
  };

  // Word indirme
  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      await downloadWordDocument(
        "Rapor_Basligi",
        "report-content",
        `Rapor_${new Date().toISOString().slice(0, 10)}.docx`
      );
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme
  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      await downloadPdfFromBackend("report_type", { ...data });
    } finally {
      setPdfBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <BaseReportLayout
            reportTitle="Rapor Başlığı"
            reportDate={new Date().toLocaleDateString("tr-TR")}
            identityInfo={[
              { label: "İşe Giriş Tarihi", value: data.startDate },
              { label: "İşten Çıkış Tarihi", value: data.endDate },
              { label: "Çalışma Süresi", value: data.duration },
            ]}
            sections={[
              // Bölüm 1: Hesaplama Tablosu
              {
                title: "Hesaplama Detayı",
                content: (
                  <ReportTable
                    headers={["Dönem", "Gün", "Ücret", "Tutar"]}
                    rows={data.rows.map(row => [
                      row.period,
                      row.days.toString(),
                      `${fmt(row.wage)}₺`,
                      `${fmt(row.total)}₺`,
                    ])}
                    footer={[
                      "TOPLAM",
                      data.totalDays.toString(),
                      "",
                      `${fmt(data.totalAmount)}₺`,
                    ]}
                    alignRight={[1, 2, 3]}
                  />
                ),
              },
              // Bölüm 2: Brüt → Net
              {
                title: "Brüt'ten Net'e Çeviri",
                content: (
                  <BrutNetTable
                    rows={[
                      { label: "Brüt Alacak", value: `${fmt(data.brut)}₺` },
                      { label: "SGK Primi (%15)", value: `-${fmt(data.sgk)}₺`, isDeduction: true },
                      { label: "Gelir Vergisi", value: `-${fmt(data.gelir)}₺`, isDeduction: true },
                      { label: "Damga Vergisi", value: `-${fmt(data.damga)}₺`, isDeduction: true },
                      { label: "Net Alacak", value: `${fmt(data.net)}₺`, isNet: true },
                    ]}
                  />
                ),
              },
              // Bölüm 3: Mahsuplaşma (opsiyonel)
              ...(data.hasMahsuplasma ? [{
                title: "Mahsuplaşma",
                content: (
                  <MahsuplasmaTable
                    rows={[
                      { label: "Brüt Alacak", value: `${fmt(data.brut)}₺` },
                      { label: "İşverence Ödenen", value: `-${fmt(data.paid)}₺`, isDeduction: true },
                    ]}
                    netRow={{
                      label: "Mahsuplaşmadan Sonra Kalan",
                      value: `${fmt(data.remaining)}₺`,
                    }}
                  />
                ),
              }] : []),
            ]}
            onClose={onClose}
            onPrint={handlePrint}
            onWord={handleDownloadWord}
            onPdf={handleDownloadPDF}
            wordBusy={wordBusy}
            pdfBusy={pdfBusy}
            isOpen={open}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
```

---

## 🔧 Component API

### `BaseReportLayout`

```tsx
<BaseReportLayout
  reportTitle="string"           // Rapor başlığı
  reportDate="string"             // Tarih (opsiyonel, default: bugün)
  identityInfo={[                 // Kimlik bilgileri (opsiyonel)
    { label: "Alan", value: "Değer" }
  ]}
  sections={[                     // İçerik bölümleri
    { title: "Başlık", content: ReactNode }
  ]}
  onClose={() => {}}              // Kapat butonu
  onPrint={() => {}}              // Yazdır butonu
  onWord={() => {}}               // Word indirme butonu
  onPdf={() => {}}                // PDF indirme butonu
  wordBusy={false}                // Word indiriliyor mu?
  pdfBusy={false}                 // PDF indiriliyor mu?
  isOpen={true}                   // Modal açık mı?
/>
```

### `ReportTable`

```tsx
<ReportTable
  headers={["Sütun 1", "Sütun 2"]}
  rows={[
    ["Veri 1", "Veri 2"],
    ["Veri 3", "Veri 4"],
  ]}
  footer={["Toplam", "100₺"]}    // Opsiyonel
  alignRight={[1]}                // Sağa hizalanacak sütunlar (index)
/>
```

### `BrutNetTable`

```tsx
<BrutNetTable
  rows={[
    { label: "Brüt", value: "1000₺" },
    { label: "Kesinti", value: "-100₺", isDeduction: true },
    { label: "Net", value: "900₺", isNet: true },
  ]}
/>
```

### `MahsuplasmaTable`

```tsx
<MahsuplasmaTable
  rows={[
    { label: "Brüt", value: "1000₺" },
    { label: "Ödenen", value: "-200₺", isDeduction: true },
  ]}
  netRow={{
    label: "Kalan",
    value: "800₺",
  }}
/>
```

---

## 📋 Checklist: Mevcut Raporu Dönüştürme

- [ ] `BaseReportLayout` import et
- [ ] Helper component'leri import et (`ReportTable`, `BrutNetTable`, `MahsuplasmaTable`)
- [ ] Eski modal'ı sil veya yedekle
- [ ] Yeni modal component'i oluştur
- [ ] `identityInfo` verilerini hazırla
- [ ] `sections` array'ini doldur:
  - [ ] Hesaplama tablosu → `ReportTable`
  - [ ] Brüt-Net → `BrutNetTable`
  - [ ] Mahsuplaşma → `MahsuplasmaTable`
- [ ] Export fonksiyonlarını yaz (print, word, pdf)
- [ ] Ana sayfada import'u güncelle
- [ ] Test et!

---

## ✅ Standartlar

1. **Tüm raporlar aynı görünümde**
   - Aynı border style
   - Aynı padding
   - Aynı font
   - Aynı renk paleti

2. **Mahsuplaşma HER ZAMAN tablo**
   - Düz yazı YOK
   - Çizgili tablo formatı

3. **Butonlar her zaman aynı yerde**
   - Sağ üstte: Yazdır, Word, PDF, Kapat
   - Aynı renkler, aynı ikonlar

4. **Çıktı tutarlılığı**
   - Yazdır = Word = PDF (aynı içerik)
   - `report-content` ID'si kullan

---

## 🎨 Görsel Standartlar

- **Border**: `1px solid #999`
- **Padding**: `8px 12px`
- **Font**: `Inter, Arial, sans-serif`
- **Başlık**: `#1f2937` (dark gray)
- **Net satır**: `#dcfce7` (açık yeşil)
- **Kesinti**: `#dc2626` (kırmızı)
- **Tablo header**: `#f3f4f6` (açık gri)

---

## 🚀 Sonraki Adımlar

1. ✅ `BaseReportLayout` oluşturuldu
2. ✅ Hafta Tatili raporu adapte edildi
3. ⏳ UBGT raporu adapte edilecek
4. ⏳ Fazla Mesai raporu adapte edilecek
5. ⏳ Kıdem Tazminatı raporu adapte edilecek
6. ⏳ Tüm diğer raporlar

**Hedef**: Tüm raporlar bu sisteme geçirilecek. Hiçbir rapor farklı olmayacak!
