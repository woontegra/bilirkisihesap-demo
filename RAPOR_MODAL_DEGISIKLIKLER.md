# Rapor modalı değişiklikleri – Nerede ne değişti?

## 1. Değiştirilen dosyalar (tek kaynak)

| Dosya | Ne yapıldı? |
|-------|----------------|
| `src/components/report/BaseReportModal.tsx` | Tüm raporların kullandığı tek modal. 16cm genişlik, Yazdır/Word/PDF. |
| `src/components/DraggableModal.tsx` | Sürüklenebilir çerçeve: ⋮⋮, küçült/büyüt, başlıktan sürükleme. |
| `src/pages/kidem-tazminati/KidemReportModal.tsx` | İçi boşaltıldı; sadece BaseReportModal re-export ediyor. |

Bu üç dosya değişti. Diğer kıdem **sayfa** dosyaları zaten `@/components/report` içindeki `BaseReportModal`'ı import ediyor; onlarda yeni bir değişiklik yok.

---

## 2. Hangi sayfada test edeceksin?

Değişen şey **sayfa** değil, **ortak modal**. Aynı modal şu sayfalarda rapor açıldığında kullanılıyor:

### Kıdem tazminatı (raporu açınca yeni modal)

- **Kısmi süreli / Part-time:**  
  `https://.../kidem-tazminati/kismi-sureli` veya `.../kidem-tazminati/part-time`  
  → Sayfanın **altındaki footer’da** “Kıdem Tazminatı” (veya rapor önizleme) butonuna tıkla.

- **Gemi:**  
  `.../kidem-tazminati/gemi`  
  → Aynı şekilde rapor butonuna tıkla.

- **Mevsimlik:**  
  `.../kidem-tazminati/mevsimlik`  
  → Rapor butonuna tıkla.

- **Basın:**  
  `.../kidem-tazminati/basin`  
  → Rapor butonuna tıkla.

### Dönemsel fazla mesai (karşılaştırma için)

- **Dönemsel haftalık:**  
  `.../fazla-mesai/donemsel-haftalik` (veya Bilirkisi1 / Dönemsel sayfa)  
  → Raporu aç; burada da **aynı** modal (BaseReportModal + DraggableModal) kullanılıyor.

Yani değişiklik “şu sayfa”da değil; **raporu açtığın her yerde** (yukarıdaki sayfalarda rapor butonuna basınca açılan pencerede).

---

## 3. Hiçbir şey değişmiyorsa

1. **Projeyi yeniden derle / dev’i yeniden başlat**
   - Terminalde: `npm run build` veya dev server’ı durdurup tekrar `npm run dev` (veya `npm start`).
2. **Tarayıcıda sert yenile**
   - Ctrl+Shift+R (Windows) veya Cmd+Shift+R (Mac), ya da F12 → Network → “Disable cache” işaretle → sayfayı yenile.
3. **Doğru yerde raporu aç**
   - Yukarıdaki URL’lerden birine git (örn. `/kidem-tazminati/kismi-sureli`).
   - Sayfa içindeki **rapor / önizleme** butonuna tıkla (footer’daki “Kıdem Tazminatı” veya benzeri).
   - Açılan **modal** pencerede başlık çubuğunda ⋮⋮ ve küçült/büyüt ikonları görünüyorsa yeni modal yüklü demektir.

---

## 4. Özet

- Değişiklik yapılan yer: **`src/components/report/BaseReportModal.tsx`** ve **`src/components/DraggableModal.tsx`** (ve KidemReportModal re-export).
- Test ettiğin yer: **Herhangi bir kıdem sayfası** (kismi-sureli, gemi, mevsimlik, basin) veya dönemsel fazla mesai sayfası → **Rapor butonuna tıklayınca açılan modal**.
- Görünmüyorsa: Build/restart + sert yenile (Ctrl+Shift+R).
