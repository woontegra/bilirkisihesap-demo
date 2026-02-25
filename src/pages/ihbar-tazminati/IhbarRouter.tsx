import { Routes, Route } from "react-router-dom";

// 🔹 İhbar Tazminatı bağımsız sayfaları
import Ihbar30Independent from "./Ihbar30Independent";
import IhbarBorclarPage from "./IhbarBorclarIndependent/IhbarBorclarPage";
import IhbarGemiIndependent from "./IhbarGemiIndependent";
import IhbarMevsimIndependent from "./IhbarMevsimIndependent";
import IhbarBasinIndependent from "./IhbarBasinIndependent";
// import IhbarTopluIndependent from "./IhbarTopluIndependent"; // Kaldırıldı - dosya projede kalıyor
// import IhbarPartIndependent from "./IhbarPartIndependent"; // Kaldırıldı - dosya projede kalıyor
// import IhbarParcaIndependent from "./IhbarParcaIndependent"; // Kaldırıldı - dosya projede kalıyor
import IhbarKismiIndependent from "./IhbarKismiIndependent";
import IhbarBelirliIndependent from "./IhbarBelirliIndependent";

export default function IhbarRouter() {
  return (
    <Routes>
      <Route path="30isci/:id?" element={<Ihbar30Independent />} />
      <Route path="borclar/:id?" element={<IhbarBorclarPage />} />
      <Route path="gemi/:id?" element={<IhbarGemiIndependent />} />
      <Route path="mevsim/:id?" element={<IhbarMevsimIndependent />} />
      <Route path="basin/:id?" element={<IhbarBasinIndependent />} />
      {/* <Route path="toplu" element={<IhbarTopluIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      {/* <Route path="part" element={<IhbarPartIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      {/* <Route path="parca" element={<IhbarParcaIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      <Route path="kismi/:id?" element={<IhbarKismiIndependent />} />
      <Route path="belirli/:id?" element={<IhbarBelirliIndependent />} />

      {/* Varsayılan yönlendirme */}
      <Route index element={<Ihbar30Independent />} />
    </Routes>
  );
}
