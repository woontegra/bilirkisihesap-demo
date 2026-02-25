import { Routes, Route, Navigate } from "react-router-dom";
import StandardIndependent from "./StandardIndependent";
import GemiAdamiIndependent from "./GemiAdamiIndependent";
import BasinIsIndependent from "./BasinIsIndependent";

export default function HaftaTatiliRouter() {
  return (
    <Routes>
      <Route path="standard/:id?" element={<StandardIndependent />} />
      <Route path="gemi-adami/:id?" element={<GemiAdamiIndependent />} />
      <Route path="basin-is/:id?" element={<BasinIsIndependent />} />
      {/* Varsayılan yönlendirme */}
      <Route index element={<Navigate to="standard" replace />} />
    </Routes>
  );
}

