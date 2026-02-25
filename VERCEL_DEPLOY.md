# Vercel Deployment Guide - Frontend

## 🚀 Vercel'de Frontend Deploy Etme

### ADIM 1: Vercel'de Proje Oluştur

1. [vercel.com](https://vercel.com) → Sign up/Login (GitHub ile)
2. "Add New..." → "Project"
3. GitHub repository'ni seç: `aktuerya-frontend` veya tüm repo'yu seç
4. "Import" butonuna tıkla

### ADIM 2: Build Settings

Vercel otomatik olarak algılar:
- **Framework Preset:** Vite
- **Root Directory:** `aktuerya-frontend` (eğer monorepo ise)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### ADIM 3: Environment Variables

**ÖNEMLİ:** Railway backend URL'ini ekle!

Vercel dashboard → Projen → "Settings" → "Environment Variables"

Şu değişkeni ekle:

```env
VITE_API_URL=https://your-railway-domain.up.railway.app
```

**Örnek:**
```
VITE_API_URL=https://api-bilirkisihesap-production.up.railway.app
```

**Not:** Railway domain'ini Railway dashboard'dan al:
- Railway → Projen → Settings → Networking → Domain

### ADIM 4: Deploy

1. "Deploy" butonuna tıkla
2. Vercel otomatik olarak:
   - GitHub'dan kodu çeker
   - `npm install` çalıştırır
   - `npm run build` çalıştırır
   - `dist` klasörünü deploy eder

### ADIM 5: Domain Ayarla (Opsiyonel)

1. Vercel dashboard → "Settings" → "Domains"
2. Custom domain ekle (örn: `bilirkisihesap.com`)
3. DNS ayarlarını yap

## 🔧 Troubleshooting

### Build hatası
- Logları kontrol et: Vercel dashboard → Deployments → Logs
- `VITE_API_URL` doğru mu kontrol et

### API bağlantı hatası
- `VITE_API_URL` Railway backend URL'ine işaret ediyor mu?
- Railway backend çalışıyor mu?
- CORS ayarları doğru mu? (Backend'de CORS_ORIGIN'e Vercel domain'ini ekle)

### CORS hatası
Railway backend'de `CORS_ORIGIN` environment variable'ına Vercel domain'ini ekle:
```
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

## 📝 Notlar

- Vercel ücretsiz tier'da sınırsız deploy
- Otomatik HTTPS
- CDN ile hızlı
- GitHub push ile otomatik deploy
