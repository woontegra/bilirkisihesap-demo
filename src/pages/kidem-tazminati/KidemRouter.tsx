import { Routes, Route } from "react-router-dom";

// 🔹 Tüm bağımsız kıdem sayfaları
import Kidem30Independent from "./Kidem30Independent";
import KidemBorclarIndependent from "./KidemBorclarIndependent";
import KidemGemiIndependent from "./KidemGemiIndependent";
import KidemMevsimlikIndependent from "./KidemMevsimlikIndependent";
import KidemBasinIndependent from "./KidemBasinIndependent";
// import KidemTopluSozlesmeIndependent from "./KidemTopluSozlesmeIndependent"; // Kaldırıldı - dosya projede kalıyor
// import KidemParcaBasiIndependent from "./KidemParcaBasiIndependent"; // Kaldırıldı - dosya projede kalıyor
import KidemKismiSureliIndependent from "./KidemKismiSureliIndependent";
import KidemBelirliSureliIndependent from "./KidemBelirliSureliIndependent";

export default function KidemRouter() {
  return (
    <Routes>
      <Route path="30isci/:id?" element={<Kidem30Independent />} />
      <Route path="borclar/:id?" element={<KidemBorclarIndependent />} />
      <Route path="gemi/:id?" element={<KidemGemiIndependent />} />
      <Route path="mevsimlik/:id?" element={<KidemMevsimlikIndependent />} />
      <Route path="basin/:id?" element={<KidemBasinIndependent />} />
      {/* <Route path="toplu-sozlesme/:id?" element={<KidemTopluSozlesmeIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      <Route path="part-time/:id?" element={<KidemKismiSureliIndependent />} />
      {/* <Route path="parca-basi/:id?" element={<KidemParcaBasiIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      <Route path="kismi-sureli/:id?" element={<KidemKismiSureliIndependent />} />
      <Route path="belirli-sureli/:id?" element={<KidemBelirliSureliIndependent />} />

      {/* Varsayılan yönlendirme */}
      <Route index element={<Kidem30Independent />} />
    </Routes>
  );
}
