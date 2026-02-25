import React, { useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";

export default function HaftaTatiliRaporPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { error } = useToast();

  useEffect(() => {
    if (!id) {
      error("Hesaplama ID'si bulunamadı");
      navigate("/admin");
      return;
    }
  }, [id, navigate, error]);

  if (!id || !type) {
    return null;
  }

  // URL'deki id parametresini caseId query parametresine çevirerek yönlendir
  // Bu sayede StandardIndependent component'i kaydedilmiş hesaplamayı yükleyebilir
  // Rapor görünümü için sayfayı açıp otomatik olarak rapor modal'ını açabilir
  const basePath = `/hafta-tatili-alacagi/${type}`;
  return <Navigate to={`${basePath}?caseId=${id}&view=true`} replace />;
}

