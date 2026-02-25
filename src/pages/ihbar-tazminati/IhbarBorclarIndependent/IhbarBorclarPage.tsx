/**
 * IhbarBorclarPage.tsx
 * SADECE UI + event bağlama.
 * Hesaplama, API, mantık YAPMAZ.
 * Butonlar sadece action çağırır.
 */

import React, { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useLocation, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useToast, ToastProvider, Toaster } from "./localContext/ToastContext";
import { calcWorkPeriodBilirKisi } from "./localUtils/dateUtils";
import FooterActions from "@/components/FooterActions";
import EklentiModal from "./localComponents/EklentiModal";
import { Button } from "./localComponents/ui/button";
import { Input } from "./localComponents/ui/input";
import { Youtube, Save, Download, Trash2, Copy } from "lucide-react";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./localUtils/extraCalculationsStorage";
import { getVideoLink } from "./localConfig/videoLinks";
import { BaseReportModal, ReportContentFromConfig } from "./localComponents/report";
import type { ReportConfig } from "./localComponents/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
// Soft glow styles removed for isolation

// State ve actions
import { useIhbarBorclarState } from "./state";
import {
  handleCalculateIhbarBorclar,
  handleLoadCalculation,
  prepareSaveData,
} from "./actions";
import { fmtCurrency, fmt, parseNum } from "./calculations";
import type { ExtraItem } from "./contract";
import { getAsgariUcretByDate } from "./localUtils/asgariUcretler";
import { API_BASE_URL } from "./localUtils/apiClient";
import SaveCalculationNameModal from "@/components/SaveCalculationNameModal";

// Components
import NoteCard from "./NoteCard";

// Bolt tasarım stilleri (Kidem ile aynı)
const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400";
const btnImport = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-2";
const btnSave = "px-4 py-2.5 rounded-full font-medium text-sm bg-white border border-gray-200 text-gray-700 hover:border-green-400 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnEklenti = "text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 hover:border-blue-400";

// Constants
const SAVE_TYPE = "ihbar_borclar";
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const REDIRECT_BASE_PATH = "/ihbar-tazminati/borclar";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Borçlar Kanunu İşçileri İhbar Tazminatı";
const PRINT_TITLE = "Borçlar Kanunu İşçileri İhbar Tazminatı";
const USE_NEW_IHBAR_BORCLAR_REPORT = true;

// Yerel kaydetme – saved-cases API'ye doğrudan POST/PUT
const saveCalculation = async (
  kayitAdi: string,
  hesapTuru: string,
  veri: Record<string, unknown>,
  mevcutId?: string | number | null
): Promise<{ id: number; success: boolean; message?: string; name?: string }> => {
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const dataPayload = (veri.data as Record<string, unknown>) || {};
  const payload = {
    name: kayitAdi || "",
    type: hesapTuru,
    data: {
      ...dataPayload,
      net_total: (veri as any).net_total ?? (dataPayload as any).results?.net,
      brut_total: (veri as any).brut_total ?? (dataPayload as any).results?.brut,
    },
  };
  const validId = mevcutId != null && mevcutId !== "" && String(mevcutId) !== "undefined" && !isNaN(Number(mevcutId)) && Number(mevcutId) > 0 ? Number(mevcutId) : null;
  const url = validId ? `${SAVE_ENDPOINT}/${validId}` : SAVE_ENDPOINT;
  const method = validId ? "PUT" : "POST";
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Beklenmeyen yanıt (${response.status}).`);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.error || `Kayıt başarısız (${response.status})`);
  return { id: result.id ?? Number(mevcutId) ?? 0, success: true, message: validId ? "Güncellendi" : "Kaydedildi", name: result.name ?? kayitAdi };
};

// IhbarTazminatiForm component (sayfaya özel)
const IhbarTazminatiForm = ({
  onTotalsChange,
  appliedEklenti,
  onRequestEklenti,
  onExitDateChange,
  onValuesChange,
  initialBrut,
  initialIseGiris = "",
  initialIstenCikis = "",
  initialPrim = "",
  initialIkramiye = "",
  initialYol = "",
  initialYemek = "",
  initialExtras = [],
  headerAction,
  onImportClick,
  onSaveClick,
  extrasLength = 0,
}: {
  onTotalsChange: (totals: { toplam: number; yil: number; ay: number; gun: number }) => void;
  appliedEklenti?: number;
  onRequestEklenti?: (fieldKey: string, title: string, apply: (v: number) => void) => void;
  onExitDateChange?: (date: string) => void;
  onValuesChange?: (values: any) => void;
  initialBrut?: string;
  initialIseGiris?: string;
  initialIstenCikis?: string;
  initialPrim?: string;
  initialIkramiye?: string;
  initialYol?: string;
  initialYemek?: string;
  initialExtras?: ExtraItem[];
  headerAction?: React.ReactNode;
  onImportClick?: () => void;
  onSaveClick?: () => void;
  extrasLength?: number;
}) => {
  const [iseGiris, setIseGiris] = useState(initialIseGiris);
  const [istenCikis, setIstenCikis] = useState(initialIstenCikis);
  const [brut, setBrut] = useState(initialBrut || "");
  const [prim, setPrim] = useState(initialPrim || "");
  const [ikramiye, setIkramiye] = useState(initialIkramiye || "");
  const [yol, setYol] = useState(initialYol || "");
  const [yemek, setYemek] = useState(initialYemek || "");
  const [extras, setExtras] = useState<ExtraItem[]>(initialExtras || []);
  const { error } = useToast();

  // Parent formValues değişince (içe aktar, kayıt yükle) form alanlarını senkronize et
  useEffect(() => {
    setIseGiris(initialIseGiris ?? "");
    setIstenCikis(initialIstenCikis ?? "");
    setBrut(initialBrut ?? "");
    setPrim(initialPrim ?? "");
    setIkramiye(initialIkramiye ?? "");
    setYol(initialYol ?? "");
    setYemek(initialYemek ?? "");
    setExtras(Array.isArray(initialExtras) ? initialExtras : []);
  }, [initialIseGiris, initialIstenCikis, initialBrut, initialPrim, initialIkramiye, initialYol, initialYemek, initialExtras]);

  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  const brutUcret = useMemo(() => parseNum(brut), [brut]);
  const primUcret = useMemo(() => parseNum(prim), [prim]);
  const ikramiyeUcret = useMemo(() => parseNum(ikramiye), [ikramiye]);
  const yolUcret = useMemo(() => parseNum(yol), [yol]);
  const yemekUcret = useMemo(() => parseNum(yemek), [yemek]);

  const toplam = useMemo(() => {
    const base = brutUcret + primUcret + ikramiyeUcret + yolUcret + yemekUcret;
    const ex = extras.reduce((acc, it) => acc + parseNum(it.value), 0);
    return base + ex;
  }, [brutUcret, primUcret, ikramiyeUcret, yolUcret, yemekUcret, extras]);

  useEffect(() => {
    onTotalsChange({ toplam, yil: diff.yil, ay: diff.ay, gun: diff.gun });
    if (onValuesChange) {
      onValuesChange({ iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, extras, toplam });
    }
  }, [toplam, diff, iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, extras, onTotalsChange, onValuesChange]);

  useEffect(() => {
    if (onExitDateChange && istenCikis) onExitDateChange(istenCikis);
  }, [istenCikis, onExitDateChange]);

  const addExtra = () => {
    setExtras([...extras, { id: Date.now().toString(), label: "Eklenti", value: "" }]);
  };
  const setExtra = (id: string, patch: Partial<ExtraItem>) => {
    setExtras(extras.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };
  const removeExtra = (id: string) => {
    setExtras(extras.filter((x) => x.id !== id));
  };

  const asgariHataMessage = useMemo(() => {
    if (!istenCikis || !brut) return null;
    const minUcret = getAsgariUcretByDate(istenCikis);
    if (minUcret == null || minUcret === 0) return null;
    if (!brutUcret || brutUcret === 0) return null;
    if (brutUcret < minUcret) {
      const year = new Date(istenCikis).getFullYear();
      const formattedMin = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minUcret);
      return `İşten çıkış tarihindeki asgari ücretten az yazamazsınız (${year} yılı asgari brüt: ${formattedMin}₺).`;
    }
    return null;
  }, [istenCikis, brut, brutUcret]);

  return (
    <div className="soft-card mb-6" style={{ padding: '16px' }}>
      {(headerAction) && (
        <div className="flex items-center justify-end border-b border-gray-200 pb-2 mb-4">
          {headerAction}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
            İşe Giriş Tarihi <span className="text-gray-500" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
          </div>
          <input 
            type="date" 
            value={iseGiris}
            onChange={(e) => {
              let value = e.target.value;
              if (value && value.includes('-')) {
                const parts = value.split('-');
                if (parts[0] && parts[0].length > 4) {
                  parts[0] = parts[0].substring(0, 4);
                  value = parts.join('-');
                  e.target.value = value;
                }
              }
              setIseGiris(value);
            }}
            onBlur={(e) => {
              const newValue = e.target.value;
              if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)) {
                const newDate = new Date(newValue);
                const exitDate = new Date(istenCikis);
                if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                  error("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                }
              }
            }}
            className={inputClass} 
          />
        </div>
        
        <div>
          <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
            İşten Çıkış Tarihi <span className="text-gray-500" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
          </div>
          <input 
            type="date" 
            value={istenCikis} 
            onChange={(e) => {
              let value = e.target.value;
              if (value && value.includes('-')) {
                const parts = value.split('-');
                if (parts[0] && parts[0].length > 4) {
                  parts[0] = parts[0].substring(0, 4);
                  value = parts.join('-');
                  e.target.value = value;
                }
              }
              setIstenCikis(value);
              if (onExitDateChange) onExitDateChange(value);
            }}
            onBlur={(e) => {
              const newValue = e.target.value;
              if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(iseGiris)) {
                const newDate = new Date(newValue);
                const entryDate = new Date(iseGiris);
                if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                  error("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                }
              }
            }}
            className={inputClass} 
          />
        </div>
        
        <div>
          <div className="text-[13px] text-gray-700 font-medium mb-1">Çalışma Süresi</div>
          <input 
            disabled 
            value={diff.label} 
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" 
          />
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        <div>
          <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
            Çıplak Brüt Ücret * <span className="text-gray-500" title="TL cinsinden brüt ücret.">ℹ️</span>
          </div>
          <input 
            type="text"
            value={brut} 
            onChange={(e) => setBrut(e.target.value)} 
            placeholder="Örn: 25.000,00" 
            className={inputClass} 
          />
          {asgariHataMessage && (
            <p className="text-xs text-red-600 mt-1">{asgariHataMessage}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">₺</div>
              Ekstra Hesaplamalar
            </h2>
            <div className="flex gap-3">
              {onImportClick && <button onClick={onImportClick} className={btnImport}><Download className="w-4 h-4" /> İçe Aktar</button>}
              {onSaveClick && <button onClick={onSaveClick} disabled={!(extras.length > 0 || (prim || '').trim() || (ikramiye || '').trim() || (yol || '').trim() || (yemek || '').trim())} className={btnSave}><Save className="w-4 h-4" /> Kaydet</button>}
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Prim, İkramiye, Yol, Yemek vb.</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input disabled value="Prim" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input value={prim} onChange={(e) => setPrim(e.target.value)} placeholder="Örn: 2.500,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("prim", "Prim için eklenti hesapla", (v) => setPrim(String(v.toFixed(2)).replace('.', ',')))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın prim değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setPrim('')} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="İkramiye" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input value={ikramiye} onChange={(e) => setIkramiye(e.target.value)} placeholder="Örn: 1.000,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("ikramiye", "İkramiye için eklenti hesapla", (v) => setIkramiye(String(v.toFixed(2)).replace('.', ',')))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın ikramiye değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setIkramiye('')} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="Yol" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input value={yol} onChange={(e) => setYol(e.target.value)} placeholder="Örn: 500,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("yol", "Yol için eklenti hesapla", (v) => setYol(String(v.toFixed(2)).replace('.', ',')))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın yol değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setYol('')} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="Yemek" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input value={yemek} onChange={(e) => setYemek(e.target.value)} placeholder="Örn: 1.200,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("yemek", "Yemek için eklenti hesapla", (v) => setYemek(String(v.toFixed(2)).replace('.', ',')))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın yemek değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setYemek('')} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            {extras.map((it) => (
              <div key={it.id} className="flex items-center gap-2">
                <input value={it.label} onChange={(e) => setExtra(it.id, { label: e.target.value })} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" placeholder="Kalem Adı" />
                <div className="flex-1 flex items-center gap-2">
                  <input value={it.value} onChange={(e) => setExtra(it.id, { value: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" placeholder="Tutar" />
                  {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti(`extra:${it.id}`, `${it.label || 'Ek kalem'} için eklenti hesapla`, (v) => setExtra(it.id, { value: String(v.toFixed(2)).replace(".", ",") }))}>Eklenti Hesapla</button>}
                </div>
                <button type="button" onClick={() => removeExtra(it.id)} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Satırı Sil"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addExtra} className="text-blue-600 hover:text-blue-800 text-sm font-medium px-4 py-2.5 rounded-full border border-dashed border-gray-200 hover:border-blue-400">+ Ekle</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t">
        <div className="text-sm text-gray-600">Toplam</div>
        <div className="text-base font-semibold">
          {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(toplam)}
        </div>
      </div>
    </div>
  );
};

function IhbarBorclarPageInner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const pathname = location.pathname;
  const navState = (location.state as any) || {};
  
  const videoLink = getVideoLink("ihbar-borclar");
  const { success, error: showToastError } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  
  const caseIdFromQuery = searchParams.get('caseId');
  const effectiveId = id || caseIdFromQuery || undefined;
  
  // State
  const state = useIhbarBorclarState();
  const {
    totals,
    setTotals,
    appliedEklenti,
    setAppliedEklenti,
    exitDate,
    setExitDate,
    formValues,
    setFormValues,
    currentRecordName,
    setCurrentRecordName,
    activeModal,
    setActiveModal,
    eklentiValues,
    setEklentiValues,
    applyFunctions,
    setApplyFunctions,
    showImportModal,
    setShowImportModal,
    showSaveModal,
    setShowSaveModal,
    saveName,
    setSaveName,
    savedSets,
    setSavedSets,
    weeks,
    setWeeks,
    amount,
    setAmount,
    gelirVergisi,
    setGelirVergisi,
    gelirVergisiDilimleri,
    setGelirVergisiDilimleri,
    damgaVergisi,
    setDamgaVergisi,
    net,
    setNet,
    showNewIhbarBorclarReportModal,
    setShowNewIhbarBorclarReportModal,
  } = state;

  // İşten çıkış tarihine göre yıl belirleme
  const selectedYear = useMemo(() => {
    if (exitDate) {
      const year = new Date(exitDate).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) return year;
    }
    if (formValues?.istenCikis) {
      const year = new Date(formValues.istenCikis).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) return year;
    }
    return new Date().getFullYear();
  }, [exitDate, formValues?.istenCikis]);

  // Backend'den hesaplamayı çek
  useEffect(() => {
    if (formValues && (totals.toplam > 0 || totals.yil > 0 || totals.ay > 0 || totals.gun > 0)) {
      handleCalculateIhbarBorclar(
        formValues,
        totals,
        selectedYear,
        (data) => {
          setWeeks(data.weeks);
          setAmount(data.amount);
          setGelirVergisi(data.gelirVergisi);
          setGelirVergisiDilimleri(data.gelirVergisiDilimleri);
          setDamgaVergisi(data.damgaVergisi);
          setNet(data.net);
        },
        (error) => {
          console.error("İhbar tazminatı hesaplama hatası:", error);
        }
      );
    }
  }, [totals, selectedYear, formValues]);

  const handleRequestEklenti = useCallback((fieldKey: string, title: string, apply: (v: number) => void) => {
    setApplyFunctions((prev) => ({ ...prev, [fieldKey]: apply }));
    if (!eklentiValues[fieldKey]) {
      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
    }
    setActiveModal(fieldKey);
  }, [eklentiValues, setApplyFunctions, setEklentiValues, setActiveModal]);

  const handleApplyEklenti = useCallback((value: number, fieldKey: string) => {
    if (applyFunctions[fieldKey]) {
      applyFunctions[fieldKey](value);
    }
    setAppliedEklenti({ field: fieldKey, value });
    setActiveModal(null);
  }, [applyFunctions, setAppliedEklenti, setActiveModal]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, [setActiveModal]);

  // Report Config
  const ihbarBorclarReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLocalCurrency = (n: number) => `${fmtLocal(n)}₺`;
    
    const brutUcretNum = parseNum(formValues?.brut || formValues?.brutUcret || "0");
    const primNum = parseNum(formValues?.prim || "0");
    const ikramiyeNum = parseNum(formValues?.ikramiye || "0");
    const yolNum = parseNum(formValues?.yol || "0");
    const yemekNum = parseNum(formValues?.yemek || "0");
    const extrasTotal = (formValues?.extras || []).reduce((sum: number, ex: any) => sum + parseNum(ex.value), 0);
    const toplamBrutUcret = brutUcretNum + primNum + ikramiyeNum + yolNum + yemekNum + extrasTotal;
    
    const calismaSuresiLabel = `${totals.yil} Yıl ${totals.ay} Ay ${totals.gun} Gün`;
    const haftaSayisiLabel = weeks === 2 ? "2 hafta (altı aydan az)" : 
                             weeks === 4 ? "4 hafta (altı ay - 1,5 yıl)" : 
                             weeks === 6 ? "6 hafta (1,5 yıl - 3 yıl)" : 
                             weeks === 8 ? "8 hafta (3 yıldan fazla)" : 
                             `${weeks} hafta`;

    // İhbar tazminatı hesaplama için günlük ücret formülü
    const gunlukUcretFormulu = `(${fmtLocalCurrency(toplamBrutUcret)} / 30 × ${weeks} × 7)`;

    const iseGirisTarihi = formValues?.iseGiris || formValues?.startDate || "";
    const istenCikisTarihi = formValues?.istenCikis || formValues?.endDate || formValues?.exitDate || "";
    const iseGirisDisplay = iseGirisTarihi ? new Date(iseGirisTarihi).toLocaleDateString("tr-TR") : "-";
    const istenCikisDisplay = istenCikisTarihi ? new Date(istenCikisTarihi).toLocaleDateString("tr-TR") : "-";

    // Ekstra hesaplamalar varsa ayrı bölüm oluştur
    const hasExtras = (formValues?.extras || []).some((ex: any) => parseNum(ex.value) > 0);

    return {
      title: "Borçlar Kanunu İşçileri İhbar Tazminatı",
      sections: {
        info: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: iseGirisDisplay },
        { label: "İşten Çıkış Tarihi", value: istenCikisDisplay },
        { label: "Çalışma Süresi", value: calismaSuresiLabel || "-" },
        { label: "Hafta Sayısı", value: haftaSayisiLabel },
      ],
      customSections: [
        {
          title: "Ücret Bileşenleri",
          condition: true,
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px', marginBottom: '12px' }}>
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Bileşen</th>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Çıplak Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(brutUcretNum)}</td>
                </tr>
                {primNum > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Prim</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(primNum)}</td>
                  </tr>
                )}
                {ikramiyeNum > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>İkramiye</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(ikramiyeNum)}</td>
                  </tr>
                )}
                {yemekNum > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Yemek</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(yemekNum)}</td>
                  </tr>
                )}
                {yolNum > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Yol</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(yolNum)}</td>
                  </tr>
                )}
                <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Toplam Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(toplamBrutUcret)}</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        ...(hasExtras ? [{
          title: "Ekstra Hesaplamalar",
          condition: true,
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px', marginBottom: '12px' }}>
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Açıklama</th>
                  <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {(formValues?.extras || []).map((ex: any, idx: number) => {
                  const exValue = parseNum(ex.value);
                  if (exValue > 0) {
                    return (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ex.label || `Ekstra ${idx + 1}`}</td>
                        <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtLocalCurrency(exValue)}</td>
                      </tr>
                    );
                  }
                  return null;
                })}
              </tbody>
            </table>
          ),
        }] : []),
        {
          title: "İhbar Tazminatı",
          condition: true,
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px', marginBottom: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>İhbar Süresi</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{weeks} hafta</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Günlük Ücret (Toplam/30)</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{gunlukUcretFormulu}</td>
                </tr>
                <tr style={{ background: '#eff6ff', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Toplam İhbar Tazminatı</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#2563eb', fontSize: '12px' }}>{fmtLocalCurrency(amount)}</td>
                </tr>
              </tbody>
            </table>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt İhbar Tazminatı", value: fmtLocalCurrency(amount) },
          { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmtLocalCurrency(gelirVergisi)}`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocalCurrency(damgaVergisi)}`, isDeduction: true },
          { label: "Net İhbar Tazminatı", value: fmtLocalCurrency(net), isNet: true },
        ],
      },
    };
  }, [weeks, amount, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, net, formValues, totals]);

  // Bölüm bazlı Word tabloları (Ihbar30 / Kidem sayfaları ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const brutUcretNum = parseNum(formValues?.brut || formValues?.brutUcret || "0");
    const primNum = parseNum(formValues?.prim || "0");
    const ikramiyeNum = parseNum(formValues?.ikramiye || "0");
    const yolNum = parseNum(formValues?.yol || "0");
    const yemekNum = parseNum(formValues?.yemek || "0");
    const extrasTotal = (formValues?.extras || []).reduce((sum: number, ex: any) => sum + parseNum(ex.value), 0);
    const toplamBrutUcret = brutUcretNum + primNum + ikramiyeNum + yolNum + yemekNum + extrasTotal;
    const calismaSuresiLabel = `${totals.yil} Yıl ${totals.ay} Ay ${totals.gun} Gün`;
    const haftaSayisiLabel = weeks === 2 ? "2 hafta (altı aydan az)" : weeks === 4 ? "4 hafta (altı ay - 1,5 yıl)" : weeks === 6 ? "6 hafta (1,5 yıl - 3 yıl)" : weeks === 8 ? "8 hafta (3 yıldan fazla)" : `${weeks} hafta`;
    const iseGirisTarihi = formValues?.iseGiris || formValues?.startDate || "";
    const istenCikisTarihi = formValues?.istenCikis || formValues?.endDate || formValues?.exitDate || "";
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLocalCurrency = (n: number) => `${fmtLocal(n)}₺`;
    const gunlukUcretFormulu = `(${fmtLocal(toplamBrutUcret)} / 30 × ${weeks} × 7)`;

    const n1 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: [
        ["Tarih", new Date().toLocaleDateString("tr-TR")],
        ["İşe Giriş Tarihi", iseGirisTarihi ? new Date(iseGirisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["İşten Çıkış Tarihi", istenCikisTarihi ? new Date(istenCikisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["Çalışma Süresi", calismaSuresiLabel || "-"],
        ["Hafta Sayısı", haftaSayisiLabel],
      ],
    });
    sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Çıplak Brüt Ücret", value: fmtLocalCurrency(brutUcretNum) },
    ];
    if (primNum > 0) bilesenData.push({ label: "Prim", value: fmtLocalCurrency(primNum) });
    if (ikramiyeNum > 0) bilesenData.push({ label: "İkramiye", value: fmtLocalCurrency(ikramiyeNum) });
    if (yemekNum > 0) bilesenData.push({ label: "Yemek", value: fmtLocalCurrency(yemekNum) });
    if (yolNum > 0) bilesenData.push({ label: "Yol", value: fmtLocalCurrency(yolNum) });
    (formValues?.extras || []).forEach((ex: any) => {
      if (parseNum(ex.value) > 0) bilesenData.push({ label: ex.label || "Ekstra", value: fmtLocalCurrency(parseNum(ex.value)) });
    });
    bilesenData.push({ label: "Toplam Brüt Ücret", value: fmtLocalCurrency(toplamBrutUcret) });
    const n2 = adaptToWordTable(bilesenData);
    sections.push({ id: "ucret-bilesenleri", title: "Ücret Bileşenleri", html: buildWordTable(n2.headers, n2.rows) });

    const ihbarRows: { label: string; value: string }[] = [
      { label: "İhbar Süresi", value: `${weeks} hafta` },
      { label: "Günlük Ücret (Toplam/30 × Hafta × 7)", value: gunlukUcretFormulu },
      { label: "Toplam İhbar Tazminatı", value: fmtLocalCurrency(amount ?? 0) },
    ];
    const n3 = adaptToWordTable(ihbarRows);
    sections.push({ id: "ihbar-tazminati", title: "İhbar Tazminatı", html: buildWordTable(n3.headers, n3.rows) });

    const grossNetRows = ihbarBorclarReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n4 = adaptToWordTable(grossNetRows);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    return sections;
  }, [formValues, weeks, amount, totals, ihbarBorclarReportConfig]);

  const handlePrint = useCallback(() => {
    if (USE_NEW_IHBAR_BORCLAR_REPORT) {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      const title = ihbarBorclarReportConfig.title;
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0 auto; font-size: 10px; max-width: 16cm; }
    table { width: 100% !important; max-width: 16cm !important; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid !important; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { text-align: left; }
  </style>
</head>
<body>${targetEl.outerHTML}</body>
</html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
      };
    } else {
      window.print();
    }
  }, [ihbarBorclarReportConfig.title]);

  const handleSave = useCallback(async (kayitAdi?: string) => {
    const saveData = prepareSaveData(formValues, totals, amount ?? 0, net ?? 0);
    const finalKayitAdi = kayitAdi ?? currentRecordName ?? "Borçlar Kanunu İhbar Tazminatı - " + new Date().toLocaleDateString("tr-TR");
    try {
      setIsSaving(true);
      const result = await saveCalculation(finalKayitAdi, SAVE_TYPE, saveData, effectiveId);
      if (result.success) {
        success("Hesaplama kaydedildi");
        if (result.name) setCurrentRecordName(result.name);
        setShowSaveNameModal(false);
        setSaveNameInput("");
        if (result.id && !effectiveId) navigate(REDIRECT_BASE_PATH + "/" + result.id);
      }
    } catch (err: any) {
      showToastError(err?.message || "Kaydetme hatası");
    } finally {
      setIsSaving(false);
    }
  }, [amount, net, totals, formValues, effectiveId, currentRecordName, showToastError, success, navigate]);

  const handleSaveClick = useCallback(() => {
    setSaveNameInput(currentRecordName || "");
    setShowSaveNameModal(true);
  }, [currentRecordName]);

  const handleNewCalculation = useCallback(() => {
    try {
      const hasUnsavedData = (formValues?.iseGiris || formValues?.startDate) && !id;
      if (hasUnsavedData) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) {
          return;
        }
      }
      
      if (id) {
        window.location.href = REDIRECT_BASE_PATH;
        return;
      }
      
      setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
      setAppliedEklenti(null);
      setExitDate("");
      setFormValues(null);
      setCurrentRecordName(null);
      setActiveModal(null);
      setEklentiValues({
        prim: Array(12).fill(""),
        ikramiye: Array(12).fill(""),
        yol: Array(12).fill(""),
        yemek: Array(12).fill(""),
      });
      setApplyFunctions({});
      setShowImportModal(false);
      setShowSaveModal(false);
      setSaveName("");
      setSavedSets([]);
    } catch (err) {
      console.error("Yeni hesaplama hatası:", err);
    }
  }, [formValues, id, setTotals, setAppliedEklenti, setExitDate, setFormValues, setCurrentRecordName, setActiveModal, setEklentiValues, setApplyFunctions, setShowImportModal, setShowSaveModal, setSaveName, setSavedSets]);

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  // Sayfa yüklendiğinde ID varsa kaydı yükle
  const loadedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const loadId = id;
    if (!loadId) {
      loadedIdRef.current = null;
      return;
    }
    
    // Eğer bu ID zaten yüklendiyse tekrar yükleme
    if (loadedIdRef.current === loadId) return;
    
    let isMounted = true;
    loadedIdRef.current = loadId;
    
    const fetchData = async () => {
      try {
        const data = await handleLoadCalculation(loadId);
        
        if (!isMounted || !data) return;
        
        const formData = data.formValues || {};
        const startDateValue = formData.startDate || formData.iseGiris || '';
        const endDateValue = formData.endDate || formData.istenCikis || '';
        const exitDateValue = formData.exitDate || formData.endDate || formData.istenCikis || '';
        const brutUcretValue = formData.brutUcret || formData.brut || '';
        
        const mappedFormValues = {
          ...formData,
          iseGiris: startDateValue ? new Date(startDateValue).toISOString().split('T')[0] : '',
          istenCikis: endDateValue ? new Date(endDateValue).toISOString().split('T')[0] : '',
          exitDate: exitDateValue ? new Date(exitDateValue).toISOString().split('T')[0] : '',
          brutUcret: brutUcretValue,
          extras: formData?.extras || [],
        };
        
        if (!isMounted) return;
        setFormValues(mappedFormValues);
        
        if (!isMounted) return;
        setExitDate(mappedFormValues.exitDate || mappedFormValues.istenCikis || '');
        setAppliedEklenti(data.appliedEklenti || null);
        
        if (!isMounted) return;
        setCurrentRecordName(data.name || data.notes || null);
        
        if (data.totals) {
          if (!isMounted) return;
          setTotals(data.totals);
        }
        
        if (!isMounted) return;
        success('Kayıt yüklendi');
      } catch (err) {
        if (!isMounted) return;
        console.error('Kayıt yüklenirken hata oluştu:', err);
        showToastError('Kayıt yüklenirken hata oluştu');
        loadedIdRef.current = null; // Hata durumunda ref'i sıfırla
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Sadece id değiştiğinde çalışsın

  // Reset form when pathname changes
  useEffect(() => {
    if (id) return;
    
    setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
    setAppliedEklenti(null);
    setExitDate("");
    setFormValues(null);
    setCurrentRecordName(null);
    setActiveModal(null);
    setEklentiValues({
      prim: Array(12).fill(""),
      ikramiye: Array(12).fill(""),
      yol: Array(12).fill(""),
      yemek: Array(12).fill(""),
    });
    setApplyFunctions({});
  }, [pathname, id, setTotals, setAppliedEklenti, setExitDate, setFormValues, setCurrentRecordName, setActiveModal, setEklentiValues, setApplyFunctions]);

  // Initial prop'ları useMemo ile oluştur
  const memoizedInitialBrut = useMemo(() => {
    if (formValues?.brutUcret || formValues?.brut) {
      return formValues.brutUcret || formValues.brut || "";
    }
    try {
      if (navState?.brutUcret) return String(navState.brutUcret);
      const search = new URLSearchParams(location.search);
      const fromQuery = Number(search.get("toplamTutar") || "");
      const fromState = navState?.toplamTutar;
      const val = Number(isNaN(fromQuery) ? fromState : fromQuery);
      if (!val || !isFinite(val)) return "";
      return String(val.toFixed(2)).replace(".", ",");
    } catch { return ""; }
  }, [formValues?.brutUcret, formValues?.brut, location.search, location.state, navState]);
  const memoizedInitialIseGiris = useMemo(() => formValues?.iseGiris || formValues?.startDate || "", [formValues?.iseGiris, formValues?.startDate]);
  const memoizedInitialIstenCikis = useMemo(() => formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || "", [formValues?.istenCikis, formValues?.exitDate, formValues?.endDate]);
  const memoizedInitialPrim = useMemo(() => formValues?.prim || "", [formValues?.prim]);
  const memoizedInitialIkramiye = useMemo(() => formValues?.ikramiye || "", [formValues?.ikramiye]);
  const memoizedInitialYol = useMemo(() => formValues?.yol || "", [formValues?.yol]);
  const memoizedInitialYemek = useMemo(() => formValues?.yemek || "", [formValues?.yemek]);
  const memoizedInitialExtras = useMemo(() => formValues?.extras || [], [formValues?.extras]);

  // Kaydedilmiş setleri yükle
  useEffect(() => {
    if (showImportModal) {
      getAllExtraCalculationsSets().then(setSavedSets);
    }
  }, [showImportModal, setSavedSets]);

  const handleSaveExtra = async () => {
    if (!saveName.trim()) {
      showToastError("Lütfen bir isim girin");
      return;
    }

    const extrasFromForm = formValues?.extras || [];
    if (extrasFromForm.length === 0) {
      showToastError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }

    const items = extrasFromForm.map((item: any) => ({ id: item.id, name: item.label, value: item.value }));
    const saveResult = await saveExtraCalculationsSet(saveName.trim(), items);
    if (saveResult) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
    } else {
      showToastError("Kaydetme başarısız");
    }
  };

  const FIXED_EXTRA_IDS = ["prim", "ikramiye", "yol", "yemek"];
  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      const primItem = data.find((x: any) => x.id === "prim");
      const ikramiyeItem = data.find((x: any) => x.id === "ikramiye");
      const yolItem = data.find((x: any) => x.id === "yol");
      const yemekItem = data.find((x: any) => x.id === "yemek");
      const extrasItems = data.filter((x: any) => !FIXED_EXTRA_IDS.includes(x.id));
      setFormValues((prev: any) => ({
        ...prev,
        prim: primItem?.value ?? prev?.prim ?? "",
        ikramiye: ikramiyeItem?.value ?? prev?.ikramiye ?? "",
        yol: yolItem?.value ?? prev?.yol ?? "",
        yemek: yemekItem?.value ?? prev?.yemek ?? "",
        extras: extrasItems.map((item: any) => ({ id: item.id, label: item.name, value: item.value })),
      }));
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else {
      showToastError("Yüklenecek veri bulunamadı");
    }
  };

  const handleDeleteExtra = async (id: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;

    const deleteResult = await deleteExtraCalculationsSet(id);
    if (deleteResult) {
      success("Set silindi");
      await getAllExtraCalculationsSets().then(setSavedSets);
    } else {
      showToastError("Silme başarısız");
    }
  };

  return (
    <div>
      <div style={{ height: "4px", background: "#1E88E5" }} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: "80px" }}>
          <div className="mb-8 flex justify-end">
            <div className="flex items-center gap-2">
              {videoLink && (
                <button onClick={() => window.open(videoLink, "_blank")} className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 bg-white border border-red-200 hover:border-red-300 transition-all">
                  <Youtube className="w-4 h-4" />
                  Kullanım Videosu İzle
                </button>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div id="ihbar-print" className="p-8 space-y-6">
        <div className="w-full space-y-6">
          <div className="space-y-4">
            <IhbarTazminatiForm
              key={id || pathname}
              onTotalsChange={setTotals}
              appliedEklenti={typeof appliedEklenti === 'number' ? appliedEklenti : appliedEklenti?.value}
              onRequestEklenti={handleRequestEklenti}
              initialBrut={memoizedInitialBrut}
              initialIseGiris={memoizedInitialIseGiris}
              initialIstenCikis={memoizedInitialIstenCikis}
              initialPrim={memoizedInitialPrim}
              initialIkramiye={memoizedInitialIkramiye}
              initialYol={memoizedInitialYol}
              initialYemek={memoizedInitialYemek}
              initialExtras={memoizedInitialExtras}
              onImportClick={() => {
                getAllExtraCalculationsSets().then(sets => {
                  setSavedSets(sets);
                  setShowImportModal(true);
                });
              }}
              onSaveClick={() => setShowSaveModal(true)}
              extrasLength={formValues?.extras?.length || 0}
              onExitDateChange={setExitDate}
              onValuesChange={setFormValues}
            />

            {activeModal && (
              <EklentiModal
                open={true}
                title={
                  activeModal === "prim"
                    ? "Prim için eklenti hesapla"
                    : activeModal === "ikramiye"
                    ? "İkramiye için eklenti hesapla"
                    : activeModal === "yol"
                    ? "Yol için eklenti hesapla"
                    : activeModal === "yemek"
                    ? "Yemek için eklenti hesapla"
                    : activeModal.startsWith("extra:")
                    ? "Eklenti Hesapla"
                    : "Eklenti Hesaplama"
                }
                onClose={closeModal}
                months={eklentiValues[activeModal]}
                onMonthsChange={(index, value) => {
                  setEklentiValues((prev) => ({
                    ...prev,
                    [activeModal]: prev[activeModal]?.map((v, i) => (i === index ? value : v)) || Array(12).fill(""),
                  }));
                }}
                onApply={(v) => handleApplyEklenti(v, activeModal)}
              />
            )}

            {showSaveModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
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
                      onClick={() => {
                        setShowSaveModal(false);
                        setSaveName("");
                      }}
                    >
                      İptal
                    </Button>
                    <Button onClick={handleSaveExtra}>Kaydet</Button>
                  </div>
                </div>
              </div>
            )}

            {showImportModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto">
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
                              onClick={() => handleImportExtra(set.name)}
                              className="gap-1"
                            >
                              <Download className="w-4 h-4" />
                              Yükle
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteExtra(set.id)}
                              className="gap-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={() => setShowImportModal(false)}>
                      Kapat
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-l-4 border-purple-500 dark:border-purple-600 shadow-sm hover:shadow-md transition-all duration-200">
              <h3 className="font-bold text-purple-900 dark:text-purple-400 mb-3 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                İhbar Tazminatı
              </h3>
              <div className="text-sm sm:text-base space-y-2">
                <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30"><span className="text-gray-700 dark:text-gray-300">İhbar Süresi:</span> <span className="font-semibold text-gray-900 dark:text-gray-100">{weeks} hafta</span></p>
                <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30"><span className="text-gray-700 dark:text-gray-300">Günlük Ücret (Toplam/30):</span> <span className="font-medium text-gray-900 dark:text-gray-100">({fmtCurrency(totals.toplam || 0)} / 30 × {weeks} × 7)</span></p>
                <p className="flex items-center justify-between pt-2"><span className="text-gray-900 dark:text-gray-100 font-semibold">Toplam İhbar Tazminatı:</span> <span className="font-bold text-lg text-purple-700 dark:text-purple-400">{fmtCurrency(amount)}</span></p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-3 bg-purple-100 dark:bg-purple-900/30 p-2 rounded">İş Kanunu madde 17'ye göre hesaplanan ihbar süresi esas alınmıştır.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
              <h3 className="font-bold text-yellow-900 dark:text-yellow-400 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-xs font-bold">₺</span>
                Brüt'ten Net'e Çeviri
              </h3>
              <div className="space-y-2 text-sm sm:text-base">
                <p className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30"><span className="text-gray-700 dark:text-gray-300">Brüt İhbar Tazminatı:</span> <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(amount)}</span></p>
                <p className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30"><span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {gelirVergisiDilimleri}:</span> <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(gelirVergisi)}</span></p>
                <p className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30"><span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59):</span> <span className="font-semibold text-red-600 dark:text-red-400">-{fmtCurrency(damgaVergisi)}</span></p>
                <p className="flex items-center justify-between pt-3"><span className="text-gray-900 dark:text-gray-100 font-semibold">Net İhbar Tazminatı:</span> <span className="font-bold text-lg text-green-700 dark:text-green-400">{fmtCurrency(net)}</span></p>
              </div>
            </div>
            
          </div>
          
          <NoteCard />
        </div>
          </div>
        </div>

      {/* Rapor içeriği yazdırma için her zaman DOM'da (gizli); modal sadece önizleme için */}
      {USE_NEW_IHBAR_BORCLAR_REPORT && (
        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={ihbarBorclarReportConfig} />
        </div>
      )}
      {USE_NEW_IHBAR_BORCLAR_REPORT && (
        <BaseReportModal
          open={showNewIhbarBorclarReportModal}
          onClose={() => setShowNewIhbarBorclarReportModal(false)}
          config={ihbarBorclarReportConfig}
        />
      )}

      <SaveCalculationNameModal
        open={showSaveNameModal}
        onClose={() => { setShowSaveNameModal(false); setSaveNameInput(""); }}
        value={saveNameInput}
        onChange={setSaveNameInput}
        onSave={(name) => handleSave(name)}
        saving={isSaving}
        onEmptyName={() => showToastError("Lütfen bir isim girin")}
        placeholder="Örn: Ahmet Yılmaz - Borçlar Kanunu İhbar"
        inputId="save-calculation-name-borclar"
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSaveClick}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: PRINT_TITLE,
          copyTargetId: "ihbar-borclar-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ihbar-borclar-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #ihbar-borclar-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="ihbar-borclar-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button
                        type="button"
                        className="copy-icon-btn"
                        onClick={() => copySectionForWord(sec.id)}
                        title="Word'e kopyala"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PRINT_TITLE, "report-content"),
        }}
      />
      <Toaster />
        </div>
      </div>
    </div>
  );
}

export default function IhbarBorclarPage() {
  return (
    <ToastProvider>
      <IhbarBorclarPageInner />
    </ToastProvider>
  );
}
