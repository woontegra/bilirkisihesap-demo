import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";
import FooterActions from "@/components/FooterActions";
import Layout from "@/components/Layout";
import EklentiModal from "../../is-tazminati/EklentiModal";
import { API_BASE_URL, apiPost } from "@/utils/apiClient";
// Constants - inline (Parça Başı)
const NOTE_ITEMS: string[] = ["Süreli fesih", "", "Madde 17 - Belirsiz süreli iş sözleşmelerinin feshinden önce durumun diğer tarafa bildirilmesi gerekir.", "", "İş sözleşmeleri;", "", "a) İşi altı aydan az sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak iki hafta sonra,", "", "b) İşi altı aydan birbuçuk yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak dört hafta sonra,", "", "c) İşi birbuçuk yıldan üç yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak altı hafta sonra,", "", "d) İşi üç yıldan fazla sürmüş işçi için, bildirim yapılmasından başlayarak sekiz hafta sonra,", "", "feshedilmiş sayılır.", "", "Bu süreler asgari olup sözleşmeler ile artırılabilir.", "", "Bildirim şartına uymayan taraf, bildirim süresine ilişkin ücret tutarında tazminat ödemek zorundadır.", "", "İşveren bildirim süresine ait ücreti peşin vermek suretiyle iş sözleşmesini feshedebilir."];
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const SAVE_TYPE = "İhbar Tazminatı";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Parça Başı Çalışanlar İhbar Tazminatı";
const PRINT_TITLE = "Parça Başı Çalışanlar İhbar Tazminatı";
const PRINT_HEADING = "Parça Başı Çalışanlar İhbar Tazminatı";
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const toNumber = (value: string) => Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;
import "@/styles/soft-glow.css";

type ExtraItem = { id: string; label: string; value: string };

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
}) => {
  const [iseGiris, setIseGiris] = useState(initialIseGiris);
  const [istenCikis, setIstenCikis] = useState(initialIstenCikis);
  const [brut, setBrut] = useState(initialBrut || "");
  const [prim, setPrim] = useState(initialPrim || "");
  const [ikramiye, setIkramiye] = useState(initialIkramiye || "");
  const [yol, setYol] = useState(initialYol || "");
  const [yemek, setYemek] = useState(initialYemek || "");
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const { error } = useToast();

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
      {!hideEmploymentDates && (
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
              className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
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
              className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
            />
          </div>
          
          <div>
            <div className="text-[13px] text-gray-700 font-medium mb-1">Çalışma Süresi</div>
            <input 
              disabled 
              value={diff.label} 
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm" 
            />
          </div>
        </div>
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
            className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
          />
          {asgariHataMessage && (
            <p className="text-xs text-red-600 mt-1">{asgariHataMessage}</p>
          )}
          <div className="text-gray-600 text-sm font-medium mt-2">
            Ekstra Hesaplamalar (Prim, İkramiye, Yol, Yemek vb.)
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] text-gray-700 font-medium">Prim</div>
              {onRequestEklenti && (
<button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => onRequestEklenti?.("prim", "Prim için eklenti hesapla", (v) => setPrim(String(v.toFixed(2)).replace('.', ',')))}
              >
                Eklenti Hesapla
                <span className="text-orange-500 hover:text-orange-600 cursor-help" title="Son 12 ayın prim değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
              </button>
              )}
            </div>
            <input 
              type="text"
              value={prim} 
              onChange={(e) => setPrim(e.target.value)} 
              placeholder="Örn: 2.500,00" 
              className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] text-gray-700 font-medium">İkramiye</div>
              {onRequestEklenti && (
<button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => onRequestEklenti?.("ikramiye", "İkramiye için eklenti hesapla", (v) => setIkramiye(String(v.toFixed(2)).replace('.', ',')))}
              >
                Eklenti Hesapla
                <span className="text-orange-500 hover:text-orange-600 cursor-help" title="Son 12 ayın ikramiye değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
              </button>
              )}
            </div>
            <input 
              type="text"
              value={ikramiye} 
              onChange={(e) => setIkramiye(e.target.value)} 
              placeholder="Örn: 1.000,00" 
              className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] text-gray-700 font-medium">Yol</div>
              {onRequestEklenti && (
<button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => onRequestEklenti?.("yol", "Yol için eklenti hesapla", (v) => setYol(String(v.toFixed(2)).replace('.', ',')))}
              >
                Eklenti Hesapla
                <span className="text-orange-500 hover:text-orange-600 cursor-help" title="Son 12 ayın yol değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
              </button>
              )}
            </div>
            <input 
              type="text"
              value={yol} 
              onChange={(e) => setYol(e.target.value)} 
              placeholder="Örn: 500,00" 
              className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] text-gray-700 font-medium">Yemek</div>
              {onRequestEklenti && (
<button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => onRequestEklenti?.("yemek", "Yemek için eklenti hesapla", (v) => setYemek(String(v.toFixed(2)).replace('.', ',')))}
              >
                Eklenti Hesapla
                <span className="text-orange-500 hover:text-orange-600 cursor-help" title="Son 12 ayın yemek değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
              </button>
              )}
            </div>
            <input 
              type="text"
              value={yemek} 
              onChange={(e) => setYemek(e.target.value)} 
              placeholder="Örn: 1.200,00" 
              className="w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-sm" 
            />
          </div>
        </div>
      </div>

      {/* Extras */}
      <div className="space-y-2 mt-4">
        {extras.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <input
              type="text"
              value={it.label}
              onChange={(e) => setExtra(it.id, { label: e.target.value })}
              className="w-40 sm:w-56 rounded-md bg-white border border-gray-300 px-2 py-1 text-sm"
              placeholder="Kalem Adı"
            />
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={it.value}
                onChange={(e) => setExtra(it.id, { value: e.target.value })}
                className="flex-1 rounded-md bg-white border border-gray-300 px-2 py-1 text-sm"
                placeholder="Tutar"
              />
              {onRequestEklenti && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                  onClick={() =>
                    onRequestEklenti?.(
                      `extra:${it.id}`,
                      "Eklenti Hesapla",
                      (v) => setExtra(it.id, { value: String(v.toFixed(2)).replace(".", ",") })
                    )
                  }
                >
                  Eklenti Hesapla
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeExtra(it.id)}
              className="text-red-500 hover:text-red-700 text-lg leading-none"
              aria-label="Satırı Sil"
            >
              –
            </button>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button 
            onClick={addExtra} 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            + Ekle
          </button>
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

export default function IhbarParcaIndependent() {
  const { success, error } = useToast();
  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | number | null>(null);
  const [exitDate, setExitDate] = useState<string>("");
  const [formValues, setFormValues] = useState<any>(null);
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
        const result = await apiPost('/api/ihbar/parca', requestData);
        if (result.success && result.data) {
          setWeeks(result.data.weeks || 2);
          setAmount(result.data.brut || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNet(result.data.net || 0);
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

  const handlePrint = () => {
    window.print();
  };

  const handleSave = useCallback(async () => {
    if (!amount || amount <= 0) {
      error("Lütfen geçerli bir hesaplama yapın");
      return;
    }

    try {
      setIsSaving(true);
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      // Extras'ı payload'a ekle
      const payload = {
        tenant_id: tenantId,
        type: SAVE_TYPE,
        brut_total: Number(amount.toFixed(2)),
        net_total: Number(net.toFixed(2)),
        data: {
          form: {
            ...(formValues || {}),
            extras: formValues?.extras || []
          },
          results: {
            totals,
            brut: amount,
            net: net
          }
        }
      };
      const res = await fetch(SAVE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save_failed");
      success("Hesaplama başarıyla kaydedildi.");
    } catch (e) {
      error("Hesaplama kaydedilirken bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  }, [amount, net, success, error, formValues, totals]);

  const location = useLocation();
  const pathname = location.pathname;
  const navState = (location.state as any) || {};

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  // Reset form when pathname changes
  useEffect(() => {
    setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
    setAppliedEklenti(null);
    setExitDate("");
    setFormValues(null);
    setActiveModal(null);
    setEklentiValues({
      prim: Array(12).fill(""),
      ikramiye: Array(12).fill(""),
      yol: Array(12).fill(""),
      yemek: Array(12).fill(""),
    });
    setApplyFunctions({});
  }, [pathname]);
  const initialBrut = useMemo(() => {
    try {
      if (navState?.brutUcret) return String(navState.brutUcret);
      const search = new URLSearchParams(location.search);
      const fromQuery = Number(search.get("toplamTutar") || "");
      const fromState = navState?.toplamTutar;
      const val = Number(isNaN(fromQuery) ? fromState : fromQuery);
      if (!val || !isFinite(val)) return undefined;
      return String(val.toFixed(2)).replace(".", ",");
    } catch { return undefined; }
  }, [location.search, location.state, navState]);

  return (
    <Layout hideHeader={true} fluid={true} pageKey="ihbar-tazminati" noBackgroundColor={true}>
      <div className="min-h-screen page-background bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div id="ihbar-print" className="w-full max-w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol taraf - Form ve Hesaplamalar */}
          <div className="lg:col-span-2 space-y-4">
            <IhbarTazminatiForm
              key={pathname}
              onTotalsChange={setTotals}
              appliedEklenti={appliedEklenti}
              onRequestEklenti={handleRequestEklenti}
              initialBrut={initialBrut}
              initialIseGiris={navState?.iseGiris}
              initialIstenCikis={navState?.istenCikis}
              initialPrim={navState?.prim}
              initialIkramiye={navState?.ikramiye}
              initialYol={navState?.yol}
              initialYemek={navState?.yemek}
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

            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">İhbar Tazminatı</h3>
              <div className="text-sm sm:text-base space-y-1">
                <p className="flex items-center justify-between"><span>İhbar Süresi:</span> <span className="font-medium">{weeks} hafta</span></p>
                <p className="flex items-center justify-between"><span>Günlük Ücret (Toplam/30):</span> <span className="font-medium">({fmt(totals.toplam || 0)} ₺ / 30 × {weeks} × 7)</span></p>
                <hr className="my-2" />
                <p className="flex items-center justify-between"><span>Toplam İhbar Tazminatı:</span> <span className="font-semibold text-gray-900">{fmt(amount)} ₺</span></p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">İş Kanunu madde 17'ye göre hesaplanan ihbar süresi esas alınmıştır.</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Brüt'ten Net'e Çeviri</h3>
              <div className="space-y-1 text-sm sm:text-base">
                <p className="flex items-center justify-between"><span>Brüt İhbar Tazminatı:</span> <span className="font-medium">{fmt(amount)} ₺</span></p>
                <p className="flex items-center justify-between"><span>Gelir Vergisi {gelirVergisiDilimleri}:</span> <span className="font-medium text-red-600">-{fmt(gelirVergisi)} ₺</span></p>
                <p className="flex items-center justify-between"><span>Damga Vergisi (binde 7,59):</span> <span className="font-medium text-red-600">-{fmt(damgaVergisi)} ₺</span></p>
                <hr className="my-2" />
                <p className="flex items-center justify-between"><span>Net İhbar Tazminatı:</span> <span className="font-semibold text-green-700">{fmt(net)} ₺</span></p>
              </div>
            </div>
            
          </div>
          
          {/* Sağ taraf - Notlar Bölümü */}
          <div className="space-y-6">
            <div className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
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
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {NOTE_ITEMS.map((item, index) => {
                    if (item === "") return <br key={index} />;
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
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "İhbar Tazminatı",
          copyTargetId: "calc-table",
          renderContent: () => {
            const calismaSuresiLabel = `${totals.yil} Yıl ${totals.ay} Ay ${totals.gun} Gün`;
            const brutUcretNum = toNumber(formValues?.brut || "0");
            const primNum = toNumber(formValues?.prim || "0");
            const ikramiyeNum = toNumber(formValues?.ikramiye || "0");
            const yolNum = toNumber(formValues?.yol || "0");
            const yemekNum = toNumber(formValues?.yemek || "0");
            const extrasTotal = (formValues?.extras || []).reduce((sum: number, ex: any) => sum + toNumber(ex.value), 0);
            const toplamBrutUcret = brutUcretNum + primNum + ikramiyeNum + yolNum + yemekNum + extrasTotal;

            return (
              <div style={{fontFamily:'Inter, Arial, sans-serif', color:'#111827'}}>
                <div style={{fontSize:18, fontWeight:700, marginBottom:12}}>İhbar Tazminatı Hesap Özeti</div>
                
                <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #d1d5db', fontSize:13, marginBottom:12}}>
                  <thead style={{background:'#f3f4f6'}}>
                    <tr>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'left'}}>Alan</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'left'}}>Değer</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İşe Giriş</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{formValues?.iseGiris || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İşten Çıkış</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{formValues?.istenCikis || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Çalışma Süresi</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{calismaSuresiLabel}</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İhbar Süresi</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{weeks} hafta</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{fontSize:18, fontWeight:700, marginBottom:12, marginTop:16}}>Ücret Bileşenleri</div>
                <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #d1d5db', fontSize:13, marginBottom:12}}>
                  <thead style={{background:'#f3f4f6'}}>
                    <tr>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'left'}}>Ücret Kalemi</th>
                      <th style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Çıplak Brüt</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(brutUcretNum)}</td>
                    </tr>
                    {primNum > 0 && (
                      <tr>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Prim</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(primNum)}</td>
                      </tr>
                    )}
                    {ikramiyeNum > 0 && (
                      <tr>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İkramiye</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(ikramiyeNum)}</td>
                      </tr>
                    )}
                    {yemekNum > 0 && (
                      <tr>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Yemek</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(yemekNum)}</td>
                      </tr>
                    )}
                    {yolNum > 0 && (
                      <tr>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Yol</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(yolNum)}</td>
                      </tr>
                    )}
                    {(formValues?.extras || []).map((ex: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>{ex.label || `Ekstra ${idx + 1}`}</td>
                        <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(toNumber(ex.value))}</td>
                      </tr>
                    ))}
                    <tr style={{background:'#f3f4f6', fontWeight:600}}>
                      <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Toplam Brüt Ücret</td>
                      <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>{fmt(toplamBrutUcret)}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{fontSize:18, fontWeight:700, marginBottom:12, marginTop:16}}>Brütten Nete Çeviri</div>
                <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #d1d5db', fontSize:13}}>
                  <tbody>
                    <tr style={{background:'#f3f4f6', fontWeight:600}}>
                      <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Brüt İhbar Tazminatı</td>
                      <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>{fmt(amount)} ₺</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Gelir Vergisi {gelirVergisiDilimleri}</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(gelirVergisi)} ₺</td>
                    </tr>
                    <tr>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Damga Vergisi (binde 7,59)</td>
                      <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>{fmt(damgaVergisi)} ₺</td>
                    </tr>
                    <tr style={{background:'#dcfce7', fontWeight:600, color:'#16a34a'}}>
                      <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Net İhbar Tazminatı</td>
                      <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>{fmt(net)} ₺</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          },
        }}
      />
      </div>
    </Layout>
  );
}
