/**
 * Local Kaydet Hook - Simplified version without global provider
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../localContext/ToastContext";
import { API_BASE_URL } from "../localUtils/apiClient";

interface KaydetOptions {
  hesapTuru: string;
  veri: any;
  mevcutId?: string | number | null;
  mevcutKayitAdi?: string | null;
  redirectPath?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export function useKaydetContext() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<KaydetOptions | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  const kaydetAc = useCallback((options: KaydetOptions) => {
    setCurrentOptions(options);
    setIsModalOpen(true);
  }, []);

  const kaydetKapat = useCallback(() => {
    setIsModalOpen(false);
    setCurrentOptions(null);
  }, []);

  const handleSave = useCallback(async (kayitAdi: string) => {
    if (!currentOptions) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";
      
      const endpoint = currentOptions.mevcutId
        ? `${API_BASE_URL}/api/saved-cases/${currentOptions.mevcutId}`
        : `${API_BASE_URL}/api/saved-cases`;

      const response = await fetch(endpoint, {
        method: currentOptions.mevcutId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: kayitAdi,
          type: currentOptions.hesapTuru,
          data: currentOptions.veri,
        }),
      });

      if (!response.ok) {
        throw new Error("Kayıt başarısız");
      }

      const result = await response.json();
      
      toast.success("Başarılı", "Kayıt başarıyla oluşturuldu");
      
      if (currentOptions.onSuccess) {
        currentOptions.onSuccess(result);
      }

      if (currentOptions.redirectPath && result.id) {
        navigate(`${currentOptions.redirectPath}/${result.id}`);
      }

      kaydetKapat();
    } catch (error) {
      console.error("Kayıt hatası:", error);
      toast.error("Hata", "Kayıt oluşturulamadı");
      
      if (currentOptions.onError) {
        currentOptions.onError(error as Error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [currentOptions, toast, navigate, kaydetKapat]);

  return {
    kaydetAc,
    kaydetKapat,
    isModalOpen,
    isSaving,
    handleSave,
    currentOptions,
  };
}
