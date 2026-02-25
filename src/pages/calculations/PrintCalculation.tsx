import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import Layout from "@/components/Layout";
import { getRouteForCalculationType } from "./calculationRouter";
import { apiGet } from "@/utils/apiClient";

export default function PrintCalculation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { error } = useToast();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!id || hasNavigated.current) {
      if (!id) {
        error("Hesaplama ID'si bulunamadı");
        navigate("/profile/saved-calculations");
      }
      return;
    }

    const loadAndRedirect = async () => {
      try {
        // Önce yeni endpoint'i dene
        let res = await apiGet(`/api/saved-calculations/${id}`);

        // Eğer 404 ise eski endpoint'i dene
        if (res.status === 404) {
          res = await apiGet(`/api/savedCases/${id}`);
        }

        if (!res.ok) {
          throw new Error("Hesaplama yüklenemedi");
        }

        const calculation = await res.json();
        const calculationType = calculation.calculation_type || calculation.hesaplama_tipi || "";
        const route = getRouteForCalculationType(calculationType, calculation.data || {});
        const printUrl = `${route}?caseId=${id}&print=true`;
        
        hasNavigated.current = true;
        navigate(printUrl, { replace: true });
        
        // Print dialog'unu aç
        setTimeout(() => {
          window.print();
        }, 1500);
      } catch (err) {
        console.error("Failed to load calculation:", err);
        error("Hesaplama yüklenemedi");
        hasNavigated.current = true;
        navigate("/profile/saved-calculations");
      }
    };

    loadAndRedirect();
  }, [id, navigate, error]);

  return (
    <Layout title="Yönlendiriliyor..." description="Yazdırma sayfasına yönlendiriliyor">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yönlendiriliyor...</p>
        </div>
      </div>
    </Layout>
  );
}

