# ResponsiveShell V2 - Kullanım Kılavuzu

## 🎯 Amaç

Tek bir layout dosyası ile **tüm responsive sorunları çözmek**.

---

## 📋 Özellikler

### ✅ Dahil Olanlar
- ✅ **Hamburger Menu** (mobile/tablet için ZORUNLU)
- ✅ **Sidebar** (overlay <1024px, fixed offset ≥1024px)
- ✅ **Header** (sticky, hamburger + title + actions)
- ✅ **Content** (responsive padding, max-w-1440px)
- ✅ **Footer** (static, NOT fixed)

### ✅ Garantiler
- ✅ 768px'de header düzgün
- ✅ Hamburger menu görünür ve çalışır (<1024px)
- ✅ Sidebar overlay çalışır
- ✅ Footer taşmaz
- ✅ Yatay scroll YOK

---

## 🚀 Kullanım

### Basit Örnek

```tsx
import ResponsiveShell from "@/components/layout/ResponsiveShell";
import Sidebar from "@/components/layout/Sidebar";

export default function MyPage() {
  return (
    <ResponsiveShell
      title="Kıdem Tazminatı Hesaplama"
      sidebarContent={<Sidebar />}
      headerActions={
        <div>
          <button>Kaydet</button>
        </div>
      }
    >
      {/* Sayfa içeriği */}
      <div>
        <h2>İçerik buraya</h2>
      </div>
    </ResponsiveShell>
  );
}
```

---

## 📐 Props

| Prop | Tip | Default | Açıklama |
|------|-----|---------|----------|
| `children` | `ReactNode` | - | Sayfa içeriği (zorunlu) |
| `title` | `string` | `""` | Header başlığı |
| `headerActions` | `ReactNode` | - | Header sağ taraf butonları |
| `sidebarContent` | `ReactNode` | - | Sidebar içeriği |
| `showSidebar` | `boolean` | `true` | Sidebar göster/gizle |

---

## 🎨 Layout Davranışları

### Mobile/Tablet (<1024px)
```
┌─────────────────────────────┐
│ [☰] Title         [Actions] │  ← Header (sticky)
├─────────────────────────────┤
│                             │
│   Content (full-width)      │  ← Content
│                             │
├─────────────────────────────┤
│   Footer                    │  ← Footer (static)
└─────────────────────────────┘

Hamburger tıklandığında:
┌─────────────────────────────┐
│ Sidebar (overlay)  │ Backdrop│
│                    │         │
│  - Menu Item 1     │         │
│  - Menu Item 2     │         │
│  - Menu Item 3     │         │
└────────────────────┴─────────┘
```

### Desktop (≥1024px)
```
┌────────┬──────────────────────┐
│        │ Title      [Actions] │  ← Header (sticky)
│        ├──────────────────────┤
│ Sidebar│                      │
│        │   Content (centered) │  ← Content (max-w-1440px)
│ (fixed)│                      │
│        ├──────────────────────┤
│        │   Footer             │  ← Footer (static)
└────────┴──────────────────────┘
```

---

## 🧪 Test Checklist

### Header Test
- [ ] 768px'de header görünüyor
- [ ] Hamburger butonu görünür (<1024px)
- [ ] Hamburger butonu çalışıyor
- [ ] Title görünüyor
- [ ] Actions sağda hizalı

### Sidebar Test
- [ ] Mobile'da hamburger ile açılıyor
- [ ] Backdrop tıklandığında kapanıyor
- [ ] ESC tuşu ile kapanıyor
- [ ] Desktop'ta otomatik görünür
- [ ] Scroll ediliyor (çok içerik varsa)

### Content Test
- [ ] Full-width (<1024px)
- [ ] Centered + max-w-1440px (≥1024px)
- [ ] Padding responsive (mobile: 16px, tablet: 24px, desktop: 32px)
- [ ] Yatay scroll YOK

### Footer Test
- [ ] En altta
- [ ] Static (fixed değil)
- [ ] Mobile'da taşmıyor
- [ ] Desktop'ta ortalı

---

## 📱 Ekran Testleri

Test edilmesi gereken ekranlar:

| Ekran | Genişlik | Hamburger | Sidebar | Content | Footer |
|-------|----------|-----------|---------|---------|--------|
| iPhone SE | 375px | ✅ Var | Overlay | Full | Static |
| iPhone 12 | 390px | ✅ Var | Overlay | Full | Static |
| iPad | 768px | ✅ Var | Overlay | Full | Static |
| iPad Landscape | 1024px | ❌ Yok | Fixed | Centered | Static |
| Laptop | 1366px | ❌ Yok | Fixed | Centered | Static |
| Desktop | 1920px | ❌ Yok | Fixed | Centered | Static |

---

## 🔧 Hamburger Menu

### Davranışlar
1. **Görünürlük**: Sadece <1024px'de görünür
2. **Icon**: Menu (☰) → X (kapatma)
3. **Toggle**: Sidebar açar/kapar
4. **Touch Target**: Min 40x40px (touch-friendly)

### Kapat Yöntemleri
- Backdrop'a tıkla
- ESC tuşuna bas
- Hamburger'a tekrar tıkla
- Sidebar dışına tıkla

---

## 📊 Sidebar

### Mobile/Tablet (<1024px)
- **Position**: Fixed overlay
- **Z-index**: 50
- **Width**: 256px (16rem)
- **Animation**: Slide in/out (300ms)
- **Backdrop**: Black 50% opacity
- **Initial**: Kapalı

### Desktop (≥1024px)
- **Position**: Fixed offset
- **Width**: 256px (16rem)
- **Always visible**: Evet
- **Content offset**: margin-left: 256px

---

## 🎯 Header

### Yapı
```tsx
┌─────────────────────────────────────┐
│ [☰] Title              [Actions]    │
└─────────────────────────────────────┘
  ↑    ↑                    ↑
  |    |                    |
  |    |                    └─── headerActions prop
  |    └──────────────────────── title prop
  └───────────────────────────── Hamburger (auto)
```

### Özellikler
- **Height**: 56px (3.5rem)
- **Position**: Sticky (top: 0)
- **Z-index**: 30
- **Padding**: 16px yatay
- **Gap**: 16px (elements arası)

---

## 📏 Content

### Padding
- **Mobile** (<640px): 16px
- **Tablet** (640-1024px): 24px
- **Desktop** (≥1024px): 32px

### Max-Width
- **Mobile/Tablet**: 100%
- **Desktop**: 1440px (centered)

### Margin
- **Mobile/Tablet**: 0
- **Desktop**: auto (centered)

---

## 🦶 Footer

### Özellikler
- **Position**: Static (NOT fixed!)
- **Height**: Auto
- **Padding**: 16px vertical, responsive horizontal
- **Border**: Top border
- **Content**: Centered, max-w-1440px

### Layout
```tsx
Desktop:
┌───────────────────────────────────────┐
│ Beta Sürüm | Mercan © 2025   v1.0.0  │
└───────────────────────────────────────┘

Mobile:
┌──────────────────────┐
│ Beta Sürüm |         │
│ Mercan © 2025        │
│                      │
│ v1.0.0               │
└──────────────────────┘
```

---

## 🚫 Yasaklar

### ❌ YAPMAYIN

```tsx
// Fixed footer
<footer className="fixed bottom-0"> ❌

// Inline responsive hack
<div style={{ marginLeft: '256px' }}> ❌

// Custom hamburger
<button onClick={...}>Menu</button> ❌

// Gereksiz wrapper
<ResponsiveShell>
  <div className="max-w-7xl mx-auto px-4"> ❌
    {content}
  </div>
</ResponsiveShell>
```

### ✅ YAPIN

```tsx
// Static footer (ResponsiveShell içinde)
<footer> ✅

// Tailwind utilities
<div className="w-full max-w-[1440px]"> ✅

// ResponsiveShell'in kendi hamburger'ı
<ResponsiveShell showSidebar={true}> ✅

// Clean content
<ResponsiveShell>
  {content} ✅
</ResponsiveShell>
```

---

## 🔍 Sorun Giderme

### Hamburger Görünmüyor
**Çözüm**: `showSidebar={true}` ve ekran <1024px olmalı

### Sidebar Açılmıyor
**Çözüm**: Console'da hata var mı kontrol et, `sidebarContent` prop'u geçilmiş mi kontrol et

### Footer Taşıyor
**Çözüm**: ResponsiveShell kullanıyorsan otomatik düzelir, eski Layout.tsx kullanıyorsan geç

### Content Sidebar'a Giriyor (<1024px)
**Çözüm**: ResponsiveShell kullan, overlay otomatik çalışır

### Yatay Scroll Var
**Çözüm**: Content içinde fixed width element var mı kontrol et

---

## 📝 Örnek: Tam Özellikli Sayfa

```tsx
import ResponsiveShell from "@/components/layout/ResponsiveShell";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";

export default function KidemTazminatiPage() {
  return (
    <ResponsiveShell
      title="Kıdem Tazminatı Hesaplama"
      sidebarContent={<Sidebar />}
      headerActions={
        <>
          <Button size="sm">Kaydet</Button>
          <Button size="sm" variant="outline">Yazdır</Button>
        </>
      }
      showSidebar={true}
    >
      {/* Sayfa içeriği */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ana form (2/3) */}
        <div className="lg:col-span-2">
          <FormCard />
          <ResultsCard />
        </div>
        
        {/* Yan panel (1/3) */}
        <div>
          <NotesCard />
        </div>
      </div>
    </ResponsiveShell>
  );
}
```

---

## 🎓 Özet

### Tek yapmanız gereken:

1. **Import et**:
```tsx
import ResponsiveShell from "@/components/layout/ResponsiveShell";
```

2. **Wrap et**:
```tsx
<ResponsiveShell
  title="Sayfa Başlığı"
  sidebarContent={<Sidebar />}
>
  {/* İçerik */}
</ResponsiveShell>
```

3. **Test et**:
- Mobile: 375px
- Tablet: 768px
- Desktop: 1366px, 1920px

**Hepsi bu! 🎉**

---

## 📞 Kontrol Listesi

Yeni sayfa eklerken:

- [ ] ResponsiveShell import edildi
- [ ] title prop geçildi
- [ ] sidebarContent prop geçildi (varsa)
- [ ] headerActions prop geçildi (varsa)
- [ ] Content direkt children'a geçildi
- [ ] Test: 375px (hamburger var mı?)
- [ ] Test: 768px (sidebar overlay çalışıyor mu?)
- [ ] Test: 1024px (sidebar fixed mi?)
- [ ] Test: Yatay scroll yok mu?
- [ ] Test: Footer en altta mı?

---

**Version:** 2.0.0  
**Created:** 2025-01-18  
**Status:** ✅ Production Ready
