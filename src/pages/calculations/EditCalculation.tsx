import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import Layout from "@/components/Layout";
import { getRouteForCalculationType } from "./calculationRouter";
import { apiGet } from "@/utils/apiClient";

export default function EditCalculation() {
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
        // apiGet kullan - otomatik olarak tenant ID ve diğer header'ları ekler
        const res = await apiGet(`/api/saved-cases/${id}`);

        if (!res.ok) {
          throw new Error("Hesaplama yüklenemedi");
        }

        const calculation = await res.json();
        
        // ÖNEMLİ: Önce data içindeki route bilgisini kontrol et (kayıt sırasında kaydedilmiş route)
        // İç içe yapıları kontrol et: data.route, data.form.route, data.data.form.route
        const savedRoute = calculation.data?.route || 
                          calculation.data?.form?.route || 
                          calculation.data?.data?.form?.route ||
                          calculation.data?.pageType ||
                          calculation.data?.form?.pageType ||
                          calculation.data?.data?.form?.pageType ||
                          null;
        
        let route: string;
        if (savedRoute) {
          // Kaydedilmiş route varsa onu kullan (en güvenilir)
          route = String(savedRoute).toLowerCase();
          // Eğer route ID içermiyorsa (sadece path ise), olduğu gibi kullan
          if (!route.includes("/")) {
            // pageType ise route'a çevir
            if (route.includes("bilirkisi-1") || route.includes("bilirkisi1")) {
              route = "/fazla-mesai/bilirkisi-1/standart";
            } else if (route.includes("bilirkisi-2") || route.includes("bilirkisi2")) {
              route = "/fazla-mesai/bilirkisi-2";
            }
          } else if (route === "/fazla-mesai/bilirkisi-1") {
            // Eğer route tam olarak /fazla-mesai/bilirkisi-1 ise, /standart ekle
            route = "/fazla-mesai/bilirkisi-1/standart";
          }
          console.log("[EditCalculation] Kaydedilmiş route kullanılıyor:", route);
        } else {
          // Kaydedilmiş route yoksa type'dan route hesapla
          const calculationType = calculation.type || calculation.calculation_type || calculation.hesaplama_tipi || "";
          route = getRouteForCalculationType(calculationType, calculation.data || {});
          // Bilirkişi-1 için standart alt rotasını ekle
          if (route === "/fazla-mesai/bilirkisi-1") {
            route = "/fazla-mesai/bilirkisi-1/standart";
          }
          console.log("[EditCalculation] Type'dan route hesaplandı:", { calculationType, route });
        }
        
        // Route parametresi olarak ID'yi ekle (örn: /kidem-tazminati/30isci/22)
        const editUrl = `${route}/${id}`;
        
        console.log("[EditCalculation] Final editUrl:", editUrl);
        hasNavigated.current = true;
        navigate(editUrl, { replace: true });
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
    <Layout title="Yönlendiriliyor..." description="Düzenleme sayfasına yönlendiriliyor">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yönlendiriliyor...</p>
        </div>
      </div>
    </Layout>
  );
}

