/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { kaydetHesap, type HesapTuru, type KayitSonucu } from "../localUtils/kaydetServisi";
import KaydetModal from "../localComponents/KaydetModal";

interface KaydetOptions {
  hesapTuru: HesapTuru;
  veri: any;
  mevcutId?: string | number | null;
  mevcutKayitAdi?: string | null;
  varsayilanIsim?: string;
  redirectPath?: string;
  onSuccess?: (result: KayitSonucu) => void;
  onError?: (error: Error) => void;
}

interface UseKaydetParams {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

export function useKaydet({ success, error: showError }: UseKaydetParams) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<KaydetOptions | null>(null);
  const navigate = useNavigate();

  const performKaydetInternal = useCallback(
    async (kayitAdi: string, options: KaydetOptions) => {
      setIsSaving(true);
      try {
        const result = await kaydetHesap(
          kayitAdi,
          options.hesapTuru,
          options.veri,
          options.mevcutId
        );

        setIsModalOpen(false);
        
        // Farklı mesajlar: Güncelleme vs Yeni Kayıt
        const isUpdate = !!options.mevcutId;
        const successMessage = isUpdate 
          ? "Dosya güncellendi" 
          : (result.message || "Dosya kaydedildi");
        success(successMessage);

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        // Only redirect on CREATE (new records), not on UPDATE
        // When updating, user is already on the correct page
        if (options.redirectPath && result.id && !options.mevcutId) {
          const redirectUrl = options.redirectPath.includes(":id")
            ? options.redirectPath.replace(":id", String(result.id))
            : `${options.redirectPath}/${result.id}`;
          
          setTimeout(() => {
            navigate(redirectUrl, { replace: false });
          }, 1500);
        }
      } catch (err: any) {
        console.error("Kayıt hatası:", err);
        const errorMessage = err.message || "Kayıt sırasında bir hata oluştu";
        showError(errorMessage);

        if (options.onError) {
          options.onError(err);
        }
      } finally {
        setIsSaving(false);
        setCurrentOptions(null);
      }
    },
    [navigate, success, showError]
  );

  const kaydetAc = useCallback((options: KaydetOptions) => {
    console.log('🔍 [KAYDET] kaydetAc called with:', {
      mevcutId: options.mevcutId,
      mevcutKayitAdi: options.mevcutKayitAdi,
      mevcutKayitAdiTrimmed: options.mevcutKayitAdi?.trim(),
      hasId: !!options.mevcutId,
      hasName: !!options.mevcutKayitAdi,
      hasNameTrimmed: !!(options.mevcutKayitAdi && options.mevcutKayitAdi.trim())
    });
    
    // Güncelleme: mevcutId VE mevcutKayitAdi varsa direkt kaydet (modal açma)
    if (options.mevcutId && options.mevcutKayitAdi && options.mevcutKayitAdi.trim()) {
      console.log('✅ [KAYDET] Güncelleme modu - modal açılmayacak');
      performKaydetInternal(options.mevcutKayitAdi, options);
      return;
    }
    
    console.log('⚠️ [KAYDET] Yeni kayıt modu - modal açılacak');
    // Yeni kayıt: Modal aç
    setCurrentOptions(options);
    setIsModalOpen(true);
  }, [performKaydetInternal]);

  const kaydetKapat = useCallback(() => {
    setIsModalOpen(false);
    setCurrentOptions(null);
  }, []);

  const performKaydet = useCallback(
    async (kayitAdi: string) => {
      if (!currentOptions) return;
      await performKaydetInternal(kayitAdi, currentOptions);
    },
    [currentOptions, performKaydetInternal]
  );

  const KaydetModalComponent = useCallback(() => {
    if (!currentOptions) return null;

    return (
      <KaydetModal
        open={isModalOpen}
        onClose={kaydetKapat}
        onSave={performKaydet}
        hesapTuru={currentOptions.hesapTuru}
        defaultName={currentOptions.varsayilanIsim || undefined}
        isLoading={isSaving}
      />
    );
  }, [isModalOpen, isSaving, currentOptions, kaydetKapat, performKaydet]);

  return {
    kaydetAc,
    kaydetKapat,
    isModalOpen,
    isSaving,
    KaydetModal: KaydetModalComponent,
  };
}
