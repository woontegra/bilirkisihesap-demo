import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL } from "@/utils/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Youtube, Save, Download, Trash2, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "@/utils/extraCalculationsStorage";
import EklentiModal from "@/pages/kidem-tazminati/KidemKismiSureliIndependent/localComponents/EklentiModal";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
// Constants (inline)
const PAGE_TITLE = "Bakiye Ücret Alacağı";
const BUTTON_LABELS = { CALCULATE: "Bakiye Hesapla", SAVE: "Kaydet", PRINT: "Yazdır", RESET: "Sıfırla" };
const FORM_LABELS = {
  START_DATE: "Çalışma dönemi başlangıcı",
  END_DATE: "Çalışma dönemi sonu",
  RESIGN_DATE: "İş Akdinin Fesih Edildiği Tarih",
  BRUT: "Çıplak Brüt Ücret",
  EXTRA_ITEMS: "Ekstra Hesaplamalar (Prim, İkramiye, Yol, Yemek vb.)",
  REMAINING_TIME: "Kalan Süre",
  GROSS_TO_NET: "Brütten Nete Çevir",
  NET_TO_GROSS: "Netten Brüte Çevir",
  GROSS_SALARY: "Brüt Ücret",
  NET_SALARY: "Net Ücret",
};
const NOTE_TEXT = "Belirli süreli iş sözleşmelerinde iş akdi süresinden önce sonlandırılır ise sözleşme sonuna kadar kararlaştırılan ücret bakiye ücret olarak talep edilebilir.";

const btnEklenti = "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500";

// Helper functions & types (inline)
const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const round2 = (v: number) => Math.round((v || 0) * 100) / 100;
const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const calculateRemainingDays = (resignDate: string, endDate: string): number => {
  try {
    if (!resignDate || !endDate) return 0;
    const r = new Date(resignDate);
    const e = new Date(endDate);
    if (Number.isNaN(+r) || Number.isNaN(+e)) return 0;
    if (r >= e) return 0;
    // Tarihleri normalize et
    const date1 = new Date(r.getFullYear(), r.getMonth(), r.getDate());
    const date2 = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const diffTime = date2.getTime() - date1.getTime();
    return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
  } catch {
    return 0;
  }
};

const calculateRemainingLabel = (resignDate: string, endDate: string): string => {
  try {
    if (!resignDate || !endDate) return "";
    // calcWorkPeriodBilirKisi ile gerçek takvim hesaplaması yap
    const result = calcWorkPeriodBilirKisi(resignDate, endDate);
    return result.label || "";
  } catch {
    return "";
  }
};

type Row = { start: string; end: string; days: number; amount: number };
type MonthRow = { start: string; end: string; days: number; gross: number; net: number };
type ExtraItem = { id: string; name: string; value: string };

const validateBakiyeUcretForm = (form: any) => {
  const errors: string[] = [];
  if (!form.startDate) errors.push("Başlangıç tarihi gerekli");
  if (!form.endDate) errors.push("Bitiş tarihi gerekli");
  if (!form.resignDate) errors.push("Fesih tarihi gerekli");
  if (!form.brut || parseNum(form.brut) <= 0) errors.push("Geçerli bir brüt ücret girin");
  return { isValid: errors.length === 0, errors };
};
import "@/styles/soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

export default function BakiyeUcretIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("bakiye-ucret");
  
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [resignDate, setResignDate] = useState<string>("");
  const [brut, setBrut] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef<boolean>(false);
  
  // Ekstra kalemler
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([
    { id: Math.random().toString(36).slice(2), name: "Prim", value: "" },
    { id: Math.random().toString(36).slice(2), name: "İkramiye", value: "" },
    { id: Math.random().toString(36).slice(2), name: "Yol", value: "" },
    { id: Math.random().toString(36).slice(2), name: "Yemek", value: "" },
  ]);

  // Ekstra hesaplamalar seti kaydet / içe aktar
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<SavedExtraCalculationsSet[]>([]);

  // Eklenti hesapla modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");

  // Brüt tutar düzenleme - geçici input değerleri
  const [editingGross, setEditingGross] = useState<Record<number, string>>({});
  useEffect(() => {
    if (monthRows.length === 0) setEditingGross({});
  }, [monthRows.length]);

  // Dönüştürücüler
  const [grossForNet, setGrossForNet] = useState<string>("");
  const [netForGross, setNetForGross] = useState<string>("");

  // Asgari ücret kontrolü
  const asgariUcretHatasi = useMemo(() => {
    if (!resignDate || !brut) return null;
    
    const minUcret = getAsgariUcretByDate(resignDate);
    if (!minUcret) return null;
    
    const brutValue = parseNum(brut);
    if (!brutValue || brutValue === 0) return null;
    
    if (brutValue < minUcret) {
      const year = new Date(resignDate).getFullYear();
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${fmtCurrency(minUcret)}₺).`;
    }
    
    return null;
  }, [resignDate, brut]);

  // Hesaplanan değerler
  const monthlyBase = useMemo(() => parseNum(brut), [brut]);
  const extrasTotal = useMemo(
    () => extraItems.reduce((acc, it) => acc + parseNum(it.value), 0),
    [extraItems]
  );
  const monthly = useMemo(
    () => monthlyBase + extrasTotal,
    [monthlyBase, extrasTotal]
  );
  const daily = useMemo(
    () => (monthly > 0 ? monthly / 30 : 0),
    [monthly]
  );
  const total = useMemo(
    () => round2(rows.reduce((acc, r) => acc + r.amount, 0)),
    [rows]
  );

  // Kalan günler
  const remainingDays = useMemo(
    () => calculateRemainingDays(resignDate, endDate),
    [resignDate, endDate]
  );
  const remainingLabel = useMemo(
    () => calculateRemainingLabel(resignDate, endDate),
    [resignDate, endDate]
  );

  // Çalışma süresi hesaplama
  const workPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const result = calcWorkPeriodBilirKisi(startDate, endDate);
    if (!result.label) return null;
    return result;
  }, [startDate, endDate]);

  // Brütten Nete Çevir
  const grossVal = useMemo(
    () => parseNum(grossForNet),
    [grossForNet]
  );
  
  // İşten çıkış tarihinden yıl bilgisini çıkar, yoksa mevcut yılı kullan
  const selectedYear = useMemo(() => {
    const dateStr = resignDate || endDate || "";
    if (dateStr) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.getFullYear();
        }
      } catch {
        // Hata durumunda mevcut yılı kullan
      }
    }
    return new Date().getFullYear();
  }, [resignDate, endDate]);
  
  // Brütten Nete - Backend (gelir vergisi istisnası dahil, Ücret Alacağı ile aynı)
  const [netFromGross, setNetFromGross] = useState({
    gross: 0, sgk: 0, issizlik: 0,
    gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "",
    damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0,
    net: 0
  });
  
  useEffect(() => {
    if (grossVal > 0) {
      const tenantId = localStorage.getItem("tenant_id") || "1";
      const totalFromMonthRows = monthRows.length > 0 ? round2(monthRows.reduce((a, b) => a + b.gross, 0)) : 0;
      const useSegmented = monthRows.length > 0 && Math.abs(grossVal - totalFromMonthRows) < 1;
      const url = useSegmented
        ? `${API_BASE_URL}/api/bakiye-ucret/net-from-gross-segmented`
        : `${API_BASE_URL}/api/bakiye-ucret/net-from-gross`;
      const body = useSegmented
        ? { monthRows: monthRows.map(m => ({ start: m.start, end: m.end, days: m.days, gross: m.gross })), year: selectedYear }
        : { gross: grossVal, year: selectedYear };
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
        body: JSON.stringify(body)
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setNetFromGross(result.data);
          }
        })
        .catch(err => console.error("Net hesaplama hatası:", err));
    } else {
      setNetFromGross({
        gross: 0, sgk: 0, issizlik: 0,
        gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "",
        damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0,
        net: 0
      });
    }
  }, [grossVal, selectedYear, monthRows]);

  // Netten Brüte - Backend
  const netVal = useMemo(() => parseNum(netForGross), [netForGross]);
  const [grossFromNet, setGrossFromNet] = useState({
    net: 0, gross: 0, sgk: 0, issizlik: 0,
    gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "",
    damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0
  });
  
  // Netten brüte: Sol panelin neti girildiğinde ve monthRows varsa (çok aylı) sol panel sonucunu kullan (tek aylık API yerine)
  useEffect(() => {
    if (netVal <= 0) {
      setGrossFromNet({
        net: 0, gross: 0, sgk: 0, issizlik: 0,
        gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "",
        damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0
      });
      return;
    }
    const netMatchesLeft = monthRows.length > 0 && netFromGross.net > 0 && Math.abs(netVal - netFromGross.net) < 1;
    if (netMatchesLeft) {
      setGrossFromNet({ ...netFromGross });
      return;
    }
    const tenantId = localStorage.getItem("tenant_id") || "1";
    fetch(`${API_BASE_URL}/api/bakiye-ucret/gross-from-net`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
      body: JSON.stringify({ netInput: netVal, year: selectedYear })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) setGrossFromNet(result.data);
      })
      .catch(err => console.error("Brüt hesaplama hatası:", err));
  }, [netVal, selectedYear, monthRows.length, netFromGross]);

  // API servis fonksiyonları
  const loadCalculation = async (loadId: string) => {
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      // API_BASE_URL already imported from @/utils/apiClient
      
      const response = await fetch(`${API_BASE_URL}/api/saved-cases/${loadId}`, {
        headers: {
          "x-tenant-id": String(tenantId)
        }
      });
      
      // Response'un JSON olup olmadığını kontrol et
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Kayıt bulunamadı (ID: ${loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`);
        }
        throw new Error(data.message || data.error || `Yükleme işlemi başarısız oldu (${response.status})`);
      }
      
      // Backend'den gelen format: { name, type, data: { form: {...}, results: {...} } }
      // data field'ı JSON string olabilir veya object olabilir
      let payload = {};
      
      if (data.data) {
        // data field'ı string ise parse et
        if (typeof data.data === 'string') {
          try {
            payload = JSON.parse(data.data);
          } catch {
            payload = {};
          }
        } else {
          payload = data.data;
        }
      }
      
      return {
        data: payload, // Orijinal payload'ı da döndür
        formValues: payload.form || payload.formValues || payload,
        name: data.name || data.notes || data.aciklama || "",
        start_date: data.start_date || payload.start_date || payload.startDate,
        end_date: data.end_date || payload.end_date || payload.endDate,
        resign_date: data.resign_date || payload.resign_date || payload.resignDate,
        notes: data.notes || data.aciklama || "",
        brut_total: data.brut_total || payload.brut_total || payload.total,
        net_total: data.net_total || payload.net_total || payload.total,
      };
    } catch (err: any) {
      console.error('Kayıt yükleme hatası:', err);
      throw err;
    }
  };

  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    if (!id) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        if (loadRanRef.current) return;
        loadRanRef.current = true;
        
        const data = await loadCalculation(id);
        
        if (!isMounted) return;
        
        // Form alanlarını doldur
        const formData = data.formValues || data.data || {};
        
        // Yeni format: data.form içinde form verileri
        const form = formData.form || formData.data?.form || formData;
        const results = formData.results || formData.data?.results || {};
        
        // Tarihleri set et - önce yeni format, sonra eski format
        const startDateValue = form.startDate || form.start_date || data.start_date;
        const endDateValue = form.endDate || form.end_date || data.end_date;
        const resignDateValue = form.resignDate || form.resign_date || data.resign_date;
        
        if (startDateValue) setStartDate(startDateValue);
        if (endDateValue) setEndDate(endDateValue);
        if (resignDateValue) setResignDate(resignDateValue);
        
        // Brüt değerini al - hem yeni hem eski formatı destekle
        const brutValue = form.brut || formData.brut || formData.data?.brut || data.brut_total;
        if (brutValue !== undefined) {
          setBrut(String(brutValue));
        }
        
        // Ekstra kalemleri yükle
        if (form.extraItems && Array.isArray(form.extraItems)) {
          setExtraItems(form.extraItems);
        } else if (formData.extraItems && Array.isArray(formData.extraItems)) {
          setExtraItems(formData.extraItems);
        }
        
        // Eğer results içinde rows varsa, onu kullan (hesaplama yapılmış)
        if (results.rows && Array.isArray(results.rows) && results.rows.length > 0) {
          setRows(results.rows);
        }
        if (results.monthRows && Array.isArray(results.monthRows) && results.monthRows.length > 0) {
          setMonthRows(results.monthRows);
          const tot = results.monthRows.reduce((a: number, m: { gross?: number }) => a + (m.gross || 0), 0);
          if (tot > 0) setGrossForNet(tot.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } else if (startDateValue && endDateValue && resignDateValue && brutValue) {
          // Eğer rows yoksa, backend'den hesaplat
          const monthlyValue = parseNum(String(brutValue)) + (form.extraItems ? form.extraItems.reduce((acc: number, it: any) => acc + parseNum(it.value || "0"), 0) : 0);
          if (monthlyValue > 0) {
            const tenantId = localStorage.getItem("tenant_id") || "1";
            const response = await fetch(`${API_BASE_URL}/api/bakiye-ucret/calculate`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "X-Tenant-Id": tenantId
              },
              body: JSON.stringify({
                startDate: startDateValue,
                endDate: endDateValue,
                resignDate: resignDateValue,
                monthly: monthlyValue
              })
            });
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                setRows(result.data.rows || []);
                setMonthRows(result.data.monthRows || []);
                const tot = result.data.totalAmount ?? (result.data.monthRows || []).reduce((a: number, m: { gross?: number }) => a + (m.gross || 0), 0);
                if (tot > 0) setGrossForNet(tot.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
              }
            }
          }
        }
        
        // Mevcut kaydın ismini al (güncelleme için)
        setCurrentRecordName(data.name || data.notes || null);
        
        success(`Kayıt yüklendi (#${id})`);
      } catch (err) {
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError("Kayıt yüklenemedi");
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (showImportModal) {
      getAllExtraCalculationsSets().then(setSavedSets);
    }
  }, [showImportModal]);

  const handleSaveExtra = async () => {
    if (!saveName.trim()) {
      showToastError("Lütfen bir isim girin");
      return;
    }
    const items = extraItems.map((it) => ({ id: it.id, name: it.name, value: it.value }));
    if (items.length === 0) {
      showToastError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }
    const ok = await saveExtraCalculationsSet(saveName.trim(), items);
    if (ok) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
    } else {
      showToastError("Kaydetme başarısız");
    }
  };

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setExtraItems(data.map((it) => ({ id: it.id, name: it.name, value: it.value })));
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else {
      showToastError("Yüklenecek veri bulunamadı");
    }
  };

  const handleDeleteExtra = async (setId: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;
    const ok = await deleteExtraCalculationsSet(setId);
    if (ok) {
      success("Set silindi");
      getAllExtraCalculationsSets().then(setSavedSets);
    } else {
      showToastError("Silme başarısız");
    }
  };

  const handleRequestEklenti = useCallback((title: string, fieldKey: string) => {
    setModalTitle(title);
    setModalOpen(true);
    (window as any).__eklentiFieldKey = fieldKey;
  }, []);

  const handleApplyEklenti = useCallback((eklenti: number) => {
    const fieldKey = (window as any).__eklentiFieldKey || "";
    const formatted = String(eklenti.toFixed(2)).replace(".", ",");
    if (fieldKey.startsWith("extra:")) {
      const extraId = fieldKey.replace("extra:", "");
      setExtraItems((prev) =>
        prev.map((p) => (p.id === extraId ? { ...p, value: formatted } : p))
      );
    }
    setModalOpen(false);
    success("Eklenti uygulandı");
  }, [success]);

  const handleMonthRowGrossBlur = useCallback(async (index: number) => {
    const raw = editingGross[index];
    if (raw === undefined) return;
    setEditingGross((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    const parsed = parseNum(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const mr = monthRows[index];
    if (!mr) return;
    try {
      const tenantId = localStorage.getItem("tenant_id") || "1";
      const res = await fetch(`${API_BASE_URL}/api/bakiye-ucret/net-from-gross-segmented`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
        body: JSON.stringify({
          monthRows: [{ start: mr.start, end: mr.end, days: mr.days, gross: parsed }],
          year: selectedYear
        })
      });
      const result = await res.json();
      if (result.success && result.data) {
        setMonthRows((prev) =>
          prev.map((m, i) => (i === index ? { ...m, gross: round2(parsed), net: result.data.net } : m))
        );
        const newTotal = monthRows.reduce((a, b, i) => a + (i === index ? parsed : b.gross), 0);
        setGrossForNet(round2(newTotal).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
    } catch {
      // Hata durumunda sadece gross güncelle, net eski kalsın
      setMonthRows((prev) =>
        prev.map((m, i) => (i === index ? { ...m, gross: round2(parsed) } : m))
      );
    }
  }, [editingGross, monthRows, selectedYear]);

  const handleCalculate = async () => {
    try {
      const validation = validateBakiyeUcretForm({
        startDate,
        endDate,
        resignDate,
        brut,
        extraItems,
      });

      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showToastError(firstError);
        setRows([]);
        setMonthRows([]);
        return;
      }

      if (!monthly || monthly <= 0) {
        showToastError("Toplam aylık ücret 0'dan büyük olmalıdır");
        setRows([]);
        setMonthRows([]);
        return;
      }

      console.log("[Bakiye Ücret] Backend'e gönderiliyor...");
      const tenantId = localStorage.getItem("tenant_id") || "1";
      const response = await fetch(`${API_BASE_URL}/api/bakiye-ucret/calculate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Tenant-Id": tenantId
        },
        body: JSON.stringify({
          startDate,
          endDate,
          resignDate,
          monthly
        })
      });

      const result = await response.json();
      console.log("[Bakiye Ücret] Backend'den gelen sonuç:", result);

      if (!response.ok) {
        showToastError(result.error || `HTTP error! status: ${response.status}`);
        setRows([]);
        setMonthRows([]);
        return;
      }

      if (result.success && result.data) {
        setRows(result.data.rows || []);
        setMonthRows(result.data.monthRows || []);
        setEditingGross({});
        const tot = result.data.totalAmount ?? (result.data.rows || []).reduce((a: number, r: { amount?: number }) => a + (r.amount || 0), 0);
        if (tot > 0) {
          setGrossForNet(tot.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      } else {
        showToastError(result.error || "Hesaplama başarısız");
        setRows([]);
        setMonthRows([]);
      }
    } catch (err: any) {
      console.error("[Bakiye Ücret] Hesaplama hatası:", err);
      showToastError(err.message || "Hesaplama sırasında bir hata oluştu");
      setRows([]);
      setMonthRows([]);
    }
  };

  // YENİ RAPOR SİSTEMİ: Config
  const bakiyeUcretReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Ekstra kalemlerin içeriği
    const extrasContent = extraItems
      .filter(item => parseNum(item.value) > 0)
      .map(item => `${item.name}: ${fmtLocal(parseNum(item.value))}₺`)
      .join(", ");

    const grossToNetRows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }> = [
      { label: "Brüt Ücret", value: `${fmtLocal(netFromGross.gross)}₺` },
      { label: "SGK Primi (%14)", value: `-${fmtLocal(netFromGross.sgk)}₺`, isDeduction: true },
      { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(netFromGross.issizlik)}₺`, isDeduction: true },
    ];
    if ((netFromGross.gelirVergisiIstisna ?? 0) > 0) {
      grossToNetRows.push(
        { label: "Gelir Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.gelirVergisiBrut ?? 0)}₺`, isDeduction: true },
        { label: "Asg. Üc. Gelir Vergi İstisnası", value: `+${fmtLocal(netFromGross.gelirVergisiIstisna ?? 0)}₺` },
        { label: "Net Gelir Vergisi", value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`, isDeduction: true }
      );
    } else {
      grossToNetRows.push(
        { label: "Gelir Vergisi " + (netFromGross.gelirVergisiDilimleri || ""), value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`, isDeduction: true }
      );
    }
    if ((netFromGross.damgaVergisiIstisna ?? 0) > 0) {
      grossToNetRows.push(
        { label: "Damga Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.damgaVergisiBrut ?? 0)}₺`, isDeduction: true },
        { label: "Asg. Üc. Damga Vergi İstisnası", value: `+${fmtLocal(netFromGross.damgaVergisiIstisna ?? 0)}₺` },
        { label: "Net Damga Vergisi", value: `-${fmtLocal(netFromGross.damgaVergisi)}₺`, isDeduction: true }
      );
    } else {
      grossToNetRows.push(
        { label: "Damga Vergisi (binde 7,59)", value: `-${fmtLocal(netFromGross.damgaVergisi)}₺`, isDeduction: true }
      );
    }
    grossToNetRows.push({ label: "Net Ücret", value: `${fmtLocal(netFromGross.net)}₺`, isNet: true });

    return {
      title: "Bakiye Ücret Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Çalışma dönemi başlangıcı", value: startDate ? new Date(startDate).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma dönemi sonu", value: endDate ? new Date(endDate).toLocaleDateString("tr-TR") : "-" },
        { label: "İş Akdinin Fesih Edildiği Tarih", value: resignDate ? new Date(resignDate).toLocaleDateString("tr-TR") : "-" },
        { label: "Kalan Süre", value: remainingLabel || `${remainingDays} gün` },
        { label: "Çıplak Brüt Ücret", value: monthlyBase ? `${fmtLocal(monthlyBase)}₺` : "-" },
        { label: "Ekstra Haklar", value: extrasContent || "-", condition: extrasTotal > 0 },
        { label: "Aylık Toplam Ücret", value: monthly ? `${fmtLocal(monthly)}₺` : "-" },
        { label: "Günlük Ücret", value: daily ? `${fmtLocal(daily)}₺` : "-" },
      ],
      periodData: {
        title: "Bakiye Ücret Hesaplama Cetveli",
        headers: ["Dönem", "Gün Sayısı", "Tutar"],
        rows: rows.map(row => [
          `${format(row.start, "dd.MM.yyyy")} – ${format(row.end, "dd.MM.yyyy")}`,
          row.days.toString(),
          `${fmtLocal(row.amount)}₺`,
        ]),
        footer: [
          "TOPLAM:",
          "",
          `${fmtLocal(total)}₺`,
        ],
        alignRight: [1, 2],
      },
      grossToNetData: netFromGross.gross > 0 ? {
        title: "Brütten Nete Çevir",
        rows: grossToNetRows,
      } : undefined,
      customSections: monthRows.length > 0 ? [
        {
          title: "Aylık Brüt → Net Dönüşüm",
          content: (
            <div className="space-y-1 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
              <table style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse", border: "1px solid #d1d5db" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, border: "1px solid #d1d5db" }}>Dönem</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, border: "1px solid #d1d5db" }}>Gün</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, border: "1px solid #d1d5db" }}>Brüt</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, border: "1px solid #d1d5db" }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((mr, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: "8px 10px", border: "1px solid #d1d5db" }}>
                        {format(mr.start, "dd.MM.yyyy")} – {format(mr.end, "dd.MM.yyyy")}
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>{mr.days}</td>
                      <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>{fmtLocal(mr.gross)} ₺</td>
                      <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>{fmtLocal(mr.net)} ₺</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 600, background: "#f9fafb" }}>
                    <td colSpan={2} style={{ padding: "8px 10px", border: "1px solid #d1d5db" }}>TOPLAM:</td>
                    <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>
                      {fmtLocal(monthRows.reduce((a, b) => a + b.gross, 0))} ₺
                    </td>
                    <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db", color: "#16a34a" }}>
                      {fmtLocal(monthRows.reduce((a, b) => a + b.net, 0))} ₺
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ),
        },
      ] : undefined,
    };
  }, [startDate, endDate, resignDate, remainingDays, remainingLabel, monthlyBase, extrasTotal, extraItems, monthly, daily, rows, total, monthRows, netFromGross]);

  const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (bakiyeUcretReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const pd = bakiyeUcretReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) {
        periodRows.push(pd.footer);
      }
      const n2 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({ id: "bakiye-hesaplama", title: pd.title || "Bakiye Ücret Hesaplama Cetveli", html: buildWordTable(n2.headers, n2.rows) });
    }

    if (monthRows.length > 0) {
      const aylikRows = monthRows.map((mr) => [
        `${format(mr.start, "dd.MM.yyyy")} – ${format(mr.end, "dd.MM.yyyy")}`,
        mr.days.toString(),
        `${fmtLocal(mr.gross)} ₺`,
        `${fmtLocal(mr.net)} ₺`,
      ]);
      const grossToplam = monthRows.reduce((a, b) => a + b.gross, 0);
      const netToplam = monthRows.reduce((a, b) => a + b.net, 0);
      aylikRows.push(["TOPLAM:", "", `${fmtLocal(grossToplam)} ₺`, `${fmtLocal(netToplam)} ₺`]);
      const n3 = adaptToWordTable({
        headers: ["Dönem", "Gün", "Brüt", "Net"],
        rows: aylikRows,
      });
      sections.push({ id: "aylik-brut-net", title: "Aylık Brüt → Net Dönüşüm", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = bakiyeUcretReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: bakiyeUcretReportConfig.grossToNetData?.title || "Brütten Nete Çevir", html: buildWordTable(n4.headers, n4.rows) });
    }

    return sections;
  }, [bakiyeUcretReportConfig, monthRows]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("bakiye-ucret-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = bakiyeUcretReportConfig.title;
    const contentHtml = targetEl.innerHTML;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0 auto;font-size:10px;max-width:16cm}table{width:100%!important;max-width:16cm!important;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid!important}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}</style></head><body>${contentHtml}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {}
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 400);
    };
  }, [bakiyeUcretReportConfig.title]);

  const handleSave = () => {
    try {
      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "bakiye_ucret",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              startDate,
              endDate,
              resignDate,
              brut,
              extraItems,
              monthly,
            },
            results: {
              total,
              rows,
              monthRows,
              monthly,
              daily,
              brutTotal: total,
              netTotal: total,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          start_date: startDate,
          end_date: endDate,
          resign_date: resignDate,
          brut_total: Number(total.toFixed(2)),
          net_total: Number(total.toFixed(2)),
          brut,
          extraItems,
          monthly,
        },
        mevcutId: id,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/bakiye-ucret-alacagi/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = 
        startDate || endDate || resignDate || brut || rows.length > 0;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setStartDate("");
      setEndDate("");
      setResignDate("");
      setBrut("");
      setRows([]);
      setMonthRows([]);
      setExtraItems([
        { id: Math.random().toString(36).slice(2), name: "Prim", value: "" },
        { id: Math.random().toString(36).slice(2), name: "İkramiye", value: "" },
        { id: Math.random().toString(36).slice(2), name: "Yol", value: "" },
        { id: Math.random().toString(36).slice(2), name: "Yemek", value: "" },
      ]);
      setCurrentRecordName(null);
      loadRanRef.current = false;
      
      // URL'de ID varsa temizle ve yönlendir
      if (id) {
        window.location.href = "/bakiye-ucret-alacagi";
      }
    } catch {}
  };

  return (
    <Layout
      title={PAGE_TITLE}
      description="Bakiye Ücret Alacağı Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="bakiye-ucret"
      noBackgroundColor={true}
      headerRight={
        videoLink ? (
          <Button
            onClick={() => window.open(videoLink, "_blank")}
            variant="outline"
            className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            <Youtube className="h-4 w-4" />
            Kullanım Videosu
          </Button>
        ) : undefined
      }
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {videoLink && (
            <div className="mb-8 flex justify-end">
              <Button
                onClick={() => window.open(videoLink, "_blank")}
                variant="outline"
                className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
              >
                <Youtube className="h-4 w-4" />
                Kullanım Videosu
              </Button>
            </div>
          )}

        <div className="w-full space-y-6">
          {/* Left: Form & results */}
          <div id="bakiye-ucret-print">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {FORM_LABELS.START_DATE}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Yıl kısmını 4 karakterle sınırla
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join('-');
                          e.target.value = value;
                        }
                      }
                      setStartDate(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                        const newDate = new Date(newValue);
                        const exitDate = new Date(endDate);
                        if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                            showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {FORM_LABELS.END_DATE}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Yıl kısmını 4 karakterle sınırla
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join('-');
                          e.target.value = value;
                        }
                      }
                      setEndDate(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
                        const newDate = new Date(newValue);
                        const startDateObj = new Date(startDate);
                        if (!isNaN(newDate.getTime()) && !isNaN(startDateObj.getTime()) && newDate < startDateObj) {
                            showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {FORM_LABELS.RESIGN_DATE}
                  </label>
                  <input
                    type="date"
                    value={resignDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Yıl kısmını 4 karakterle sınırla
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join('-');
                          e.target.value = value;
                        }
                      }
                      setResignDate(value);
                    }}
                    className="w-full mt-1 rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                  />
                </div>

                <div className="flex items-end">
                  <div className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 p-3">
                    <div className="text-xs font-medium text-gray-600">
                      {FORM_LABELS.REMAINING_TIME}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mt-1">
                      {remainingDays > 0 ? remainingLabel : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Çalışma Süresi Gösterimi */}
              {workPeriod && workPeriod.label && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Toplam Çalışma Süresi: <span className="font-semibold">{workPeriod.label}</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {FORM_LABELS.BRUT}
                  </label>
                  <input
                    value={brut}
                    onChange={(e) => setBrut(e.target.value)}
                    placeholder="Örn: 25.000,00"
                    className={`w-full mt-1 rounded-xl h-11 font-medium px-3 ${
                      asgariUcretHatasi ? "border-2 border-red-500" : "border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    }`}
                  />
                  {asgariUcretHatasi && (
                    <div className="text-xs text-red-600 mt-1 font-medium">
                      {asgariUcretHatasi}
                    </div>
                  )}
                </div>

                {/* Ekstra Hesaplamalar */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {FORM_LABELS.EXTRA_ITEMS}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
                        onClick={() => {
                          getAllExtraCalculationsSets().then(setSavedSets);
                          setShowImportModal(true);
                        }}
                      >
                        <Download className="w-4 h-4" />
                        İçe Aktar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
                        onClick={() => setShowSaveModal(true)}
                        disabled={extraItems.length === 0}
                      >
                        <Save className="w-4 h-4" />
                        Kaydet
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {extraItems.map((it, idx) => (
                      <div
                        key={it.id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          value={it.name}
                          onChange={(e) =>
                            setExtraItems((prev) =>
                              prev.map((p) =>
                                p.id === it.id ? { ...p, name: e.target.value } : p
                              )
                            )
                          }
                          className="w-40 sm:w-48 rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                          placeholder={`Ek Kalem ${idx + 1}`}
                        />
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <input
                            value={it.value}
                            onChange={(e) =>
                              setExtraItems((prev) =>
                                prev.map((p) =>
                                  p.id === it.id
                                    ? { ...p, value: e.target.value }
                                    : p
                                )
                              )
                            }
                            className="flex-1 min-w-[100px] rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3 text-right"
                            placeholder="Örn: 2.500,00"
                          />
                          <button
                            type="button"
                            className={btnEklenti}
                            onClick={() =>
                              handleRequestEklenti(
                                `${it.name || "Ek Kalem"} için eklenti hesapla`,
                                `extra:${it.id}`
                              )
                            }
                          >
                            Eklenti Hesapla{" "}
                            <span
                              className="text-orange-500 cursor-help ml-1"
                              title="Son 12 ayın değerlerini girerek aylık ortalama tutarı otomatik hesaplayın"
                            >
                              ⓘ
                            </span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExtraItems((prev) =>
                              prev.filter((p) => p.id !== it.id)
                            )
                          }
                          className="text-sm font-semibold rounded-full px-3 py-1.5 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0"
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setExtraItems((prev) => [
                            ...prev,
                            {
                              id: Math.random().toString(36).slice(2),
                              name: "Ek Kalem",
                              value: "",
                            },
                          ])
                        }
                        className="text-sm font-semibold rounded-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        + Ekle
                      </button>
                    </div>
                    <div className="mt-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Ekstra Toplam:</span>
                        <span className="font-medium">
                          {fmtCurrency(extrasTotal)} ₺
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Toplam Brüt (Çıplak + Ekstra):</span>
                        <span className="font-semibold text-gray-900">
                          {fmtCurrency(monthly)} ₺
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleCalculate}
                    className="w-full font-semibold rounded-full bg-blue-600 text-white px-6 py-3 hover:bg-blue-700 transition"
                  >
                    {BUTTON_LABELS.CALCULATE}
                  </button>
                </div>
              </div>

              {/* Results & Monthly table */}
              <div className="pt-2 border-t space-y-2">
                {rows.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Hesaplama için alanları doldurup {BUTTON_LABELS.CALCULATE}{" "}
                    butonuna basınız.
                  </div>
                ) : (
                  <>
                    {/* Monthly breakdown table */}
                    {monthRows.length > 0 && (
                      <div id="aylikTablo" className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                        <table className="min-w-full text-sm border-collapse">
                          <thead>
                            <tr className="text-left text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                              <th className="py-2 px-3 border border-gray-200 dark:border-gray-600 font-semibold">Dönem</th>
                              <th className="py-2 px-3 border border-gray-200 dark:border-gray-600 font-semibold">Gün Sayısı</th>
                              <th className="py-2 px-3 border border-gray-200 dark:border-gray-600 font-semibold">Brüt Tutar</th>
                              <th className="py-2 px-3 border border-gray-200 dark:border-gray-600 font-semibold">Net Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthRows.map((mr, i) => {
                              const fromStr = format(mr.start, "dd.MM.yyyy");
                              const toStr = format(mr.end, "dd.MM.yyyy");
                              return (
                                <tr key={i} className="bg-white dark:bg-gray-800/30">
                                  <td className="py-2 px-3 border border-gray-200 dark:border-gray-600">
                                    {fromStr} - {toStr}
                                  </td>
                                  <td className="py-2 px-3 border border-gray-200 dark:border-gray-600">{mr.days} gün</td>
                                  <td className="py-2 px-3 border border-gray-200 dark:border-gray-600">
                                    <Input
                                      type="text"
                                      value={editingGross[i] ?? fmtCurrency(mr.gross)}
                                      onChange={(e) => setEditingGross((prev) => ({ ...prev, [i]: e.target.value }))}
                                      onBlur={() => handleMonthRowGrossBlur(i)}
                                      className="h-8 w-28 text-sm"
                                    />
                                  </td>
                                  <td className="py-2 px-3 border border-gray-200 dark:border-gray-600">
                                    {fmtCurrency(mr.net)} ₺
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 text-sm sm:text-base">
                          <div className="flex items-center justify-between">
                            <span>Toplam Brüt:</span>
                            <span className="font-semibold">
                              {fmtCurrency(
                                monthRows.reduce((a, b) => a + b.gross, 0)
                              )} ₺
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Toplam Net:</span>
                            <span className="font-medium">
                              {fmtCurrency(
                                monthRows.reduce((a, b) => a + b.net, 0)
                              )} ₺
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dönüştürücüler - Yan Yana */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Brütten Nete Çevir */}
            <Card className="soft-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{FORM_LABELS.GROSS_TO_NET}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{FORM_LABELS.GROSS_SALARY}</Label>
                  <Input
                    value={grossForNet}
                    onChange={(e) => setGrossForNet(e.target.value)}
                    placeholder="Örn: 25.000,00"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2 pt-2 border-t border-gray-200 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">Brüt Ücret</span>
                    <span className="font-semibold text-gray-900">{fmtCurrency(netFromGross.gross)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">SGK Primi (%14)</span>
                    <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.sgk)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">İşsizlik Primi (%1)</span>
                    <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.issizlik)}₺</span>
                  </div>
                  {(netFromGross.gelirVergisiIstisna ?? 0) > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.gelirVergisiBrut ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                        <span className="font-semibold text-green-600">+{fmtCurrency(netFromGross.gelirVergisiIstisna ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Gelir Vergisi</span>
                        <span className="font-semibold text-gray-900">-{fmtCurrency(netFromGross.gelirVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Gelir Vergisi {netFromGross.gelirVergisiDilimleri}</span>
                      <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.gelirVergisi)}₺</span>
                    </div>
                  )}
                  {(netFromGross.damgaVergisiIstisna ?? 0) > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Damga Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.damgaVergisiBrut ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                        <span className="font-semibold text-green-600">+{fmtCurrency(netFromGross.damgaVergisiIstisna ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Damga Vergisi</span>
                        <span className="font-semibold text-gray-900">-{fmtCurrency(netFromGross.damgaVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                      <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.damgaVergisi)}₺</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-green-700">Net Ücret</span>
                    <span className="text-sm font-bold text-green-700">{fmtCurrency(netFromGross.net)}₺</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Netten Brüte Çevir */}
            <Card className="soft-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{FORM_LABELS.NET_TO_GROSS}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{FORM_LABELS.NET_SALARY}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={netForGross}
                      onChange={(e) => setNetForGross(e.target.value)}
                      placeholder="Örn: 18.000,00"
                      className="h-8 text-sm flex-1"
                    />
                    {netFromGross.net > 0 && (
                      <button
                        type="button"
                        onClick={() => setNetForGross(netFromGross.net.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                        className="shrink-0 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg border border-emerald-200 dark:border-emerald-700 transition-colors h-8"
                      >
                        Sol panelin netini kullan
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-gray-200 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">Net Ücret</span>
                    <span className="font-semibold text-gray-900">{fmtCurrency(grossFromNet.net)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">SGK Primi (%14)</span>
                    <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.sgk)}₺</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-red-600">İşsizlik Primi (%1)</span>
                    <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.issizlik)}₺</span>
                  </div>
                  {(grossFromNet.gelirVergisiIstisna ?? 0) > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.gelirVergisiBrut ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                        <span className="font-semibold text-green-600">-{fmtCurrency(grossFromNet.gelirVergisiIstisna ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Gelir Vergisi</span>
                        <span className="font-semibold text-gray-900">+{fmtCurrency(grossFromNet.gelirVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Gelir Vergisi {grossFromNet.gelirVergisiDilimleri}</span>
                      <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.gelirVergisi)}₺</span>
                    </div>
                  )}
                  {(grossFromNet.damgaVergisiIstisna ?? 0) > 0 ? (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-red-600">Damga Vergisi (Brüt)</span>
                        <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.damgaVergisiBrut ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                        <span className="font-semibold text-green-600">-{fmtCurrency(grossFromNet.damgaVergisiIstisna ?? 0)}₺</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Net Damga Vergisi</span>
                        <span className="font-semibold text-gray-900">+{fmtCurrency(grossFromNet.damgaVergisi)}₺</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                      <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.damgaVergisi)}₺</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-green-700">Brüt Ücret</span>
                    <span className="text-sm font-bold text-green-700">{fmtCurrency(grossFromNet.gross)}₺</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notlar */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 text-sm leading-6">
              <p className="text-slate-600 dark:text-slate-300">{NOTE_TEXT}</p>
            </div>
          </div>
        </div>
        </div>
      </div>

      <EklentiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        onApply={handleApplyEklenti}
      />

      {/* Ekstra Hesaplamalar - Kaydet Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Ekstra Hesaplamaları Kaydet</h3>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Set adı girin"
              className="mb-4"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveExtra();
                if (e.key === "Escape") {
                  setShowSaveModal(false);
                  setSaveName("");
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                className="font-semibold rounded-full"
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                }}
              >
                İptal
              </Button>
              <Button onClick={handleSaveExtra} className="font-semibold rounded-full">Kaydet</Button>
            </div>
          </div>
        </div>
      )}

      {/* Ekstra Hesaplamalar - İçe Aktar Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Kaydedilmiş Setleri İçe Aktar</h3>
            {savedSets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Henüz kaydedilmiş set bulunmuyor
              </p>
            ) : (
              <div className="space-y-2">
                {savedSets.map((set) => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{set.name}</div>
                      <div className="text-xs text-gray-500">
                        {set.data.length} kalem •{" "}
                        {new Date(set.createdAt).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-semibold rounded-full"
                        onClick={() => handleImportExtra(set.name)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-semibold rounded-full border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        onClick={() => handleDeleteExtra(set.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" className="font-semibold rounded-full" onClick={() => setShowImportModal(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="bakiye-ucret-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={bakiyeUcretReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "Bakiye Ücret Alacağı Rapor",
          copyTargetId: "bakiye-ucret-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #bakiye-ucret-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #bakiye-ucret-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="bakiye-ucret-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button type="button" className="copy-icon-btn" onClick={() => copySectionForWord(sec.id)} title="Word'e kopyala">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM("Bakiye Ücret Alacağı Rapor", "report-content"),
        }}
      />
    </Layout>
  );
}
