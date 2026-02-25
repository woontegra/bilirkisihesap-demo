import { Routes, Route, Navigate } from "react-router-dom";
import StandartIndependent from "./StandartIndependent";
import BorclarKanunuIndependent from "./BorclarKanunuIndependent";
import GemiIndependent from "./GemiIndependent";
import MevsimIndependent from "./MevsimIndependent";
import BasinIndependent from "./BasinIndependent";
import GunlukOlmayanIndependent from "./BasinIndependent/GunlukOlmayanIndependent";
// import TopluIndependent from "./TopluIndependent"; // Kaldırıldı - dosya projede kalıyor
// import PartIndependent from "./PartIndependent"; // Kaldırıldı - dosya projede kalıyor
// import ParcaIndependent from "./ParcaIndependent"; // Kaldırıldı - dosya projede kalıyor
import KismiIndependent from "./KismiIndependent";
import BelirliIndependent from "./BelirliIndependent";

export default function YillikRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="standart" />} />
      <Route path="standart/:id?" element={<StandartIndependent />} />
      <Route path="borclar/:id?" element={<BorclarKanunuIndependent />} />
      <Route path="gemi/:id?" element={<GemiIndependent />} />
      <Route path="mevsim/:id?" element={<MevsimIndependent />} />
      <Route path="basin/:id?" element={<BasinIndependent />} />
      <Route path="basin/gunluk-olmayan/:id?" element={<GunlukOlmayanIndependent />} />
      {/* <Route path="toplu" element={<TopluIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      {/* <Route path="part" element={<PartIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      {/* <Route path="parca" element={<ParcaIndependent />} /> Kaldırıldı - dosya projede kalıyor */}
      <Route path="kismi/:id?" element={<KismiIndependent />} />
      <Route path="belirli/:id?" element={<BelirliIndependent />} />
    </Routes>
  );
}
