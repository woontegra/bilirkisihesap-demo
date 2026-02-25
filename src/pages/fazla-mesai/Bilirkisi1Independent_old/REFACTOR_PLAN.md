# REFACTOR PLAN - Bilirkisi1Independent Ayrımı

## HEDEF
Her senaryo için tamamen ayrı sayfa oluştur - state sızması YOK

## YAPILANMA

```
Bilirkisi1Independent/
├── shared/                    ✅ OLUŞTURULDU
│   ├── types.ts              ✅ Ortak tipler
│   ├── utils.ts              ✅ Ortak fonksiyonlar
│   └── constants.ts          ✅ Ortak sabitler
│
├── StandartPage.tsx          🔄 OLUŞTURULUYOR
├── HaftalikKarmaPage.tsx     ⏳ BEKLEMEDE
├── DonemselPage.tsx          ⏳ BEKLEMEDE
├── DonemselKarmaPage.tsx     ⏳ BEKLEMEDE
│
└── index.tsx                 ⚠️ ESKİ - SİLİNECEK
```

## ADIMLAR

1. ✅ Shared klasörü oluşturuldu
2. 🔄 StandartPage.tsx oluşturuluyor
3. ⏳ HaftalikKarmaPage.tsx oluşturulacak
4. ⏳ Routing güncellenecek
5. ⏳ Test edilecek

## KRİTİK KURALLAR

- ✅ Her sayfa tamamen izole state
- ✅ Sadece shared utilities ortak
- ✅ STANDART hesaplama bozulmayacak
- ✅ HAFTALIK_KARMA hesaplama bozulmayacak
- ✅ State sızması YOK

## İLERLEME

Şu an: StandartPage.tsx oluşturuluyor...
