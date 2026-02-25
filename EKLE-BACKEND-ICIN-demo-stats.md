# Backend'e /demo-stats ve /demo-track Eklemek

4000 portunda çalışan **aktuerya-backend** projesine bu route'ları eklemeniz gerekiyor.

## Adım 1: Backend projesini Cursor'da açın

- **File → Open Folder**
- **aktuerya-backend** klasörünü seçin (bilirkisihesap-demo-frontend değil).

Sonra Cursor’da bana şunu yazın:  
**"demo-stats ve demo-track route'larını bu backend'e ekle"**  
Ben o projedeki doğru dosyayı bulup ekleyeceğim.

---

## Adım 2 (Alternatif): Kendiniz ekleyecekseniz

Backend projenizde **Express app’in oluşturulduğu ana dosyayı** açın (genelde `app.js`, `index.js` veya `server.js`).  
`const app = express();` ve `app.use(express.json());` gibi satırların **hemen altına** aşağıdaki kodu yapıştırın:

```javascript
// ========== DEMO TRACKING (başlangıç) ==========
const path = require('path');
const fs = require('fs');
const DEMO_STATS_FILE = path.join(process.cwd(), 'demo-stats.json');
const DEMO_DEFAULT = { calculation: 0, preview_click: 0, demo_click: 0, subscribe_click: 0 };

function demoReadStats() {
  try {
    if (fs.existsSync(DEMO_STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEMO_STATS_FILE, 'utf8'));
      return { ...DEMO_DEFAULT, ...data };
    }
  } catch (e) {}
  return { ...DEMO_DEFAULT };
}

function demoEnsureFile() {
  if (!fs.existsSync(DEMO_STATS_FILE)) {
    fs.writeFileSync(DEMO_STATS_FILE, JSON.stringify(DEMO_DEFAULT, null, 2), 'utf8');
  }
}

app.get('/demo-stats', (_req, res) => {
  try {
    demoEnsureFile();
    res.json(demoReadStats());
  } catch (e) {
    res.status(500).json({});
  }
});

app.post('/demo-track', (req, res) => {
  try {
    demoEnsureFile();
    const stats = demoReadStats();
    const event = req.body?.event;
    if (event != null && typeof stats[event] === 'number') {
      stats[event] += 1;
      fs.writeFileSync(DEMO_STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});
// ========== DEMO TRACKING (bitiş) ==========
```

**Not:** Dosyanın en üstünde zaten `const fs = require('fs');` veya `const path = require('path');` varsa, yukarıdaki `const path = ...` ve `const fs = ...` satırlarını **silin**, sadece `DEMO_STATS_FILE` ve altındaki kodu yapıştırın.

Backend’i yeniden başlatın. Sonra tarayıcıda `http://localhost:4000/demo-stats` açın; JSON görmelisiniz.
