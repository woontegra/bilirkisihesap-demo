#!/bin/bash

# HARDCODED URL FIX SCRIPT
# Tüm localhost:4000 referanslarını API_BASE_URL ile değiştirir

echo "🔧 Fixing hardcoded URLs in all files..."

# Find all TypeScript files with localhost:4000
FILES=$(grep -rl "http://localhost:4000" src/ --include="*.tsx" --include="*.ts" 2>/dev/null)

if [ -z "$FILES" ]; then
  echo "✅ No hardcoded URLs found!"
  exit 0
fi

echo "📁 Found files with hardcoded URLs:"
echo "$FILES" | wc -l

# Fix each file
for file in $FILES; do
  echo "  - Fixing: $file"
  
  # Replace hardcoded URLs with template literals
  sed -i 's|"http://localhost:4000|`${API_BASE_URL}|g' "$file"
  sed -i "s|'http://localhost:4000|\`\${API_BASE_URL}|g" "$file"
  
  # Check if API_BASE_URL import exists
  if ! grep -q "import.*API_BASE_URL.*from.*@/utils/apiClient" "$file"; then
    # Find the last import line
    LAST_IMPORT=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
    
    if [ -n "$LAST_IMPORT" ]; then
      # Add import after last import
      sed -i "${LAST_IMPORT}a import { API_BASE_URL } from \"@/utils/apiClient\";" "$file"
    fi
  fi
done

echo "✅ All files fixed!"
echo "🧪 Run 'npm run build' to verify"



