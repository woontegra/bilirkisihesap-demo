/**
 * Local wrapper for Kaydet context
 */

import { useKaydet } from "./useKaydet";

export function useKaydetContext() {
  const { kaydetAc, kaydetKapat, isModalOpen, isSaving } = useKaydet();
  
  return {
    kaydetAc,
    kaydetKapat,
    isModalOpen,
    isSaving,
  };
}

// Export useKaydet for KaydetModal access
export { useKaydet };
