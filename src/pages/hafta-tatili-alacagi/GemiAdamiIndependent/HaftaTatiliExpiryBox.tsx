import React, { useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { differenceInCalendarDays, subYears, subDays, format } from "date-fns";
import { useToast } from "@/context/ToastContext";

// Hafta Tatili için Zamanaşımı utility fonksiyonları
function toUTC(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function toISODateUTC(date: Date | null): string {
  if (!date) return "";
  try {
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

interface HaftaTatiliExpiryBoxProps {
  haftaTatiliExpiryStart: string | null;
  onHaftaTatiliExpiryStartChange: (date: string | null) => void;
  onHaftaTatiliExpiryCancel?: () => void;
  /** İşe giriş tarihi - pandemi kontrolü için (işe giriş bazlı 3 kural) */
  iseGiris?: string;
}

// Modal içeriği için ayrı memoized component
const ZamanasimiModalContent = React.memo(function ZamanasimiModalContent({
  haftaTatiliZForm,
  setHaftaTatiliZForm,
  onApply,
  onCancel,
  showToastError,
  iseGiris,
}: {
  haftaTatiliZForm: { dava: string; bas: string; bit: string };
  setHaftaTatiliZForm: React.Dispatch<React.SetStateAction<{ dava: string; bas: string; bit: string }>>;
  onApply: () => void;
  onCancel: () => void;
  showToastError: (msg: string) => void;
  iseGiris?: string;
}) {
  // Hesaplamaları useMemo ile optimize et - pandemi işe giriş bazlı 3 kural
  const hesaplama = useMemo(() => {
    const dava = haftaTatiliZForm.dava ? toUTC(haftaTatiliZForm.dava) : null;
    const bas = haftaTatiliZForm.bas ? toUTC(haftaTatiliZForm.bas) : null;
    const bit = haftaTatiliZForm.bit ? toUTC(haftaTatiliZForm.bit) : null;
    const gun = bas && bit ? Math.max(0, differenceInCalendarDays(bit, bas) + 1) : null;
    const limit = dava ? subYears(dava, 5) : null;
    
    // Pandemi: işe giriş bazlı 3 kural (13.03.2020–15.06.2020)
    const pandemiBaslangic = new Date('2020-03-13');
    const pandemiBitis = new Date('2020-06-15');
    const iseGirisDate = iseGiris ? toUTC(iseGiris) : null;
    let pandemiGun = 0;
    if (iseGirisDate) {
      if (iseGirisDate < pandemiBaslangic) pandemiGun = 94;
      else if (iseGirisDate >= pandemiBaslangic && iseGirisDate <= pandemiBitis) {
        pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBitis, iseGirisDate) + 1);
      }
    }
    const pandemiEklendi = pandemiGun > 0;
    
    let nihai = limit ? (gun != null ? subDays(limit, gun) : limit) : null;
    if (pandemiEklendi && nihai) nihai = subDays(nihai, pandemiGun);
    
    return { dava, bas, bit, gun, limit, nihai, pandemiEklendi, pandemiGun };
  }, [haftaTatiliZForm.dava, haftaTatiliZForm.bas, haftaTatiliZForm.bit, iseGiris]);

  const handleDavaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHaftaTatiliZForm((p) => ({ ...p, dava: e.target.value }));
  }, [setHaftaTatiliZForm]);

  const handleBasChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHaftaTatiliZForm((p) => ({ ...p, bas: e.target.value }));
  }, [setHaftaTatiliZForm]);

  const handleBitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHaftaTatiliZForm((p) => ({ ...p, bit: e.target.value }));
  }, [setHaftaTatiliZForm]);

  const handleBasBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && haftaTatiliZForm.bit && /^\d{4}-\d{2}-\d{2}$/.test(haftaTatiliZForm.bit)) {
      const newDate = new Date(newValue);
      const endDate = new Date(haftaTatiliZForm.bit);
      if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
        showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
      }
    }
  }, [haftaTatiliZForm.bit, showToastError]);

  const handleBitBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && haftaTatiliZForm.bas && /^\d{4}-\d{2}-\d{2}$/.test(haftaTatiliZForm.bas)) {
      const newDate = new Date(newValue);
      const startDate = new Date(haftaTatiliZForm.bas);
      if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
        showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
      }
    }
  }, [haftaTatiliZForm.bas, showToastError]);

  // Portal ile body'ye render et
  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
        onClick={onCancel}
      />
      <div 
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          width: '100%',
          maxWidth: '28rem',
          padding: '1rem',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
          Zamanaşımı Hesaplama
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <Label style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
              Dava Tarihi
            </Label>
            <Input
              type="date"
              value={haftaTatiliZForm.dava}
              onChange={handleDavaChange}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <Label style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                Arabuluculuk Başlangıç
              </Label>
              <Input
                type="date"
                value={haftaTatiliZForm.bas}
                onChange={handleBasChange}
                onBlur={handleBasBlur}
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '14px' }}
              />
            </div>
            <div>
              <Label style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                Arabuluculuk Bitiş
              </Label>
              <Input
                type="date"
                value={haftaTatiliZForm.bit}
                onChange={handleBitChange}
                onBlur={handleBitBlur}
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '14px' }}
              />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '14px', lineHeight: '1.5', color: '#374151' }}>
            <div>
              Dava tarihi: <b>{hesaplama.dava ? format(hesaplama.dava, "dd.MM.yyyy") : "-"}</b>
            </div>
            <div>
              Zamanaşımı süresi {hesaplama.pandemiEklendi ? `(5 yıl + ${hesaplama.pandemiGun ?? 94} gün)` : "(5 yıl)"}: <b>{hesaplama.limit ? format(hesaplama.limit, "dd.MM.yyyy") : "-"}</b>
            </div>
            <div>
              Arabuluculuk süresi: <b>{hesaplama.gun != null ? `${hesaplama.gun} gün` : "-"}</b>
            </div>
            {hesaplama.pandemiEklendi && (
              <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '0.5rem', padding: '0.5rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fbbf24' }}>
                <b>Pandemi Dönemi:</b> 13 Mart 2020 - 15 Haziran 2020 arası pandemi hak kaybı süresi nedeniyle +{(hesaplama.pandemiGun ?? 94)} gün eklendi (işe giriş bazlı).
              </div>
            )}
            <div style={{ color: '#1d4ed8', fontWeight: 500, marginTop: '0.5rem' }}>
              Nihai zamanaşımı başlangıç tarihi: <b>{hesaplama.nihai ? format(hesaplama.nihai, "dd.MM.yyyy") : "-"}</b>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button
            variant="outline"
            style={{ padding: '0.375rem 0.75rem', fontSize: '14px', borderRadius: '6px' }}
            onClick={onCancel}
          >
            İptal
          </Button>
          <Button
            variant="default"
            style={{ padding: '0.375rem 0.75rem', fontSize: '14px', border: '1px solid #2563eb', color: 'white', backgroundColor: '#2563eb', borderRadius: '6px' }}
            onClick={onApply}
          >
            Uygula
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
});

function HaftaTatiliExpiryBox({
  haftaTatiliExpiryStart,
  onHaftaTatiliExpiryStartChange,
  onHaftaTatiliExpiryCancel,
  iseGiris,
}: HaftaTatiliExpiryBoxProps) {
  const { error: showToastError } = useToast();
  const [showHaftaTatiliZamanaModal, setShowHaftaTatiliZamanaModal] = useState(false);
  const [haftaTatiliZForm, setHaftaTatiliZForm] = useState<{ dava: string; bas: string; bit: string }>({
    dava: "",
    bas: "",
    bit: "",
  });
  const prevHaftaTatiliZamanaRef = useRef<string | null>(null);

  const handleHaftaTatiliZamanaApply = useCallback(() => {
    try {
      const basUTC = haftaTatiliZForm.bas ? toUTC(haftaTatiliZForm.bas) : null;
      const bitUTC = haftaTatiliZForm.bit ? toUTC(haftaTatiliZForm.bit) : null;
      const arabuluculukGun = basUTC && bitUTC ? Math.max(0, differenceInCalendarDays(bitUTC, basUTC) + 1) : 0;
      const davaUTC = haftaTatiliZForm.dava ? toUTC(haftaTatiliZForm.dava) : null;
      const limitTarihi = davaUTC ? subYears(davaUTC, 5) : null;
      let nihai = limitTarihi ? subDays(limitTarihi, arabuluculukGun) : null;
      
      // Pandemi: işe giriş bazlı 3 kural
      const pandemiBaslangic = new Date('2020-03-13');
      const pandemiBitis = new Date('2020-06-15');
      const iseGirisDate = iseGiris ? toUTC(iseGiris) : null;
      let pandemiGun = 0;
      if (iseGirisDate) {
        if (iseGirisDate < pandemiBaslangic) pandemiGun = 94;
        else if (iseGirisDate >= pandemiBaslangic && iseGirisDate <= pandemiBitis) {
          pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBitis, iseGirisDate) + 1);
        }
      }
      if (pandemiGun > 0 && nihai) nihai = subDays(nihai, pandemiGun);
      
      if (nihai) {
        prevHaftaTatiliZamanaRef.current = null;
        onHaftaTatiliExpiryStartChange(toISODateUTC(nihai));
      }
      setShowHaftaTatiliZamanaModal(false);
    } catch {
      setShowHaftaTatiliZamanaModal(false);
    }
  }, [haftaTatiliZForm, iseGiris, onHaftaTatiliExpiryStartChange]);

  const handleHaftaTatiliZamanaCancel = useCallback(() => {
    setShowHaftaTatiliZamanaModal(false);
    if (prevHaftaTatiliZamanaRef.current) {
      onHaftaTatiliExpiryStartChange(prevHaftaTatiliZamanaRef.current);
    }
    prevHaftaTatiliZamanaRef.current = null;
  }, [onHaftaTatiliExpiryStartChange]);

  const handleOpenModal = useCallback(() => {
    prevHaftaTatiliZamanaRef.current = haftaTatiliExpiryStart ?? null;
    if (haftaTatiliExpiryStart) onHaftaTatiliExpiryStartChange(null);
    setShowHaftaTatiliZamanaModal(true);
  }, [haftaTatiliExpiryStart, onHaftaTatiliExpiryStartChange]);

  const handleRemoveExpiry = useCallback(() => {
    onHaftaTatiliExpiryStartChange(null);
    prevHaftaTatiliZamanaRef.current = null;
    onHaftaTatiliExpiryCancel?.();
  }, [onHaftaTatiliExpiryStartChange, onHaftaTatiliExpiryCancel]);

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full text-blue-700 bg-white border border-blue-300 shadow-sm hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:bg-gray-800 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-gray-700"
        >
          Zamanaşımı İtirazı
        </Button>
        {haftaTatiliExpiryStart && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRemoveExpiry}
            className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full text-gray-700 bg-white border border-gray-300 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Zamanaşımı itirazını kaldır"
          >
            Zamanaşımı İtirazını Kaldır
          </Button>
        )}
      </div>

      {showHaftaTatiliZamanaModal && (
        <ZamanasimiModalContent
          haftaTatiliZForm={haftaTatiliZForm}
          setHaftaTatiliZForm={setHaftaTatiliZForm}
          onApply={handleHaftaTatiliZamanaApply}
          onCancel={handleHaftaTatiliZamanaCancel}
          showToastError={showToastError}
          iseGiris={iseGiris}
        />
      )}
    </>
  );
}

export default React.memo(HaftaTatiliExpiryBox);
