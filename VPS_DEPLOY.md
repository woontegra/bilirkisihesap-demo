# VPS Frontend Deployment Guide

## 🚀 VPS'de Frontend Deploy Etme

### ADIM 1: Frontend Build Et

Lokal'de:

```bash
cd aktuerya-frontend
npm install
npm run build
```

Bu komut `dist` klasörü oluşturur.

### ADIM 2: VPS'e Dosyaları Yükle

**Yöntem A: FileZilla ile**
1. FileZilla ile VPS'e bağlan
2. Frontend dosyalarını yükle (örn: `/var/www/vhosts/bilirkisihesap.com/bilirkisihesap.com`)
3. `dist` klasöründeki tüm dosyaları yükle

**Yöntem B: Git ile**
1. VPS'de:
```bash
cd /var/www/vhosts/bilirkisihesap.com/bilirkisihesap.com
git pull origin main
cd aktuerya-frontend
npm install
npm run build
```

### ADIM 3: Nginx/Apache Ayarları

**Nginx örneği:**

```nginx
server {
    listen 80;
    server_name bilirkisihesap.com www.bilirkisihesap.com;
    
    root /var/www/vhosts/bilirkisihesap.com/bilirkisihesap.com/aktuerya-frontend/dist;
    index index.html;
    
    # SPA routing için
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Static assets cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Apache örneği (.htaccess):**

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### ADIM 4: Environment Variable

`.env.production` dosyası zaten oluşturuldu:
```
VITE_API_URL=https://apibilirkisihesapcom-production.up.railway.app
```

Build sırasında bu değer kullanılır.

### ADIM 5: Test Et

1. VPS'de frontend'i aç: `http://bilirkisihesap.com`
2. Browser console'da hata var mı kontrol et
3. Login sayfası açılıyor mu kontrol et

## 🔧 Troubleshooting

### CORS hatası
Railway backend'de `CORS_ORIGIN` environment variable'ına VPS domain'ini ekle:
```
CORS_ORIGIN=https://bilirkisihesap.com
```

### API bağlantı hatası
- `VITE_API_URL` doğru mu kontrol et
- Railway backend çalışıyor mu kontrol et
- Browser console'da network tab'ı kontrol et

### 404 hatası (SPA routing)
Nginx/Apache'de `try_files` veya `.htaccess` ayarlarını kontrol et
