# HARDCODED URL FIX SCRIPT (PowerShell)
# Tüm localhost:4000 referanslarını API_BASE_URL ile değiştirir

Write-Host "🔧 Fixing hardcoded URLs in all files..." -ForegroundColor Cyan

# Find all TypeScript files with localhost:4000
$files = Get-ChildItem -Path "src" -Include "*.tsx","*.ts" -Recurse | 
         Where-Object { (Get-Content $_.FullName -Raw) -match "http://localhost:4000" }

if ($files.Count -eq 0) {
    Write-Host "✅ No hardcoded URLs found!" -ForegroundColor Green
    exit 0
}

Write-Host "📁 Found $($files.Count) files with hardcoded URLs" -ForegroundColor Yellow

foreach ($file in $files) {
    Write-Host "  - Fixing: $($file.FullName)" -ForegroundColor Gray
    
    $content = Get-Content $file.FullName -Raw
    
    # Replace hardcoded URLs with template literals
    $content = $content -replace '"http://localhost:4000', '`${API_BASE_URL}'
    $content = $content -replace "'http://localhost:4000", '`${API_BASE_URL}'
    
    # Check if API_BASE_URL import exists
    if ($content -notmatch 'import.*API_BASE_URL.*from.*@/utils/apiClient') {
        # Find last import line
        $lines = $content -split "`n"
        $lastImportIndex = -1
        
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^import\s') {
                $lastImportIndex = $i
            }
        }
        
        if ($lastImportIndex -ge 0) {
            # Insert import after last import
            $lines = $lines[0..$lastImportIndex] + 
                     'import { API_BASE_URL } from "@/utils/apiClient";' + 
                     $lines[($lastImportIndex + 1)..($lines.Count - 1)]
            $content = $lines -join "`n"
        }
    }
    
    # Write back
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "✅ All files fixed!" -ForegroundColor Green
Write-Host "🧪 Run 'npm run build' to verify" -ForegroundColor Cyan



