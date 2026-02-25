import { useMemo, useState, useEffect, useRef } from "react";
import { FileText, Clock, Scale, Calendar, RefreshCw, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend as ReLegend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { calculateSubscription, formatDate, formatNumber, getStatusColor } from "@/utils/subscriptionUtils";
import { EmptyStateMessage } from "@/components/EmptyStateMessage";
import { API_BASE_URL } from "@/utils/apiClient";

const number = (n: number) => n.toLocaleString("tr-TR");
const API_URL = API_BASE_URL;

/** Abonelik tipi raw değerini (annual, user, demo vb.) kullanıcıya gösterilecek Türkçe etikete çevirir.
 * hasDemoLicense: true ise ve tip belirtilmemişse "Demo Paket" döner; yıllık/aylık gibi tip varsa o önceliklidir (demo'dan yıllığa geçenler için). */
const getSubscriptionDisplayLabel = (
  subscriptionType: string | null | undefined,
  hasDemoLicense?: boolean
): string => {
  const t = (subscriptionType || "").toLowerCase().trim();
  if (t === "annual") return "Yıllık abone";
  if (t === "monthly") return "Aylık abone";
  if (t === "trial") return "Deneme";
  if (t === "user") return "Standart Paket";
  if (t === "demo" || t.startsWith("demo_")) return "Demo Paket";
  if (t) return "Standart Paket";
  return hasDemoLicense ? "Demo Paket" : "Standart Paket";
};

// Teknik tür isimlerini kullanıcı dostu isimlere çevir
const formatTypeName = (type: string): string => {
  const typeMap: Record<string, string> = {
    // Kıdem
    "kidem": "Kıdem Tazminatı",
    "kidem_standart": "Kıdem Tazminatı",
    "kidem_30isci": "Kıdem Tazminatı (30+ İşçi)",
    "kidem_gemi": "Gemi Adamı Kıdem Tazminatı",
    "kidem_basin": "Basın İşçisi Kıdem Tazminatı",
    "kidem_mevsim": "Mevsimlik İşçi Kıdem Tazminatı",
    "kidem_kismi": "Kısmi Süreli Kıdem Tazminatı",
    "kidem_belirli": "Belirli Süreli Kıdem Tazminatı",
    "kidem_borclar": "Borçlar Kanunu Kıdem Tazminatı",
    
    // İhbar
    "ihbar": "İhbar Tazminatı",
    "ihbar_standart": "İhbar Tazminatı",
    "ihbar_30isci": "İhbar Tazminatı (30+ İşçi)",
    "ihbar_gemi": "Gemi Adamı İhbar Tazminatı",
    "ihbar_basin": "Basın İşçisi İhbar Tazminatı",
    "ihbar_mevsim": "Mevsimlik İşçi İhbar Tazminatı",
    "ihbar_kismi": "Kısmi Süreli İhbar Tazminatı",
    "ihbar_belirli": "Belirli Süreli İhbar Tazminatı",
    "ihbar_borclar": "Borçlar Kanunu İhbar Tazminatı",
    
    // Yıllık İzin
    "yillik_izin": "Yıllık İzin Ücreti",
    "yillik_izin_standart": "Yıllık İzin Ücreti",
    "yillik_izin_gemi": "Gemi Adamı Yıllık İzin",
    "yillik_izin_basin": "Basın İşçisi Yıllık İzin",
    "yillik_izin_mevsim": "Mevsimlik Yıllık İzin",
    "yillik_izin_kismi": "Kısmi Süreli Yıllık İzin",
    "yillik_izin_belirli": "Belirli Süreli Yıllık İzin",
    
    // Fazla Mesai
    "fazla_mesai": "Fazla Mesai Alacağı",
    "fazla_mesai_standart": "Fazla Mesai Alacağı",
    "fazla_mesai_bilirkisi_1": "Fazla Mesai (Bilirkişi-1)",
    "fazla_mesai_bilirkisi_2": "Fazla Mesai (Bilirkişi-2)",
    "fazla_mesai_gemi": "Gemi Adamı Fazla Mesai",
    "fazla_mesai_gece": "Gece Fazla Mesai",
    "fazla_mesai_vardiya": "Vardiya Fazla Mesai",
    
    // UBGT
    "ubgt": "UBGT Alacağı",
    "ubgt_alacagi": "UBGT Alacağı",
    
    // Hafta Tatili
    "hafta_tatili": "Hafta Tatili Alacağı",
    "hafta_tatili_standart": "Hafta Tatili Alacağı",
    "hafta_tatili_gemi": "Gemi Adamı Hafta Tatili",
    "hafta_tatili_basin": "Basın İşçisi Hafta Tatili",
    
    // Diğer
    "ucret": "Ücret Alacağı",
    "ucret_alacagi": "Ücret Alacağı",
    "bakiye_ucret": "Bakiye Ücret Alacağı",
    "prim": "Prim Alacağı",
    "prim_alacagi": "Prim Alacağı",
    "kotu_niyet": "Kötü Niyet Tazminatı",
    "bosta_gecen_sure": "Boşta Geçen Süre Ücreti",
    "ise_almama": "İşe Başlatmama Tazminatı",
    "ayrimcilik": "Ayrımcılık Tazminatı",
    "haksiz_fesih": "Haksız Fesih Tazminatı",
    "is_arama_izni": "İş Arama İzni Ücreti",
    "davaci_ucreti": "Davacı Ücreti",
  };
  
  // Tam eşleşme
  if (typeMap[type]) return typeMap[type];
  
  // Kısmi eşleşme dene
  const lowerType = type.toLowerCase();
  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerType.includes(key) || key.includes(lowerType)) {
      return value;
    }
  }
  
  // Eşleşme bulunamazsa, _ karakterlerini boşlukla değiştir ve ilk harfleri büyüt
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface SavedCase {
  id: number;
  name?: string;
  type: string;
  data?: any;
  created_at?: string;
  createdAt?: string;
  brut_total?: number;
  net_total?: number;
  brut_toplam?: number;
  net_toplam?: number;
  hesaplama_tipi?: string;
}

interface DemoLicense {
  expiresAt: string;
  createdAt: string;
  activatedAt: string;
  type: string;
}

interface UserInfo {
  id: number;
  email: string;
  name?: string;
  subscriptionStartsAt?: string;
  subscriptionEndsAt?: string;
  status?: string;
  demoLicense?: DemoLicense;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const tenantId = localStorage.getItem("tenant_id") || "1";
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedCases, setSavedCases] = useState<SavedCase[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [chartWidth, setChartWidth] = useState(500);
  const [chartPeriod, setChartPeriod] = useState<"haftalik" | "aylik" | "yillik" | "tum">("aylik");
  const barChartRef = useRef<HTMLDivElement>(null);
  
  // Verileri yükle
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Kayıtlı hesaplamaları yükle
      const token = localStorage.getItem("access_token");
      const casesRes = await fetch(`${API_URL}/api/saved-cases`, {
        headers: {
          "x-tenant-id": tenantId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      
      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setSavedCases(Array.isArray(casesData) ? casesData : []);
      }
      
      // Kullanıcı bilgilerini yükle (abonelik için)
      try {
        const token = localStorage.getItem("access_token");
        // Email: "email" veya "current_user" içindeki email
        let userEmail = localStorage.getItem("email");
        if (!userEmail) {
          const currentUser = localStorage.getItem("current_user");
          if (currentUser) {
            try {
              const parsed = JSON.parse(currentUser);
              userEmail = parsed.email;
            } catch {}
          }
        }
        
        if (userEmail) {
          // Önce auth/me endpoint'ini dene (tüm kullanıcılar için çalışır)
          let userRes = await fetch(`${API_URL}/api/auth/me?email=${encodeURIComponent(userEmail)}`, {
            headers: { 
              "x-tenant-id": tenantId,
              "Authorization": `Bearer ${token}`
            }
          });
          
          // Eğer başarısız olursa admin endpoint'ini dene
          if (!userRes.ok) {
            userRes = await fetch(`${API_URL}/api/admin/users/email/${encodeURIComponent(userEmail)}`, {
              headers: { 
                "x-tenant-id": tenantId,
                "Authorization": `Bearer ${token}`,
                "x-user-role": "admin"
              }
            });
          }
          
          if (userRes.ok) {
            const userData = await userRes.json();
            setUserInfo(userData);
          }
        }
      } catch (e) {
        console.log("User info not available");
      }
      
    } catch (err) {
      console.error("Dashboard veri yükleme hatası:", err);
      setError("Veriler yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, [tenantId]);
  
  // Chart genişliğini container'a göre ayarla (scroll yok) - Edge uyumlu
  useEffect(() => {
    const updateChartWidth = () => {
      if (barChartRef.current) {
        const containerWidth = barChartRef.current.offsetWidth;
        // Container genişliğinden padding çıkar (p-4 = 16px * 2 = 32px)
        const newWidth = Math.max(300, containerWidth - 32); // Minimum 300px
        setChartWidth(newWidth);
      }
    };
    
    // İlk yükleme - birden fazla deneme (Edge için)
    const timer1 = setTimeout(updateChartWidth, 50);
    const timer2 = setTimeout(updateChartWidth, 200);
    const timer3 = setTimeout(updateChartWidth, 500);
    
    // Resize event
    window.addEventListener('resize', updateChartWidth);
    
    // ResizeObserver (modern browsers için)
    let resizeObserver: ResizeObserver | null = null;
    if (barChartRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateChartWidth);
      resizeObserver.observe(barChartRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateChartWidth);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [loading]);

  // İstatistikleri hesapla
  const stats = useMemo(() => {
    if (!savedCases.length) {
      return {
        totalCount: 0,
        lastRecordName: "-",
        lastRecordType: "-",
      };
    }
    
    const totalCount = savedCases.length;
    
    // En son kayıt - kullanıcının verdiği isim
    const lastCase = savedCases[0];
    const lastRecordName = lastCase?.name || "-";
    const rawType = lastCase?.type || lastCase?.hesaplama_tipi || "-";
    const lastRecordType = rawType !== "-" ? formatTypeName(rawType) : "-";
    
    return {
      totalCount,
      lastRecordName,
      lastRecordType,
    };
  }, [savedCases]);

  // Abonelik durumu hesapla - Demo kullanıcılarda demoLicense tarihleri kullanılır
  const subscriptionInfo = useMemo(() => {
    const start = userInfo?.demoLicense?.activatedAt ?? userInfo?.subscriptionStartsAt;
    const end = userInfo?.demoLicense?.expiresAt ?? userInfo?.subscriptionEndsAt;
    const calc = calculateSubscription(start, end);

    return {
      daysRemaining: calc.daysRemaining,
      totalDays: calc.totalDays,
      daysUsed: calc.daysUsed,
      remainingPct: calc.remainingPct,
      usedPct: calc.usedPct,
      hasSubscription: calc.hasSubscription,
      startDate: calc.startDate,
      endDate: calc.endDate,
      isActive: calc.isActive,
      isExpired: calc.isExpired,
      isExpiringSoon: calc.isExpiringSoon,
    };
  }, [userInfo]);

  // Pie chart verisi - türlere göre dağılım
  const pieData = useMemo(() => {
    const typeCount: Record<string, number> = {};
    
    savedCases.forEach(c => {
      const type = c.type || c.hesaplama_tipi || "Diğer";
      // Türü normalize et
      let normalizedType = type;
      if (type.toLowerCase().includes("kıdem") || type.toLowerCase().includes("kidem")) {
        normalizedType = "Kıdem";
      } else if (type.toLowerCase().includes("ihbar")) {
        normalizedType = "İhbar";
      } else if (type.toLowerCase().includes("izin") || type.toLowerCase().includes("yıllık")) {
        normalizedType = "Yıllık İzin";
      } else if (type.toLowerCase().includes("ücret") || type.toLowerCase().includes("ucret")) {
        normalizedType = "Ücret";
      } else if (type.toLowerCase().includes("fazla") || type.toLowerCase().includes("mesai")) {
        normalizedType = "Fazla Mesai";
      } else if (type.toLowerCase().includes("hafta")) {
        normalizedType = "Hafta Tatili";
      } else if (type.toLowerCase().includes("ubgt")) {
        normalizedType = "UBGT";
      }
      
      typeCount[normalizedType] = (typeCount[normalizedType] || 0) + 1;
    });
    
    return Object.entries(typeCount).map(([name, value]) => ({ name, value }));
  }, [savedCases]);
  
  const pieColors = ["#60A5FA", "#FBBF24", "#34D399", "#F87171", "#A78BFA", "#F472B6", "#38BDF8"];

  // Bar chart verisi - hesaplama sayısı (haftalık/aylık/yıllık/tümü)
  const barData = useMemo(() => {
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", 
                        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const countByKey: Record<string, number> = {};
    const now = new Date();

    const getWeekKey = (d: Date) => {
      const day = d.getDay() || 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - day + 1);
      return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
    };

    if (chartPeriod === "haftalik") {
      const weekKeys: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - 7 * i);
        const key = getWeekKey(d);
        weekKeys.push(key);
        countByKey[key] = 0;
      }
      savedCases.forEach(c => {
        const dateStr = c.created_at || c.createdAt;
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              const key = getWeekKey(d);
              if (key in countByKey) countByKey[key]++;
            }
          } catch {}
        }
      });
      return weekKeys.map(key => {
        const [y, m, day] = key.split("-").map(Number);
        return { name: `${day}.${m}`, Adet: countByKey[key] };
      });
    }

    if (chartPeriod === "yillik") {
      const currentYear = now.getFullYear();
      for (let i = 6; i >= 0; i--) {
        const y = currentYear - i;
        countByKey[String(y)] = 0;
      }
      savedCases.forEach(c => {
        const dateStr = c.created_at || c.createdAt;
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              const key = String(d.getFullYear());
              if (key in countByKey) countByKey[key]++;
            }
          } catch {}
        }
      });
      return Object.keys(countByKey).sort((a, b) => Number(a) - Number(b)).map(key => ({
        name: key,
        Adet: countByKey[key]
      }));
    }

    if (chartPeriod === "tum") {
      const monthCount: Record<string, number> = {};
      savedCases.forEach(c => {
        const dateStr = c.created_at || c.createdAt;
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              monthCount[key] = (monthCount[key] || 0) + 1;
            }
          } catch {}
        }
      });
      const sorted = Object.entries(monthCount).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
      return sorted.map(([key, adet]) => {
        const [, m] = key.split("-").map(Number);
        return { name: monthNames[m - 1] + " " + key.slice(0, 4), Adet: adet };
      });
    }

    // aylık (varsayılan)
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const months: Array<{ year: number; month: number; key: string }> = [];
    for (let i = 6; i >= 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;
      while (month < 0) { month += 12; year -= 1; }
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      months.push({ year, month, key });
      countByKey[key] = 0;
    }
    savedCases.forEach(c => {
      const dateStr = c.created_at || c.createdAt;
      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (key in countByKey) countByKey[key]++;
          }
        } catch {}
      }
    });
    return months.map(({ key, month }) => ({
      name: monthNames[month],
      Adet: countByKey[key]
    }));
  }, [savedCases, chartPeriod]);

  // Son kayıtlar
  const recentCases = useMemo(() => {
    return savedCases.slice(0, 10).map(c => {
      // Brüt ve Net değerleri çıkar - birden fazla kaynaktan dene
      let brut = c.brut_total || c.brut_toplam || 0;
      let net = c.net_total || c.net_toplam || 0;
      
      // Eğer hala 0 ise, detay veya data içinden çıkarmaya çalış
      if ((brut === 0 || !brut) && c.detay) {
        try {
          const detay = typeof c.detay === 'string' ? JSON.parse(c.detay) : c.detay;
          brut = detay.brutTazminat || detay.brutTazminatTutari || detay.brut_tazminat || detay.toplamBrut || detay.brutTotal || detay.brut_total || brut;
          net = detay.netTazminat || detay.netTazminatTutari || detay.net_tazminat || detay.toplamNet || detay.netTotal || detay.net_total || net;
        } catch (e) {
          console.log("Detay parse hatası:", e);
        }
      }
      
      if ((brut === 0 || !brut) && c.data) {
        try {
          const data = typeof c.data === 'string' ? JSON.parse(c.data) : c.data;
          brut = data.brutTazminat || data.brutTazminatTutari || data.brut_tazminat || data.toplamBrut || data.brutTotal || data.brut_total || brut;
          net = data.netTazminat || data.netTazminatTutari || data.net_tazminat || data.toplamNet || data.netTotal || data.net_total || net;
        } catch (e) {
          console.log("Data parse hatası:", e);
        }
      }
      
      const dateStr = c.created_at || c.createdAt;
      const date = dateStr ? new Date(dateStr).toLocaleDateString("tr-TR") : "-";
      const rawType = c.type || c.hesaplama_tipi || "Hesaplama";
      const type = formatTypeName(rawType);
      
      return { 
        id: c.id, 
        type, 
        rawType,
        date, 
        brut: Number(brut) || 0, 
        net: Number(net) || 0, 
        name: c.name || c.aciklama || c.kayit_adi,
        data: c.data || c.detay // Detay için data'yı da tut
      };
    });
  }, [savedCases]);

  const [detail, setDetail] = useState<{ open: boolean; row?: typeof recentCases[number] }>({ open: false });

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen p-2 md:p-4" style={{ maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 1) Üst İstatistik Kartları */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', maxWidth: '100%' }}>
        <Card>
          <CardContent className="p-4 md:p-6 flex items-center gap-3">
            <div className="p-2 md:p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex-shrink-0">
              <FileText size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Toplam Hesaplama Sayısı</div>
              <div className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">{number(stats.totalCount)}</div>
            </div>
          </CardContent>
        </Card>
        <Card style={{ flex: '1 1 250px', minWidth: 0, maxWidth: '100%' }}>
          <CardContent className="p-3 md:p-4 flex items-center gap-2" style={{ minWidth: 0 }}>
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex-shrink-0">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Ortalama Hesaplama Süresi</div>
              <div className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                {(() => {
                  // Son 10 hesaplamanın ortalama süresini hesapla
                  if (savedCases.length === 0) return '—';
                  
                  const recentCases = savedCases.slice(0, 10);
                  let totalSeconds = 0;
                  let validCount = 0;
                  
                  recentCases.forEach(c => {
                    if (c.createdAt && c.updatedAt) {
                      const created = new Date(c.createdAt).getTime();
                      const updated = new Date(c.updatedAt).getTime();
                      const diffMs = updated - created;
                      
                      // Sadece makul süreleri say (0-300 saniye arası)
                      if (diffMs > 0 && diffMs < 300000) {
                        totalSeconds += diffMs / 1000;
                        validCount++;
                      }
                    }
                  });
                  
                  if (validCount === 0) return 'Çok Hızlı ⚡';
                  
                  const avgSeconds = totalSeconds / validCount;
                  
                  if (avgSeconds < 60) {
                    return `${avgSeconds.toFixed(1)} sn`;
                  } else {
                    const minutes = Math.floor(avgSeconds / 60);
                    const seconds = Math.floor(avgSeconds % 60);
                    return `${minutes}dk ${seconds}sn`;
                  }
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card style={{ flex: '1 1 250px', minWidth: 0, maxWidth: '100%' }}>
          <CardContent className="p-3 md:p-4 flex items-center gap-2" style={{ minWidth: 0 }}>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex-shrink-0">
              <Calendar size={16} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Son Giriş Tarihi</div>
              <div className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                {(() => {
                  const lastLogin = localStorage.getItem('last_login_date');
                  if (lastLogin) {
                    const date = new Date(lastLogin);
                    return date.toLocaleDateString('tr-TR', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  }
                  return 'İlk Giriş';
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card style={{ flex: '1 1 250px', minWidth: 0, maxWidth: '100%' }}>
          <CardContent className="p-3 md:p-4 flex items-center gap-2" style={{ minWidth: 0 }}>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex-shrink-0">
              <Scale size={16} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">En Son Kayıt Adı</div>
              <div className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">{stats.lastRecordName}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2) Abonelik Durumu - Profesyonel Tasarım */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Abonelik Bilgileri
                </CardTitle>
                <CardDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {getSubscriptionDisplayLabel(userInfo?.subscriptionType, !!userInfo?.demoLicense)}
                </CardDescription>
              </div>
            </div>
            <Badge 
              variant={subscriptionInfo.daysRemaining > 0 ? "default" : "destructive"}
              className={cn(
                "gap-1",
                subscriptionInfo.daysRemaining > 0 
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                  : ""
              )}
            >
              {subscriptionInfo.daysRemaining > 0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  {subscriptionInfo.daysRemaining} gün kaldı
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Süresi doldu
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tarih Bilgileri */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white/60 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Başlangıç Tarihi</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {userInfo?.demoLicense?.activatedAt 
                  ? new Date(userInfo.demoLicense.activatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                  : userInfo?.subscriptionStartsAt 
                    ? new Date(userInfo.subscriptionStartsAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '-'
                }
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Bitiş Tarihi</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {userInfo?.demoLicense?.expiresAt 
                  ? new Date(userInfo.demoLicense.expiresAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                  : userInfo?.subscriptionEndsAt 
                    ? new Date(userInfo.subscriptionEndsAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '-'
                }
              </div>
            </div>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-white/60 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Toplam Süre</div>
              <div className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">{subscriptionInfo.totalDays}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">gün</div>
            </div>
            <div className="text-center p-3 bg-white/60 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kullanılan</div>
              <div className="text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400">{subscriptionInfo.daysUsed}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">gün</div>
            </div>
            <div className="text-center p-3 bg-white/60 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kalan</div>
              <div className={cn(
                "text-lg md:text-xl font-bold",
                subscriptionInfo.daysRemaining > 30 ? "text-green-600 dark:text-green-400" : 
                subscriptionInfo.daysRemaining > 7 ? "text-amber-600 dark:text-amber-400" : 
                "text-red-600 dark:text-red-400"
              )}>
                {subscriptionInfo.daysRemaining}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">gün</div>
            </div>
            <div className="text-center p-3 bg-white/60 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kullanım Oranı</div>
              <div className="text-lg md:text-xl font-bold text-indigo-600 dark:text-indigo-400">%{subscriptionInfo.usedPct.toFixed(1)}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">tamamlandı</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>Abonelik İlerlemesi</span>
              <span className="font-semibold text-green-600 dark:text-green-400">%{subscriptionInfo.remainingPct.toFixed(1)} kaldı</span>
            </div>
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500 shadow-lg",
                  subscriptionInfo.daysRemaining > 30 
                    ? "bg-gradient-to-r from-green-500 to-emerald-600" 
                    : subscriptionInfo.daysRemaining > 7 
                      ? "bg-gradient-to-r from-amber-500 to-orange-600" 
                      : "bg-gradient-to-r from-red-500 to-rose-600"
                )}
                style={{ width: `${subscriptionInfo.remainingPct}%` }} 
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {!subscriptionInfo.hasSubscription
                ? "⚠️ Abonelik bilgisi bulunamadı. Admin panelinden abonelik tarihleri ayarlayın."
                : subscriptionInfo.daysRemaining > 0 
                  ? `🎯 ${subscriptionInfo.daysUsed} gün tamamlandı • ${subscriptionInfo.daysRemaining} gün kaldı`
                  : "❌ Aboneliğinizin süresi doldu"
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3) Grafik Alanı */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', maxWidth: '100%' }}>
        <Card className="border-gray-200 dark:border-gray-700" style={{ flex: '1 1 400px', minWidth: 0, maxWidth: '100%' }}>
          <CardHeader>
            <CardTitle className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100" style={{ wordBreak: 'break-word' }}>
              Hesaplama Türlerine Göre Dağılım
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-3 flex justify-center" style={{ overflow: 'auto', maxWidth: '100%' }}>
            {pieData.length > 0 ? (
              <div className="w-full max-w-[400px] h-[300px] sm:h-[350px]">
                <PieChart width={Math.min(400, window.innerWidth - 80)} height={300}>
                <Pie 
                  data={pieData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100} 
                  label={(entry) => entry.name}
                  labelLine={true}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <ReTooltip />
                <ReLegend 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconSize={10}
                />
                </PieChart>
              </div>
            ) : (
              <EmptyStateMessage 
                message="Henüz hesaplama kaydı bulunmuyor"
                showTenantWarning={false}
              />
            )}
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-gray-700 relative overflow-visible" style={{ flex: '1 1 400px', minWidth: 0, maxWidth: '100%' }}>
          <CardHeader className="pb-2 pr-10">
            <CardTitle className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100" style={{ wordBreak: 'break-word' }}>
              Hesaplama Sayısı
            </CardTitle>
          </CardHeader>
          <div className="absolute top-3 right-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs transition-colors"
                  aria-label="Görünüm seç"
                >
                  <span>
                    {chartPeriod === "haftalik" && "Haftalık"}
                    {chartPeriod === "aylik" && "Aylık"}
                    {chartPeriod === "yillik" && "Yıllık"}
                    {chartPeriod === "tum" && "Tümü"}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0" />
                </button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  <DropdownMenuItem onClick={() => setChartPeriod("haftalik")}>
                    Haftalık
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChartPeriod("aylik")}>
                    Aylık
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChartPeriod("yillik")}>
                    Yıllık
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChartPeriod("tum")}>
                    Tümünü göster
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
          <CardContent className="p-2 md:p-3" style={{ overflow: 'auto', maxWidth: '100%' }} ref={barChartRef}>
            <BarChart 
              width={chartWidth} 
              height={300} 
              data={barData} 
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                stroke="#6b7280" 
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#6b7280" 
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                width={40}
              />
              <ReTooltip 
                contentStyle={{ fontSize: '12px' }}
                cursor={{ fill: 'rgba(96, 165, 250, 0.1)' }}
              />
              <Bar 
                dataKey="Adet" 
                fill="#60A5FA" 
                name="Hesaplama Sayısı"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </CardContent>
        </Card>
      </div>

      {/* 4) Son Hesaplamalar Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Son Kayıtlar
          </CardTitle>
          <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
            En son yapılan hesaplamaların listesi
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 md:p-3">
          <div className="table-wrapper" style={{ overflow: 'auto', maxWidth: '100%' }}>
            {recentCases.length > 0 ? (
              <table className="text-xs md:text-sm" style={{ width: '100%', minWidth: '600px', tableLayout: 'auto' }}>
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tür</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Kayıt Adı</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Tarih</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Brüt</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Net</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentCases.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-gray-900 dark:text-gray-100 font-medium text-xs sm:text-sm">{r.type}</td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-gray-600 dark:text-gray-400 text-xs sm:text-sm hidden sm:table-cell">{r.name || "-"}</td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-gray-600 dark:text-gray-400 text-xs sm:text-sm hidden md:table-cell">{r.date}</td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{r.brut > 0 ? `₺${number(r.brut)}` : "-"}</td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-gray-900 dark:text-gray-100 font-semibold text-xs sm:text-sm hidden sm:table-cell">{r.net > 0 ? `₺${number(r.net)}` : "-"}</td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-right">
                        <button 
                          className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors" 
                          onClick={() => setDetail({ open: true, row: r })}
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                Henüz kayıtlı hesaplama bulunmuyor.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detay Modal */}
      {detail.open && detail.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setDetail({ open: false })} />
          <Card className="relative w-full max-w-lg border-gray-200 dark:border-gray-700 max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kayıt Detayı</CardTitle>
                <button 
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none transition-colors" 
                  onClick={() => setDetail({ open: false })}
                  aria-label="Kapat"
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1">
              <div className="space-y-4 text-sm">
                {/* Temel Bilgiler */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Temel Bilgiler</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Hesaplama Türü</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{detail.row.type}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Kayıt Adı</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{detail.row.name || "-"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Kayıt Tarihi</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{detail.row.date}</p>
                    </div>
                  </div>
                </div>
                
                {/* Hesaplama Detayları - data varsa göster */}
                {detail.row.data && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 text-xs uppercase tracking-wider">Hesaplama Detayları</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* İşe Giriş/Çıkış Tarihleri */}
                      {(detail.row.data.iseGiris || detail.row.data.ise_giris) && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">İşe Giriş</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {new Date(detail.row.data.iseGiris || detail.row.data.ise_giris).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                      )}
                      {(detail.row.data.istenCikis || detail.row.data.isten_cikis) && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">İşten Çıkış</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {new Date(detail.row.data.istenCikis || detail.row.data.isten_cikis).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                      )}
                      {/* Ücret */}
                      {(detail.row.data.ucret || detail.row.data.brut || detail.row.data.brutUcret) && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">Brüt Ücret</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {number(detail.row.data.ucret || detail.row.data.brut || detail.row.data.brutUcret || 0)} ₺
                          </p>
                        </div>
                      )}
                      {/* Çalışma Süresi */}
                      {(detail.row.data.calismaSuresi || detail.row.data.workPeriod) && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">Çalışma Süresi</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {detail.row.data.calismaSuresi || detail.row.data.workPeriod}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Sonuçlar */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 text-xs uppercase tracking-wider">Sonuçlar</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Brüt Tutar</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-lg">
                        {detail.row.brut > 0 ? `₺${number(detail.row.brut)}` : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Net Tutar</span>
                      <p className="font-medium text-green-600 dark:text-green-400 text-lg">
                        {detail.row.net > 0 ? `₺${number(detail.row.net)}` : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardContent className="pt-0 flex justify-end flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
              <button 
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors" 
                onClick={() => setDetail({ open: false })}
              >
                Kapat
              </button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
