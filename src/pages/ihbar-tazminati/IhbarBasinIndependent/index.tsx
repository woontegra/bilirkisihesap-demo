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
// Constants - inline (Basın İş)
const NOTE_ITEMS: string[] = ["HEADING:Feshin ihbarı:", "", "Madde 5 – Müddeti muayyen olmıyan iş akitlerinde feshin ihbarı bu Kanunda yazılı mühletlere tabidir.", "", "6 ncı ve 7 nci maddelerde yazılı ihbar mühletlerine tekabül eden ücret miktarındaki tazminatın işveren veya gazeteci tarafından diğer tarafa önceden ödenmesi suretiyle akdin derhal feshi de caizdir.", "", "HEADING:Akdin işveren tarafından feshi ve kıdem tazminatı:", "", "Madde 6 – (Değişik: 4/1/1961 - 212/1 md.)", "", "(İptal fıkra: Anayasa Mahkemesinin 4/5/2023 Tarihli ve E: 2021/62, K: 2023/89 Sayılı Kararı ile.)", "", "Kıdem hakkı gazetecinin mesleke ilk giriş tarihinden itibaren hesaplanır.", "", "Akdin feshi halinde gazeteci, bu süreye göre hesaplanacak tazminatı almaya hak kazanır.", "", "Birinci maddenin şümulüne giren bir işyerinde işverenle arasındaki hizmet münasebeti bir veya müteaddit mukaveleye istinaden fasılasız olarak en az beş yıl sürmüş olan gazetecinin işine son verilmesi yapılacak yazılı ihbardan itibaren üç ay geçtikten sonra muteber olur. Beş seneden az hizmeti olanlar için bu ihbar müddeti bir aydır.", "", "İhbar müddetinin son günü olan tarih tazminata esas tutulur ve yıllık izinden sayılmaz.", "", "Gazeteci yıllık iznini kullanmamışsa, işine son verilmesi halinde, izin müddetine ait ücreti kendisine peşin olarak verilir.", "", "Hizmetine bu madde hükümlerine göre son verilen gazeteciye feshi ihbar edilen mukavelenin taallük ettiği her hizmet yılı veya küsuru için, son aylığı esas ittihaz olunmak suretiyle her yıl için bir aylık ücreti miktarında tazminat verilir. (İptal ikinci cümle: Anayasa Mahkemesinin 4/5/2023 Tarihli ve E: 2021/62, K: 2023/89 Sayılı Kararı ile.) İlk mukavele yılında bu miktar hesaplanmaz.", "", "Bir defa kıdem tazminatı alan gazetecinin kıdemi, yeni işine girişinden itibaren hesaplanır. Ancak, buna aykırı olarak işverenle gazeteci arasında yapılacak mukavele muteberdir.", "", "İşverenin maddi imkansızlık sebebiyle gazetecinin tazminatını bir defada ödeyememesi halinde, tediye en çok dört taksitte yapılır ve bu taksitlerin tamamının süresi bir yılı geçemez. Ancak, bu bölünme o iş yerinin mali vergisini tahakkuk ettiren maliye şubesinin, müessesenin zarar etmekte olduğu kararı üzerine yapılabilir.", "", "(Ek: 9/8/2002-4773/12 md.; Değişik: 22/5/2003-4857/116 md.) İş Kanununun 18, 19, 20, 21 ve 29 uncu maddesi hükümleri kıyas yoluyla uygulanır.", "", "HEADING:Akdin gazeteci tarafından feshi:", "", "Madde 7 – Gazeteci en az bir ay evvel işverene yazılı ihbarda bulunmak suretiyle iş akdini her zaman feshedebilir.", "", "HEADING:Müddetlerin artırılması:", "", "Madde 8 – Yukarki maddelerde yazılı ihbar mühletleri asgari olup mukavele ile artırılabilir."];
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const SAVE_TYPE = "ihbar_basin";

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
const REDIRECT_BASE_PATH = "/ihbar-tazminati/basin";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Basın İşçileri İhbar Tazminatı";
const PRINT_TITLE = "Basın İşçileri İhbar Tazminatı";
const PRINT_HEADING = "Basın İşçileri İhbar Tazminatı";
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const toNumber = (value: string) => Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;

// Bolt tasarım stilleri (Kidem ile aynı)
const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400";
const btnImport = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-2";
const btnSave = "px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnEklenti = "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500";

// YENİ RAPOR SİSTEMİ
import { BaseReportModal, ReportContentFromConfig } from "./localComponents/report";
import type { ReportConfig } from "./localComponents/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
const USE_NEW_IHBAR_BASIN_REPORT = true;

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
  initialMeslegeBaslangic = "",
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
  initialMeslegeBaslangic?: string;
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
  const [meslegeBaslangic, setMeslegeBaslangic] = useState("");
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
    setMeslegeBaslangic(initialMeslegeBaslangic ?? "");
    setBrut(initialBrut ?? "");
    setPrim(initialPrim ?? "");
    setIkramiye(initialIkramiye ?? "");
    setYol(initialYol ?? "");
    setYemek(initialYemek ?? "");
    setExtras(Array.isArray(initialExtras) ? initialExtras : []);
  }, [initialIseGiris, initialIstenCikis, initialMeslegeBaslangic, initialBrut, initialPrim, initialIkramiye, initialYol, initialYemek, initialExtras]);

  // Çalışma süresi hesaplama (işe giriş - işten çıkış arası)
  const calismaSuresi = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  // Kıdem süresi hesaplama (mesleğe başlangıç - işten çıkış arası)
  const kidemSuresi = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(meslegeBaslangic, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [meslegeBaslangic, istenCikis]);

  // diff eskisi için uyumluluk
  const diff = calismaSuresi;

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
      onValuesChange({ 
        iseGiris, 
        istenCikis, 
        meslegeBaslangic,
        kidemSuresi: { yil: kidemSuresi.yil, ay: kidemSuresi.ay, gun: kidemSuresi.gun, label: kidemSuresi.label },
        calismaSuresi: calismaSuresi.label,
        brut, 
        prim, 
        ikramiye, 
        yol, 
        yemek, 
        extras, 
        toplam 
      });
    }
  }, [toplam, diff, iseGiris, istenCikis, meslegeBaslangic, kidemSuresi, calismaSuresi, brut, prim, ikramiye, yol, yemek, extras]);

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
        <div className="flex items-center justify-end border-b border-gray-200 pb-2 mb-4">
          {headerAction}
        </div>
      )}
      
      {!hideEmploymentDates && (
        <>
          {/* İlk satır: Tarih alanları */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
                Mesleğe Başlangıç Tarihi <span className="text-gray-500" title="Basın mesleğine ilk başladığınız tarihi giriniz.">ℹ️</span>
              </div>
              <input 
                type="date" 
                value={meslegeBaslangic} 
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
                  setMeslegeBaslangic(value);
                }}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)) {
                    const newDate = new Date(newValue);
                    const exitDate = new Date(istenCikis);
                    if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                      error("Mesleğe başlangıç tarihi, işten çıkış tarihinden sonra olamaz.");
                    }
                  }
                }}
                className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
              />
            </div>

            <div>
              <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
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
              <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
                İşten Çıkış Tarihi <span className="text-gray-500" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
              </div>
              <input 
                type="date" 
                value={istenCikis} 
                onChange={(e) => {
                  setIstenCikis(e.target.value);
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
          </div>

          {/* İkinci satır: Süre alanları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
                Kıdem Süresi <span className="text-gray-500" title="Mesleğe başlangıç tarihinden işten çıkış tarihine kadar olan süre">ℹ️</span>
              </div>
              <input 
                disabled 
                value={kidemSuresi.label || "Mesleğe başlangıç tarihi giriniz"} 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" 
              />
            </div>
            
            <div>
              <div className="text-[13px] text-gray-700 font-medium mb-1 flex items-center gap-1">
                Çalışma Süresi <span className="text-gray-500" title="İşe giriş tarihinden işten çıkış tarihine kadar olan süre">ℹ️</span>
              </div>
              <input 
                disabled 
                value={calismaSuresi.label || "Tarihleri giriniz"} 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" 
              />
            </div>
          </div>
        </>
      )}

      <div className="space-y-4">
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
              <input disabled value="Prim" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={prim} onChange={(e) => setPrim(e.target.value)} placeholder="Örn: 2.500,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("prim", "Prim için eklenti hesapla", (v) => setPrim(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın prim değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setPrim("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="İkramiye" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={ikramiye} onChange={(e) => setIkramiye(e.target.value)} placeholder="Örn: 1.000,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("ikramiye", "İkramiye için eklenti hesapla", (v) => setIkramiye(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın ikramiye değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setIkramiye("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="Yol" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={yol} onChange={(e) => setYol(e.target.value)} placeholder="Örn: 500,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("yol", "Yol için eklenti hesapla", (v) => setYol(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın yol değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setYol("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input disabled value="Yemek" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700" />
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={yemek} onChange={(e) => setYemek(e.target.value)} placeholder="Örn: 1.200,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" />
                {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti("yemek", "Yemek için eklenti hesapla", (v) => setYemek(String(v.toFixed(2)).replace(".", ",")))}>Eklenti Hesapla <span className="text-orange-500 cursor-help ml-1" title="Son 12 ayın yemek değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span></button>}
              </div>
              <button type="button" onClick={() => setYemek("")} className="p-2 hover:bg-red-50 rounded-full text-red-500" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
            {extras.map((it) => (
              <div key={it.id} className="flex items-center gap-2">
                <input type="text" value={it.label} onChange={(e) => setExtra(it.id, { label: e.target.value })} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" placeholder="Kalem Adı" />
                <div className="flex-1 flex items-center gap-2">
                  <input type="text" value={it.value} onChange={(e) => setExtra(it.id, { value: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" placeholder="Tutar" />
                  {onRequestEklenti && <button type="button" className={btnEklenti} onClick={() => onRequestEklenti(`extra:${it.id}`, "Eklenti Hesapla", (v) => setExtra(it.id, { value: String(v.toFixed(2)).replace(".", ",") }))}>Eklenti Hesapla</button>}
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
          {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toplam)}₺
        </div>
      </div>
    </div>
  );
};

function IhbarBasinIndependentInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  
  const transferredData = (location.state as any)?.transferredFrom === "kidem" ? (location.state as any).data : null;
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("ihbar-basin");
  const { success, error: showToastError } = useToast();
  
  // Query parametrelerinden caseId'yi de kontrol et
  const caseIdFromQuery = searchParams.get('caseId');
  const effectiveId = id || caseIdFromQuery || undefined;
  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | number | null>(null);
  const [exitDate, setExitDate] = useState<string>("");
  const [formValues, setFormValues] = useState<any>(null);
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  // Hesaplamayı kaydet modalı
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

  // Kıdem süresi state'i (mesleğe başlangıçtan işten çıkışa)
  const [kidemSuresiState, setKidemSuresiState] = useState<{ yil: number; ay: number; gun: number }>({ yil: 0, ay: 0, gun: 0 });

  // formValues'tan kıdem süresini güncelle
  useEffect(() => {
    if (formValues?.kidemSuresi && typeof formValues.kidemSuresi === 'object') {
      setKidemSuresiState({
        yil: formValues.kidemSuresi.yil || 0,
        ay: formValues.kidemSuresi.ay || 0,
        gun: formValues.kidemSuresi.gun || 0
      });
    }
  }, [formValues?.kidemSuresi]);

  // Basın İş Kanunu: İhbar süresi sadece kıdeme göre (brütten bağımsız). 5+ yıl = 3 ay (90 gün), 5 yıldan az = 1 ay (30 gün).
  const basinIhbarDisplay = useMemo(() => {
    const yil = kidemSuresiState.yil ?? 0;
    const ay = kidemSuresiState.ay ?? 0;
    const gun = kidemSuresiState.gun ?? 0;
    const hasKidem = yil > 0 || ay > 0 || gun > 0;
    const ihbarGun = hasKidem ? (yil >= 5 ? 90 : 30) : 0;
    const ihbarSuresi = hasKidem ? (yil >= 5 ? "3 ay" : "1 ay") : "-";
    return { ihbarGun, ihbarSuresi, hasKidem };
  }, [kidemSuresiState.yil, kidemSuresiState.ay, kidemSuresiState.gun]);

  const [weeks, setWeeks] = useState(2);
  const [ihbarGun, setIhbarGun] = useState(0);
  const [ihbarAy, setIhbarAy] = useState(0);
  const [ihbarLabel, setIhbarLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [net, setNet] = useState(0);

  // YENİ RAPOR SİSTEMİ: State
  const [showNewIhbarBasinReportModal, setShowNewIhbarBasinReportModal] = useState(false);

  useEffect(() => {
    if (transferredData && !formValues) {
      setFormValues({
        brutUcret: transferredData.brutUcret || "",
        brut: transferredData.brutUcret || "",
        prim: transferredData.prim || "",
        ikramiye: transferredData.ikramiye || "",
        yol: transferredData.yol || "",
        yemek: transferredData.yemek || "",
        startDate: transferredData.iseGiris || "",
        exitDate: transferredData.istenCikis || "",
        iseGiris: transferredData.iseGiris || "",
        istenCikis: transferredData.istenCikis || "",
        extras: transferredData.extras || [],
        kidemSuresi: {
          yil: transferredData.totals?.yil || 0,
          ay: transferredData.totals?.ay || 0,
          gun: transferredData.totals?.gun || 0,
        }
      });
      if (transferredData.totals) {
        setTotals(transferredData.totals);
      }
      if (transferredData.istenCikis) {
        setExitDate(transferredData.istenCikis);
      }
      window.history.replaceState({}, document.title);
      success('Kıdem Tazminatından veriler aktarıldı');
    }
  }, [transferredData, formValues, success]);

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
          kidemTotals: kidemSuresiState, // Basın: ihbar süresi kıdeme göre (5+ yıl = 3 ay/90 gün, 5 yıldan az = 1 ay/30 gün)
          exitYear: selectedYear
        };
        const result = await apiPost('/api/ihbar/basin', requestData);
        if (result.ok) {
          const data = await result.json();
          if (data.success && data.data) {
            setWeeks(data.data.weeks || 2);
            setAmount(data.data.brut || 0);
            setGelirVergisi(data.data.gelirVergisi || 0);
            setGelirVergisiDilimleri(data.data.gelirVergisiDilimleri || "");
            setDamgaVergisi(data.data.damgaVergisi || 0);
            setNet(data.data.net || 0);
            setIhbarGun(0);
            setIhbarAy(0);
            setIhbarLabel("");
          }
        }
      } catch (error) {
        console.error("İhbar tazminatı hesaplama hatası:", error);
      }
    };
    const hasWorkPeriod = totals.yil > 0 || totals.ay > 0 || totals.gun > 0;
    const hasBrut = formValues && (formValues.brutUcret || formValues.brut);
    if (hasWorkPeriod && hasBrut) calculateFromBackend();
  }, [totals, selectedYear, formValues, kidemSuresiState]);

  const handleRequestEklenti = useCallback((fieldKey: string, title: string, apply: (v: number) => void) => {
    // Store the apply function for this field
    setApplyFunctions((prev) => ({ ...prev, [fieldKey]: apply }));
    // Initialize months array if not exists
    if (!eklentiValues[fieldKey]) {
      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
    }
    setActiveModal(fieldKey);
  }, [eklentiValues]);

  const handleApplyEklenti = useCallback((value: number, fieldKey: string) => {
    // Önce, formdan gelen apply fonksiyonunu kullanarak ilgili alanı güncelle
    if (applyFunctions[fieldKey]) {
      applyFunctions[fieldKey](value);
    }
    // field + value bilgisiyle birlikte appliedEklenti state'ini güncelle
    setAppliedEklenti({ field: fieldKey, value });
    setActiveModal(null);
  }, [applyFunctions]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  // YENİ RAPOR SİSTEMİ: Config
  const ihbarBasinReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const brutUcretNum = toNumber(formValues?.brut || formValues?.brutUcret || "0");
    const primNum = toNumber(formValues?.prim || "0");
    const ikramiyeNum = toNumber(formValues?.ikramiye || "0");
    const yolNum = toNumber(formValues?.yol || "0");
    const yemekNum = toNumber(formValues?.yemek || "0");
    const extrasTotal = (formValues?.extras || []).reduce((sum: number, ex: any) => sum + toNumber(ex.value), 0);
    const toplamBrutUcret = brutUcretNum + primNum + ikramiyeNum + yolNum + yemekNum + extrasTotal;
    
    const calismaSuresiLabel = `${totals.yil} Yıl ${totals.ay} Ay ${totals.gun} Gün`;
    // Basın İş Kanunu: 5 yıl ve üzeri kıdem = 3 ay (90 gün), 5 yıldan az = 1 ay (30 gün). Kıdem = mesleğe başlangıç → işten çıkış.
    const kidemYil = kidemSuresiState.yil ?? 0;
    const hasKidem = kidemYil > 0 || (kidemSuresiState.ay ?? 0) > 0 || (kidemSuresiState.gun ?? 0) > 0;
    const ihbarGunSayisi = hasKidem ? (kidemYil >= 5 ? 90 : 30) : 0;
    const ihbarSuresiLabel = hasKidem ? (kidemYil >= 5 ? "3 ay" : "1 ay") : "-";
    const gunlukUcret = toplamBrutUcret > 0 ? toplamBrutUcret / 30 : 0;
    // Brüt ihbar = günlük ücret × ihbar gün (formül ile hesaplanan; backend ile aynı olmalı)
    const hesaplananBrutIhbar = gunlukUcret * ihbarGunSayisi;

    // Brüt ücret detayları için custom section
    const brutUcretDetailsRows: [string, string][] = [
      ["Brüt Ücret", `${fmtLocal(brutUcretNum)}₺`],
    ];
    
    if (primNum > 0) brutUcretDetailsRows.push(["Prim", `${fmtLocal(primNum)}₺`]);
    if (ikramiyeNum > 0) brutUcretDetailsRows.push(["İkramiye", `${fmtLocal(ikramiyeNum)}₺`]);
    if (yemekNum > 0) brutUcretDetailsRows.push(["Yemek", `${fmtLocal(yemekNum)}₺`]);
    if (yolNum > 0) brutUcretDetailsRows.push(["Yol", `${fmtLocal(yolNum)}₺`]);
    
    (formValues?.extras || []).forEach((ex: any) => {
      if (toNumber(ex.value) > 0) {
        brutUcretDetailsRows.push([ex.label || "Ekstra", `${fmtLocal(toNumber(ex.value))}₺`]);
      }
    });
    
    brutUcretDetailsRows.push(["TOPLAM BRÜT ÜCRET", `${fmtLocal(toplamBrutUcret)}₺`]);

    // Sayfadaki mor kutu ile aynı format (avukat formatı): Kıdem Süresi, İhbar Süresi, Hesaplama, Tutar + açıklama
    const kidemLabel = kidemYil > 0 || hasKidem ? `${kidemSuresiState.yil} yıl ${kidemSuresiState.ay} ay ${kidemSuresiState.gun} gün` : "-";
    const hesaplamaStr = ihbarGunSayisi > 0 ? `(${fmtLocal(toplamBrutUcret)}₺ / 30 × ${ihbarGunSayisi} gün)` : "-";

    return {
      title: "Basın İşçileri İhbar Tazminatı",
      sections: {
        info: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "İşe Giriş", value: formValues?.iseGiris ? new Date(formValues.iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış", value: formValues?.istenCikis ? new Date(formValues.istenCikis).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Süresi", value: calismaSuresiLabel },
        { label: "İhbar Süresi", value: ihbarSuresiLabel },
      ],
      customSections: [
        {
          title: "Brüt Ücret Detayı",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px' }}>
              <tbody>
                {brutUcretDetailsRows.map(([label, value], idx) => {
                  const isTotal = idx === brutUcretDetailsRows.length - 1;
                  return (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: isTotal ? '#f3f4f6' : '#f9fafb', fontWeight: isTotal ? 600 : 400, width: '30%' }}>{label}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ),
        },
        {
          title: "İhbar Tazminatı Hesaplaması",
          content: (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px' }}>
                <tbody>
                  <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600, width: '30%' }}>Kıdem Süresi</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{kidemLabel}</td></tr>
                  <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>İhbar Süresi</td><td style={{ border: '1px solid #999', padding: '5px 8px' }}>{ihbarSuresiLabel}</td></tr>
                  <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600 }}>Hesaplama</td><td style={{ border: '1px solid #999', padding: '5px 8px', fontVariantNumeric: 'tabular-nums' }}>{hesaplamaStr}</td></tr>
                  <tr><td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f3f4f6', fontWeight: 600 }}>Toplam İhbar Tazminatı</td><td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtLocal(hesaplananBrutIhbar)}₺</td></tr>
                </tbody>
              </table>
              <p style={{ fontSize: '9px', color: '#6b7280', margin: '8px 0 0', lineHeight: 1.35 }}>Basın İş Kanunu'na göre: 5 yıl ve üzeri kıdem için 3 ay, 5 yıl altı kıdem için 1 ay ihbar süresi uygulanır.</p>
            </>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        fontSize: "10px",
        rows: [
          { label: "Brüt İhbar Tazminatı", value: `${fmtLocal(amount)}₺` },
          { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmtLocal(gelirVergisi)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)}₺`, isDeduction: true },
          { label: "Net İhbar Tazminatı", value: `${fmtLocal(net)}₺`, isNet: true },
        ],
      },
    };
  }, [amount, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, net, formValues, totals, kidemSuresiState]);

  // Bölüm bazlı Word tabloları (Ihbar30 / IhbarGemi ile aynı yapı, Basın özel alanları ile)
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
    const kidemYil = kidemSuresiState.yil ?? 0;
    const hasKidem = kidemYil > 0 || (kidemSuresiState.ay ?? 0) > 0 || (kidemSuresiState.gun ?? 0) > 0;
    const ihbarGunSayisi = hasKidem ? (kidemYil >= 5 ? 90 : 30) : 0;
    const ihbarSuresiLabel = hasKidem ? (kidemYil >= 5 ? "3 ay" : "1 ay") : "-";
    const kidemLabel = kidemYil > 0 || hasKidem ? `${kidemSuresiState.yil} yıl ${kidemSuresiState.ay} ay ${kidemSuresiState.gun} gün` : "-";
    const hesaplamaStr = ihbarGunSayisi > 0 ? `(${fmt(toplamBrutUcret)} / 30 × ${ihbarGunSayisi} gün)` : "-";
    const fmtCurrency = (n: number) => `${fmt(n)}₺`;
    const iseGirisTarihi = formValues?.iseGiris || formValues?.startDate || "";
    const istenCikisTarihi = formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || "";

    const n1 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: [
        ["Tarih", new Date().toLocaleDateString("tr-TR")],
        ["İşe Giriş", iseGirisTarihi ? new Date(iseGirisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["İşten Çıkış", istenCikisTarihi ? new Date(istenCikisTarihi).toLocaleDateString("tr-TR") : "-"],
        ["Çalışma Süresi", calismaSuresiLabel || "-"],
        ["İhbar Süresi", ihbarSuresiLabel],
      ],
    });
    sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Brüt Ücret", value: fmtCurrency(brutUcretNum) },
    ];
    if (primNum > 0) bilesenData.push({ label: "Prim", value: fmtCurrency(primNum) });
    if (ikramiyeNum > 0) bilesenData.push({ label: "İkramiye", value: fmtCurrency(ikramiyeNum) });
    if (yemekNum > 0) bilesenData.push({ label: "Yemek", value: fmtCurrency(yemekNum) });
    if (yolNum > 0) bilesenData.push({ label: "Yol", value: fmtCurrency(yolNum) });
    (formValues?.extras || []).forEach((ex: any) => {
      if (toNumber(ex.value) > 0) bilesenData.push({ label: ex.label || "Ekstra", value: fmtCurrency(toNumber(ex.value)) });
    });
    bilesenData.push({ label: "TOPLAM BRÜT ÜCRET", value: fmtCurrency(toplamBrutUcret) });
    const n2 = adaptToWordTable(bilesenData);
    sections.push({ id: "ucret-bilesenleri", title: "Ücret Bileşenleri", html: buildWordTable(n2.headers, n2.rows) });

    const ihbarRows: { label: string; value: string }[] = [
      { label: "Kıdem Süresi", value: kidemLabel },
      { label: "İhbar Süresi", value: ihbarSuresiLabel },
      { label: "Hesaplama", value: hesaplamaStr },
      { label: "Toplam İhbar Tazminatı", value: fmtCurrency(amount ?? 0) },
    ];
    const n3 = adaptToWordTable(ihbarRows);
    sections.push({ id: "ihbar-tazminati", title: "İhbar Tazminatı Hesaplaması", html: buildWordTable(n3.headers, n3.rows) });

    const grossNetRows = ihbarBasinReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n4 = adaptToWordTable(grossNetRows);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    return sections;
  }, [formValues, amount, totals, kidemSuresiState, ihbarBasinReportConfig]);

  const handlePrint = useCallback(() => {
    if (USE_NEW_IHBAR_BASIN_REPORT) {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) {
        window.print();
        return;
      }
      const title = ihbarBasinReportConfig.title;
      const contentHtml = targetEl.innerHTML;
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
<body>${contentHtml}</body>
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
  }, [ihbarBasinReportConfig.title]);

  const handleSave = useCallback(async (kayitAdi: string) => {
    if (!amount || amount <= 0) {
      showToastError("Lütfen geçerli bir hesaplama yapın");
      return;
    }

    const iseGiris = formValues?.iseGiris || formValues?.startDate || null;
    const istenCikis = formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || null;
    const formDataWithExtras = {
      ...(formValues || {}),
      extras: formValues?.extras || []
    };
    const veri = {
      data: {
        form: formDataWithExtras,
        results: { totals, brut: amount, net }
      },
      ise_giris: iseGiris,
      isten_cikis: istenCikis,
      brut_total: Number(amount.toFixed(2)),
      net_total: Number(net.toFixed(2)),
      start_date: iseGiris,
      end_date: istenCikis,
      total: Number(amount.toFixed(2)),
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
          meslegeBaslangic: formData?.meslegeBaslangic || '',
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
  const memoizedInitialMeslegeBaslangic = useMemo(() => formValues?.meslegeBaslangic || "", [formValues?.meslegeBaslangic]);
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
              initialMeslegeBaslangic={memoizedInitialMeslegeBaslangic}
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

            {/* İçe Aktar Modal */}
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
                <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30"><span className="text-gray-700 dark:text-gray-300">Kıdem Süresi:</span> <span className="font-semibold text-gray-900 dark:text-gray-100">{kidemSuresiState.yil > 0 || kidemSuresiState.ay > 0 || kidemSuresiState.gun > 0 ? `${kidemSuresiState.yil} yıl ${kidemSuresiState.ay} ay ${kidemSuresiState.gun} gün` : "Mesleğe başlangıç tarihi giriniz"}</span></p>
                <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30"><span className="text-gray-700 dark:text-gray-300">İhbar Süresi:</span> <span className="font-semibold text-gray-900 dark:text-gray-100">{basinIhbarDisplay.ihbarSuresi}</span></p>
                <p className="flex items-center justify-between py-2 border-b border-purple-200 dark:border-purple-800/30"><span className="text-gray-700 dark:text-gray-300">Hesaplama:</span> <span className="font-medium text-gray-900 dark:text-gray-100">({fmt(totals.toplam || 0)}₺ / 30 × {basinIhbarDisplay.ihbarGun} gün)</span></p>
                <p className="flex items-center justify-between pt-2"><span className="text-gray-900 dark:text-gray-100 font-semibold">Toplam İhbar Tazminatı:</span> <span className="font-bold text-lg text-purple-700 dark:text-purple-400">{basinIhbarDisplay.hasKidem && basinIhbarDisplay.ihbarGun > 0 ? fmt((totals.toplam || 0) / 30 * basinIhbarDisplay.ihbarGun) : fmt(amount)}₺</span></p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-3 bg-purple-100 dark:bg-purple-900/30 p-2 rounded">Basın İş Kanunu'na göre: 5 yıl ve üzeri kıdem için 3 ay, 5 yıl altı kıdem için 1 ay ihbar süresi uygulanır.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 leading-relaxed">
                  Basın İş Kanununda İhbar Tazminatı uygulaması bulunmadığı, İhbar için belirlenen süre de Basın işçisine süregelen ücretin ödendiği ve Kıdem tazminatı hesaplamasında dikkate alınması zorunlu süre hesaplaması bakımından örnek niteliğinde İhbar süresi içinde basın işçisinin alacağı ücret hesaplaması yapılmıştır.
                </p>
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
                  
                  // HEADING: ile başlayan satırlar başlık
                  if (item.startsWith("HEADING:")) {
                    const headingText = item.replace("HEADING:", "");
                    return <p key={index} className="font-bold text-slate-800 dark:text-slate-200 mt-4 first:mt-0">{headingText}</p>;
                  }
                  
                  // Madde ile başlayanlar
                  if (item.startsWith("Madde")) {
                    return <p key={index} className="font-medium">{item}</p>;
                  }
                  
                  // Diğer paragraflar
                  return <p key={index}>{item}</p>;
                })}
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>

      {/* YENİ RAPOR SİSTEMİ: BaseReportModal */}
      {USE_NEW_IHBAR_BASIN_REPORT && (
        <BaseReportModal
          open={showNewIhbarBasinReportModal}
          onClose={() => setShowNewIhbarBasinReportModal(false)}
          config={ihbarBasinReportConfig}
        />
      )}

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSaveClick}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: PRINT_TITLE,
          buttonClassName: "bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-3 md:py-2 rounded-md transition w-full md:w-auto flex items-center justify-center gap-1.5 sm:gap-2",
          buttonIcon: <Eye className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />,
          copyTargetId: "ihbar-basin-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ihbar-basin-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; }
                #ihbar-basin-word-copy td { border: 1px solid #999; padding: 6px 8px; }
              `}</style>
              <div id="ihbar-basin-word-copy">
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
      {USE_NEW_IHBAR_BASIN_REPORT && (
        <div id="report-content" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
          <ReportContentFromConfig config={ihbarBasinReportConfig} />
        </div>
      )}
      <SaveCalculationNameModal
        open={showSaveNameModal}
        onClose={() => { setShowSaveNameModal(false); setSaveNameInput(""); }}
        value={saveNameInput}
        onChange={setSaveNameInput}
        onSave={(name) => handleSave(name)}
        saving={isSaving}
        onEmptyName={() => showToastError("Lütfen bir isim girin")}
        placeholder="Örn: Basın İşçisi İhbar Tazminatı"
        inputId="save-calculation-name-basin"
      />
      <Toaster />
        </div>
      </div>
    </div>
  );
}

export default function IhbarBasinIndependent() {
  return (
    <ToastProvider>
      <IhbarBasinIndependentInner />
    </ToastProvider>
  );
}
