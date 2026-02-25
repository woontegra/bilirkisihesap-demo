import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getRouteForCalculationType } from "./calculationRouter";
import { apiGet } from "@/utils/apiClient";

export default function ViewCalculation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { error } = useToast();
  const [calculation, setCalculation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const hasNavigated = useRef(false);

  // EditCalculation ile aynı route mantığı - önce kaydedilmiş route, sonra type'dan hesaplama
  const route = calculation ? (() => {
    const savedRoute = calculation.data?.route || calculation.data?.form?.route || calculation.data?.data?.form?.route ||
      calculation.data?.pageType || calculation.data?.form?.pageType || calculation.data?.data?.form?.pageType || null;
    if (savedRoute) {
      let r = String(savedRoute).toLowerCase();
      if (!r.includes("/")) {
        if (r.includes("bilirkisi-1") || r.includes("bilirkisi1")) r = "/fazla-mesai/bilirkisi-1/standart";
        else if (r.includes("bilirkisi-2") || r.includes("bilirkisi2")) r = "/fazla-mesai/bilirkisi-2";
      } else if (r === "/fazla-mesai/bilirkisi-1") r = "/fazla-mesai/bilirkisi-1/standart";
      return r;
    }
    const calcType = calculation.type || calculation.calculation_type || calculation.hesaplama_tipi || "";
    let r = getRouteForCalculationType(calcType, calculation.data || {});
    if (r === "/fazla-mesai/bilirkisi-1") r = "/fazla-mesai/bilirkisi-1/standart";
    return r;
  })() : "";
  const viewUrl = route && id ? `${route}/${id}?view=true` : "";

  // Hesaplamayı yükle
  useEffect(() => {
    if (!id) {
      error("Hesaplama ID'si bulunamadı");
      navigate("/profile/saved-calculations");
      return;
    }

    const loadCalculation = async () => {
      try {
        setLoading(true);
        const res = await apiGet(`/api/saved-cases/${id}`);

        if (!res.ok) {
          throw new Error("Hesaplama yüklenemedi");
        }

        const data = await res.json();
        setCalculation(data);
      } catch (err) {
        console.error("Failed to load calculation:", err);
        error("Hesaplama yüklenemedi");
        navigate("/profile/saved-calculations");
      } finally {
        setLoading(false);
      }
    };

    loadCalculation();
  }, [id, navigate, error]);

  // Otomatik yönlendirme
  useEffect(() => {
    if (route && !loading && calculation && id && !hasNavigated.current) {
      hasNavigated.current = true;
      navigate(viewUrl, { replace: true });
    }
  }, [route, id, loading, calculation, navigate, viewUrl]);

  if (loading) {
    return (
      <Layout title="Yükleniyor..." description="Hesaplama yükleniyor">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!calculation) {
    return (
      <Layout title="Hesaplama Bulunamadı" description="Aradığınız hesaplama bulunamadı">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Hesaplama bulunamadı</p>
            <Button onClick={() => navigate("/profile/saved-calculations")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri Dön
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Yönlendiriliyor..." description="Hesaplama sayfasına yönlendiriliyor">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yönlendiriliyor...</p>
        </div>
      </div>
    </Layout>
  );
}

