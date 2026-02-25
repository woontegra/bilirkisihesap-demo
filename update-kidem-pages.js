const fs = require('fs');
const path = require('path');

// Scriptin çalıştığı ana dizini al
const baseDir = path.join(__dirname, 'src', 'pages', 'kidem-tazminati');

// List of all Kıdem Tazminatı page directories
const kidemPages = [
  'Kidem30Independent',
  'KidemBaseTemplate',
  'KidemBasinIndependent',
  'KidemBelirliSureliIndependent',
  'KidemBorclarIndependent',
  'KidemGemiIndependent',
  'KidemKismiSureliIndependent',
  'KidemMevsimlikIndependent',
  'KidemParcaBasiIndependent',
  'KidemPartTimeIndependent',
  'KidemTopluSozlesmeIndependent',
  'independent/index',
  'independent/ornekSayfa'
];

// The pattern to search for and replace
const searchPattern = /<div className="mt-6 bg-white rounded-lg shadow p-4">\s*<h3 className="text-lg font-medium mb-3">Brüt'ten Net'e Çeviri<\/h3>\s*<div className="space-y-2">\s*<p className="flex items-center justify-between">\s*<span>Brüt Kıdem Tazminatı:<\/span>\s*<span className="font-semibold">\\{fmt\(brutTazminat\)\\} ₺<\/span>\s*<\/p>\s*<p className="text-sm text-gray-500">\s*\(Brüt üzerinden %15 stopaj kesintisi yapılmıştır\)\s*<\/p>\s*<hr className="my-2" \/>\s*<p className="flex items-center justify-between">\s*<span>Net Kıdem Tazminatı:<\/span> \s*<span className="font-semibold text-green-700">\\{fmt\(netTazminat\)\\} ₺<\/span>\s*<\/p>\s*<\/div>\s*<\/div>/g;

// The replacement template
const replacementTemplate = `            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium mb-3">Brüt'ten Net'e Çeviri</h3>
              <div className="space-y-2">
                <p className="flex items-center justify-between">
                  <span>Brüt Kıdem Tazminatı:</span>
                  <span className="font-semibold">{fmt(brutTazminat)} ₺</span>
                </p>
                <p className="text-sm text-gray-500">
                  (Brüt üzerinden %15 stopaj kesintisi yapılmıştır)
                </p>
                <hr className="my-2" />
                <p className="flex items-center justify-between">
                  <span>Net Kıdem Tazminatı:</span> 
                  <span className="font-semibold text-green-700">{fmt(netTazminat)} ₺</span>
                </p>
                
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={handlePrint} 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-4 py-2 transition-colors flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                        <rect x="6" y="14" width="12" height="8"></rect>
                      </svg>
                      Yazdır
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-md px-4 py-2 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </div>
            </div>`;

// Function to update a single file
function updateFile(filePath) {
  try {
    const fullPath = path.join(baseDir, filePath, 'index.tsx');
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`Dosya bulunamadı: ${fullPath}`);
      return;
    }
    
    // Read file content
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if the pattern exists in the file
    if (!searchPattern.test(content)) {
      console.log(`Şu dosyada eşleşme bulunamadı: ${filePath}`);
      return;
    }
    
    // Replace the content
    const updatedContent = content.replace(searchPattern, replacementTemplate);
    
    // Write back to file
    fs.writeFileSync(fullPath, updatedContent, 'utf8');
    console.log(`Güncellendi: ${filePath}`);
    
  } catch (error) {
    console.error(`Hata oluştu (${filePath}):`, error.message);
  }
}

console.log('Kıdem Tazminatı sayfaları güncelleniyor...\n');

// Update all Kıdem Tazminatı pages
kidemPages.forEach(page => {
  updateFile(page);
});

console.log('\nİşlem tamamlandı! Tüm sayfalar güncellendi.');
