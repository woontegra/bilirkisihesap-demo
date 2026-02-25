import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
// useCaseAutosave disabled to avoid 400 errors from /api/cases endpoint
// import { useCaseAutosave } from "./hooks/useCaseAutosave";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { useToast } from "@/context/ToastContext";
import { parseMoney } from "@/utils/parseMoney";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "@/utils/extraCalculationsStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Download, Trash2 } from "lucide-react";

export type ExtraItem = { id: string; label: string; value: string };

// Asgari ücret tablosu (2005 - 2025)
const ASGARI_UCRET_BRUT: Record<string, number> = {
  "2005-1": 488.7, "2005-2": 488.7,
  "2006-1": 531, "2006-2": 531,
  "2007-1": 562.5, "2007-2": 585,
  "2008-1": 608.4, "2008-2": 638.7,
  "2009-1": 666, "2009-2": 693,
  "2010-1": 729, "2010-2": 760.5,
  "2011-1": 796.5, "2011-2": 837,
  "2012-1": 886.5, "2012-2": 940.5,
  "2013-1": 978.6, "2013-2": 1021.5,
  "2014-1": 1071, "2014-2": 1134,
  "2015-1": 1201.5, "2015-2": 1273.5,
  "2016-1": 1647, "2016-2": 1647,
  "2017-1": 1777.5, "2017-2": 1777.5,
  "2018-1": 2029.5, "2018-2": 2029.5,
  "2019-1": 2558.4, "2019-2": 2558.4,
  "2020-1": 2943, "2020-2": 2943,
  "2021-1": 3577.5, "2021-2": 3577.5,
  "2022-1": 5004, "2022-2": 6471,
  "2023-1": 10008, "2023-2": 13414.5,
  "2024-1": 20002.5, "2024-2": 20002.5,
  "2025-1": 26005.5, "2025-2": 26005.5,
};

function getAsgariUcretByDate(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const period = month <= 6 ? "1" : "2";
  const key = `${year}-${period}`;
  
  // Eğer yıl tabloda yoksa, en son yılın değerini kullan
  if (!ASGARI_UCRET_BRUT[key]) {
    const maxYear = Math.max(...Object.keys(ASGARI_UCRET_BRUT).map(k => parseInt(k.split('-')[0])));
    const maxPeriod = year > maxYear ? "2" : period;
    const fallbackKey = `${maxYear}-${maxPeriod}`;
    return ASGARI_UCRET_BRUT[fallbackKey] || null;
  }
  
  return ASGARI_UCRET_BRUT[key];
}

type Props = {
  onTotalsChange: (totals: { toplam: number; yil: number; ay: number; gun: number }) => void;
  appliedEklenti?: number | { field: string; value: number } | null;
  onRequestEklenti?: (fieldKey: string, title: string, apply: (v: number) => void) => void;
  onExitDateChange?: (date: string) => void;
  hideEmploymentDates?: boolean;
  onValuesChange?: (values: {
    iseGiris: string;
    istenCikis: string;
    brut: string;
    prim: string;
    ikramiye: string;
    yol: string;
    yemek: string;
    extras: ExtraItem[];
    toplam: number;
  }) => void;
  initialBrut?: string;
  showIhbarShortcut?: boolean;
  ihbarRoute?: string; // İhbar tazminatı sayfası route'u (örn: "30isci", "borclar", "gemi")
  initialIseGiris?: string;
  initialIstenCikis?: string;
  initialPrim?: string;
  initialIkramiye?: string;
  initialYol?: string;
  initialYemek?: string;
  initialExtras?: ExtraItem[];
  customTitle?: string;
  customIseGirisLabel?: string;
  customIstenCikisLabel?: string;
  denemeSuresiGun?: number; // Deneme süresi gün sayısı (mesleğe ilk giriş tarihine eklenecek)
  customTotalFormatter?: (n: number) => string;   // Özel toplam formatlayıcı (örn: fmt + ₺)
  // Header action (örn: buton)
  headerAction?: React.ReactNode;
  extraCalculationsLabel?: string; // Ekstra hesaplamalar başlığı (örn: "Ekstra Hesaplamalar (Prim, İkramiye, Yemek vb.)")
};

export default function KidemTazminatiForm({ onTotalsChange, appliedEklenti, onRequestEklenti, onExitDateChange, onValuesChange, initialBrut, showIhbarShortcut = true, ihbarRoute = "30isci", hideEmploymentDates = false, initialIseGiris, initialIstenCikis, initialPrim, initialIkramiye, initialYol, initialYemek, initialExtras, customTitle, customIseGirisLabel, customIstenCikisLabel, denemeSuresiGun = 0, customTotalFormatter, headerAction, extraCalculationsLabel = "Ekstra Hesaplamalar (Prim, İkramiye, Yol, Yemek vb.)" }: Props) {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<SavedExtraCalculationsSet[]>([]);
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [brut, setBrut] = useState("");
  const [prim, setPrim] = useState("");
  const [ikramiye, setIkramiye] = useState("");
  const [yol, setYol] = useState("");
  const [yemek, setYemek] = useState("");
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [asgariHata, setAsgariHata] = useState<string | null>(null);

  // Ref'ler en üstte tanımlanmalı (effect'lerde kullanılmadan önce initialize edilmiş olmalı)
  const extrasRef = useRef<ExtraItem[]>([]);
  // Önceki initial değerleri takip et (sonsuz döngüyü önlemek için)
  const prevInitialsRef = useRef({
    initialBrut: "",
    initialIseGiris: "",
    initialIstenCikis: "",
    initialPrim: "",
    initialIkramiye: "",
    initialYol: "",
    initialYemek: "",
    initialExtras: [] as ExtraItem[],
  });
  
  // Önceki values değerlerini takip et (onValuesChange döngüsünü önlemek için)
  const prevValuesRef = useRef({
    iseGiris: "",
    istenCikis: "",
    brut: "",
    prim: "",
    ikramiye: "",
    yol: "",
    yemek: "",
    toplam: 0,
    extras: [] as ExtraItem[],
  });

  // Güncel extras (effect içinde karşılaştırma için; max update depth önleme)
  extrasRef.current = extras;

  // modal moved to page; we only receive appliedEklenti

  // Autosave payload (mock fields for now) - Disabled to avoid 400 errors
  // useCaseAutosave({
  //   gelir: parseMoney(brut),
  //   dogum_tarihi: iseGiris,
  //   rapor_tarihi: istenCikis,
  // });

  // Deneme süresi gün sayısını başlangıç tarihine ekle
  const adjustedIseGiris = useMemo(() => {
    if (!iseGiris || denemeSuresiGun <= 0) return iseGiris;
    
    try {
      const startDate = new Date(iseGiris);
      if (isNaN(startDate.getTime())) return iseGiris;
      
      // Deneme süresi gün sayısını ekle
      const adjustedDate = new Date(startDate);
      adjustedDate.setDate(adjustedDate.getDate() + denemeSuresiGun);
      
      return adjustedDate.toISOString().split('T')[0];
    } catch {
      return iseGiris;
    }
  }, [iseGiris, denemeSuresiGun]);

  // çalışma süresi hesaplama (bilirkişi yöntemi) - deneme süresi eklenmiş tarihle
  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(adjustedIseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [adjustedIseGiris, istenCikis]);

  const toplam = useMemo(() => {
    const base = parseMoney(brut) + parseMoney(prim) + parseMoney(ikramiye) + parseMoney(yol) + parseMoney(yemek);
    const ex = extras.reduce((acc, it) => acc + parseMoney(it.value), 0);
    return base + ex;
  }, [brut, prim, ikramiye, yol, yemek, extras]);

  // EklentiModal'dan gelen değerleri doğru alana yaz
  useEffect(() => {
    if (appliedEklenti === undefined || appliedEklenti === null) return;

    // Eski davranışla geriye dönük uyumluluk: sadece sayı gönderilmişse ikramiyeye yaz
    if (typeof appliedEklenti === "number") {
      const v = Number(appliedEklenti) || 0;
      const formatted = String(v.toFixed(2)).replace(".", ",");
      setIkramiye(formatted);
      return;
    }

    const { field, value } = appliedEklenti;
    const formatted = String(value.toFixed(2)).replace(".", ",");

    if (field === "prim") setPrim(formatted);
    if (field === "ikramiye") setIkramiye(formatted);
    if (field === "yemek") setYemek(formatted);

    // Extra satırları için: field = "extra:<id>"
    if (field.startsWith("extra:")) {
      const id = field.split(":")[1];
      setExtras((prev) =>
        prev.map((x) => (x.id === id ? { ...x, value: formatted } : x))
      );
    }
  }, [appliedEklenti]);

  // Prefill brut if provided via initialBrut (for navigations from Kıdem -> İhbar and editing)
  useEffect(() => {
    if (initialBrut && initialBrut !== prevInitialsRef.current.initialBrut) {
      prevInitialsRef.current.initialBrut = initialBrut;
      setBrut(initialBrut);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrut]);

  // Asgari ücret validasyonunu useMemo ile hesapla
  const asgariHataMessage = useMemo(() => {
    if (!istenCikis || !brut) {
      return null;
    }
    
    const minUcretRaw = getAsgariUcretByDate(istenCikis);
    // Asgari ücret bulunamazsa validation'ı atla
    if (!minUcretRaw) {
      return null;
    }
    
    // Asgari ücreti parseMoney ile parse et (güvenli parse)
    const minUcret = typeof minUcretRaw === "number" ? minUcretRaw : parseMoney(minUcretRaw);
    if (!minUcret || minUcret === 0) {
      return null;
    }
    
    const brutValue = parseMoney(brut);
    
    // brutValue 0 ise validation'ı atla
    if (!brutValue || brutValue === 0) {
      return null;
    }
    
    // Sadece asgari ücret varsa ve brüt değer düşükse hata göster
    if (brutValue < minUcret) {
      const year = new Date(istenCikis).getFullYear();
      const formattedMin = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minUcret);
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${formattedMin}₺).`;
    }
    
    return null;
  }, [istenCikis, brut]);

  // useMemo sonucunu state'e senkronize et
  useEffect(() => {
    setAsgariHata(asgariHataMessage);
  }, [asgariHataMessage]);

  // Prefill other fields if provided - Update when initial values change (for editing saved calculations)
  // Use ref to track previous values and prevent infinite loops
  // Mevcut state'i de ref ile takip et (stale closure sorununu önlemek için)
  const currentStateRef = useRef({
    iseGiris: "",
    istenCikis: "",
  });
  
  // onValuesChange'i geçici olarak devre dışı bırakmak için flag
  const skipOnValuesChangeRef = useRef(false);
  
  // State değiştiğinde ref'i güncelle
  useEffect(() => {
    currentStateRef.current.iseGiris = iseGiris;
  }, [iseGiris]);
  useEffect(() => {
    currentStateRef.current.istenCikis = istenCikis;
  }, [istenCikis]);
  
  // Sadece initial değer gerçekten değiştiğinde ve mevcut state'den farklı olduğunda güncelle
  // onValuesChange'i tetiklememek için flag kullan
  useEffect(() => { 
    if (initialIseGiris && 
        initialIseGiris !== prevInitialsRef.current.initialIseGiris &&
        initialIseGiris !== currentStateRef.current.iseGiris) {
      prevInitialsRef.current.initialIseGiris = initialIseGiris;
      skipOnValuesChangeRef.current = true; // onValuesChange'i atla
      setIseGiris(initialIseGiris);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIseGiris]);
  useEffect(() => { 
    if (initialIstenCikis && 
        initialIstenCikis !== prevInitialsRef.current.initialIstenCikis &&
        initialIstenCikis !== currentStateRef.current.istenCikis) {
      prevInitialsRef.current.initialIstenCikis = initialIstenCikis;
      skipOnValuesChangeRef.current = true; // onValuesChange'i atla
      setIstenCikis(initialIstenCikis);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIstenCikis]);
  useEffect(() => { 
    if (initialPrim !== undefined && initialPrim !== prevInitialsRef.current.initialPrim) {
      prevInitialsRef.current.initialPrim = initialPrim;
      setPrim(initialPrim); 
    }
  }, [initialPrim]);
  useEffect(() => { 
    if (initialIkramiye !== undefined && initialIkramiye !== prevInitialsRef.current.initialIkramiye) {
      prevInitialsRef.current.initialIkramiye = initialIkramiye;
      setIkramiye(initialIkramiye); 
    }
  }, [initialIkramiye]);
  useEffect(() => { 
    if (initialYol !== undefined && initialYol !== prevInitialsRef.current.initialYol) {
      prevInitialsRef.current.initialYol = initialYol;
      setYol(initialYol); 
    }
  }, [initialYol]);
  useEffect(() => { 
    if (initialYemek !== undefined && initialYemek !== prevInitialsRef.current.initialYemek) {
      prevInitialsRef.current.initialYemek = initialYemek;
      setYemek(initialYemek); 
    }
  }, [initialYemek]);
  useEffect(() => { 
    if (initialExtras === undefined) return;
    const initialStr = JSON.stringify(initialExtras);
    // Zaten mevcut state ile aynıysa setState çağırma (max update depth ve titreme önleme)
    if (initialStr === JSON.stringify(extrasRef.current)) {
      prevInitialsRef.current.initialExtras = initialExtras;
      return;
    }
    if (initialStr !== JSON.stringify(prevInitialsRef.current.initialExtras)) {
      prevInitialsRef.current.initialExtras = initialExtras;
      setExtras(initialExtras);
    }
  }, [initialExtras]);

  useEffect(() => {
    onTotalsChange({ toplam, yil: diff.yil, ay: diff.ay, gun: diff.gun });
  }, [toplam, diff.yil, diff.ay, diff.gun, onTotalsChange]);
  
  // onValuesChange'i sadece değerler gerçekten değiştiğinde çağır
  // skipOnValuesChangeRef flag'i true ise çağırma (initial değerlerden kaynaklanan güncellemeleri atla)
  useEffect(() => {
    // Eğer skip flag'i true ise, sadece prevValuesRef'i güncelle ama onValuesChange'i çağırma
    // Flag'i de sıfırla (bir sonraki render'da normal akışa dön)
    if (skipOnValuesChangeRef.current) {
      prevValuesRef.current = {
        iseGiris,
        istenCikis,
        brut,
        prim,
        ikramiye,
        yol,
        yemek,
        toplam,
        extras,
      };
      skipOnValuesChangeRef.current = false; // Flag'i sıfırla
      return;
    }
    
    // Extras array'ini karşılaştır (referans eşitliği yerine içerik kontrolü)
    const extrasChanged = JSON.stringify(prevValuesRef.current.extras) !== JSON.stringify(extras);
    
    const valuesChanged = 
      prevValuesRef.current.iseGiris !== iseGiris ||
      prevValuesRef.current.istenCikis !== istenCikis ||
      prevValuesRef.current.brut !== brut ||
      prevValuesRef.current.prim !== prim ||
      prevValuesRef.current.ikramiye !== ikramiye ||
      prevValuesRef.current.yol !== yol ||
      prevValuesRef.current.yemek !== yemek ||
      prevValuesRef.current.toplam !== toplam ||
      extrasChanged;
    
    if (valuesChanged && onValuesChange) {
      prevValuesRef.current = {
        iseGiris,
        istenCikis,
        brut,
        prim,
        ikramiye,
        yol,
        yemek,
        toplam,
        extras,
      };
      onValuesChange({ iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, extras, toplam });
    }
  }, [iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, toplam, extras, onValuesChange]);

  const addExtra = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    setExtras((prev) => [...prev, { id, label: "Eklenti", value: "" }]);
  };

  const setExtra = (id: string, patch: Partial<ExtraItem>) => {
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeExtra = (id: string) => {
    setExtras((prev) => prev.filter((x) => x.id !== id));
  };

  // Kaydedilmiş setleri yükle
  useEffect(() => {
    if (showImportModal) {
      getAllExtraCalculationsSets().then(setSavedSets);
    }
  }, [showImportModal]);

  const FIXED_EXTRA_IDS = ["prim", "ikramiye", "yol", "yemek"];
  const handleSave = async () => {
    if (!saveName.trim()) {
      error("Lütfen bir isim girin");
      return;
    }

    const items: { id: string; name: string; value: string }[] = [];
    if (prim?.trim()) items.push({ id: "prim", name: "Prim", value: prim.trim() });
    if (ikramiye?.trim()) items.push({ id: "ikramiye", name: "İkramiye", value: ikramiye.trim() });
    if (yol?.trim()) items.push({ id: "yol", name: "Yol", value: yol.trim() });
    if (yemek?.trim()) items.push({ id: "yemek", name: "Yemek", value: yemek.trim() });
    extras.forEach(item => items.push({ id: item.id, name: item.label, value: item.value }));

    if (items.length === 0) {
      error("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }

    const successResult = await saveExtraCalculationsSet(saveName.trim(), items);
    if (successResult) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
    } else {
      error("Kaydetme başarısız");
    }
  };

  const handleImport = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      const primItem = data.find((x: { id: string }) => x.id === "prim");
      const ikramiyeItem = data.find((x: { id: string }) => x.id === "ikramiye");
      const yolItem = data.find((x: { id: string }) => x.id === "yol");
      const yemekItem = data.find((x: { id: string }) => x.id === "yemek");
      const extrasData = data.filter((x: { id: string }) => !FIXED_EXTRA_IDS.includes(x.id));
      if (primItem?.value) setPrim(primItem.value);
      if (ikramiyeItem?.value) setIkramiye(ikramiyeItem.value);
      if (yolItem?.value) setYol(yolItem.value);
      if (yemekItem?.value) setYemek(yemekItem.value);
      setExtras(extrasData.map((item: { id: string; name: string; value: string }) => ({ id: item.id, label: item.name, value: item.value })));
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else {
      error("Yüklenecek veri bulunamadı");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;

    const successResult = await deleteExtraCalculationsSet(id);
    if (successResult) {
      success("Set silindi");
      await getAllExtraCalculationsSets().then(setSavedSets);
    } else {
      error("Silme başarısız");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 md:p-4 mb-4" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
      <div className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-center gap-2">
          <div className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-200 text-center sm:text-left" style={{ minWidth: 0, wordBreak: 'break-word' }}>{customTitle || "KIDEM TAZMİNATI HESAPLAMA"}</div>
          {headerAction && <div className="flex gap-2 justify-center w-full sm:w-auto" style={{ flexShrink: 0 }}>{headerAction}</div>}
        </div>
      </div>
      {!hideEmploymentDates && (
        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label className="block text-xs md:text-sm text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1" style={{ minWidth: 0 }}>
              <span style={{ wordBreak: 'break-word' }}>{customIseGirisLabel || "İşe Giriş Tarihi"}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
            </label>
            <input 
              type="date" 
              max="9999-12-31"
              value={iseGiris} 
              onChange={(e) => {
                setIseGiris(e.target.value);
              }}
              onBlur={(e) => {
                // Sadece input'tan çıkıldığında ve tam tarih girildiğinde validasyon yap
                const newValue = e.target.value;
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)) {
                  const newDate = new Date(newValue);
                  const exitDate = new Date(istenCikis);
                  if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                    error("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                  }
                }
              }}
              className="w-full rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-2 md:px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
            />
          </div>
          <div className="form-group">
            <label className="block text-xs md:text-sm text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1" style={{ minWidth: 0 }}>
              <span style={{ wordBreak: 'break-word' }}>{customIstenCikisLabel || "İşten Çıkış Tarihi"}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
            </label>
            <input 
              type="date" 
              max="9999-12-31"
              value={istenCikis} 
              onChange={(e) => {
                setIstenCikis(e.target.value);
                onExitDateChange?.(e.target.value);
              }}
              onBlur={(e) => {
                // Sadece input'tan çıkıldığında ve tam tarih girildiğinde validasyon yap
                const newValue = e.target.value;
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(iseGiris)) {
                  const newDate = new Date(newValue);
                  const entryDate = new Date(iseGiris);
                  if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                    error("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                    // Hatalı değeri geri al
                    setIstenCikis(iseGiris);
                    onExitDateChange?.(iseGiris);
                  }
                }
              }}
              className="w-full rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-2 md:px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
            />
          </div>
          <div className="form-group">
            <label className="block text-xs md:text-sm text-gray-700 dark:text-gray-300 font-medium mb-1" style={{ minWidth: 0 }}>
              <span style={{ wordBreak: 'break-word' }}>Çalışma Süresi</span>
            </label>
            <input disabled value={diff.label} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 md:px-3 py-1.5 text-sm" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <div>
          <label className="block text-xs md:text-sm text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center gap-1" style={{ minWidth: 0 }}>
            <span style={{ wordBreak: 'break-word' }}>Çıplak Brüt Ücret *</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs" title="TL cinsinden brüt ücret.">ℹ️</span>
          </label>
          <input value={brut} onChange={(e) => setBrut(e.target.value)} placeholder="Örn: 25.000,00" className="w-full rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-2 md:px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
          {asgariHata && (
            <p key={`asgari-hata-${brut}-${istenCikis}`} className="text-xs text-red-600 dark:text-red-400 mt-1" style={{ wordBreak: 'break-word' }}>{asgariHata}</p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>İçe Aktar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveModal(true)}
              className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold rounded-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
              disabled={!(extras.length > 0 || (prim && prim.trim()) || (ikramiye && ikramiye.trim()) || (yol && yol.trim()) || (yemek && yemek.trim()))}
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Kaydet</span>
            </Button>
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium mt-3 flex items-center gap-1">
            {extraCalculationsLabel}
            <span 
              className="cursor-help text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-500" 
              title="Çıplak brüt ücrete ek olarak prim, ikramiye, yemek gibi düzenli ödemeleri buraya ekleyebilirsiniz. Bu değerler kıdem tazminatı hesaplamasına dahil edilir."
            >
              ⓘ
            </span>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <div className="text-gray-600 dark:text-gray-400 text-xs font-medium mb-2">Ekstra Hesaplamalar</div>
          {[
            { key: "prim" as const, label: "Prim", value: prim, setValue: setPrim, placeholder: "Örn: 2.500,00" },
            { key: "ikramiye" as const, label: "İkramiye", value: ikramiye, setValue: setIkramiye, placeholder: "Örn: 1.000,00" },
            { key: "yol" as const, label: "Yol", value: yol, setValue: setYol, placeholder: "Örn: 500,00" },
            { key: "yemek" as const, label: "Yemek", value: yemek, setValue: setYemek, placeholder: "Örn: 1.200,00" },
          ].map(({ key, label, value, setValue, placeholder }) => (
            <div key={key} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
              <input disabled value={label} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium" />
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="flex-1 min-w-[100px] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 shrink-0" onClick={() => onRequestEklenti?.(key, `${label} için eklenti hesapla`, (v) => setValue(String(v.toFixed(2)).replace('.', ',')))}>
                  Eklenti Hesapla <span className="text-orange-500 dark:text-orange-400 cursor-help ml-1" title="Son 12 ayın değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                </button>
              </div>
              <button type="button" onClick={() => setValue('')} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full text-red-500 dark:text-red-400 shrink-0" aria-label="Temizle"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {extras.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
              <input value={it.label} onChange={(e) => setExtra(it.id, { label: e.target.value })} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 placeholder-gray-500 dark:placeholder-gray-400" placeholder="Kalem Adı" />
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <input value={it.value} onChange={(e) => setExtra(it.id, { value: e.target.value })} className="flex-1 min-w-[100px] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 placeholder-gray-500 dark:placeholder-gray-400" placeholder="Örn: 2.500,00" />
                <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 shrink-0" onClick={() => onRequestEklenti?.(`extra:${it.id}`, "Eklenti Hesapla", (v) => setExtra(it.id, { value: String(v.toFixed(2)).replace(".", ",") }))}>
                  Eklenti Hesapla <span className="text-orange-500 dark:text-orange-400 cursor-help ml-1" title="Son 12 ayın değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                </button>
              </div>
              <button type="button" onClick={() => removeExtra(it.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full text-red-500 dark:text-red-400 shrink-0" aria-label="Satırı Sil"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={addExtra} className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm text-blue-600 dark:text-blue-400 border border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
            + Ekle
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-400 order-1">Toplam</div>
        <div className="text-base font-semibold order-2">
          {customTotalFormatter 
            ? customTotalFormatter(toplam)
            : new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(toplam)
          }
        </div>
      </div>

      {/* ReportPreviewButton renders modal itself */}

      {/* Kaydet Modal */}
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
                if (e.key === "Enter") handleSave();
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
              <Button onClick={handleSave}>Kaydet</Button>
            </div>
          </div>
        </div>
      )}

      {/* İçe Aktar Modal */}
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
                        onClick={() => handleImport(set.name)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(set.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(false)}
              >
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
