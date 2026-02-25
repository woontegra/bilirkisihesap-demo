# Bilirkişi-1 Sayfa Mimarisi

## 📋 KATMAN AYIRIMI

Bu sayfa **2 AYRI KATMAN** kullanır:

---

## 1️⃣ HESAP KATMANI (Calculation Layer)

### Amaç
Fazla mesai hesaplama, 270 saat düşümü, zamanaşımı hesaplama

### Kullanılan State
```typescript
davaci: Beyan          // Eski tip - hesap için
davali: Beyan          // Eski tip - hesap için
taniklar: Witness[]    // Eski tip - hesap için
```

### Fonksiyonlar
- `handleCalculate()` - Backend hesaplama
- `recalculate()` - Frontend hesaplama
- `calculateFromBackend()` - Async hesaplama wrapper
- `apply270RuleFrontend()` - 270 saat düşümü

### Veri Akışı
```
davaci/davali/taniklar (state)
    ↓
handleCalculate() / recalculate()
    ↓
Backend API / Frontend calculation
    ↓
rows[] (PeriodRow[])
    ↓
Tablo render
```

### ⚠️ KESİN KURALLAR
- ❌ `declarations` state'i hesap fonksiyonlarına parametre olarak GÖNDERİLMEZ
- ❌ `calculateFM` fonksiyonları DEĞİŞTİRİLMEZ
- ❌ `useMemo` zinciri BOZULMAZ
- ✅ Hesap motoru TEK KAYNAK: `davaci`, `davali`, `taniklar`

---

## 2️⃣ BEYAN KATMANI (Declaration Layer)

### Amaç
Çoklu dönem beyan verisi toplama, UI önizleme, ispat açıklaması, dağıtım açıklaması

### Kullanılan State
```typescript
declarations: Declaration[]  // Yeni tip - sadece UI için
```

### Komponentler
- `DavaciDeclarationManager` - Davacı için çoklu dönem UI
- `TanikDeclarationManager` - Tanıklar için çoklu dönem UI

### Veri Yapısı
```typescript
Declaration {
  sourceType: "DAVACI" | "TANIK"
  sourceName: string | null
  periods: Period[]
}

Period {
  id: string
  startDate: string
  endDate: string
  label: "Yaz" | "Kış" | "Ay Bazlı" | "Serbest"
  weeklyPattern: WeeklyPattern
}

WeeklyPattern {
  patternType: "SINGLE" | "MIXED"
  days: PatternDay[]
}

PatternDay {
  dayCount: number
  startTime: string  // HH:mm
  endTime: string    // HH:mm
}
```

### Kullanım Alanları
- ✅ Tablo önizleme (gelecek özellik)
- ✅ İspat açıklaması (gelecek özellik)
- ✅ Dağıtım açıklaması (gelecek özellik)
- ✅ Rapor detaylandırma (gelecek özellik)

### ⚠️ KESİN KURALLAR
- ❌ `declarations` → HESAP FONKSİYONLARINA PARAMETRE OLARAK GÖNDERİLMEZ
- ❌ FM hesaplama yapılmaz
- ❌ 270 saat düşümü yapılmaz
- ❌ Zamanaşımı hesabı yapılmaz
- ✅ SADECE UI/Documentation katmanı

---

## 🔄 KATMAN İLETİŞİMİ

```
┌─────────────────────────────────────────────────────────┐
│                    UI LAYER                             │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ Basit Giriş      │      │ Gelişmiş Giriş   │        │
│  │ (Tek Dönem)      │      │ (Çoklu Dönem)    │        │
│  └────────┬─────────┘      └────────┬─────────┘        │
│           │                         │                   │
│           ▼                         ▼                   │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ davaci/davali    │      │ declarations[]   │        │
│  │ taniklar[]       │      │                  │        │
│  └────────┬─────────┘      └──────────────────┘        │
│           │                         │                   │
└───────────┼─────────────────────────┼───────────────────┘
            │                         │
            │                         │ (NO CONNECTION)
            │                         ▼
            │                  ┌──────────────────┐
            │                  │ Önizleme/İspat   │
            │                  │ (Gelecek)        │
            │                  └──────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│              CALCULATION LAYER                          │
│  ┌──────────────────────────────────────────┐           │
│  │ handleCalculate()                        │           │
│  │ recalculate()                            │           │
│  │ calculateFromBackend()                   │           │
│  │ apply270RuleFrontend()                   │           │
│  └────────┬─────────────────────────────────┘           │
│           │                                              │
│           ▼                                              │
│  ┌──────────────────┐                                   │
│  │ rows[]           │                                   │
│  │ (PeriodRow[])    │                                   │
│  └────────┬─────────┘                                   │
└───────────┼──────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│                  TABLE RENDER                           │
│  Fazla Mesai Tablosu                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 ÖRNEK KULLANIM

### ✅ DOĞRU - Hesap katmanı
```typescript
// Hesap için eski state kullan
const result = await handleCalculate(
  davaci,      // ✅ Beyan tipinde
  taniklar,    // ✅ Witness[] tipinde
  weeklyDays,
  // ...
);
```

### ❌ YANLIŞ - Beyan katmanını hesaba karıştırma
```typescript
// ASLA YAPMA!
const result = await handleCalculate(
  declarations,  // ❌ Declaration[] - hesap fonksiyonuna gönderilmez
  // ...
);
```

### ✅ DOĞRU - Beyan katmanı
```typescript
// Sadece UI için kullan
<DavaciDeclarationManager
  declaration={declarations.find(d => d.sourceType === "DAVACI") || null}
  onUpdate={(updated) => setDeclarations(prev => [...])}
  isReadOnly={false}
/>
```

---

## 🎯 GELECEK ÖZELLIKLER

Beyan katmanı şu amaçlar için kullanılacak:

1. **Tablo Önizleme**: Dönemlere göre tablo bölümleme
2. **İspat Açıklaması**: "Davacı yaz döneminde 6 gün, kış döneminde 5 gün çalıştığını beyan etmiştir"
3. **Dağıtım Açıklaması**: "Tanık X, 2020-2023 arası karma çalışma düzenini doğrulamıştır"
4. **Rapor Detaylandırma**: Beyan bazlı rapor bölümleri

---

## 🚫 YAPILMAYACAKLAR

- ❌ `declarations` state'ini hesap fonksiyonlarına parametre olarak göndermek
- ❌ Beyan verilerinden FM hesaplama yapmak
- ❌ Beyan verilerinden 270 saat düşümü yapmak
- ❌ `calculateFM` fonksiyonlarını değiştirmek
- ❌ `useMemo` zincirini bozmak
- ❌ Yeni hesap mantığı eklemek

---

## ✅ YAPILACAKLAR

- ✅ Beyan verilerini sadece UI/önizleme/ispat için kullanmak
- ✅ Hesap motoru için `davaci`, `davali`, `taniklar` kullanmak
- ✅ İki katmanı NET ayrı tutmak
- ✅ Hesap zincirini korumak
