import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useToast, ToastProvider, Toaster } from "./localContext/ToastContext";
import { calcWorkPeriodBilirKisi } from "./localUtils/dateUtils";
import FooterActions from "@/components/FooterActions";
import EklentiModal from "./localComponents/EklentiModal";
import { API_BASE_URL, apiPost } from "./localUtils/apiClient";
import SaveCalculationNameModal from "@/components/SaveCalculationNameModal";
import { Button } from "./localComponents/ui/button";
import { Input } from "./localComponents/ui/input";
import { Youtube, Save, Download, Trash2, Eye, Copy } from "lucide-react";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./localUtils/extraCalculationsStorage";
import { getVideoLink } from "./localConfig/videoLinks";
import { getAsgariUcretByDate } from "./localUtils/asgariUcretler";
// Constants - inline (Kısmi Süreli)
const NOTE_ITEMS: string[] = ["Süreli fesih", "", "Madde 17 - Belirsiz süreli iş sözleşmelerinin feshinden önce durumun diğer tarafa bildirilmesi gerekir.", "", "İş sözleşmeleri;", "", "a) İşi altı aydan az sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak iki hafta sonra,", "", "b) İşi altı aydan birbuçuk yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak dört hafta sonra,", "", "c) İşi birbuçuk yıldan üç yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak altı hafta sonra,", "", "d) İşi üç yıldan fazla sürmüş işçi için, bildirim yapılmasından başlayarak sekiz hafta sonra,", "", "feshedilmiş sayılır.", "", "Bu süreler asgari olup sözleşmeler ile artırılabilir.", "", "Bildirim şartına uymayan taraf, bildirim süresine ilişkin ücret tutarında tazminat ödemek zorundadır.", "", "İşveren bildirim süresine ait ücreti peşin vermek suretiyle iş sözleşmesini feshedebilir."];
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const SAVE_TYPE = "ihbar_kismi";

const saveCalculation = async (kayitAdi: string, hesapTuru: string, veri: Record<string, unknown>, mevcutId?: string | number | null): Promise<{ id: number; success: boolean; message?: string; name?: string }> => {
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const dataPayload = (veri.data as Record<string, unknown>) || {};
  const payload = { name: kayitAdi || "", type: hesapTuru, data: { ...dataPayload, net_total: (veri as any).net_total ?? (dataPayload as any).results?.net, brut_total: (veri as any).brut_total ?? (dataPayload as any).results?.brut } };
  const validId = mevcutId != null && mevcutId !== "" && String(mevcutId) !== "undefined" && !isNaN(Number(mevcutId)) && Number(mevcutId) > 0 ? Number(mevcutId) : null;
  const url = validId ? `${SAVE_ENDPOINT}/${validId}` : SAVE_ENDPOINT;
  const method = validId ? "PUT" : "POST";
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) }, body: JSON.stringify(payload) });
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Beklenmeyen yanıt (${response.status}).`);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.error || `Kayıt başarısız (${response.status})`);
  return { id: result.id ?? Number(mevcutId) ?? 0, success: true, message: validId ? "Güncellendi" : "Kaydedildi", name: result.name ?? kayitAdi };
};
const REDIRECT_BASE_PATH = "/ihbar-tazminati/kismi";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Kısmi Süreli / Part Time İhbar Tazminatı";
const PRINT_TITLE = "Kısmi Süreli / Part Time İhbar Tazminatı";
const PRINT_HEADING = "Kısmi Süreli / Part Time İhbar Tazminatı";
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const toNumber = (value: string) => Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;

const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400";
const btnImport = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-2";
const btnSave = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnEklenti = "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500";

import "@/styles/soft-glow.css";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

type ExtraItem = { id: string; label: string; value: string };

// API servis fonksiyonları
const loadCalculation = async (id: string) => {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    
    const response = await fetch(`${LOAD_ENDPOINT}/${id}`, {
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
        throw new Error(`Kayıt bulunamadı (ID: ${id}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`);
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
    
    // loadCalculation'dan gelen veriyi direkt kullan (dönüşüm yapmadan)
    return {
      data: payload, // Orijinal payload'ı da döndür
      formValues: payload.form || payload.formValues || {},
      appliedEklenti: payload.appliedEklenti || null,
      totals: payload.results?.totals || payload.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 },
      brutTazminat: payload.results?.brut || payload.brutTazminat || 0,
      netTazminat: payload.results?.net || payload.netTazminat || 0,
      notes: data.notes || data.aciklama || "",
      name: data.name || data.notes || data.aciklama || "" // Mevcut kaydın ismi
    };
  } catch (err: any) {
    console.error('Kayıt yükleme hatası:', err);
    throw err;
  }
};

const IhbarTazminatiForm = ({
  onTotalsChange,
  appliedEklenti,
  onRequestEklenti,
  onExitDateChange,
  onValuesChange,
  initialBrut,
  showIhbarShortcut = false,
  hideEmploymentDates = false,
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
  showIhbarShortcut?: boolean;
  hideEmploymentDates?: boolean;
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

  // çalışma süresi hesaplama (bilirkişi yöntemi)
  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  const brutUcret = useMemo(() => toNumber(brut), [brut]);
  const primUcret = useMemo(() => toNumber(prim), [prim]);
  const ikramiyeUcret = useMemo(() => toNumber(ikramiye), [ikramiye]);
  const yolUcret = useMemo(() => toNumber(yol), [yol]);
  const yemekUcret = useMemo(() => toNumber(yemek), [yemek]);

  const toplam = useMemo(() => {
    const base = brutUcret + primUcret + ikramiyeUcret + yolUcret + yemekUcret;
    const ex = extras.reduce((acc, it) => acc + toNumber(it.value), 0);
    return base + ex;
  }, [brutUcret, primUcret, ikramiyeUcret, yolUcret, yemekUcret, extras]);

  // Update parent with totals and values
  useEffect(() => {
    onTotalsChange({ toplam, yil: diff.yil, ay: diff.ay, gun: diff.gun });
    if (onValuesChange) {
      onValuesChange({ iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, extras, toplam });
    }
  }, [toplam, diff, iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, extras]);

  // Handle exit date change
  useEffect(() => {
    if (onExitDateChange && istenCikis) {
      onExitDateChange(istenCikis);
    }
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
        <div className="flex items-center justify-end border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
          {headerAction}
        </div>
      )}
      
      {!hideEmploymentDates && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1">
              İşe Giriş Tarihi <span className="text-gray-500" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
            </div>
            <input 
              type="date" 
              value={iseGiris} 
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
            <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1">
              İşten Çıkış Tarihi <span className="text-gray-500" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
            </div>
            <input 
              type="date" 
              value={istenCikis} 
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
                setIstenCikis(value);
                if (onExitDateChange) onExitDateChange(e.target.value);
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
            <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1">Çalışma Süresi</div>
            <input 
              disabled 
              value={diff.label} 
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300" 
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1">
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">₺</div>
              Ekstra Hesaplamalar
            </h2>
            <div className="flex gap-3">
              {onImportClick && (
                <button type="button" onClick={onImportClick} className={btnImport}><Download className="w-4 h-4" /> İçe Aktar</button>
              )}
              {onSaveClick && (
                <button type="button" onClick={onSaveClick} disabled={!(extras.length > 0 || (prim || "").trim() || (ikramiye || "").trim() || (yol || "").trim() || (yemek || "").trim())} className={btnSave}><Save className="w-4 h-4" /> Kaydet</button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Prim, İkramiye, Yol, Yemek vb.</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input disabled value="Prim" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={prim} onChange={(e) => setPrim(e.target.value)} placeholder="Örn: 2.500,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("prim", "Prim için eklenti hesapla", (v) => setPrim(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın prim değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setPrim("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="İkramiye" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={ikramiye} onChange={(e) => setIkramiye(e.target.value)} placeholder="Örn: 1.000,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("ikramiye", "İkramiye için eklenti hesapla", (v) => setIkramiye(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın ikramiye değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setIkramiye("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="Yol" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={yol} onChange={(e) => setYol(e.target.value)} placeholder="Örn: 500,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("yol", "Yol için eklenti hesapla", (v) => setYol(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın yol değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setYol("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="Yemek" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={yemek} onChange={(e) => setYemek(e.target.value)} placeholder="Örn: 1.200,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("yemek", "Yemek için eklenti hesapla", (v) => setYemek(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın yemek değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setYemek("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            {extras.map((it) => (
              <div key={it.id} className="flex items-center gap-2">
                <input type="text" value={it.label} onChange={(e) => setExtra(it.id, { label: e.target.value })} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Kalem Adı" />
                <div className="flex-1 flex items-center gap-2">
                  <input type="text" value={it.value} onChange={(e) => setExtra(it.id, { value: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Tutar" />
                  {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("extra:" + it.id, "Eklenti Hesapla", (v) => setExtra(it.id, { value: String(v.toFixed(2)).replace(".", ",") }))}>Eklenti Hesapla</button>}
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
        <div className="text-base font-semibold">{new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toplam)}₺</div>
      </div>
    </div>
  );
};

function IhbarKismiIndependentInner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("ihbar-kismi");
  const { success, error: showToastError } = useToast();
  
  const caseIdFromQuery = searchParams.get('caseId');
  const effectiveId = id || caseIdFromQuery || undefined;
  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | number | null>(null);
  const [exitDate, setExitDate] = useState<string>("");
  const [formValues, setFormValues] = useState<any>(null);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal state management
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({
    prim: Array(12).fill(""),
    ikramiye: Array(12).fill(""),
    yol: Array(12).fill(""),
    yemek: Array(12).fill(""),
  });
  const [applyFunctions, setApplyFunctions] = useState<Record<string, (v: number) => void>>({});
  
  // Extra calculations modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<SavedExtraCalculationsSet[]>([]);

  // İşten çıkış tarihine göre yıl belirleme
  const selectedYear = useMemo(() => {
    if (exitDate) {
      const year = new Date(exitDate).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) {
        return year;
      }
    }
    if (formValues?.istenCikis) {
      const year = new Date(formValues.istenCikis).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) {
        return year;
      }
    }
    return new Date().getFullYear();
  }, [exitDate, formValues?.istenCikis]);

  const [weeks, setWeeks] = useState(2);
  const [amount, setAmount] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [net, setNet] = useState(0);

  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        const requestData = {
          brut: formValues?.brutUcret || formValues?.brut || "0",
          prim: formValues?.prim || "0",
          ikramiye: formValues?.ikramiye || "0",
          yol: formValues?.yol || "0",
          yemek: formValues?.yemek || "0",
          diger: "0",
          extras: formValues?.extras || [],
          totals: totals,
          exitYear: selectedYear
        };
        const res = await apiPost('/api/ihbar/kismi', requestData);
        if (!res.ok) return;
        const result = await res.json();
        if (result.success && result.data) {
          const data = result.data;
          setWeeks(data.weeks || 2);
          setAmount(data.brut || 0);
          setGelirVergisi(data.gelirVergisi || 0);
          setGelirVergisiDilimleri(data.gelirVergisiDilimleri || "");
          setDamgaVergisi(data.damgaVergisi || 0);
          setNet(data.net || 0);
        }
      } catch (error) {
        console.error("İhbar tazminatı hesaplama hatası:", error);
      }
    };
    if (totals.toplam > 0) calculateFromBackend();
  }, [totals, selectedYear, formValues]);

  const handleRequestEklenti = useCallback((fieldKey: string, title: string, apply: (v: number) => void) => {
    setApplyFunctions((prev) => ({ ...prev, [fieldKey]: apply }));
    if (!eklentiValues[fieldKey]) {
      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
    }
    setActiveModal(fieldKey);
  }, [eklentiValues]);

  const handleApplyEklenti = useCallback((value: number, fieldKey: string) => {
    if (applyFunctions[fieldKey]) {
      applyFunctions[fieldKey](value);
    }
    setAppliedEklenti({ field: fieldKey, value });
    setActiveModal(null);
  }, [applyFunctions]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("report-content");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = PRINT_TITLE;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0 auto;font-size:10px;max-width:16cm}table{width:100%!important;max-width:16cm!important;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid!important}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}</style></head><body>${targetEl.innerHTML}</body></html>`;
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
  }, []);

  const handleSave = useCallback(async (kayitAdi: string) => {
    if (!amount || amount <= 0) {
      showToastError("Lütfen geçerli bir hesaplama yapın");
      return;
    }
    const iseGiris = formValues?.iseGiris || formValues?.startDate || null;
    const istenCikis = formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || null;
    const formDataWithExtras = { ...(formValues || {}), extras: formValues?.extras || [] };
    const veri = {
      data: { form: formDataWithExtras, results: { totals, brut: amount, net } },
      ise_giris: iseGiris, isten_cikis: istenCikis, brut_total: Number(amount.toFixed(2)), net_total: Number(net.toFixed(2)), start_date: iseGiris, end_date: istenCikis, total: Number(amount.toFixed(2)),
    };
    try {
      setIsSaving(true);
      const result = await saveCalculation(kayitAdi, SAVE_TYPE, veri, effectiveId);
      if (result.success) {
        success("Hesaplama kaydedildi");
        if (result.name) setCurrentRecordName(result.name);
        setShowSaveNameModal(false);
        setSaveNameInput("");
        if (result.id && !effectiveId) navigate(`${REDIRECT_BASE_PATH}/${result.id}`);
      }
    } catch (err: any) {
      showToastError(err?.message || "Kaydetme hatası");
    } finally {
      setIsSaving(false);
    }
  }, [amount, net, totals, formValues, effectiveId, success, showToastError, navigate]);

  const handleSaveClick = useCallback(() => {
    if (effectiveId) {
      handleSave(currentRecordName || PRINT_TITLE + " - " + new Date().toLocaleDateString("tr-TR"));
      return;
    }
    setSaveNameInput(currentRecordName || "");
    setShowSaveNameModal(true);
  }, [currentRecordName, effectiveId, handleSave]);

  // Rapor içeriği: hem gizli yazdırma div'inde hem önizleme modalında kullanılır
  const reportContentEl = useMemo(() => {
    const calismaSuresiLabel = `${totals.yil} Yıl ${totals.ay} Ay ${totals.gun} Gün`;
    const brutUcretNum = toNumber(formValues?.brut || "0");
    const primNum = toNumber(formValues?.prim || "0");
    const ikramiyeNum = toNumber(formValues?.ikramiye || "0");
    const yolNum = toNumber(formValues?.yol || "0");
    const yemekNum = toNumber(formValues?.yemek || "0");
    const extrasTotal = (formValues?.extras || []).reduce((sum: number, ex: any) => sum + toNumber(ex.value), 0);
    const toplamBrutUcret = brutUcretNum + primNum + ikramiyeNum + yolNum + yemekNum + extrasTotal;
    return (
      <div style={{ width: '16cm', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827', fontSize: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>İhbar Tazminatı Hesap Özeti</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: 10, marginBottom: 10 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Alan</th><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Değer</th></tr>
          </thead>
          <tbody>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>İşe Giriş</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{formValues?.iseGiris || '-'}</td></tr>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>İşten Çıkış</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{formValues?.istenCikis || '-'}</td></tr>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Çalışma Süresi</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{calismaSuresiLabel}</td></tr>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>İhbar Süresi</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{weeks} hafta</td></tr>
          </tbody>
        </table>
        <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 12 }}>İhbar Tazminatı Hesaplaması</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: 10, marginBottom: 10 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Alan</th><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Değer</th></tr>
          </thead>
          <tbody>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Kıdem Süresi</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{calismaSuresiLabel}</td></tr>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>İhbar Süresi</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{weeks} hafta</td></tr>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Hesaplama</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>({fmt(toplamBrutUcret)}₺ / 30) × {weeks} hafta × 7 gün</td></tr>
            <tr style={{ background: '#f3f4f6', fontWeight: 600 }}><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Brüt İhbar Tazminatı Tutarı</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{fmt(amount)}₺</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: '9px', color: '#6b7280', marginTop: 4, marginBottom: 12 }}>İş Kanunu madde 17'ye göre hesaplanan ihbar süresi esas alınmıştır.</p>
        <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 12 }}>Ücret Bileşenleri</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: 10, marginBottom: 10 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Ücret Kalemi</th><th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Tutar</th></tr>
          </thead>
          <tbody>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Çıplak Brüt</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(brutUcretNum)}₺</td></tr>
            {primNum > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Prim</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(primNum)}₺</td></tr>}
            {ikramiyeNum > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>İkramiye</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(ikramiyeNum)}₺</td></tr>}
            {yemekNum > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Yemek</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(yemekNum)}₺</td></tr>}
            {yolNum > 0 && <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Yol</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(yolNum)}₺</td></tr>}
            {(formValues?.extras || []).map((ex: any, idx: number) => (
              <tr key={idx}><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ex.label || `Ekstra ${idx + 1}`}</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(toNumber(ex.value))}₺</td></tr>
            ))}
            <tr style={{ background: '#f3f4f6', fontWeight: 600 }}><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Toplam Brüt Ücret</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(toplamBrutUcret)}₺</td></tr>
          </tbody>
        </table>
        <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 12 }}>Brütten Nete Çeviri</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: 10 }}>
          <tbody>
            <tr style={{ background: '#f3f4f6', fontWeight: 600 }}><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Brüt İhbar Tazminatı</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(amount)}₺</td></tr>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Gelir Vergisi {gelirVergisiDilimleri}</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(gelirVergisi)}₺</td></tr>
            <tr><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Damga Vergisi (binde 7,59)</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(damgaVergisi)}₺</td></tr>
            <tr style={{ background: '#dcfce7', fontWeight: 600, color: '#16a34a' }}><td style={{ border: '1px solid #999', padding: '5px 8px' }}>Net İhbar Tazminatı</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(net)}₺</td></tr>
          </tbody>
        </table>
        </div>
      </div>
    );
  }, [totals, formValues, amount, net, weeks, gelirVergisiDilimleri, gelirVergisi, damgaVergisi]);

  // Bölüm bazlı Word tabloları (Ihbar30 / IhbarMevsim ile aynı yapı)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const brutUcretNum = toNumber(formValues?.brut || formValues?.brutUcret || "0");
    const primNum = toNumber(formValues?.prim || "0");
    const ikramiyeNum = toNumber(formValues?.ikramiye || "0");
    const yolNum = toNumber(formValues?.yol || "0");
    const yemekNum = toNumber(formValues?.yemek || "0");
    const extrasTotal = (formValues?.extras || []).reduce((sum: number, ex: any) => sum + toNumber(ex.value), 0);
    const toplamBrutUcret = brutUcretNum + primNum + ikramiyeNum + yolNum + yemekNum + extrasTotal;
    const calismaSuresiLabel = `${totals.yil} Yıl ${totals.ay} Ay ${totals.gun} Gün`;
    const iseGirisTarihi = formValues?.iseGiris || formValues?.startDate || "";
    const istenCikisTarihi = formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || "";
    const fmtCurrency = (n: number) => `${fmt(n)}₺`;
    const hesaplamaStr = toplamBrutUcret > 0 ? `(${fmt(toplamBrutUcret)} / 30) × ${weeks} hafta × 7 gün` : "-";

    const n1 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: [
        ["Tarih", new Date().toLocaleDateString("tr-TR")],
        ["İşe Giriş", iseGirisTarihi ? new Date(iseGirisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["İşten Çıkış", istenCikisTarihi ? new Date(istenCikisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["Çalışma Süresi", calismaSuresiLabel || "-"],
        ["İhbar Süresi", `${weeks} hafta`],
      ],
    });
    sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const ihbarRows: { label: string; value: string }[] = [
      { label: "Kıdem Süresi", value: calismaSuresiLabel },
      { label: "İhbar Süresi", value: `${weeks} hafta` },
      { label: "Hesaplama", value: hesaplamaStr },
      { label: "Brüt İhbar Tazminatı Tutarı", value: fmtCurrency(amount ?? 0) },
    ];
    const n2 = adaptToWordTable(ihbarRows);
    sections.push({ id: "ihbar-tazminati", title: "İhbar Tazminatı Hesaplaması", html: buildWordTable(n2.headers, n2.rows) });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Çıplak Brüt", value: fmtCurrency(brutUcretNum) },
    ];
    if (primNum > 0) bilesenData.push({ label: "Prim", value: fmtCurrency(primNum) });
    if (ikramiyeNum > 0) bilesenData.push({ label: "İkramiye", value: fmtCurrency(ikramiyeNum) });
    if (yemekNum > 0) bilesenData.push({ label: "Yemek", value: fmtCurrency(yemekNum) });
    if (yolNum > 0) bilesenData.push({ label: "Yol", value: fmtCurrency(yolNum) });
    (formValues?.extras || []).forEach((ex: any) => {
      if (toNumber(ex.value) > 0) bilesenData.push({ label: ex.label || "Ekstra", value: fmtCurrency(toNumber(ex.value)) });
    });
    bilesenData.push({ label: "Toplam Brüt Ücret", value: fmtCurrency(toplamBrutUcret) });
    const n3 = adaptToWordTable(bilesenData);
    sections.push({ id: "ucret-bilesenleri", title: "Ücret Bileşenleri", html: buildWordTable(n3.headers, n3.rows) });

    const grossNetRows: { label: string; value: string }[] = [
      { label: "Brüt İhbar Tazminatı", value: fmtCurrency(amount ?? 0) },
      { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmtCurrency(gelirVergisi)}` },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtCurrency(damgaVergisi)}` },
      { label: "Net İhbar Tazminatı", value: fmtCurrency(net ?? 0) },
    ];
    const n4 = adaptToWordTable(grossNetRows);
    sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });

    return sections;
  }, [formValues, totals, weeks, amount, net, gelirVergisiDilimleri, gelirVergisi, damgaVergisi]);

  // Yeni hesaplama
  const handleNewCalculation = useCallback(() => {
    try {
      const hasUnsavedData = (formValues?.iseGiris || formValues?.startDate) && !id;
      if (hasUnsavedData) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) {
          return;
        }
      }
      
      // ID varsa URL'den kaldır ve sayfayı yeniden yükle
      if (id) {
        window.location.href = REDIRECT_BASE_PATH;
        return;
      }
      
      // ID yoksa sadece state'leri temizle
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
  }, [formValues, id]);

  const location = useLocation();
  const pathname = location.pathname;
  const navState = (location.state as any) || {};

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  // Sayfa yüklendiğinde ID varsa kaydı yükle
  useEffect(() => {
    const loadId = id;
    if (!loadId) return;
    
    let isMounted = true; // Component unmount kontrolü
    
    const fetchData = async () => {
      try {
        const data = await loadCalculation(loadId);
        
        if (!isMounted) return; // Component unmount olduysa işlemi durdur
        
        // Form verilerini map et - hem eski hem yeni formatı destekle
        const formData = data.formValues || {};
        
        // Tarih alanlarını normalize et ve formatla
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
          // Extras'ı koru - eğer yüklenen veride varsa onu kullan
          extras: formData?.extras || [],
        };
        
        if (!isMounted) return;
        setFormValues(mappedFormValues);
        
        if (!isMounted) return;
        setExitDate(mappedFormValues.exitDate || mappedFormValues.istenCikis || '');
        setAppliedEklenti(data.appliedEklenti || null);
        
        // Mevcut kaydın ismini al (güncelleme için)
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
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Sadece id değiştiğinde çalışsın

  // Reset form when pathname changes (sadece ID yoksa)
  useEffect(() => {
    if (id) return; // ID varsa yukarıdaki useEffect zaten yüklüyor
    
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
  }, [pathname, id]);

  // Initial prop'ları useMemo ile oluştur (form alanlarının yüklenmesi için)
  const memoizedInitialBrut = useMemo(() => {
    // Önce formValues'tan al
    if (formValues?.brutUcret || formValues?.brut) {
      return formValues.brutUcret || formValues.brut || "";
    }
    // Sonra navState'ten al
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
  }, [showImportModal]);

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

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setFormValues((prev: any) => ({
        ...prev,
        extras: data.map(item => ({ id: item.id, label: item.name, value: item.value }))
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
                <button onClick={() => window.open(videoLink, "_blank")} className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 transition-all">
                  <Youtube className="w-4 h-4" />
                  Kullanım Videosu İzle
                </button>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div id="ihbar-print" className="p-8 space-y-6">
        <div className="w-full space-y-6">
          {/* Form ve Hesaplamalar */}
          <div className="space-y-4">
            <IhbarTazminatiForm
              key={id || pathname}
              onTotalsChange={setTotals}
              appliedEklenti={appliedEklenti}
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

            {/* Kaydet Modal */}
            {showSaveModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-600">
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

            {/* İçe Aktar Modal */}
            {showImportModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-600">
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
                <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30"><span className="text-gray-700 dark:text-gray-300">Günlük Ücret (Toplam/30):</span> <span className="font-medium text-gray-900 dark:text-gray-100">({fmt(totals.toplam || 0)}₺ / 30 × {weeks} × 7)</span></p>
                <p className="flex items-center justify-between pt-2"><span className="text-gray-900 dark:text-gray-100 font-semibold">Toplam İhbar Tazminatı:</span> <span className="font-bold text-lg text-purple-700 dark:text-purple-400">{fmt(amount)}₺</span></p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-3 bg-purple-100 dark:bg-purple-900/30 p-2 rounded">İş Kanunu madde 17'ye göre hesaplanan ihbar süresi esas alınmıştır.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
              <h3 className="font-bold text-yellow-900 dark:text-yellow-400 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-xs font-bold">₺</span>
                Brüt'ten Net'e Çeviri
              </h3>
              <div className="space-y-2 text-sm sm:text-base">
                <p className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30"><span className="text-gray-700 dark:text-gray-300">Brüt İhbar Tazminatı:</span> <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(amount)}₺</span></p>
                <p className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30"><span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {gelirVergisiDilimleri}:</span> <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(gelirVergisi)}₺</span></p>
                <p className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30"><span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59):</span> <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(damgaVergisi)}₺</span></p>
                <p className="flex items-center justify-between pt-3"><span className="text-gray-900 dark:text-gray-100 font-semibold">Net İhbar Tazminatı:</span> <span className="font-bold text-lg text-green-700 dark:text-green-400">{fmt(net)}₺</span></p>
              </div>
            </div>
            
          </div>
          
          {/* Notlar Bölümü */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 notes-content">
              <div className="space-y-0.5 text-sm text-slate-600 dark:text-slate-300 leading-tight">
                {NOTE_ITEMS.map((item, index) => {
                  if (item === "") return <div key={index} className="h-0.5" />;
                  const isHeading = item === "Süreli fesih" || item === "İş sözleşmeleri;";
                  const isListItem = /^[a-d]\)/.test(item) || item === "feshedilmiş sayılır.";
                  const isMadde = item.startsWith("Madde 17");
                  
                  if (isHeading) {
                    return <p key={index} className="font-semibold text-slate-800 dark:text-slate-200">{item}</p>;
                  }
                  if (isListItem) {
                    return <p key={index} className="pl-6">{item}</p>;
                  }
                  if (isMadde) {
                    return <p key={index}>{item}</p>;
                  }
                  return <p key={index}>• {item}</p>;
                })}
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      <div id="report-content" style={{ position: 'absolute', left: '-9999px', top: 0, visibility: 'hidden', width: '16cm', zIndex: -1 }} aria-hidden="true">
        {reportContentEl}
      </div>
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSaveClick}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: PRINT_TITLE,
          copyTargetId: "ihbar-kismi-word-copy",
          hideWordDownload: true,
          buttonIcon: <Eye className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ihbar-kismi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #ihbar-kismi-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="ihbar-kismi-word-copy">
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
      <SaveCalculationNameModal
        open={showSaveNameModal}
        onClose={() => { setShowSaveNameModal(false); setSaveNameInput(""); }}
        value={saveNameInput}
        onChange={setSaveNameInput}
        onSave={(name) => handleSave(name)}
        saving={isSaving}
        onEmptyName={() => showToastError("Lütfen bir isim girin")}
        placeholder="Hesaplama adı"
        inputId="save-calculation-name-kismi"
      />
      <Toaster />
        </div>
      </div>
    </div>
  );
}

export default function IhbarKismiIndependent() {
  return (
    <ToastProvider>
      <IhbarKismiIndependentInner />
    </ToastProvider>
  );
}
