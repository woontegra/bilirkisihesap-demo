import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import FooterActions from "@/components/FooterActions";
import Layout from "@/components/Layout";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { API_BASE_URL } from "@/utils/apiClient";
import { Button } from "@/components/ui/button";
import { Plus, Youtube, Copy } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";
// Constants - inline
const NOTE_ITEMS: string[] = [
  "İş Arama İzni Ücreti",
  "",
  "• İşveren tarafından süreli fesihte, ihbar öneli süresince işçiye günde en az 2 saat iş arama izni verilmesi zorunludur.",
  "",
  "• İşçiye iş arama izni verilmezse, işveren bu süreye ait ücret tutarını ödemekle yükümlüdür.",
  "",
  "• İhbar süreleri İş Kanunu Madde 17'ye göre belirlenir.",
  "",
  "Yeni iş arama izni",
  "",
  "Madde 27-",
  "",
  "• Bildirim süreleri içinde işveren, işçiye yeni bir iş bulması için gerekli olan iş arama iznini iş saatleri içinde ve ücret kesintisi yapmadan vermeye mecburdur. İş arama izninin süresi günde iki saatten az olamaz ve işçi isterse iş arama izin saatlerini birleştirerek toplu kullanabilir. Ancak iş arama iznini toplu kullanmak isteyen işçi, bunu işten ayrılacağı günden evvelki günlere rastlatmak ve bu durumu işverene bildirmek zorundadır.",
  "",
  "• İşveren yeni iş arama iznini vermez veya eksik kullandırırsa o süreye ilişkin ücret işçiye ödenir.",
  "",
  "• İşveren, iş arama izni esnasında işçiyi çalıştırır ise işçinin izin kullanarak bir çalışma karşılığı olmaksızın alacağı ücrete ilaveten, çalıştırdığı sürenin ücretini yüzde yüz zamlı öder.",
];
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const LOAD_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const SAVE_TYPE = "is_arama_izni";
const REDIRECT_BASE_PATH = "/is-arama-izni-ucreti";
const DOCUMENT_TITLE = "Mercan Danışmanlık | İş Arama İzni Ücreti";
const PRINT_TITLE = "İş Arama İzni Ücreti";
const PRINT_HEADING = "İŞ ARAMA İZNİ ÜCRETİ HESAPLAMA";

// Helper functions - inline
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const toNumber = (value: string) =>
  Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;

// Günlük çalışma saati - Standart iş günü 7.5 saattir
const getGunlukCalismaSaati = (haftalikCalismaGunu: number): number => {
  // İş Kanunu'na göre standart günlük çalışma süresi 7.5 saattir
  // (Haftalık 45 saat / 6 gün = 7.5 saat)
  return 7.5;
};

// İki tarih arası çalışma günlerini hesapla (hafta tatili hariç)
const calculateWorkDays = (startDate: string, endDate: string, haftalikCalismaGunu: number): number => {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return 0;
  }
  
  let workDays = 0;
  const current = new Date(start);
  
  // Haftalık çalışma gününe göre hangi günler çalışma günü
  // 5 gün: Pazartesi-Cuma (1-5)
  // 6 gün: Pazartesi-Cumartesi (1-6)
  const workDayMap: { [key: number]: number[] } = {
    5: [1, 2, 3, 4, 5], // Pazartesi-Cuma
    6: [1, 2, 3, 4, 5, 6], // Pazartesi-Cumartesi
    7: [0, 1, 2, 3, 4, 5, 6], // Tüm günler
  };
  
  const validWorkDays = workDayMap[haftalikCalismaGunu] || workDayMap[5];
  
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
    if (validWorkDays.includes(dayOfWeek)) {
      workDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workDays;
};

import "@/styles/soft-glow.css";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// Kullandırılmış izin türleri
interface TarihAralikDusum {
  id: string;
  baslangic: string;
  bitis: string;
  gunlukSaat: string;
}

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

const IsAramaForm = ({
  onTotalsChange,
  onExitDateChange,
  onValuesChange,
  initialBrut,
  hideEmploymentDates = false,
  initialIseGiris = "",
  initialIstenCikis = "",
  headerAction,
}: {
  onTotalsChange: (totals: { toplam: number; yil: number; ay: number; gun: number }) => void;
  onExitDateChange?: (date: string) => void;
  onValuesChange?: (values: any) => void;
  initialBrut?: string;
  hideEmploymentDates?: boolean;
  initialIseGiris?: string;
  initialIstenCikis?: string;
  headerAction?: React.ReactNode;
}) => {
  const [iseGiris, setIseGiris] = useState(initialIseGiris);
  const [istenCikis, setIstenCikis] = useState(initialIstenCikis);
  const [brut, setBrut] = useState(initialBrut || "");
  const [haftalikCalismaGunu, setHaftalikCalismaGunu] = useState("5");
  const { error } = useToast();

  // Asgari ücret kontrolü
  const asgariUcretHatasi = useMemo(() => {
    if (!istenCikis || !brut) return null;
    
    const minUcret = getAsgariUcretByDate(istenCikis);
    if (!minUcret) return null;
    
    const brutValue = toNumber(brut);
    if (!brutValue || brutValue === 0) return null;
    
    if (brutValue < minUcret) {
      const year = new Date(istenCikis).getFullYear();
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${fmt(minUcret)}₺).`;
    }
    
    return null;
  }, [istenCikis, brut]);

  // çalışma süresi hesaplama (bilirkişi yöntemi)
  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  const toplam = useMemo(() => {
    const result = toNumber(brut);
    console.log("[İş Arama Form] brut:", brut, "→ toplam:", result);
    return result;
  }, [brut]);

  // Ref to store previous values to prevent infinite loop
  const prevValuesRef = useRef<any>(null);

  // Prefill values if provided via initial props
  useEffect(() => {
    if (initialBrut) {
      setBrut(initialBrut);
    }
  }, [initialBrut]);

  useEffect(() => {
    if (initialIseGiris) {
      setIseGiris(initialIseGiris);
    }
  }, [initialIseGiris]);

  useEffect(() => {
    if (initialIstenCikis) {
      setIstenCikis(initialIstenCikis);
    }
  }, [initialIstenCikis]);

  // Update parent with totals and values
  useEffect(() => {
    const totalsData = { toplam, yil: diff.yil, ay: diff.ay, gun: diff.gun };
    console.log("[İş Arama Form] onTotalsChange çağrılıyor:", totalsData);
    onTotalsChange(totalsData);
    
    if (onValuesChange) {
      const newValues = {
        iseGiris,
        istenCikis,
        brut,
        brutUcret: brut,  // Backend için hem brut hem brutUcret olarak ekle
        haftalikCalismaGunu,
        toplam
      };

      // Sonsuz döngüyü engelle: önceki değer ile yeni değer aynıysa setState tetikleme
      const prevValues = prevValuesRef.current;
      if (prevValues && JSON.stringify(prevValues) === JSON.stringify(newValues)) {
        return; // Değişiklik yok → onValuesChange çağırma
      }

      // Değişiklik varsa güncelle
      prevValuesRef.current = newValues;
      onValuesChange(newValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toplam, diff.yil, diff.ay, diff.gun, iseGiris, istenCikis, brut, haftalikCalismaGunu]);

  // Handle exit date change
  useEffect(() => {
    if (onExitDateChange && istenCikis) {
      onExitDateChange(istenCikis);
    }
  }, [istenCikis, onExitDateChange]);

  return (
    <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
        <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">İŞ ARAMA İZNİ ÜCRETİ HESAPLAMA</div>
        {headerAction && <div>{headerAction}</div>}
      </div>
      
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
                const value = e.target.value;
                if (value && value.includes('-')) {
                  const parts = value.split('-');
                  if (parts[0] && parts[0].length > 4) {
                    parts[0] = parts[0].substring(0, 4);
                    e.target.value = parts.join('-');
                    setIseGiris(e.target.value);
                    return;
                  }
                }
                setIseGiris(value);
              }}
              onBlur={(e) => {
                const newValue = e.target.value;
                // Sadece input'tan çıkıldığında ve tam tarih girildiğinde validasyon yap
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)) {
                  const newDate = new Date(newValue);
                  const exitDate = new Date(istenCikis);
                  if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                    error("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                    // Hatalı değeri geri al
                    setIseGiris(istenCikis);
                  }
                }
              }}
              className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3" 
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
                const value = e.target.value;
                if (value && value.includes('-')) {
                  const parts = value.split('-');
                  if (parts[0] && parts[0].length > 4) {
                    parts[0] = parts[0].substring(0, 4);
                    e.target.value = parts.join('-');
                    setIstenCikis(e.target.value);
                    if (onExitDateChange) onExitDateChange(e.target.value);
                    return;
                  }
                }
                setIstenCikis(value);
                if (onExitDateChange) onExitDateChange(value);
              }}
              onBlur={(e) => {
                const newValue = e.target.value;
                // Sadece input'tan çıkıldığında ve tam tarih girildiğinde validasyon yap
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(iseGiris)) {
                  const newDate = new Date(newValue);
                  const entryDate = new Date(iseGiris);
                  if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                    error("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                    // Hatalı değeri geri al
                    setIstenCikis(iseGiris);
                    if (onExitDateChange) onExitDateChange(iseGiris);
                  }
                }
              }}
              className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3" 
            />
          </div>
          
          <div>
            <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1">Çalışma Süresi</div>
            <input 
              disabled 
              value={diff.label} 
              className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3" 
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
            value={brut} 
            onChange={(e) => setBrut(e.target.value)} 
            placeholder="Örn: 25.000,00" 
            className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3" 
          />
          {asgariUcretHatasi && (
            <div className="mt-1 text-xs text-red-600">
              {asgariUcretHatasi}
            </div>
          )}
        </div>
        
        <div>
          <div className="text-[13px] text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1">
            Haftalık Çalışma Süresi (Gün) * <span className="text-gray-500" title="Haftada kaç gün çalışıldığını giriniz (örn: 5 veya 6)">ℹ️</span>
          </div>
          <input 
            type="number"
            min="1"
            max="7"
            value={haftalikCalismaGunu} 
            onChange={(e) => setHaftalikCalismaGunu(e.target.value)} 
            placeholder="Örn: 5" 
            className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3" 
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-400">Toplam</div>
        <div className="text-base font-semibold">
          {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(toplam)}
        </div>
      </div>
    </div>
  );
};

export default function IsAramaIndependent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  
  // Video linki - merkezi dosyadan çekiliyor
  const videoLink = getVideoLink("is-arama-izni");
  
  // Query parametrelerinden caseId'yi de kontrol et
  const caseIdFromQuery = searchParams.get('caseId');
  const effectiveId = id || caseIdFromQuery || undefined;
  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [exitDate, setExitDate] = useState<string>("");
  const [formValues, setFormValues] = useState<any>(null);
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);

  // İşten çıkış tarihinden yıl bilgisini çıkar, yoksa mevcut yılı kullan
  const selectedYear = useMemo(() => {
    const dateStr = exitDate || formValues?.istenCikis || "";
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
  }, [exitDate, formValues?.istenCikis]);
  
  // Backend hesaplaması için state
  const [weeks, setWeeks] = useState(2);
  const [amount, setAmount] = useState(0);
  const [sskPrimi, setSskPrimi] = useState(0);
  const [issizlikPrimi, setIssizlikPrimi] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [net, setNet] = useState(0);
  const [toplamIsAramaGunu, setToplamIsAramaGunu] = useState(0);
  const [toplamIsAramaSaati, setToplamIsAramaSaati] = useState(0);
  const [saatlikUcret, setSaatlikUcret] = useState(0);
  
  // Kullandırılmış izinler
  const [kullandirilanIzinGun, setKullandirilanIzinGun] = useState<string>(""); // Gün bazlı düşüm
  const [tarihAralikDusumler, setTarihAralikDusumler] = useState<TarihAralikDusum[]>([]); // Tarih aralığı düşümleri

  // Kullandırılmış izin düşümlerini hesapla (SAAT bazında)
  const { dusumSaati, netIsAramaSaati } = useMemo(() => {
    const haftalikGun = Number(formValues?.haftalikCalismaGunu || 5);
    const gunlukCalismaSaati = getGunlukCalismaSaati(haftalikGun);
    
    let toplamDusum = 0;
    
    // 1) Gün bazlı düşüm
    const gunBazliDusumGun = toNumber(kullandirilanIzinGun);
    if (gunBazliDusumGun > 0) {
      toplamDusum += gunBazliDusumGun * gunlukCalismaSaati;
    }
    
    // 2) Tarih aralığı bazlı düşümler
    tarihAralikDusumler.forEach(dusum => {
      if (dusum.baslangic && dusum.bitis && dusum.gunlukSaat) {
        const calismaGunleri = calculateWorkDays(dusum.baslangic, dusum.bitis, haftalikGun);
        const gunlukSaat = toNumber(dusum.gunlukSaat);
        toplamDusum += calismaGunleri * gunlukSaat;
      }
    });
    
    // Net iş arama saati = Toplam iş arama saati - Düşüm
    const netSaat = Math.max(0, toplamIsAramaSaati - toplamDusum);
    
    return {
      dusumSaati: toplamDusum,
      netIsAramaSaati: netSaat
    };
  }, [kullandirilanIzinGun, tarihAralikDusumler, toplamIsAramaSaati, formValues?.haftalikCalismaGunu]);

  // Backend'den hesaplamayı çek - İLK HESAPLAMA (düşüm olmadan)
  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        // Form değerlerini hazırla
        const requestData = {
          brut: formValues?.brutUcret || formValues?.brut || "0",
          prim: formValues?.prim || "0",
          ikramiye: formValues?.ikramiye || "0",
          yol: formValues?.yol || "0",
          yemek: formValues?.yemek || "0",
          diger: "0",
          extras: formValues?.extras || [],
          totals: totals,
          exitYear: selectedYear,
          haftalikCalismaGunu: Number(formValues?.haftalikCalismaGunu || 5),
        };

        console.log("[İş Arama İzni - İlk Hesaplama] Backend'e gönderilen data:", requestData);

        const tenantId = Number(localStorage.getItem("tenant_id") || "1");
        const response = await fetch(`${API_BASE_URL}/api/is-arama-izni`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-tenant-id": String(tenantId)
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          setWeeks(result.data.weeks || 2);
          setAmount(result.data.brut || 0);
          setSskPrimi(result.data.sskPrimi || 0);
          setIssizlikPrimi(result.data.issizlikPrimi || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNet(result.data.net || 0);
          setToplamIsAramaGunu(result.data.toplamIsAramaGunu || 0);
          setToplamIsAramaSaati(result.data.toplamIsAramaSaati || 0);
          setSaatlikUcret(result.data.saatlikUcret || 0);
        }
      } catch (error) {
        console.error("İş arama izni hesaplama hatası:", error);
      }
    };

    // Sadece geçerli veri varsa hesapla
    if (!formValues) {
      return;
    }
    
    const brutValue = formValues?.brutUcret || formValues?.brut || "0";
    const brutNum = toNumber(brutValue);
    const hasBrut = brutNum > 0;
    
    if (hasBrut && totals.yil >= 0 && totals.ay >= 0 && totals.gun >= 0) {
      console.log("[İş Arama İzni - İlk Hesaplama] Başlatılıyor...");
      calculateFromBackend();
    } else {
      console.log("[İş Arama İzni - İlk Hesaplama] Koşullar sağlanmadı:", { hasBrut, totals });
      setAmount(0);
      setNet(0);
      setSskPrimi(0);
      setIssizlikPrimi(0);
      setGelirVergisi(0);
      setDamgaVergisi(0);
      setToplamIsAramaGunu(0);
      setToplamIsAramaSaati(0);
      setSaatlikUcret(0);
    }
  }, [totals, selectedYear, formValues]);

  // DÜŞÜM HESAPLAMASI - toplamIsAramaSaati geldiğinde ve düşüm varsa tekrar hesapla
  useEffect(() => {
    const recalculateWithDeduction = async () => {
      if (dusumSaati <= 0 || toplamIsAramaSaati <= 0) {
        console.log("[İş Arama İzni - Düşüm Hesaplama] Atlandı - dusumSaati:", dusumSaati, "toplamIsAramaSaati:", toplamIsAramaSaati);
        return; // Düşüm yoksa veya toplam saat henüz hesaplanmadıysa çık
      }

      if (!formValues) {
        console.log("[İş Arama İzni - Düşüm Hesaplama] Atlandı - formValues yok");
        return;
      }

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
          exitYear: selectedYear,
          haftalikCalismaGunu: Number(formValues?.haftalikCalismaGunu || 5),
          // Düşüm bilgilerini gönder
          kullandirilanIzinSaat: dusumSaati,
          netIsAramaSaati: netIsAramaSaati
        };

        console.log("=== İŞ ARAMA İZNİ DÜŞÜM HESAPLAMA ===");
        console.log("Backend'e gönderilen FULL data:", JSON.stringify(requestData, null, 2));
        console.log("toplamIsAramaSaati (backend'den gelen):", toplamIsAramaSaati);
        console.log("dusumSaati (frontend hesaplama):", dusumSaati);
        console.log("netIsAramaSaati (frontend hesaplama):", netIsAramaSaati);
        console.log("requestData.netIsAramaSaati:", requestData.netIsAramaSaati);
        console.log("=====================================");

        const tenantId = Number(localStorage.getItem("tenant_id") || "1");
        const response = await fetch(`${API_BASE_URL}/api/is-arama-izni`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-tenant-id": String(tenantId)
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          console.log("[İş Arama İzni - Düşüm Hesaplama] Backend SONUÇ:", result.data);
          console.log("Yeni brut tutar:", result.data.brut);
          setAmount(result.data.brut || 0);
          setSskPrimi(result.data.sskPrimi || 0);
          setIssizlikPrimi(result.data.issizlikPrimi || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNet(result.data.net || 0);
        }
      } catch (error) {
        console.error("İş arama izni düşüm hesaplama hatası:", error);
      }
    };

    recalculateWithDeduction();
  }, [dusumSaati, netIsAramaSaati, toplamIsAramaSaati, formValues, totals, selectedYear]);


  // YENİ RAPOR SİSTEMİ: Config
  const isAramaReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Çalışma Süresi etiketi oluştur
    const workPeriodLabel = totals.yil > 0 || totals.ay > 0 || totals.gun > 0
      ? `${totals.yil || 0} Yıl, ${totals.ay || 0} Ay, ${totals.gun || 0} Gün`
      : "-";

    return {
      title: "İş Arama İzni Ücreti",
      sections: {
        info: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "İşe Giriş", value: formValues?.iseGiris ? new Date(formValues.iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış", value: formValues?.istenCikis ? new Date(formValues.istenCikis).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Süresi", value: workPeriodLabel },
        { label: "Brüt Ücret", value: totals.toplam ? `${fmtLocal(totals.toplam)}₺` : "-" },
        { label: "İhbar Süresi (Hafta)", value: weeks.toString() },
        { label: "Haftalık Çalışma Günü", value: `${formValues?.haftalikCalismaGunu || 5} gün` },
      ],
      customSections: [
        {
          title: "İş Arama İzni Hesaplama Detayı",
          content: (
            <div className="space-y-2 text-sm">
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Toplam İş Arama Günü</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right' }}>{weeks} hafta × {formValues?.haftalikCalismaGunu || 5} gün = {toplamIsAramaGunu} gün</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Toplam İş Arama Saati</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right' }}>{toplamIsAramaGunu} gün × 2 saat = {toplamIsAramaSaati} saat</td>
                  </tr>
                  {dusumSaati > 0 && (
                    <>
                      <tr style={{ color: '#dc2626' }}>
                        <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Kullandırılan İzin (Düşüm)</td>
                        <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right' }}>-{dusumSaati.toFixed(1)} saat</td>
                      </tr>
                      <tr style={{ fontWeight: 600, backgroundColor: '#dbeafe' }}>
                        <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Net İş Arama Saati</td>
                        <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right', color: '#1d4ed8' }}>{netIsAramaSaati.toFixed(1)} saat</td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Saatlik Ücret</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right' }}>{fmtLocal(totals.toplam || 0)} ₺ / 225 = {fmtLocal(saatlikUcret)} ₺</td>
                  </tr>
                  <tr style={{ fontWeight: 600, backgroundColor: '#f3f4f6' }}>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>İş Arama İzni Ücreti</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right' }}>{fmtLocal(saatlikUcret)} ₺ × {dusumSaati > 0 ? netIsAramaSaati.toFixed(1) : toplamIsAramaSaati} saat = {fmtLocal(amount)} ₺</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2 italic">
                * İş Kanunu madde 17'ye göre hesaplanan ihbar süresi esas alınmıştır. Günde 2 saat iş arama izni hakkı vardır.
              </p>
              {dusumSaati > 0 && (
                <p className="text-xs text-blue-600 mt-1 italic">
                  * İşçiye daha önce fiilen kullandırılan izinler, iş arama izni süresinden mahsup edilmiştir.
                </p>
              )}
            </div>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt İş Arama İzni Ücreti", value: `${fmtLocal(amount)}₺` },
          { label: "SGK Primi (%14)", value: `-${fmtLocal(sskPrimi)}₺`, isDeduction: true },
          { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(issizlikPrimi)}₺`, isDeduction: true },
          { label: "Gelir Vergisi", value: `-${fmtLocal(gelirVergisi)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)}₺`, isDeduction: true },
          { label: "Net İş Arama İzni Ücreti", value: `${fmtLocal(net)}₺`, isNet: true },
        ],
      },
    };
  }, [formValues, totals, weeks, toplamIsAramaGunu, toplamIsAramaSaati, saatlikUcret, amount, sskPrimi, issizlikPrimi, gelirVergisi, damgaVergisi, net]);

  const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (isAramaReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const haftalikGun = formValues?.haftalikCalismaGunu || 5;
    const hesaplamaRows: [string, string][] = [
      ["Toplam İş Arama Günü", `${weeks} hafta × ${haftalikGun} gün = ${toplamIsAramaGunu} gün`],
      ["Toplam İş Arama Saati", `${toplamIsAramaGunu} gün × 2 saat = ${toplamIsAramaSaati} saat`],
    ];
    if (dusumSaati > 0) {
      hesaplamaRows.push(["Kullandırılan İzin (Düşüm)", `-${dusumSaati.toFixed(1)} saat`]);
      hesaplamaRows.push(["Net İş Arama Saati", `${netIsAramaSaati.toFixed(1)} saat`]);
    }
    hesaplamaRows.push(["Saatlik Ücret", `${fmtLocal(totals.toplam || 0)} ₺ / 225 = ${fmtLocal(saatlikUcret)} ₺`]);
    hesaplamaRows.push(["İş Arama İzni Ücreti", `${fmtLocal(saatlikUcret)} ₺ × ${dusumSaati > 0 ? netIsAramaSaati.toFixed(1) : toplamIsAramaSaati} saat = ${fmtLocal(amount)} ₺`]);
    const n2 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: hesaplamaRows });
    sections.push({ id: "is-arama-hesaplama", title: "İş Arama İzni Hesaplama Detayı", html: buildWordTable(n2.headers, n2.rows) });

    const gnd = isAramaReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: isAramaReportConfig.grossToNetData?.title || "Brüt'ten Net'e Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    return sections;
  }, [isAramaReportConfig, formValues, weeks, toplamIsAramaGunu, toplamIsAramaSaati, dusumSaati, netIsAramaSaati, totals, saatlikUcret, amount]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("is-arama-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = isAramaReportConfig.title;
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
  }, [isAramaReportConfig.title]);

  const handleSave = useCallback(() => {
    // Inline validation
    if (!amount || amount <= 0) {
      showToastError("Lütfen geçerli bir hesaplama yapın");
      return;
    }

    const iseGiris = formValues?.iseGiris || formValues?.startDate || null;
    const istenCikis = formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || null;
    
    // Merkezi kayıt sistemini kullan
    kaydetAc({
      hesapTuru: SAVE_TYPE,
      veri: {
        // Yeni format: data içinde form ve results
        data: {
          form: {
            ...formValues,
            kullandirilanIzinGun,
            tarihAralikDusumler
          },
          results: {
            totals,
            brut: amount,
            net: net,
            dusumSaati,
            netIsAramaSaati
          }
        },
        // Geriye dönük uyumluluk için eski alanlar (backend için)
        ise_giris: iseGiris,
        isten_cikis: istenCikis,
        brut_total: Number(amount.toFixed(2)),
        net_total: Number(net.toFixed(2)),
        start_date: iseGiris,
        end_date: istenCikis,
        total: Number(amount.toFixed(2)),
      },
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
      redirectPath: `${REDIRECT_BASE_PATH}/:id`,
    });
  }, [amount, net, totals, formValues, effectiveId, kaydetAc, showToastError, currentRecordName, kullandirilanIzinGun, tarihAralikDusumler, dusumSaati, netIsAramaSaati]);

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
      setExitDate("");
      setFormValues(null);
      setCurrentRecordName(null);
      setKullandirilanIzinGun("");
      setTarihAralikDusumler([]);
    } catch (err) {
      console.error("Yeni hesaplama hatası:", err);
    }
  }, [formValues, id]);

  const location = useLocation();
  const pathname = location.pathname;
  const searchString = location.search;

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
        };
        
        if (!isMounted) return;
        setFormValues(mappedFormValues);
        
        if (!isMounted) return;
        setExitDate(mappedFormValues.exitDate || mappedFormValues.istenCikis || '');
        
        // Kullandırılmış izin bilgilerini yükle
        if (formData.kullandirilanIzinGun) {
          if (!isMounted) return;
          setKullandirilanIzinGun(String(formData.kullandirilanIzinGun));
        }
        if (formData.tarihAralikDusumler && Array.isArray(formData.tarihAralikDusumler)) {
          if (!isMounted) return;
          setTarihAralikDusumler(formData.tarihAralikDusumler);
        }
        
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
    setExitDate("");
    setFormValues(null);
    setCurrentRecordName(null);
    setKullandirilanIzinGun("");
    setTarihAralikDusumler([]);
  }, [pathname, id]);

  // Ref to store previous search string to prevent infinite loop
  const prevSearchRef = useRef<string>("");

  useEffect(() => {
    // Eğer search string değişmediyse, işlem yapma
    if (prevSearchRef.current === searchString) {
      return;
    }
    prevSearchRef.current = searchString;

    // Kıdem sayfasından gelen parametreleri oku ve form state'lerine yaz
    const params = new URLSearchParams(searchString);
    const start = params.get("start");
    const end = params.get("end");
    const brut = params.get("brut");
    const prim = params.get("prim");
    const ikramiye = params.get("ikramiye");
    const yemek = params.get("yemek");
    const extrasRaw = params.get("extras");

    // Eğer hiçbir parametre yoksa, işlem yapma
    if (!start && !end && !brut && !prim && !ikramiye && !yemek && !extrasRaw) {
      return;
    }

    // FormValues state'ini güncelle
    setFormValues((prev: any) => {
      const next = { ...(prev || {}) } as any;
      if (start) next.iseGiris = start;
      if (end) next.istenCikis = end;
      if (brut) next.brutUcret = brut;
      if (prim) next.prim = prim;
      if (ikramiye) next.ikramiye = ikramiye;
      if (yemek) next.yemek = yemek;
      if (extrasRaw) {
        try {
          next.extras = JSON.parse(decodeURIComponent(extrasRaw));
        } catch {
          // JSON parse hatası olursa yok say
        }
      }
      return next;
    });
  }, [searchString]);

  // Initial prop'ları useMemo ile oluştur (form alanlarının yüklenmesi için)
  const memoizedInitialBrut = useMemo(() => formValues?.brutUcret || formValues?.brut || "", [formValues?.brutUcret, formValues?.brut]);
  const memoizedInitialIseGiris = useMemo(() => formValues?.iseGiris || formValues?.startDate || "", [formValues?.iseGiris, formValues?.startDate]);
  const memoizedInitialIstenCikis = useMemo(() => formValues?.istenCikis || formValues?.exitDate || formValues?.endDate || "", [formValues?.istenCikis, formValues?.exitDate, formValues?.endDate]);

  return (
    <Layout hideHeader={true} fluid={true} pageKey="is-arama-izni-ucreti" noBackgroundColor={true}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div id="is-arama-print" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full space-y-6">
          {/* Sol taraf - Form ve Hesaplamalar */}
          <div className="space-y-4 w-full">
            <IsAramaForm
              key={id || pathname}
              onTotalsChange={setTotals}
              initialBrut={memoizedInitialBrut}
              initialIseGiris={memoizedInitialIseGiris}
              initialIstenCikis={memoizedInitialIstenCikis}
              onExitDateChange={setExitDate}
              onValuesChange={setFormValues}
              headerAction={
                videoLink ? (
                  <Button
                    onClick={() => window.open(videoLink, "_blank")}
                    variant="outline"
                    size="sm"
                    className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                  >
                    <Youtube className="h-4 w-4" />
                    Kullanım Videosu İzle
                  </Button>
                ) : undefined
              }
            />

            {/* Kullandırılmış İzinler */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <span>Kullandırılmış İş Arama İzinleri (Düşüm)</span>
                <span className="text-xs text-gray-500 font-normal">(İsteğe Bağlı)</span>
              </h3>
              
              {/* Gün Bazlı Düşüm */}
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gün Bazlı Düşüm <span className="text-xs font-normal text-gray-500">(günlük 7,5 saat üzerinden hesaplanmıştır)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Kullandırılan İzin (Gün)</label>
                    <input
                      type="text"
                      value={kullandirilanIzinGun}
                      onChange={(e) => setKullandirilanIzinGun(e.target.value)}
                      placeholder="Örn: 2"
                      className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="text-xs text-gray-600">
                      {kullandirilanIzinGun && toNumber(kullandirilanIzinGun) > 0 && (
                        <span className="font-medium text-blue-700">
                          = {toNumber(kullandirilanIzinGun)} gün × {getGunlukCalismaSaati(Number(formValues?.haftalikCalismaGunu || 5)).toFixed(1)} saat/gün
                          = {(toNumber(kullandirilanIzinGun) * getGunlukCalismaSaati(Number(formValues?.haftalikCalismaGunu || 5))).toFixed(1)} saat
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarih Aralığı Bazlı Düşümler */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Tarih Aralığı Bazlı Düşüm</div>
                  <Button
                    onClick={() => {
                      setTarihAralikDusumler([
                        ...tarihAralikDusumler,
                        { id: Math.random().toString(36).slice(2), baslangic: "", bitis: "", gunlukSaat: "" }
                      ]);
                    }}
                    variant="outline"
                    size="sm"
                    className="gap-1 font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
                  >
                    <Plus className="h-3 w-3" />
                    Ekle
                  </Button>
                </div>
                
                {tarihAralikDusumler.length === 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    Henüz tarih aralığı düşümü eklenmedi
                  </div>
                )}
                
                <div className="space-y-2">
                  {tarihAralikDusumler.map((dusum) => {
                    const calismaGunleri = calculateWorkDays(dusum.baslangic, dusum.bitis, Number(formValues?.haftalikCalismaGunu || 5));
                    const gunlukSaat = toNumber(dusum.gunlukSaat);
                    const toplamSaat = calismaGunleri * gunlukSaat;
                    
                    return (
                      <div key={dusum.id} className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">Başlangıç</label>
                            <input
                              type="date"
                              value={dusum.baslangic}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value && value.includes('-')) {
                                  const parts = value.split('-');
                                  if (parts[0] && parts[0].length > 4) {
                                    parts[0] = parts[0].substring(0, 4);
                                    e.target.value = parts.join('-');
                                  }
                                }
                                setTarihAralikDusumler(tarihAralikDusumler.map(d =>
                                  d.id === dusum.id ? { ...d, baslangic: e.target.value } : d
                                ));
                              }}
                              className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">Bitiş</label>
                            <input
                              type="date"
                              value={dusum.bitis}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value && value.includes('-')) {
                                  const parts = value.split('-');
                                  if (parts[0] && parts[0].length > 4) {
                                    parts[0] = parts[0].substring(0, 4);
                                    e.target.value = parts.join('-');
                                  }
                                }
                                setTarihAralikDusumler(tarihAralikDusumler.map(d =>
                                  d.id === dusum.id ? { ...d, bitis: e.target.value } : d
                                ));
                              }}
                              className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">Günlük Saat</label>
                            <input
                              type="text"
                              value={dusum.gunlukSaat}
                              onChange={(e) => {
                                setTarihAralikDusumler(tarihAralikDusumler.map(d =>
                                  d.id === dusum.id ? { ...d, gunlukSaat: e.target.value } : d
                                ));
                              }}
                              placeholder="Örn: 2"
                              className="w-full rounded-xl h-11 font-medium border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-3"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-600">
                            {dusum.baslangic && dusum.bitis && dusum.gunlukSaat && (
                              <span className="font-medium text-amber-700">
                                = {calismaGunleri} çalışma günü × {gunlukSaat} saat/gün = {toplamSaat.toFixed(1)} saat
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setTarihAralikDusumler(tarihAralikDusumler.filter(d => d.id !== dusum.id));
                            }}
                            className="text-sm font-semibold rounded-full px-3 py-1.5 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Toplam Düşüm Özeti */}
              {dusumSaati > 0 && (
                <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Toplam Düşülecek Saat:</span>
                    <span className="font-bold text-red-700">{dusumSaati.toFixed(1)} saat</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">İş Arama İzni Ücreti</h3>
              <div className="text-sm sm:text-base space-y-1">
                <p className="flex items-center justify-between"><span>İhbar Süresi:</span> <span className="font-medium">{weeks} hafta</span></p>
                <p className="flex items-center justify-between"><span>Haftalık Çalışma Süresi:</span> <span className="font-medium">{formValues?.haftalikCalismaGunu || 5} gün</span></p>
                <p className="flex items-center justify-between"><span>Toplam İş Arama Günü:</span> <span className="font-medium">{weeks} hafta × {formValues?.haftalikCalismaGunu || 5} gün = {toplamIsAramaGunu} gün</span></p>
                <p className="flex items-center justify-between"><span>Toplam İş Arama Saati:</span> <span className="font-medium">{toplamIsAramaGunu} gün × 2 saat = {toplamIsAramaSaati} saat</span></p>
                {dusumSaati > 0 && (
                  <>
                    <p className="flex items-center justify-between text-red-600"><span>Kullandırılan İzin (Düşüm):</span> <span className="font-medium">-{dusumSaati.toFixed(1)} saat</span></p>
                    <p className="flex items-center justify-between border-t pt-1"><span className="font-semibold">Net İş Arama Saati:</span> <span className="font-semibold text-blue-700">{netIsAramaSaati.toFixed(1)} saat</span></p>
                  </>
                )}
                <p className="flex items-center justify-between"><span>Saatlik Ücret:</span> <span className="font-medium">{fmt(totals.toplam || 0)} ₺ / 225 = {fmt(saatlikUcret)} ₺</span></p>
                <hr className="my-2" />
                <p className="flex items-center justify-between"><span>İş Arama İzni Ücreti:</span> <span className="font-medium">{fmt(saatlikUcret)} ₺ × {dusumSaati > 0 ? netIsAramaSaati.toFixed(1) : toplamIsAramaSaati} saat</span></p>
                <p className="flex items-center justify-between"><span>Tutar:</span> <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(amount)} ₺</span></p>
                <p className="text-xs text-gray-500 mt-2">İş Kanunu madde 17'ye göre hesaplanan ihbar süresi esas alınmıştır. Günde 2 saat iş arama izni hakkı vardır.</p>
                {dusumSaati > 0 && (
                  <p className="text-xs text-blue-600 mt-1 italic">* İşçiye daha önce fiilen kullandırılan izinler, iş arama izni süresinden mahsup edilmiştir.</p>
                )}
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Brüt'ten Net'e Çeviri</h3>
              <div className="space-y-1 text-sm sm:text-base">
                <p className="flex items-center justify-between"><span>Brüt İş Arama İzni Ücreti:</span> <span className="font-medium">{fmt(amount)} ₺</span></p>
                <p className="flex items-center justify-between"><span>SSK Primi (%14):</span> <span className="font-medium text-red-600">-{fmt(sskPrimi)} ₺</span></p>
                <p className="flex items-center justify-between"><span>İşsizlik Primi (%1):</span> <span className="font-medium text-red-600">-{fmt(issizlikPrimi)} ₺</span></p>
                <p className="flex items-center justify-between"><span>Gelir Vergisi {gelirVergisiDilimleri}:</span> <span className="font-medium text-red-600">-{fmt(gelirVergisi)} ₺</span></p>
                <p className="flex items-center justify-between"><span>Damga Vergisi (binde 7,59):</span> <span className="font-medium text-red-600">-{fmt(damgaVergisi)} ₺</span></p>
                <hr className="my-2" />
                <p className="flex items-center justify-between"><span>Net İş Arama İzni Ücreti:</span> <span className="font-semibold text-green-700">{fmt(net)} ₺</span></p>
              </div>
            </div>
            
          </div>
          
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
            <div className="p-4 notes-content">
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                {NOTE_ITEMS.map((item, index) => {
                  if (item === "") return <br key={index} />;
                  const isHeading = item === "İş Arama İzni Ücreti" || item === "Yeni iş arama izni" || item === "Madde 27-";
                  
                  if (isHeading) {
                    return <p key={index} className="font-semibold text-slate-800 dark:text-slate-200">{item}</p>;
                  }
                  // Eğer zaten • ile başlıyorsa, tekrar ekleme
                  if (item.startsWith("• ")) {
                    return <p key={index}>{item}</p>;
                  }
                  return <p key={index}>• {item}</p>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="is-arama-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={isAramaReportConfig} />
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving, title: isSaving ? "Kaydediliyor..." : undefined }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: "İş Arama İzni Ücreti Rapor",
          copyTargetId: "is-arama-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #is-arama-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #is-arama-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="is-arama-word-copy">
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
          onPdf: () => downloadPdfFromDOM("İş Arama İzni Ücreti Rapor", "report-content"),
        }}
      />
      </div>
    </Layout>
  );
}
