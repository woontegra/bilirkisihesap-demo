#!/bin/bash
# TEK KOMUTLA DEPLOY - Frontend
# Kullanım: ./deploy.sh

set -e

echo "🚀 Frontend Deployment Başlıyor..."

# Proje dizini (sunucudaki frontend dizini)
PROJECT_DIR="/var/www/vhosts/bilirkisihesap.com/bilirkisihesap.com"
cd "$PROJECT_DIR" || exit 1

# Git'ten çek
echo "📥 Git'ten güncellemeler çekiliyor..."
git pull origin main || echo "⚠️ Git pull başarısız, devam ediliyor..."

# Build
echo "🔨 Frontend build ediliyor..."
npm install
npm run build

# Build dosyalarını web dizinine kopyala (nginx/apache için)
echo "📁 Build dosyaları kopyalanıyor..."
# Buraya kendi web server yapılandırmanıza göre kopyalama komutu ekleyin
# Örnek: cp -r dist/* /var/www/html/

echo "✅ Frontend deployment tamamlandı!"
