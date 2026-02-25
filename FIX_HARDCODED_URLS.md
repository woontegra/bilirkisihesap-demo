# 🚨 GÜVENLİK SORUNU - HARDCODED API URLs

## ❌ SORUN:

**242 satırda** hardcoded `http://localhost:4000` var!

### Neden Tehlikeli?

1. **Production'da çalışmaz** → localhost:4000 sadece development'ta var
2. **Güvenlik riski** → API endpoint'leri kodda açık
3. **Maintenance nightmare** → URL değişse 242 yeri düzeltmek gerekir  
4. **Environment yok** → Dev/Staging/Prod ayırt edilemiyor
5. **Linux case-sensitivity** → Windows'ta çalışır, sunucuda crash olabilir

## ✅ ÇÖZÜM:

### 1️⃣ TEK KAYNAK - `API_BASE_URL`

**File:** `src/utils/apiClient.ts`

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
```

### 2️⃣ USAGE:

**❌ YANLIŞ:**
```typescript
const response = await fetch("http://localhost:4000/api/kidem/calculate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

**✅ DOĞRU (Option 1 - apiClient kullan):**
```typescript
import { apiPost } from "@/utils/apiClient";

const response = await apiPost("/api/kidem/calculate", data);
// Otomatik: headers, token, tenant, device UUID, error handling
```

**✅ DOĞRU (Option 2 - API_BASE_URL kullan):**
```typescript
import { API_BASE_URL } from "@/utils/apiClient";

const response = await fetch(`${API_BASE_URL}/api/kidem/calculate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

## 📋 DÜZELTİLMESİ GEREKEN DOSYALAR (242 satır)

### Frontend Pages (Ana Sorun Alanları):

**Kidem Tazminatı** (8 dosya, ~50 satır):
- ✅ `Kidem30Independent/index.tsx` - LOAD_ENDPOINT, SAVE_ENDPOINT
- ✅ `KidemMevsimlikIndependent/index.tsx`
- ✅ `KidemKismiSureliIndependent/index.tsx`
- ✅ `KidemPartTimeIndependent/index.tsx`
- ✅ `KidemParcaBasiIndependent/index.tsx`
- ✅ `KidemTopluSozlesmeIndependent/index.tsx`
- ✅ `KidemGemiIndependent/index.tsx`
- ✅ `KidemBasinIndependent/index.tsx`

**Hafta Tatili** (4 dosya, ~20 satır):
- ✅ `StandardIndependent/index.tsx` - API_BASE
- ✅ `TopluSozlesmeIndependent/index.tsx`
- ✅ `GemiAdamiIndependent/index.tsx`
- ✅ `BasinIsIndependent/index.tsx`

**Yıllık İzin** (11 dosya, ~40 satır):
- ✅ `StandartIndependent/index.tsx`
- ✅ `GemiIndependent/index.tsx`
- ✅ `BorclarKanunuIndependent/index.tsx`
- ✅ `BelirliIndependent/index.tsx`
- ✅ `BasinIndependent/index.tsx`
- ✅ `TopluIndependent/index.tsx`
- ✅ `ParcaIndependent/index.tsx`
- ✅ `KismiIndependent/index.tsx`
- ✅ `PartIndependent/index.tsx`
- ✅ `MevsimIndependent/index.tsx`
- ✅ `BasinIndependent/GunlukOlmayanIndependent/index.tsx`

**İhbar Tazminatı** (10 dosya, ~30 satır):
- ✅ `Ihbar30Independent/index.tsx`
- ✅ `IhbarBorclarIndependent/index.tsx`
- ✅ `IhbarGemiIndependent/index.tsx`
- ✅ `IhbarMevsimIndependent/index.tsx`
- ✅ `IhbarBasinIndependent/index.tsx`
- ✅ `IhbarKismiIndependent/index.tsx`
- ✅ `IhbarPartIndependent/index.tsx`
- ✅ `IhbarBelirliIndependent/index.tsx`
- ✅ `IhbarParcaIndependent/index.tsx`
- ✅ `IhbarTopluIndependent/index.tsx`

**Fazla Mesai** (14 dosya, ~60 satır):
- ✅ `StandartIndependent/index.tsx`
- ✅ `Bilirkisi1Independent/index.tsx`
- ✅ `Bilirkisi2Independent/index.tsx`
- ✅ `GeceIndependent/index.tsx`
- ✅ `Vardiya8Independent/index.tsx`
- ✅ `Vardiya12Independent/index.tsx`
- ✅ `Vardiya24Independent/index.tsx`
- ✅ `Vardiya24Independent/Vardiya48Independent/index.tsx`
- ✅ `GemiIndependent/index.tsx`
- ✅ `GemiIndependent/FullCrew24/index.tsx`
- ✅ `EvIndependent/index.tsx`
- ✅ `BekciIndependent/index.tsx`
- ✅ `FazlaSurelerleCalismaIndependent/index.tsx`
- ✅ `YeraltiIndependent/index.tsx`
- ✅ `BasinIsIndependent/index.tsx`

**UBGT** (2 dosya):
- ✅ `UbgtIndependent/index.tsx` - API_BASE tanımlı ama hardcoded URL var
- ✅ `UbgtBilirkisiIndependent/index.tsx`

**Diğer** (~40 satır):
- ✅ `App.tsx` - notifications endpoint'leri
- ✅ `ayrimcilik-tazminati/AyrimcilikIndependent/index.tsx`
- ✅ `haksiz-fesih-tazminati/HaksizFesihIndependent/index.tsx`
- ✅ `kotu-niyet-tazminati/KotuNiyetIndependent/index.tsx`
- ✅ `bosta-gecen-sure-ucreti/BostaGecenSureIndependent/index.tsx`
- ✅ `ise-almama-tazminati/IseAlmamaIndependent/index.tsx`
- ✅ `prim-alacagi/PrimIndependent/index.tsx`
- ✅ `davaci-ucreti/DavaciUcretiIndependent/index.tsx`

## 🤖 OTOM

ATİK FİX SCRIPT:

### 1. Global Find & Replace (VS Code):

**Find:**
```regex
"http://localhost:4000
```

**Replace:**
```typescript
`${API_BASE_URL}
```

**SONRA (her dosyanın başına):**
```typescript
import { API_BASE_URL } from "@/utils/apiClient";
```

### 2. Daha İyi Yöntem - apiClient kullan:

**Find:**
```regex
fetch\("http://localhost:4000(/api/[^"]+)",\s*\{[\s\S]*?method:\s*"POST"[\s\S]*?body:\s*JSON\.stringify\(([^)]+)\)
```

**Replace:**
```typescript
apiPost("$1", $2
```

**Import ekle:**
```typescript
import { apiPost } from "@/utils/apiClient";
```

## 📝 ÖRNEK DÜZELTMEİstediğin dosyaları söyle, hepsini düzelteyim veya bir script hazırlayayım.

**ÖNCE:** `Kidem30Independent/index.tsx`
```typescript
const SAVE_ENDPOINT = "http://localhost:4000/api/saved-cases";
const LOAD_ENDPOINT = "http://localhost:4000/api/saved-cases";

const response = await fetch("http://localhost:4000/api/kidem/30", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

**SONRA:**
```typescript
import { API_BASE_URL, apiPost } from "@/utils/apiClient";

const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;

const response = await apiPost("/api/kidem/30", data);
// Otomatik: headers, token, tenant, device UUID, 401/403 handling
```

## 🚀 DEPLOYMENT

### `.env` Dosyaları:

**`.env.development`** (localhost):
```bash
VITE_API_URL=http://localhost:4000
```

**`.env.production`** (canlı sunucu):
```bash
VITE_API_URL=https://api.aktuerya.com
```

**`.env.staging`** (test sunucusu):
```bash
VITE_API_URL=https://staging-api.aktuerya.com
```

### Build:
```bash
# Development
npm run dev

# Production
npm run build
# Otomatik .env.production kullanır

# Staging
npm run build -- --mode staging
# .env.staging kullanır
```

## ✅ SONUÇ

Bu fix yapıldıktan sonra:
- ✅ Production'da çalışır
- ✅ Environment bazlı URL management
- ✅ Güvenli (API URL'leri kodda açık değil)
- ✅ Maintenance kolay (tek yerden değiştir)
- ✅ Automatic token/tenant/device management
- ✅ Automatic error handling (401/403)
- ✅ Linux/Windows cross-platform

---

## 🔥 ÖNCE YAPMAMIZ GEREKENLER:

1. ✅ `App.tsx` - düzeltildi
2. Tüm Kıdem sayfaları
3. Tüm Hafta Tatili sayfaları
4. Tüm Yıllık İzin sayfaları
5. Tüm İhbar sayfaları
6. Tüm Fazla Mesai sayfaları
7. UBGT sayfaları
8. Diğer tazminat sayfaları

**Tüm dosyaları şimdi düzeltmemi ister misin?**



