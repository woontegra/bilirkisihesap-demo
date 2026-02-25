# 🎨 ZARİFLEŞTİRME REHBERİ
## Standart Fazla Mesai Sayfası - Modern Tasarım Dönüşümü

> Bu belge, Standart Fazla Mesai sayfasında yapılan tüm tasarım değişikliklerini detaylı olarak açıklar.
> Diğer sayfalara da aynı tasarım dilini uygulamak için bu rehberi kullanın.

---

## 📋 İÇİNDEKİLER
1. [Genel Tasarım Prensipler](#genel-tasarım-prensipler)
2. [Renk Paleti](#renk-paleti)
3. [Tipografi](#tipografi)
4. [Input Alanları](#input-alanları)
5. [Butonlar](#butonlar)
6. [Kartlar](#kartlar)
7. [Tablo](#tablo)
8. [Dropdown/Select](#dropdown-select)
9. [Accordion/Details](#accordion-details)
10. [Toast Mesajları](#toast-mesajları)
11. [Loading Spinner](#loading-spinner)
12. [Kod Örnekleri](#kod-örnekleri)

---

## 🎯 GENEL TASARIM PRENSİPLERİ

### 1. **Yumuşak Köşeler**
❌ **ÖNCE**: `rounded-md` (0.375rem = 6px)
✅ **SONRA**: `rounded-lg` (0.5rem = 8px) veya `rounded-xl` (0.75rem = 12px)

### 2. **Subtle Borders**
❌ **ÖNCE**: `border-[0.5px]` (çok ince, görünmez)
✅ **SONRA**: `border` (1px, standart) veya `border-2` (önemli elementler)

### 3. **Focus States**
❌ **ÖNCE**: Hiç focus ring yok
✅ **SONRA**: 
```jsx
focus:outline-none 
focus:ring-2 
focus:ring-purple-500 
focus:border-transparent
```

### 4. **Hover Effects**
❌ **ÖNCE**: Hiç hover yok
✅ **SONRA**: 
```jsx
hover:border-gray-400
hover:shadow-md
transition-all duration-200
```

### 5. **Spacing**
❌ **ÖNCE**: `px-2 py-1` (çok sıkış

ık)
✅ **SONRA**: `px-3 py-2` veya `px-4 py-2.5` (nefes alıyor)

---

## 🎨 RENK PALETİ

### Primary Colors
```css
/* Mor/İndigo - Ana Aksiyonlar */
purple-500: #a855f7
purple-600: #9333ea
indigo-500: #6366f1
indigo-600: #4f46e5

/* Mavi - Bilgilendirme */
blue-500: #3b82f6
blue-600: #2563eb

/* Yeşil - Başarı */
green-500: #22c55e
green-600: #16a34a
emerald-500: #10b981
emerald-600: #059669

/* Kırmızı - Hata */
red-500: #ef4444
red-600: #dc2626
rose-500: #f43f5e
rose-600: #e11d48
```

### Neutral Colors
```css
/* Gri Tonları */
gray-50: #f9fafb    /* Arka planlar */
gray-100: #f3f4f6   /* Hover durumlar */
gray-200: #e5e7eb   /* Borderlar */
gray-300: #d1d5db   /* İnaktif borderlar */
gray-400: #9ca3af   /* Placeholder */
gray-500: #6b7280   /* Secondary text */
gray-600: #4b5563   /* Normal text */
gray-700: #374151   /* Heading */
gray-900: #111827   /* Primary text */
```

### Gradient Combinations
```css
/* 270 Saat Butonu */
from-purple-500 to-indigo-600

/* Zamanaşımı Butonu */
from-blue-500 to-blue-600

/* Katsayı Butonu */
from-green-500 to-green-600

/* HESAPLA Butonu */
from-emerald-500 via-green-500 to-teal-500
```

---

## 📝 TİPOGRAFİ

### Font Sizes
```jsx
/* Küçük detaylar, tabloda */
text-xs: 0.75rem (12px)

/* Normal input, buton */
text-sm: 0.875rem (14px)

/* Ana başlıklar */
text-base: 1rem (16px)
text-lg: 1.125rem (18px)

/* Büyük başlıklar */
text-xl: 1.25rem (20px)
text-2xl: 1.5rem (24px)
```

### Font Weights
```jsx
font-normal: 400   /* Normal text */
font-medium: 500   /* Labels */
font-semibold: 600 /* Buton text, başlıklar */
font-bold: 700     /* Önemli başlıklar */
```

### Line Heights
```jsx
leading-tight: 1.25    /* Kompakt alanlar */
leading-normal: 1.5    /* Normal text */
leading-relaxed: 1.625 /* Geniş alanlar */
```

---

## 📥 INPUT ALANLARI

### Standart Input (Date, Time, Text, Number)

#### ❌ ESKİ TASARIM
```jsx
className="w-full rounded-md border-[0.5px] border-gray-200 px-2 py-1 text-xs"
```
**Sorunlar:**
- Çok ince border (görünmez)
- Çok küçük padding (sıkışık)
- Çok küçük font
- Focus state yok
- Hover effect yok

#### ✅ YENİ TASARIM
```jsx
className="
  w-full 
  rounded-lg 
  border border-gray-300 
  px-3 py-2 
  text-sm 
  leading-tight
  bg-white
  focus:outline-none 
  focus:ring-2 
  focus:ring-purple-500 
  focus:border-transparent
  hover:border-gray-400
  transition-all duration-200
  disabled:bg-gray-50 
  disabled:text-gray-500
  disabled:cursor-not-allowed
"
```

**İyileştirmeler:**
- ✅ Daha yumuşak köşeler (`rounded-lg`)
- ✅ Görünür border (`border`)
- ✅ Daha geniş padding (`px-3 py-2`)
- ✅ Daha büyük font (`text-sm`)
- ✅ Mor focus ring
- ✅ Hover effect
- ✅ Smooth transitions
- ✅ Disabled state

### Input ile Label Kombinasyonu

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">
    İşe Giriş Tarihi
  </label>
  <input 
    type="date"
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm..."
  />
</div>
```

---

## 🔘 BUTONLAR

### 1. Primary Button (Mor/İndigo)

#### ✅ HESAPLA Butonu
```jsx
<button className="
  w-full 
  py-2.5 
  text-base 
  font-bold 
  text-white
  bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500
  rounded-xl 
  shadow-lg hover:shadow-xl
  hover:from-emerald-600 hover:via-green-600 hover:to-teal-600
  focus:outline-none 
  focus:ring-4 
  focus:ring-green-300 
  focus:ring-offset-2
  transition-all duration-300
  flex items-center justify-center gap-2.5
  tracking-wide
">
  <svg className="w-5 h-5 transition-transform duration-300 hover:scale-110">
    {/* Şimşek ikonu */}
  </svg>
  HESAPLA
</button>
```

**Özellikler:**
- 3 renkli gradient
- SVG icon (emoji yerine)
- Hover: Daha koyu gradient
- Shadow: lg → xl
- Icon animasyonu
- Ring focus state

### 2. Toggle Button (270 Saat, Zamanaşımı, Katsayı)

#### Kapalı Hal
```jsx
<button className="
  inline-flex items-center gap-2 
  px-4 py-2 
  text-sm font-medium
  bg-white text-gray-700
  border border-gray-300
  rounded-full
  hover:border-purple-400 
  hover:bg-purple-50 
  hover:text-purple-600
  transition-all duration-200
">
  {label}
</button>
```

#### Açık Hal
```jsx
<button className="
  inline-flex items-center gap-2 
  px-4 py-2 
  text-sm font-medium
  bg-gradient-to-r from-purple-500 to-indigo-600
  text-white
  border-transparent
  rounded-full
  shadow-md
  hover:from-purple-600 hover:to-indigo-700
  transition-all duration-200
">
  <svg className="w-4 h-4">
    {/* Checkmark */}
  </svg>
  {label}
</button>
```

**Renk Seçimi:**
- 270 Saat: `purple-500` → `indigo-600`
- Zamanaşımı: `blue-500` → `blue-600`
- Katsayı: `green-500` → `green-600`

### 3. Dropdown Button

```jsx
<div className="relative">
  {/* Overlay */}
  {isOpen && (
    <div className="fixed inset-0 z-40" onClick={close} />
  )}
  
  {/* Button */}
  <button className="relative z-50 {/* toggle button classes */}">
    {/* İçerik */}
    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
      {/* Aşağı ok */}
    </svg>
  </button>
  
  {/* Dropdown Menu */}
  {isOpen && (
    <div className="
      absolute top-full left-0 mt-2
      w-64
      bg-white border border-gray-100
      rounded-xl shadow-2xl
      z-50 overflow-hidden
      animate-in fade-in duration-200
    ">
      {/* Dropdown items */}
    </div>
  )}
</div>
```

### 4. Dropdown Item (Radio Style)

```jsx
<button className={`
  w-full text-left px-4 py-3
  hover:bg-purple-50
  transition-colors
  border-b border-gray-100
  ${isSelected ? 'bg-purple-50' : ''}
`}>
  <div className="flex items-start gap-3">
    {/* Radio Indicator */}
    <div className={`
      mt-0.5 w-4 h-4 rounded-full border-2
      flex items-center justify-center
      ${isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}
    `}>
      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
    </div>
    
    {/* Content */}
    <div className="flex-1">
      <div className="font-medium text-gray-900 text-sm">Başlık</div>
      <div className="text-xs text-gray-500 mt-0.5">Açıklama</div>
    </div>
    
    {/* Checkmark */}
    {isSelected && (
      <svg className="w-4 h-4 text-purple-600 mt-0.5">
        {/* Checkmark ikonu */}
      </svg>
    )}
  </div>
</button>
```

---

## 🃏 KARTLAR

### 1. Soft Card (Ana Kartlar)

#### ❌ ESKİ
```jsx
<div className="soft-card" style={{ padding: '20px' }}>
```

#### ✅ YENİ
```jsx
<div className="
  bg-white 
  rounded-xl 
  border border-gray-200
  shadow-sm hover:shadow-md
  p-6
  transition-all duration-200
">
```

**Özellikler:**
- Daha yumuşak köşeler
- Subtle border
- Hover elevation
- Consistent padding

### 2. Renkli Accent Card

```jsx
<div className="
  bg-gradient-to-br from-purple-50 to-indigo-50
  border-l-4 border-purple-500
  rounded-xl
  p-6
  shadow-sm
">
  {/* İçerik */}
</div>
```

**Kullanım Alanları:**
- Önemli bilgi kartları
- Uyarı mesajları
- Vurgulanan bölümler

### 3. Glassmorphism Card

```jsx
<div className="
  backdrop-blur-xl 
  bg-white/95
  border border-gray-200/50
  rounded-2xl
  shadow-2xl
  p-6
">
  {/* İçerik */}
</div>
```

**Kullanım:** Premium özellikleri vurgulamak için

---

## 📊 TABLO

### Tablo Container

```jsx
<div className="overflow-x-auto rounded-xl border border-gray-200">
  <table className="w-full">
    {/* ... */}
  </table>
</div>
```

### Table Header

#### ❌ ESKİ
```jsx
<th className="border px-2 py-1 text-xs bg-gray-100">
```

#### ✅ YENİ
```jsx
<th className="
  px-4 py-3
  text-xs font-semibold text-gray-700 uppercase tracking-wider
  bg-gradient-to-br from-gray-50 to-gray-100
  border-b-2 border-gray-200
  text-left
">
```

### Table Cell

#### ❌ ESKİ
```jsx
<td className="border px-1 py-0.5 text-xs">
```

#### ✅ YENİ
```jsx
<td className="
  px-4 py-3
  text-sm text-gray-900
  border-b border-gray-200
  hover:bg-gray-50
  transition-colors duration-150
">
```

### Table Row Hover

```jsx
<tr className="
  hover:bg-purple-50/30
  transition-colors duration-150
  group
">
```

### Editable Cell Input

```jsx
<input className="
  w-full 
  px-2 py-1
  text-sm text-right
  border border-transparent
  rounded
  focus:border-purple-300 
  focus:ring-2 
  focus:ring-purple-100
  transition-all duration-200
  hover:border-gray-300
  bg-transparent
  group-hover:bg-white
" />
```

---

## 📋 DROPDOWN / SELECT

### Native Select (Basit)

```jsx
<select className="
  w-full
  px-3 py-2
  text-sm
  bg-white
  border border-gray-300
  rounded-lg
  focus:outline-none 
  focus:ring-2 
  focus:ring-purple-500
  hover:border-gray-400
  transition-all duration-200
  cursor-pointer
">
  <option>Seçenek 1</option>
  <option>Seçenek 2</option>
</select>
```

### Custom Dropdown (Gelişmiş)

Yukarıda "Dropdown Button" bölümüne bakın.

---

## 🎵 ACCORDION / DETAILS

### Details Element

```jsx
<details className="
  rounded-xl 
  border border-gray-200
  overflow-hidden
  transition-all duration-200
  hover:border-gray-300
" open>
  <summary className="
    cursor-pointer select-none
    px-5 py-4
    text-sm font-semibold text-gray-800
    bg-gradient-to-r from-gray-50 to-gray-100
    hover:from-gray-100 hover:to-gray-200
    transition-all duration-200
    flex items-center justify-between
    list-none
  ">
    <span>Başlık</span>
    <svg className="w-5 h-5 transition-transform duration-200 details-arrow">
      {/* Aşağı ok */}
    </svg>
  </summary>
  
  <div className="p-5 bg-white">
    {/* İçerik */}
  </div>
</details>

<style>{`
  details[open] .details-arrow {
    transform: rotate(180deg);
  }
  details summary::-webkit-details-marker {
    display: none;
  }
`}</style>
```

---

## 🍞 TOAST MESAJLARI

### Toast Container

```jsx
<div className="fixed top-6 right-6 z-[60] space-y-3 max-w-md">
  {toasts.map(toast => (
    <ToastItem key={toast.id} {...toast} />
  ))}
</div>
```

### Toast Item

```jsx
<div className="
  relative overflow-hidden
  backdrop-blur-xl bg-white/95
  border border-green-200/50
  rounded-2xl shadow-2xl
  hover:shadow-3xl hover:scale-[1.02]
  transition-all duration-500
  animate-in slide-in-from-right fade-in
  pointer-events-auto
">
  {/* Gradient bar */}
  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-400 to-emerald-600" />
  
  <div className="flex items-start gap-3 p-4 pl-5">
    {/* Icon */}
    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
      <svg className="w-4 h-4 text-green-600">{/* Checkmark */}</svg>
    </div>
    
    {/* Content */}
    <div className="flex-1">
      <div className="font-semibold text-sm text-green-900">Başlık</div>
      <div className="text-xs text-gray-600 mt-1">Açıklama</div>
    </div>
    
    {/* Close */}
    <button className="w-5 h-5 rounded-full hover:bg-gray-100">×</button>
  </div>
  
  {/* Progress bar */}
  <div className="h-1 bg-green-400/30">
    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 animate-shrink" />
  </div>
</div>
```

**Animasyonlar:**
```css
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes shrink {
  from { width: 100%; }
  to { width: 0%; }
}
```

---

## ⏳ LOADING SPINNER

### Inline Spinner

#### ❌ ESKİ
```jsx
<div className="flex items-center gap-2 text-sm text-gray-600">
  <svg className="animate-spin h-4 w-4 text-[#0d6efd]">...</svg>
  Hesaplanıyor...
</div>
```

#### ✅ YENİ
```jsx
<div className="
  flex items-center justify-center gap-3
  px-4 py-3
  bg-gradient-to-r from-purple-50 to-indigo-50
  border border-purple-200
  rounded-xl
  shadow-sm
">
  <svg className="animate-spin h-5 w-5 text-purple-600">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
  <span className="text-sm font-medium text-purple-900">Hesaplanıyor...</span>
</div>
```

### Fullscreen Loader

```jsx
<div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
  <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
    <svg className="animate-spin h-12 w-12 text-purple-600">...</svg>
    <div className="text-lg font-semibold text-gray-900">Yükleniyor...</div>
    <div className="text-sm text-gray-500">Lütfen bekleyin</div>
  </div>
</div>
```

---

## 🎨 RENK KODLAMASlı BÖLÜMLER

### 1. Davacı Beyanı Bölümü
```jsx
<div className="
  bg-gradient-to-br from-purple-50 to-indigo-50
  border-l-4 border-purple-500
  rounded-xl
  p-6
">
  {/* İçerik */}
</div>
```

### 2. Metin Hesaplaması
```jsx
<pre className="
  bg-gradient-to-br from-blue-50 to-cyan-50
  border border-blue-200
  rounded-lg
  p-4
  font-mono text-sm
  text-gray-800
">
  {hesaplamaMetni}
</pre>
```

### 3. Yıllık İzin Dışlama
```jsx
<div className="
  bg-gradient-to-br from-green-50 to-emerald-50
  border border-green-200
  rounded-xl
  p-5
">
  {/* Form */}
</div>
```

### 4. Tablo Bölümü
```jsx
<div className="
  bg-white
  border border-gray-200
  rounded-xl
  overflow-hidden
  shadow-sm
">
  {/* Table */}
</div>
```

### 5. Brütten Nete Çevir
```jsx
<div className="
  bg-gradient-to-br from-yellow-50 to-orange-50
  border-l-4 border-yellow-500
  rounded-xl
  p-6
">
  {/* İçerik */}
</div>
```

### 6. Mahsuplaşma
```jsx
<div className="
  bg-gradient-to-br from-pink-50 to-rose-50
  border border-pink-200
  rounded-xl
  p-6
">
  {/* İçerik */}
</div>
```

---

## 📦 KOD ÖRNEKLERİ

### Örnek 1: Tarih Input Grubu

```jsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      İşe Giriş Tarihi
    </label>
    <input 
      type="date"
      className="
        w-full 
        rounded-lg 
        border border-gray-300 
        px-3 py-2 
        text-sm
        focus:outline-none 
        focus:ring-2 
        focus:ring-purple-500
        hover:border-gray-400
        transition-all duration-200
      "
    />
  </div>
  
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      İşten Çıkış Tarihi
    </label>
    <input 
      type="date"
      className="..." 
    />
  </div>
</div>
```

### Örnek 2: Renkli Kart ile Form (Brütten Nete Çevir)

```jsx
<div className="
  bg-gradient-to-br from-yellow-50 to-orange-50
  border-l-4 border-yellow-500
  rounded-xl
  p-6
  shadow-sm
">
  <h3 className="text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2">
    <svg className="w-5 h-5">...</svg>
    Brütten Nete Çevir
  </h3>
  
  <label className="block font-medium text-gray-700 mb-1">Brüt Fazla Mesai</label>
  <input
    type="text"
    placeholder="Örn: 25.000,00₺"
    value={brut > 0 ? `${brut.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺` : ''}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
  />
  
  <div className="space-y-2 text-xs mt-4">
    <div className="flex items-center justify-between py-1 border-b border-gray-100">
      <span className="text-gray-600">Brüt Fazla Mesai</span>
      <span className="font-semibold text-gray-900">25.000,00₺</span>
    </div>
    <div className="flex items-center justify-between py-1 border-b border-gray-100">
      <span className="text-red-600">SGK Primi (%14)</span>
      <span className="font-semibold text-red-600">-3.500,00₺</span>
    </div>
    <div className="flex items-center justify-between py-1 border-b border-gray-100">
      <span className="text-red-600">İşsizlik Primi (%1)</span>
      <span className="font-semibold text-red-600">-250,00₺</span>
    </div>
    <div className="flex items-center justify-between py-1 border-b border-gray-100 text-green-600">
      <span className="font-bold">Net Tutar</span>
      <span className="font-bold text-lg">21.250,00₺</span>
    </div>
  </div>
</div>
```

**ÖNEMLİ:** Türkiye'de para birimi olarak **₺ (TL)** kullanılır, $ (Dolar) değil!

### TL İkonu Kullanımı

Brütten Nete Çevir başlığında TL ikonu kullanıldı:

```jsx
<h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
  <span className="w-6 h-6 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
  Brütten Nete Çevir
</h3>
```

**Özellikler:**
- Yuvarlak sarı badge
- Beyaz ₺ sembolü
- Dark mode: Daha koyu sarı (`yellow-600`)
- Responsive ve modern görünüm

### Örnek 3: Toggle Button Grubu

```jsx
<div className="flex flex-wrap items-center gap-3">
  {/* 270 Saat */}
  <button className={`
    inline-flex items-center gap-2 
    px-4 py-2 
    text-sm font-medium
    rounded-full
    transition-all duration-200
    ${isActive 
      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
      : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400'
    }
  `}>
    {isActive && <CheckIcon />}
    270 Saat
  </button>
  
  {/* Zamanaşımı */}
  {/* ... */}
  
  {/* Katsayı */}
  {/* ... */}
</div>
```

---

## ✅ CHECKLIST - Sayfa Zarifleştirme

Yeni bir sayfa zarifleştirirken kontrol edin:

### Input Alanları
- [ ] `rounded-lg` köşeler
- [ ] `border border-gray-300` görünür border
- [ ] `px-3 py-2` geniş padding
- [ ] `text-sm` okunabilir font
- [ ] `focus:ring-2 focus:ring-purple-500` focus state
- [ ] `hover:border-gray-400` hover effect
- [ ] `transition-all duration-200` smooth geçişler

### Butonlar
- [ ] Primary: Gradient arka plan
- [ ] Pill shape: `rounded-full`
- [ ] SVG ikonlar (emoji yerine)
- [ ] Hover: Shadow ve scale
- [ ] Focus: Ring state
- [ ] Disabled: Opacity ve cursor

### Kartlar
- [ ] `rounded-xl` yumuşak köşeler
- [ ] `shadow-sm hover:shadow-md` elevation
- [ ] `p-6` geniş padding
- [ ] Renkli accent (önemli kartlar için)
- [ ] Border-left highlight

### Tablo
- [ ] `rounded-xl overflow-hidden` container
- [ ] Gradient header background
- [ ] Row hover effect
- [ ] Cell padding: `px-4 py-3`
- [ ] Editable cell focus state

### Toast
- [ ] Glassmorphism (backdrop-blur)
- [ ] Gradient accent bar
- [ ] SVG ikonlar
- [ ] Kapatma butonu
- [ ] Progress bar animasyonu

### Genel
- [ ] Consistent spacing (Tailwind spacing scale)
- [ ] Consistent colors (defined palette)
- [ ] Smooth transitions (200-300ms)
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Responsive (mobile uyumlu)

---

## 🎯 ÖNEMLİ NOTLAR

### 1. Tutarlılık
Tüm sayfalarda aynı:
- Renk paleti
- Border radius
- Shadow derinlikleri
- Transition süreleri
- Spacing değerleri

### 2. Performans
- Animasyonlar için `transform` ve `opacity` kullan
- Gereksiz re-render'ları önle
- Lazy loading kullan (büyük componentler için)

### 3. Erişilebilirlik
- Yeterli renk kontrastı (WCAG AA)
- Keyboard navigasyonu
- Screen reader desteği
- Focus indicators

### 4. Responsive
- Mobile-first yaklaşım
- Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
- Touch-friendly button sizes (min 44x44px)

---

## 🌙 DARK MODE DESTEĞİ

### Genel Prensip
Her renk için dark mode varyantı ekleyin: `dark:` prefix kullanarak.

### 1. Input Alanları

```jsx
<input className="
  w-full 
  rounded-lg 
  border border-gray-300 dark:border-gray-600
  px-3 py-2 
  text-sm 
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-gray-100
  focus:outline-none 
  focus:ring-2 
  focus:ring-purple-500 dark:focus:ring-purple-400
  hover:border-gray-400 dark:hover:border-gray-500
  transition-all duration-200
" />
```

**Dark Mode Değişiklikleri:**
- Border: `gray-300` → `dark:gray-600`
- Background: `white` → `dark:gray-800`
- Text: `gray-900` → `dark:gray-100`
- Focus ring: `purple-500` → `dark:purple-400`
- Hover border: `gray-400` → `dark:gray-500`

### 2. Renkli Kartlar

```jsx
{/* Brütten Nete (Sarı/Turuncu) */}
<div className="
  bg-gradient-to-br 
  from-yellow-50 to-orange-50 
  dark:from-yellow-900/20 dark:to-orange-900/20
  border-l-4 
  border-yellow-500 dark:border-yellow-600
  rounded-xl p-6
  dark:bg-gray-800/50
">
  <h3 className="text-yellow-900 dark:text-yellow-400">
    {/* Başlık */}
  </h3>
</div>
```

**Renk Dönüşümleri:**

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Gradient arka plan | `yellow-50` → `orange-50` | `yellow-900/20` → `orange-900/20` |
| Border accent | `yellow-500` | `yellow-600` |
| Heading text | `yellow-900` | `yellow-400` |
| Base bg | — | `gray-800/50` |

### 3. Mor/İndigo Kart (Davacı Beyanı)

```jsx
<div className="
  bg-gradient-to-r 
  from-purple-50 to-indigo-50 
  dark:from-purple-900/30 dark:to-indigo-900/30
  border-l-4 
  border-purple-500 dark:border-purple-400
">
  <span className="text-purple-900 dark:text-purple-300">Beyan Bilgileri</span>
</div>
```

### 4. Pembe/Rose Kart (Mahsuplaşma)

```jsx
<div className="
  bg-gradient-to-br 
  from-pink-50 to-rose-50 
  dark:from-pink-900/20 dark:to-rose-900/20
  border-l-4 
  border-pink-500 dark:border-pink-600
  dark:bg-gray-800/50
">
  <h3 className="text-pink-900 dark:text-pink-400">Mahsuplaşma</h3>
</div>
```

### 5. Details/Accordion

```jsx
<details className="
  rounded-xl 
  border border-gray-200 dark:border-gray-700
  overflow-hidden
  dark:bg-gray-800/50
" open>
  <summary className="
    text-gray-800 dark:text-gray-200
    bg-gradient-to-r 
    from-gray-50 to-gray-100 
    dark:from-gray-800 dark:to-gray-700
    hover:from-gray-100 hover:to-gray-200 
    dark:hover:from-gray-700 dark:hover:to-gray-600
  ">
    Başlık
  </summary>
</details>
```

### 6. Text Renkleri

```jsx
{/* Labels */}
<label className="text-gray-700 dark:text-gray-300">Label</label>

{/* Secondary text */}
<span className="text-gray-600 dark:text-gray-400">Açıklama</span>

{/* Primary text */}
<span className="text-gray-900 dark:text-gray-100">Ana Metin</span>

{/* Error/Red text */}
<span className="text-red-600 dark:text-red-400">Hata</span>

{/* Success/Green text */}
<span className="text-green-700 dark:text-green-400">Başarı</span>
```

### 7. Border Renkleri

```jsx
{/* Standard border */}
border-gray-200 dark:border-gray-700

{/* Hover border */}
hover:border-gray-400 dark:hover:border-gray-500

{/* Divider */}
border-b border-gray-100 dark:border-gray-700
```

### 8. Loading Spinner

```jsx
<div className="
  bg-gradient-to-r 
  from-purple-50 to-indigo-50 
  dark:from-purple-900/30 dark:to-indigo-900/30
  border border-purple-200 dark:border-purple-700
">
  <svg className="text-purple-600 dark:text-purple-400">...</svg>
  <span className="text-purple-900 dark:text-purple-300">Hesaplanıyor...</span>
</div>
```

### 9. Tablo (Brütten Nete detay satırları)

```jsx
<div className="space-y-2 text-xs">
  {/* Normal row */}
  <div className="
    border-b border-gray-100 dark:border-gray-700
  ">
    <span className="text-gray-600 dark:text-gray-400">Label</span>
    <span className="text-gray-900 dark:text-gray-100">Value</span>
  </div>
  
  {/* Negative (red) row */}
  <div className="
    border-b border-gray-100 dark:border-gray-700
  ">
    <span className="text-red-600 dark:text-red-400">SGK Primi</span>
    <span className="text-red-600 dark:text-red-400">-123,45₺</span>
  </div>
  
  {/* Success (green) row */}
  <div>
    <span className="text-green-700 dark:text-green-400">Net Tutar</span>
    <span className="text-green-700 dark:text-green-400">567,89₺</span>
  </div>
</div>
```

### 10. Footer Butonları

```jsx
{/* Önizleme Butonu - Dark Mode Uyumlu */}
<button className="
  bg-gradient-to-r 
  from-purple-600 to-purple-700 
  dark:from-purple-500 dark:to-purple-600
  hover:from-purple-700 hover:to-purple-800 
  dark:hover:from-purple-600 dark:hover:to-purple-700
  text-white font-semibold
  text-xs sm:text-sm
  px-2.5 sm:px-3 md:px-4 py-1.5
  rounded-lg shadow-md hover:shadow-lg
  transition-all duration-200
  border border-purple-700 dark:border-purple-400
">
  <svg className="stroke-2" strokeWidth={2.5}>...</svg>
  <span className="font-semibold drop-shadow-sm">Önizleme</span>
</button>

{/* Yazdır Butonu */}
<button className="
  bg-blue-600 hover:bg-blue-700 
  dark:bg-blue-500 dark:hover:bg-blue-600
  text-white
">
  Yazdır
</button>

{/* Kaydet Butonu */}
<button className="
  bg-green-600 hover:bg-green-700 
  dark:bg-green-500 dark:hover:bg-green-600
  text-white
">
  Kaydet
</button>
```

**Footer Arka Plan:**
```jsx
<div className="
  bg-white dark:bg-gray-800
  border-t border-gray-200 dark:border-gray-700
">
```

**Önizleme Butonu İyileştirmeleri (Dark Mode için):**
- ✅ `font-semibold` - Daha kalın text (okunabilirlik)
- ✅ `ring-1 ring-purple-500/50` - İnce ve zarif ring (border yerine)
- ✅ `no-underline` + `textDecoration: 'none !important'` - Altı çizgi yok
- ✅ `strokeWidth={2}` - Normal SVG kalınlığı (fazla kalın değil)
- ✅ Daha açık gradient dark mode'da

**ÖNEMLI:** "Bant" sorunu çözümü:
- ❌ `border` kullanmayın (kalın görünür)
- ✅ `ring-1` kullanın (daha ince ve zarif)
- ✅ `textDecoration: 'none !important'` ekleyin (altı çizgi override'ı için)

### Dark Mode Checklist

- [ ] Input backgrounds: `white` → `dark:gray-800`
- [ ] Input text: `gray-900` → `dark:gray-100`
- [ ] Input borders: `gray-300` → `dark:gray-600`
- [ ] Gradient backgrounds: `/20` veya `/30` opacity dark mode'da
- [ ] Border accents: Daha koyu ton (örn: `yellow-500` → `yellow-600`)
- [ ] Heading colors: Koyu tondan açık tona (örn: `yellow-900` → `yellow-400`)
- [ ] Labels: `gray-700` → `dark:gray-300`
- [ ] Secondary text: `gray-600` → `dark:gray-400`
- [ ] Dividers: `gray-100` → `dark:gray-700`
- [ ] Card base bg: `dark:bg-gray-800/50` ekle
- [ ] Focus rings: Daha açık ton (örn: `purple-500` → `dark:purple-400`)
- [ ] Footer butonları: Daha açık tonlar (örn: `purple-600` → `dark:purple-500`)
- [ ] Footer arka plan: `white` → `dark:gray-800`

---

## 🎨 İKON REHBERİ

### TL Para Birimi İkonu

Dolar ($) ikonu yerine TL (₺) ikonu kullanın:

#### ❌ YANLIŞ (Dolar İkonu)
```jsx
<svg className="w-5 h-5" viewBox="0 0 24 24">
  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2..." />
  {/* Dolar işareti */}
</svg>
```

#### ✅ DOĞRU (TL İkonu - Badge Tarzı)
```jsx
<span className="
  w-6 h-6 
  rounded-full 
  bg-yellow-500 dark:bg-yellow-600
  text-white 
  flex items-center justify-center 
  text-sm font-bold
">
  ₺
</span>
```

**Alternatif Stil (SVG ile):**
```jsx
{/* TL sembolü text olarak */}
<span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">₺</span>
```

**Kullanım Alanları:**
- Brütten Nete Çevir başlığı
- Mali işlemler kartları
- Para birimi göstergeleri
- Fiyat/Tutar başlıkları

---

## 📚 KAYNAKLAR

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Headless UI](https://headlessui.com/)
- [Radix UI](https://www.radix-ui.com/)
- [shadcn/ui](https://ui.shadcn.com/)

---

## 🔄 VERSİYON GEÇMIŞI

- **v1.0** - İlk zarif tasarım (Ocak 2026)
  - Butonlar modernize edildi
  - Toast mesajları yenilendi
  - Input alanları zarifleştirildi

---

**Son güncelleme:** 28 Ocak 2026
**Hazırlayan:** AI Assistant
**Proje:** Aktüerya - Standart Fazla Mesai Modülü
