# Dosya Temel Profili - Entegrasyon Rehberi

Bu doküman, "Temel Bilgileri Getir" butonunun diğer hesap modüllerine nasıl ekleneceğini açıklar.

## Referans implementasyon

- **Kidem30Independent** – Tam örnek (api, state, buton, save)

## Modüle ekleme adımları

### 1. API / load fonksiyonunda baseProfile döndür

Load cevabında `baseProfile` alanını ekleyin:

```ts
return {
  // ... mevcut alanlar
  baseProfile: (data as any).baseProfile ?? null,
};
```

### 2. State

```ts
const [loadedBaseProfile, setLoadedBaseProfile] = useState<Record<string, unknown> | null>(null);
```

### 3. Load effect içinde set et

```ts
setLoadedBaseProfile(loadedData.baseProfile ?? null);
```

### 4. Handler

```ts
import { getBaseProfileFormCopy } from "@/utils/baseProfileHelper";

const handleTemelBilgileriGetir = useCallback(() => {
  const copy = getBaseProfileFormCopy(loadedBaseProfile as any);
  if (Object.keys(copy).length === 0) return;
  const apply: Record<string, unknown> = { ...copy };
  if (copy.iseGiris != null) {
    apply.startDate = copy.iseGiris;
    apply.iseGiris = copy.iseGiris;
  }
  if (copy.istenCikis != null) {
    apply.endDate = copy.istenCikis;
    apply.exitDate = copy.istenCikis;
    apply.istenCikis = copy.istenCikis;
  }
  if (copy.brutUcret != null) apply.brutUcret = String(copy.brutUcret);
  if (copy.yemek != null) apply.yemek = String(copy.yemek);
  if (copy.yol != null) apply.yol = String(copy.yol);
  setFormValues((prev) => ({ ...prev, ...apply }));
  if (copy.istenCikis != null && setExitDate) setExitDate(String(copy.istenCikis));
}, [loadedBaseProfile, setFormValues]);
```

### 5. Buton

```tsx
import { TemelBilgileriGetirButton } from "@/components/TemelBilgileriGetirButton";

<TemelBilgileriGetirButton baseProfile={loadedBaseProfile} onApply={handleTemelBilgileriGetir} />
```

### 6. Kaydetme (opsiyonel)

Save sırasında baseProfile göndermek için:

```ts
import { extractBaseProfileFromForm } from "@/utils/baseProfileHelper";

const baseProfile = extractBaseProfileFromForm(formValues || {});
const payload = { ...existingPayload, baseProfile };
```

## Kurallar

- BaseProfile’dan modül state’ine sadece **deep copy** yapın.
- Otomatik hesap tetiklemeyin.
- useEffect ile senkronizasyon eklemeyin.
