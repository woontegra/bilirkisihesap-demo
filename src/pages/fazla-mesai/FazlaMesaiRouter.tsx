import { Routes, Route, Navigate } from "react-router-dom";
import StandartIndependent from "./StandartIndependent";
import TanikliStandartPage from "./TanikliStandartIndependent/StandartPage";
import HaftalikKarmaPage from "./HaftalikKarmaIndependent/HaftalikKarmaPage";
import DonemselPage from "./DonemselIndependent/DonemselPage";
import DonemselHaftalikPage from "./DonemselHaftalikIndependent/DonemselKarmaPage";
import YeraltiIndependent from "./YeraltiIndependent";
import Vardiya12Independent from "./Vardiya12Independent";
import Vardiya24Independent from "./Vardiya24Independent";
import Vardiya48Independent from "./Vardiya24Independent/Vardiya48Independent";
import GemiIndependent from "./GemiIndependent";
import GemiFullCrew24 from "./GemiIndependent/FullCrew24";
import EvIndependent from "./EvIndependent";
import FazlaSurelerleCalismaIndependent from "./FazlaSurelerleCalismaIndependent";
import BasinIsFazlaMesaiIndependent from "./BasinIsIndependent";
import FazlaMesaiRaporPage from "../FazlaMesaiRaporPage";

export default function FazlaMesaiRouter() {
  return (
    <Routes>
      <Route path="standart/:id?" element={<StandartIndependent key="standart" />} />
      <Route path="tanikli-standart/:id?" element={<TanikliStandartPage key="tanikli-standart" />} />
      <Route path="haftalik-karma/:id?" element={<HaftalikKarmaPage key="haftalik-karma" />} />
      <Route path="donemsel/:id?" element={<DonemselPage key="donemsel" />} />
      <Route path="donemsel-haftalik/:id?" element={<DonemselHaftalikPage key="donemsel-haftalik" />} />
      <Route path="yeralti-isci/:id?" element={<YeraltiIndependent />} />
      <Route path="vardiya12/:id?" element={<Vardiya12Independent />} />
      <Route path="vardiya24/:id?" element={<Vardiya24Independent />} />
      <Route path="vardiya48/:id?" element={<Vardiya48Independent />} />
      <Route path="gemi/:id?" element={<GemiIndependent />} />
      <Route path="gemi-7-24/:id?" element={<GemiFullCrew24 />} />
      <Route path="ev/:id?" element={<EvIndependent />} />
      <Route path="fazla-surelerle-calisma/:id?" element={<FazlaSurelerleCalismaIndependent />} />
      <Route path="basin-is-fazla-mesai/:id?" element={<BasinIsFazlaMesaiIndependent />} />
      <Route path="rapor" element={<FazlaMesaiRaporPage />} />
      <Route index element={<StandartIndependent />} />
    </Routes>
  );
}
