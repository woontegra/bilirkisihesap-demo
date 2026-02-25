#!/usr/bin/env node

/**
 * Hardcoded URL Fix Script
 * Tüm string literal "${API_BASE_URL}" kullanımlarını template literal'e çevirir
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, 'src');

// Recursively find all .tsx and .ts files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Fix hardcoded URLs in a file
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix string literal "${API_BASE_URL}" to template literal
  const patterns = [
    // Double quotes
    { from: /fetch\("(\$\{API_BASE_URL\}[^"]*)"\)/g, to: (match, url) => `fetch(\`${url}\`)` },
    { from: /fetch\("(\$\{API_BASE_URL\}[^"]*)"\s*,/g, to: (match, url) => `fetch(\`${url}\`,` },
    // Single quotes
    { from: /fetch\('(\$\{API_BASE_URL\}[^']*)'\)/g, to: (match, url) => `fetch(\`${url}\`)` },
    { from: /fetch\('(\$\{API_BASE_URL\}[^']*)'\s*,/g, to: (match, url) => `fetch(\`${url}\`,` },
  ];
  
  patterns.forEach(({ from, to }) => {
    const newContent = content.replace(from, to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  // Fix wrong API_BASE definitions
  const wrongApiBasePattern = /const\s+API_BASE\s*=\s*\(import\.meta\s+as\s+any\)\.env\?\.VITE_API_URL\s*\|\|\s*"\$\{API_BASE_URL\}";/g;
  if (wrongApiBasePattern.test(content)) {
    content = content.replace(wrongApiBasePattern, '// API_BASE_URL already imported from @/utils/apiClient');
    modified = true;
  }
  
  // Replace API_BASE with API_BASE_URL if API_BASE_URL is imported
  if (content.includes('import') && content.includes('API_BASE_URL') && content.includes('API_BASE')) {
    // Check if API_BASE_URL is imported
    const hasImport = /import.*API_BASE_URL.*from/.test(content);
    if (hasImport) {
      // Replace API_BASE with API_BASE_URL in fetch calls
      content = content.replace(/\$\{API_BASE\}/g, '${API_BASE_URL}');
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

// Main
console.log('🔧 Fixing hardcoded URLs...\n');

const files = findFiles(SRC_DIR);
let fixedCount = 0;

files.forEach(file => {
  if (fixFile(file)) {
    console.log(`✅ Fixed: ${path.relative(SRC_DIR, file)}`);
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files!`);
console.log('🧪 Run "npm run build" to verify');
