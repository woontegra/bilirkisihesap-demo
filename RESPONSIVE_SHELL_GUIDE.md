# ResponsiveShell Kullanım Kılavuzu

## 📋 Genel Bakış

**ResponsiveShell** - Projedeki tüm responsive sorunları kökten çözen merkezi layout sistemi.

## 🎯 Temel Prensipler

### Breakpoint Sistemi
- **<1024px**: Mobile/Tablet (Sidebar overlay, content full-width)
- **≥1024px**: Desktop (Sidebar fixed offset, content centered)

### Garantiler
✅ Yatay scroll YOK
✅ Content hiçbir ekranda taşmaz
✅ Grid/flex otomatik responsive
✅ Sidebar asla content'i itmez (<1024px)
✅ Max-width: 1440px (ortalanmış)

---

## 🚀 Kullanım

### Basit Kullanım

```tsx
import ResponsiveShell from "@/components/layout/ResponsiveShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

function MyPage() {
  return (
    <ResponsiveShell
      sidebar={<Sidebar />}
      header={<Header />}
      showSidebar={true}
    >
      {/* Sayfa içeriği */}
      <div>
        <h1>Hesaplama Sayfası</h1>
        <form>...</form>
      </div>
    </ResponsiveShell>
  );
}
```

### Props

| Prop | Tip | Default | Açıklama |
|------|-----|---------|----------|
| `children` | `ReactNode` | - | Sayfa içeriği (zorunlu) |
| `sidebar` | `ReactNode` | - | Sidebar component'i |
| `header` | `ReactNode` | - | Header component'i |
| `showSidebar` | `boolean` | `true` | Sidebar göster/gizle |
| `maxWidth` | `"default" \| "full" \| "narrow"` | `"default"` | Content max-width |

---

## 📐 Layout Davranışları

### Mobile (<768px)
- Sidebar: Overlay (hamburger menu)
- Content: %100 genişlik
- Padding: 16px (`px-4`)
- Grid: Tek kolon

### Tablet (768px - 1023px)
- Sidebar: Overlay
- Content: %100 genişlik
- Padding: 24px (`px-6`)
- Grid: Tek kolon

### Desktop (≥1024px)
- Sidebar: Fixed offset (256px)
- Content: Max 1440px, ortalanmış
- Padding: 32px (`px-8`)
- Grid: Çoklu kolon

---

## 🎨 CSS Kuralları

### Otomatik Responsive Grid

```tsx
// Otomatik 2 kolon (mobilde tek kolon)
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <Card>...</Card>
  <Card>...</Card>
</div>

// Auto-fit grid (en responsive)
<div className="grid-auto">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>
```

### Form Layout

```tsx
<div className="form-row">
  <div className="form-group">
    <label>İsim</label>
    <input type="text" />
  </div>
  <div className="form-group">
    <label>Soyisim</label>
    <input type="text" />
  </div>
</div>
```

### Table Wrapper

```tsx
<div className="table-wrapper">
  <table>
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

---

## 🚫 Yasaklar

### ❌ YAPMAYIN

```tsx
// Inline style ile responsive hack
<div style={{ width: '80%', marginLeft: '256px' }}>...</div>

// Sabit px değerler
<div style={{ width: '1200px', padding: '20px' }}>...</div>

// Sayfa bazlı media query
@media (max-width: 768px) {
  .my-page { ... }
}

// Fixed width grid
<div className="grid grid-cols-2">...</div>
```

### ✅ YAPIN

```tsx
// Tailwind responsive utilities kullanın
<div className="w-full max-w-[1440px] px-4 lg:px-8">...</div>

// Grid'i responsive yapın
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">...</div>

// Clamp kullanın
<div style={{ padding: 'clamp(1rem, 2vw, 2rem)' }}>...</div>

// Utility classes
<div className="space-y-responsive gap-responsive">...</div>
```

---

## 🧪 Test Checklist

Yeni sayfa eklediğinizde bu ekranlarda test edin:

- [ ] 360px (iPhone SE)
- [ ] 390px (iPhone 12/13/14)
- [ ] 768px (iPad portrait)
- [ ] 1024x768 (iPad landscape)
- [ ] 1366x768 (Küçük laptop)
- [ ] 1440px (MacBook)
- [ ] 1920x1080 (Full HD)
- [ ] 2160x1440 (2K)

### Kontrol Listesi:
- [ ] Yatay scroll yok
- [ ] Content taşmıyor
- [ ] Sidebar overlay çalışıyor (<1024px)
- [ ] Grid tek kolona düşüyor (<1024px)
- [ ] Formlar düzgün hizalı
- [ ] Tablolar scroll ediyor (mobilde)
- [ ] Butonlar erişilebilir
- [ ] Kartlar düzgün stack oluyor

---

## 🔧 Özelleştirme

### Custom Max-Width

```tsx
<ResponsiveShell maxWidth="narrow">
  {/* Content max-w-[1200px] olacak */}
</ResponsiveShell>

<ResponsiveShell maxWidth="full">
  {/* Content full-width olacak */}
</ResponsiveShell>
```

### Custom Padding

```tsx
// ResponsiveShell içinde custom padding
<ResponsiveShell>
  <div className="px-0 py-0"> {/* Override padding */}
    {/* Full bleed content */}
  </div>
</ResponsiveShell>
```

---

## 📚 Örnek Sayfalar

### Hesaplama Sayfası

```tsx
import ResponsiveShell from "@/components/layout/ResponsiveShell";
import Sidebar from "@/components/layout/Sidebar";
import HeaderBar from "@/components/HeaderBar";
import KidemTazminatiForm from "./KidemTazminatiForm";

export default function KidemPage() {
  return (
    <ResponsiveShell
      sidebar={<Sidebar />}
      header={<HeaderBar />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ana form */}
        <div className="lg:col-span-2">
          <KidemTazminatiForm />
        </div>
        
        {/* Yan panel */}
        <div>
          <NotCard />
        </div>
      </div>
    </ResponsiveShell>
  );
}
```

### Dashboard Sayfası

```tsx
export default function DashboardPage() {
  return (
    <ResponsiveShell
      sidebar={<Sidebar />}
      header={<HeaderBar />}
    >
      <div className="grid-auto">
        <StatCard title="Toplam Kullanıcı" value="1,234" />
        <StatCard title="Aktif Hesaplama" value="567" />
        <StatCard title="Aylık Gelir" value="₺89,012" />
      </div>
      
      <div className="mt-6">
        <RecentActivityTable />
      </div>
    </ResponsiveShell>
  );
}
```

---

## 🐛 Sorun Giderme

### Yatay Scroll Oluşuyor

**Neden:** Muhtemelen fixed width element var.

**Çözüm:**
```tsx
// Önce: ❌
<div style={{ width: '1200px' }}>...</div>

// Sonra: ✅
<div className="w-full max-w-[1200px]">...</div>
```

### Sidebar Content'i İtiyor (Tablet)

**Neden:** Sidebar breakpoint'i yanlış.

**Çözüm:**
```tsx
// Sidebar.tsx içinde lg: kullanın, md: değil
<nav className="hidden lg:flex ...">
```

### Grid Mobilde Tek Kolona Düşmüyor

**Neden:** Responsive class yok.

**Çözüm:**
```tsx
// Önce: ❌
<div className="grid grid-cols-2">

// Sonra: ✅
<div className="grid grid-cols-1 lg:grid-cols-2">
```

### Content 1366px'te Daralıyor

**Neden:** Sidebar offset + küçük content area.

**Çözüm:** ResponsiveShell zaten hallediyor, sayfada özel max-width kullanmayın.

---

## 📞 Destek

Responsive sorunları için:
1. Bu kılavuzu kontrol edin
2. Test checklist'i çalıştırın
3. Console'da layout warning'leri kontrol edin

## 🚀 Sonuç

**ResponsiveShell** kullandığınızda:
- ✅ Responsive sorunlar BİTTİ
- ✅ Yeni sayfa eklemek KOLAY
- ✅ Maintenance SIFIR
- ✅ Tüm ekranlar STABİL

**Tek yapmanız gereken:** Sayfayı ResponsiveShell'e wrap edin!
