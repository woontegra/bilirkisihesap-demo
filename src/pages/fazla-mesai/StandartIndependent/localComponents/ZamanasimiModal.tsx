/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import React, { useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { differenceInCalendarDays, subYears, subDays, format } from "date-fns";

const toUTC = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const toISODateUTC = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

interface ZamanasimiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (payload: {
    davaTarihi: string;
    arabuluculukBaslangic: string;
    arabuluculukBitis: string;
    arabuluculukGun: number;
    nihaiBaslangic: string;
  }) => void;
  zForm: { dava: string; bas: string; bit: string };
  setZForm: React.Dispatch<React.SetStateAction<{ dava: string; bas: string; bit: string }>>;
  showToastError?: (msg: string) => void;
  iseGiris?: string; // İşe giriş tarihi - pandemi kontrolü için
}

const ModalContent = React.memo(function ModalContent({
  zForm,
  setZForm,
  onClose,
  onApply,
  showToastError,
  iseGiris,
}: Omit<ZamanasimiModalProps, "isOpen">) {
  const calculations = useMemo(() => {
    const dava = zForm.dava ? toUTC(zForm.dava) : null;
    const bas = zForm.bas ? toUTC(zForm.bas) : null;
    const bit = zForm.bit ? toUTC(zForm.bit) : null;
    const gun = bas && bit ? Math.max(0, differenceInCalendarDays(bit, bas) + 1) : null;
    const limit = dava ? subYears(dava, 5) : null;
    
    const pandemiBaslangic = new Date('2020-03-13');
    const pandemiBitis = new Date('2020-06-15');
    
    // ✅ DOĞRU KURAL: Pandemi ek süresi SADECE işe giriş tarihine bağlı
    const iseGirisDate = iseGiris ? toUTC(iseGiris) : null;
    let pandemiGun = 0;
    
    if (iseGirisDate) {
      // KURAL A: İşe giriş < 13.03.2020 → TAM 94 GÜN
      if (iseGirisDate < pandemiBaslangic) {
        pandemiGun = 94;
      }
      // KURAL B: İşe giriş 13.03.2020 - 15.06.2020 arası (DAHİL) → KISMİ
      else if (iseGirisDate >= pandemiBaslangic && iseGirisDate <= pandemiBitis) {
        pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBitis, iseGirisDate) + 1);
      }
      // KURAL C: İşe giriş > 15.06.2020 → 0 GÜN (zaten pandemiGun = 0)
    }
    
    const pandemiEklendi = pandemiGun > 0;
    
    let nihai = limit ? (gun != null ? subDays(limit, gun) : limit) : limit;
    
    if (pandemiEklendi && nihai) {
      nihai = subDays(nihai, pandemiGun);
    }
    
    return { dava, bas, bit, gun, limit, nihai, pandemiEklendi, pandemiGun };
  }, [zForm.dava, zForm.bas, zForm.bit, iseGiris]);

  const handleApply = useCallback(() => {
    try {
      const basUTC = zForm.bas ? toUTC(zForm.bas) : null;
      const bitUTC = zForm.bit ? toUTC(zForm.bit) : null;
      const arabuluculukGun =
        basUTC && bitUTC
          ? Math.max(0, differenceInCalendarDays(bitUTC, basUTC) + 1)
          : 0;
      const davaUTC = zForm.dava ? toUTC(zForm.dava) : null;
      const limitTarihi = davaUTC ? subYears(davaUTC, 5) : null;
      let nihai = limitTarihi ? subDays(limitTarihi, arabuluculukGun) : null;
      
      // ✅ DOĞRU KURAL: Pandemi ek süresi SADECE işe giriş tarihine bağlı
      const pandemiBaslangic = new Date('2020-03-13');
      const pandemiBitis = new Date('2020-06-15');
      const iseGirisDate = iseGiris ? toUTC(iseGiris) : null;
      let pandemiGun = 0;
      
      if (iseGirisDate) {
        // KURAL A: İşe giriş < 13.03.2020 → TAM 94 GÜN
        if (iseGirisDate < pandemiBaslangic) {
          pandemiGun = 94;
        }
        // KURAL B: İşe giriş 13.03.2020 - 15.06.2020 arası (DAHİL) → KISMİ
        else if (iseGirisDate >= pandemiBaslangic && iseGirisDate <= pandemiBitis) {
          pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBitis, iseGirisDate) + 1);
        }
        // KURAL C: İşe giriş > 15.06.2020 → 0 GÜN
      }
      
      if (pandemiGun > 0 && nihai) {
        nihai = subDays(nihai, pandemiGun);
      }
      
      const payload = {
        davaTarihi: zForm.dava || "",
        arabuluculukBaslangic: zForm.bas || "",
        arabuluculukBitis: zForm.bit || "",
        arabuluculukGun,
        nihaiBaslangic: nihai ? toISODateUTC(nihai) : "",
      };
      onApply(payload);
      onClose();
    } catch {
      onClose();
    }
  }, [zForm, iseGiris, onApply, onClose]);

  const handleDavaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZForm((p) => ({ ...p, dava: e.target.value }));
  }, [setZForm]);

  const handleBasChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZForm((p) => ({ ...p, bas: e.target.value }));
  }, [setZForm]);

  const handleBitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZForm((p) => ({ ...p, bit: e.target.value }));
  }, [setZForm]);

  const handleBasBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (
      newValue &&
      /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
      zForm.bit &&
      /^\d{4}-\d{2}-\d{2}$/.test(zForm.bit)
    ) {
      const newDate = new Date(newValue);
      const endDate = new Date(zForm.bit);
      if (
        !isNaN(newDate.getTime()) &&
        !isNaN(endDate.getTime()) &&
        newDate > endDate
      ) {
        showToastError?.("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
        setZForm((p) => ({ ...p, bas: zForm.bit }));
      }
    }
  }, [zForm.bit, setZForm, showToastError]);

  const handleBitBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (
      newValue &&
      /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
      zForm.bas &&
      /^\d{4}-\d{2}-\d{2}$/.test(zForm.bas)
    ) {
      const newDate = new Date(newValue);
      const startDate = new Date(zForm.bas);
      if (
        !isNaN(newDate.getTime()) &&
        !isNaN(startDate.getTime()) &&
        newDate < startDate
      ) {
        showToastError?.("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
        setZForm((p) => ({ ...p, bit: zForm.bas }));
      }
    }
  }, [zForm.bas, setZForm, showToastError]);

  const { dava, limit, gun, nihai, pandemiEklendi, pandemiGun } = calculations;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        margin: 0,
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        border: "1px solid #e5e7eb",
        width: "100%",
        maxWidth: "28rem",
        padding: "1rem",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "#111827",
          marginBottom: "0.5rem",
        }}
      >
        Zamanaşımı Hesaplama
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div>
          <div
            style={{
              fontSize: "13px",
              color: "#374151",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Dava Tarihi
          </div>
          <input
            type="date"
            value={zForm.dava}
            onChange={handleDavaChange}
            style={{
              width: "100%",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              padding: "0.5rem 0.75rem",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <div
              style={{
                fontSize: "13px",
                color: "#374151",
                fontWeight: 500,
                marginBottom: "0.25rem",
              }}
            >
              Arabuluculuk Başlangıç
            </div>
            <input
              type="date"
              value={zForm.bas}
              onChange={handleBasChange}
              onBlur={handleBasBlur}
              style={{
                width: "100%",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                padding: "0.5rem 0.75rem",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: "13px",
                color: "#374151",
                fontWeight: 500,
                marginBottom: "0.25rem",
              }}
            >
              Arabuluculuk Bitiş
            </div>
            <input
              type="date"
              value={zForm.bit}
              onChange={handleBitChange}
              onBlur={handleBitBlur}
              style={{
                width: "100%",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                padding: "0.5rem 0.75rem",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#374151",
            minHeight: "100px",
          }}
        >
          <div>
            Dava tarihi: <b>{dava ? format(dava, "dd.MM.yyyy") : "-"}</b>
          </div>
          <div>
            Zamanaşımı süresi (5 yıl): <b>{limit ? format(limit, "dd.MM.yyyy") : "-"}</b>
          </div>
          <div>
            Arabuluculuk süresi: <b>{gun != null ? `${gun} gün` : "-"}</b>
          </div>
          {pandemiEklendi && (
            <div style={{ color: "#f59e0b", fontSize: "13px", marginTop: "0.5rem", padding: "0.5rem", background: "#fef3c7", borderRadius: "4px", border: "1px solid #fbbf24" }}>
              <b>Pandemi Dönemi:</b> 13 Mart 2020 - 15 Haziran 2020 arası pandemi hak kaybı süresi nedeniyle +{pandemiGun} gün eklendi.
            </div>
          )}
          <div style={{ color: "#1d4ed8", fontWeight: 500, marginTop: "0.5rem" }}>
            Nihai zamanaşımı başlangıç tarihi:{" "}
            <b>{nihai ? format(nihai, "dd.MM.yyyy") : "-"}</b>
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          İptal
        </button>
        <button
          type="button"
          onClick={handleApply}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "14px",
            border: "1px solid #2563eb",
            borderRadius: "6px",
            background: "#2563eb",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Uygula
        </button>
      </div>
    </div>
  );
});

function ZamanasimiModal({
  isOpen,
  onClose,
  onApply,
  zForm,
  setZForm,
  showToastError,
  iseGiris,
}: ZamanasimiModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.45)",
          zIndex: 9999,
        }}
      />
      <ModalContent
        zForm={zForm}
        setZForm={setZForm}
        onClose={onClose}
        onApply={onApply}
        showToastError={showToastError}
        iseGiris={iseGiris}
      />
    </>
  );

  return createPortal(modalContent, document.body);
}

export default React.memo(ZamanasimiModal);
