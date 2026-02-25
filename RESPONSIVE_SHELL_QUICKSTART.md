# ResponsiveShell V2 - Hızlı Başlangıç

## ⚡ 3 Adımda Kullan

### 1️⃣ Import

```tsx
import ResponsiveShell from "@/components/layout/ResponsiveShell";
import Sidebar from "@/components/layout/Sidebar";
```

### 2️⃣ Wrap

```tsx
<ResponsiveShell
  title="Sayfa Başlığı"
  sidebarContent={<Sidebar />}
  headerActions={<Button>Kaydet</Button>}
>
  {/* İçerik */}
</ResponsiveShell>
```

### 3️⃣ Test

- 📱 375px: Hamburger var mı?
- 💻 768px: Sidebar overlay çalışıyor mu?
- 🖥️ 1024px: Sidebar fixed mi?

---

## ✅ Dahil Olanlar

- ✅ **Hamburger Menu** (otomatik, <1024px)
- ✅ **Sidebar** (overlay/fixed otomatik)
- ✅ **Header** (sticky, title + actions)
- ✅ **Footer** (static, en altta)
- ✅ **Content** (responsive padding, max-w-1440px)

---

## 📱 Breakpoint

**Sadece 1024px:**
- **<1024px**: Mobile/Tablet (hamburger + overlay)
- **≥1024px**: Desktop (sidebar fixed)

---

## 🚫 Yapma

```tsx
// Layout.tsx KULLANMA ❌
import Layout from "@/components/Layout";

// Fixed footer YAPMA ❌
<footer className="fixed bottom-0">

// Inline style YAPMA ❌
<div style={{ marginLeft: '256px' }}>
```

---

## ✅ Yap

```tsx
// ResponsiveShell KULLAN ✅
import ResponsiveShell from "@/components/layout/ResponsiveShell";

// Static footer (otomatik) ✅
<ResponsiveShell> {/* Footer dahil */}

// Tailwind utilities ✅
<div className="w-full max-w-[1440px]">
```

---

## 🧪 Test Sayfası

```bash
# Route ekle (App.tsx)
<Route path="/test-responsive" element={<ResponsiveShellTestPage />} />

# Aç
http://localhost:5173/test-responsive
```

---

## 📚 Dokümantasyon

Detaylı bilgi için: `RESPONSIVE_SHELL_V2.md`

---

**Hepsi bu kadar! 🎉**
