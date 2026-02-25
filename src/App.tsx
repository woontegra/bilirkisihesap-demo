import { Routes, Route, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { Ticket } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/utils/apiClient";
import { isTokenExpired, refreshAccessToken, getAccessToken } from "@/utils/authToken";
import { migrateScopedStorageKeysOnce } from "@/utils/storageKey";

// Pages
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ProfessionalLicenseActivation from "./pages/ProfessionalLicenseActivation";
import AccidentWizardStart from "./pages/AccidentWizardStart";
import DashboardPage from "@/pages/DashboardPage";
import ProfilePage from "@/pages/Profile/ProfilePage";
import SavedCalculationsPage from "@/pages/Profile/SavedCalculationsPage";
import NotificationsPage from "@/pages/Profile/NotificationsPage";
import ComingSoonModal from "@/components/ui/ComingSoonModal";
import DemoExpiredModal from "@/components/modals/DemoExpiredModal";
import DeviceLimitExceededModal from "@/components/modals/DeviceLimitExceededModal";
import { Toaster } from "@/context/ToastContext";
import Sidebar from "@/components/layout/Sidebar";
import UserMenu from "@/components/layout/UserMenu";

// Independent Pages
import UbgtIndependent from "@/pages/ubgt-alacagi/UbgtIndependent";
import UbgtBilirkisiIndependent from "@/pages/ubgt-alacagi/UbgtBilirkisiIndependent";
import UcretIndependent from "@/pages/ucret-alacagi/UcretIndependent";
import BakiyeUcretIndependent from "@/pages/bakiye-ucret-alacagi/BakiyeUcretIndependent";
import DavaciUcretiPage from "@/pages/davaci-ucreti/DavaciUcretiPage";
import IsAramaIzniIndependent from "@/pages/is-arama-izni-ucreti/IsAramaIzniIndependent";
import PrimAlacagiPage from "@/pages/prim-alacagi/PrimAlacagiPage";
import KotuNiyetIndependent from "@/pages/kotu-niyet-tazminati/KotuNiyetIndependent";
import BostaGecenSureIndependent from "@/pages/bosta-gecen-sure-ucreti/BostaGecenSureIndependent";
import IseAlmamaIndependent from "@/pages/ise-almama-tazminati/IseAlmamaIndependent";
import AyrimcilikIndependent from "@/pages/ayrimcilik-tazminati/AyrimcilikIndependent";
import HaksizFesihIndependent from "@/pages/haksiz-fesih-tazminati/HaksizFesihIndependent";

// Router Components
import KidemRouter from "@/pages/kidem-tazminati/KidemRouter";
import IhbarRouter from "@/pages/ihbar-tazminati/IhbarRouter";
import FazlaMesaiRouter from "@/pages/fazla-mesai/FazlaMesaiRouter";
import YillikRouter from "./pages/yillik-ucretli-izin/YillikRouter";
import HaftaTatiliRouter from "@/pages/hafta-tatili-alacagi/HaftaTatiliRouter";
import HaftaTatiliRaporPage from "@/pages/hafta-tatili-alacagi/HaftaTatiliRaporPage";

// Context Hooks (Providers are in main.tsx)
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// Admin Pages
import AdminRoute from "@/components/auth/AdminRoute";
import ProfessionalProtectedRoute from "@/components/ProfessionalProtectedRoute";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminCreateUserPage from "@/pages/admin/AdminCreateUserPage";
import AdminUserEditPage from "@/pages/admin/AdminUserEditPage";
import AdminSubscriptionsPage from "@/pages/admin/AdminSubscriptionsPage";
import AdminTicketsPage from "@/pages/admin/AdminTicketsPage";
import AdminFeedbackPage from "@/pages/admin/AdminFeedbackPage";
import AdminAccessDeniedPage from "@/pages/admin/AdminAccessDeniedPage";
import LogsPage from "@/pages/admin/LogsPage";
import AdminTenantAnalytics from "@/pages/admin/AdminTenantAnalytics";
// import PaymentSettingsPage from "@/pages/admin/PaymentSettingsPage"; // Geçici kapatıldı
import ProfessionalLicenseManagement from "@/pages/admin/ProfessionalLicenseManagement";
import LicenseManagementFull from "@/pages/admin/LicenseManagementFull";
import LicensesManagement from "@/pages/admin/LicensesManagement";
import AdminEmailNotifications from "@/pages/admin/AdminEmailNotifications";
import DemoConversionPage from "@/pages/admin/DemoConversionPage";

// Other utilities
import PrimHesaplamaPage from "@/pages/PrimHesaplamaPage";
import FazlaMesaiRaporPage from "@/pages/FazlaMesaiRaporPage";
import GlobalCalculationTools from "@/components/GlobalCalculationTools";
// import HukukBot from "@/components/HukukBot"; // Geçici olarak kapatıldı


// Calculation pages
import ViewCalculation from "@/pages/calculations/ViewCalculation";
import EditCalculation from "@/pages/calculations/EditCalculation";
import PrintCalculation from "@/pages/calculations/PrintCalculation";

function HeaderBar({ 
  sidebarCollapsed, 
  setSidebarCollapsed 
}: { 
  sidebarCollapsed: boolean; 
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>; 
}) {
  const { user, logout } = useAuth();
  const { show } = useToast();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifCloseTimer = useRef<number | null>(null);
  const [notifs, setNotifs] = useState<{id:number; title:string; created_at?:string; read?:boolean}[]>([]);
  const [loading, setLoading] = useState(false);
  const unread = notifs.filter(n=>!n.read).length;
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  // Route-based page title mapping
  const getPageTitle = (pathname: string): string => {
    const routeMap: Record<string, string> = {
      "/ubgt-alacagi": "UBGT Alacağı Hesaplama",
      "/hafta-tatili-alacagi": "Hafta Tatili Alacağı Hesaplama",
      "/ucret-alacagi": "Ücret Alacağı Hesaplama",
      "/bakiye-ucret-alacagi": "Bakiye Ücret Alacağı Hesaplama",
      "/davaci-ucreti": "Davacı Ücreti Hesaplama",
      "/prim-alacagi": "Prim Alacağı Hesaplama",
      "/kotu-niyet-tazminati": "Kötü Niyet Tazminatı Hesaplama",
      "/bosta-gecen-sure-ucreti": "Boşta Geçen Süre Ücreti Hesaplama",
      "/ayrimcilik-tazminati": "Ayrımcılık Tazminatı Hesaplama",
      "/ise-almama-tazminati": "İşe Başlatmama Tazminatı Hesaplama",
      "/haksiz-fesih-tazminati": "Haksız Fesih Tazminatı Hesaplama",
      "/is-arama-izni-ucreti": "İş Arama İzni Ücreti Hesaplama",
    };

    // Check exact match first
    if (routeMap[pathname]) {
      return routeMap[pathname];
    }

    // Check for ID-based routes (e.g. /davaci-ucreti/34)
    for (const [route, title] of Object.entries(routeMap)) {
      if (pathname.startsWith(route + "/")) {
        return title;
      }
    }

    // Check for kidem-tazminati routes
    if (pathname.startsWith("/kidem-tazminati/")) {
      const parts = pathname.split("/");
      // Son kısım ID ise (sayı), bir önceki kısmı al
      let lastPart = parts[parts.length - 1];
      if (!isNaN(Number(lastPart)) && parts.length > 2) {
        lastPart = parts[parts.length - 2];
      }
      const kidemMap: Record<string, string> = {
        "gemi": "Gemi Adamları Kıdem Tazminatı Hesaplama",
        "kismi-sureli": "Kısmi Süreli / Part Time Kıdem Tazminatı Hesaplama",
        "belirli-sureli": "Belirli Süreli Kıdem Tazminatı Hesaplama",
        "borclar": "Borçlar Kanunu Kıdem Tazminatı Hesaplama",
        "mevsimlik": "Mevsimlik İşçi Kıdem Tazminatı Hesaplama",
        "basin": "Basın İşçileri Kıdem Tazminatı Hesaplama",
        "part-time": "Kısmi Süreli / Part Time Kıdem Tazminatı Hesaplama",
        // "parca-basi": "Parça Başı Kıdem Tazminatı Hesaplama", // Kaldırıldı - dosya projede kalıyor
        // "toplu": "Toplu İş Sözleşmesi Kıdem Tazminatı Hesaplama", // Kaldırıldı - dosya projede kalıyor
        "30": "İş Kanununa Göre Kıdem Tazminatı Hesaplama",
        "30isci": "İş Kanununa Göre Kıdem Tazminatı Hesaplama",
      };
      return kidemMap[lastPart] || "Kıdem Tazminatı Hesaplama";
    }

    // Check for ihbar-tazminati routes
    if (pathname.startsWith("/ihbar-tazminati/")) {
      const parts = pathname.split("/");
      // Son kısım ID ise (sayı), bir önceki kısmı al
      let lastPart = parts[parts.length - 1];
      if (!isNaN(Number(lastPart)) && parts.length > 2) {
        lastPart = parts[parts.length - 2];
      }
      const ihbarMap: Record<string, string> = {
        "kismi": "Kısmi Süreli / Part Time İhbar Tazminatı Hesaplama",
        "part": "Part Time İhbar Tazminatı Hesaplama",
        "parca": "Parça Başı İhbar Tazminatı Hesaplama",
        "borclar": "Borçlar Kanunu İhbar Tazminatı Hesaplama",
        // "toplu": "Toplu İş Sözleşmesi İhbar Tazminatı Hesaplama", // Kaldırıldı - dosya projede kalıyor
        "mevsim": "Mevsimlik İşçi İhbar Tazminatı Hesaplama",
        "gemi": "Gemi Adamları İhbar Tazminatı Hesaplama",
        "belirli": "Belirli Süreli İhbar Tazminatı Hesaplama",
        "basin": "Basın İşçileri İhbar Tazminatı Hesaplama",
        "30": "İş Kanununa Göre İhbar Tazminatı Hesaplama",
        "30isci": "İş Kanununa Göre İhbar Tazminatı Hesaplama",
      };
      return ihbarMap[lastPart] || "İhbar Tazminatı Hesaplama";
    }

    // Check for yillik-izin routes
    if (pathname.startsWith("/yillik-izin/")) {
      const parts = pathname.split("/");
      // Son kısım ID ise (sayı), bir önceki kısmı al
      let lastPart = parts[parts.length - 1];
      if (!isNaN(Number(lastPart)) && parts.length > 2) {
        lastPart = parts[parts.length - 2];
      }
      const yillikMap: Record<string, string> = {
        "standart": "İş Kanununa Göre Yıllık İzin Hesaplama",
        // "toplu": "Toplu İş Sözleşmesi Yıllık İzin Hesaplama", // Kaldırıldı - dosya projede kalıyor
        "borclar": "Borçlar Kanunu Yıllık İzin Hesaplama",
        // "part": "Part Time Yıllık İzin Hesaplama", // Kaldırıldı - dosya projede kalıyor
        "belirli": "Belirli Süreli Yıllık İzin Hesaplama",
        "parca": "Parça Başı Yıllık İzin Hesaplama",
        "basin": "Basın İşçileri Yıllık İzin Hesaplama",
        "mevsim": "Mevsimlik İşçi Yıllık İzin Hesaplama",
        "kismi": "Kısmi Süreli / Part Time Yıllık İzin Hesaplama",
        "gemi": "Gemi Adamları Yıllık İzin Hesaplama",
      };
      return yillikMap[lastPart] || "Yıllık İzin Hesaplama";
    }

    // Check for hafta-tatili-alacagi routes
    if (pathname.startsWith("/hafta-tatili-alacagi/")) {
      const parts = pathname.split("/");
      // Son kısım ID ise (sayı), bir önceki kısmı al
      let lastPart = parts[parts.length - 1];
      if (!isNaN(Number(lastPart)) && parts.length > 2) {
        lastPart = parts[parts.length - 2];
      }
      const haftaTatiliMap: Record<string, string> = {
        "standard": "Standart Hafta Tatili Alacağı Hesaplama",
        "gemi-adami": "Gemi Adamı Hafta Tatili Alacağı Hesaplama",
        "basin-is": "Basın İş Hafta Tatili Alacağı Hesaplama",
      };
      return haftaTatiliMap[lastPart] || "Hafta Tatili Alacağı Hesaplama";
    }

    // Check for fazla-mesai routes
    if (pathname.startsWith("/fazla-mesai/")) {
      const parts = pathname.split("/");
      // Son kısım ID ise (sayı), bir önceki kısmı al
      let lastPart = parts[parts.length - 1];
      if (!isNaN(Number(lastPart)) && parts.length > 2) {
        lastPart = parts[parts.length - 2];
      }
      const fazlaMesaiMap: Record<string, string> = {
        "standart": "Standart Fazla Mesai Hesaplama",
        "tanikli-standart": "Tanıklı Standart Fazla Mesai Hesaplama",
        "haftalik-karma": "Haftalık Karma Fazla Mesai Hesaplama",
        "donemsel": "Dönemsel Fazla Mesai Hesaplama",
        "donemsel-haftalik": "Dönemsel Haftalık Fazla Mesai Hesaplama",
        "vardiya-12": "12 Saatlik Vardiya Fazla Mesai Hesaplama",
        "vardiya12": "12 Saatlik Vardiya Fazla Mesai Hesaplama",
        "vardiya24": "24 Saat Çalışma Hesaplama",
        "vardiya48": "48 Saat Çalışma Hesaplama",
        "vardiya-24": "24 Saat Çalışma Hesaplama",
        "vardiya-48": "48 Saat Çalışma Hesaplama",
        "ev": "Ev İşçileri Fazla Mesai Hesaplama",
        "yeralti-isci": "Yeraltı İşçileri Fazla Mesai Hesaplama",
        "fazla-surelerle-calisma": "Fazla Sürelerle Çalışma Hesaplama",
        "gemi": "Gemi Adamları Günlük Çalışan Fazla Mesai Hesaplama",
        "gemi-7-24": "Gemi Adamları 7/24 Çalışan Fazla Mesai Hesaplama",
        "basin-is-fazla-mesai": "Basın İş Fazla Mesai Hesaplama",
      };
      return fazlaMesaiMap[lastPart] || "Fazla Mesai Hesaplama";
    }

    // Check for UBGT routes
    if (pathname.startsWith("/ubgt-bilirkisi")) {
      return "Bilirkişi UBGT Alacağı Hesaplama";
    }
    if (pathname.startsWith("/ubgt-alacagi") || pathname.startsWith("/ubgt")) {
      return "UBGT Alacağı Hesaplama";
    }

    // Other routes
    if (pathname === "/admin") return "Yönetim Paneli";
    if (pathname === "/dashboard") return "Yönetim Paneli";
    
    // Admin sub-routes
    if (pathname === "/admin/tickets") return "Destek Talepleri";
    if (pathname === "/admin/feedback") return "Kullanıcı Geri Bildirimleri";
    if (pathname === "/admin/users") return "Kullanıcı Yönetimi";
    if (pathname === "/admin/users/new") return "Yeni Kullanıcı Oluştur";
    if (pathname.startsWith("/admin/users/") && pathname.includes("/edit")) return "Kullanıcı Düzenle";
    if (pathname === "/admin/subscriptions") return "Abonelik Yönetimi";
    if (pathname === "/admin/logs") return "Sistem Logları";
    if (pathname === "/admin/analytics" || pathname === "/admin/tenant-analytics") return "Tenant İstatistikleri";
    if (pathname === "/admin/demo-conversion") return "Demo → Satış Dönüşüm Metrikleri";
    if (pathname === "/admin/professional-licenses") return "Profesyonel Lisans Yönetimi";
    if (pathname === "/admin/email-notifications") return "Email Bildirim Ayarları";
    if (pathname === "/admin/licenses") return "Lisans Yönetimi";
    if (pathname === "/admin/payment-settings") return "Ödeme Ayarları";
    if (pathname === "/admin-access-denied") return "Erişim Engellendi";
    
    // Profile routes
    if (pathname === "/profile/saved-calculations") return "Kayıtlı Hesaplamalarım";
    if (pathname === "/profile/ai-packages") return "AI Paket Yönetimi";
    if (pathname === "/profile/notifications") return "Bildirimler";
    if (pathname.startsWith("/profile")) return "Profil";
    
    // Calculation routes
    if (pathname.startsWith("/calculations/view/")) return "Hesaplama Görüntüle";
    if (pathname.startsWith("/calculations/edit/")) return "Hesaplama Düzenle";
    if (pathname.startsWith("/calculations/print/")) return "Hesaplama Yazdır";
    
    // Report routes
    if (pathname.startsWith("/rapor/hafta-tatili-alacagi/")) return "Hafta Tatili Alacağı Raporu";
    
    if (pathname === "/prim-hesaplama") return "Prim Hesaplama";

    return "";
  };

  const pageTitle = getPageTitle(location.pathname);

  // Set document title based on route
  useEffect(() => {
    const title = getPageTitle(location.pathname);
    if (title) {
      document.title = `Bilirkişi Hesaplama | ${title}`;
    } else {
      document.title = "Bilirkişi Hesaplama | Mercan Danışmanlık";
    }
  }, [location.pathname]);

  const loadNotifs = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const userId = user?.id || Number(localStorage.getItem("user_id") || "0");
      if (!userId) return;
      
      const res = await fetch(`${API_BASE_URL}/api/notifications`, { 
        headers: { 
          "x-tenant-id": String(tenantId),
          "x-user-id": String(userId),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        } 
      });
      const data = await res.json();
      const nextList = Array.isArray(data) ? data.slice(0, 8) : [];
      
      // Check for new unread notifications
      setNotifs((prev) => {
        const prevUnreadIds = new Set(prev.filter(n=>!n.read).map(n=>n.id));
        const newUnread = nextList.filter(n=>!n.read && !prevUnreadIds.has(n.id));
        if (newUnread.length > 0) {
          show({ title: "Yeni bildirim", description: newUnread[0].title, variant: "info" });
        }
        return nextList;
      });
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
    finally { setLoading(false); }
  }, [user, tenantId, show]);

  // Auto-refresh notifications every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    // Load immediately
    loadNotifs();
    
    // Then refresh every 30 seconds
    const interval = setInterval(() => {
      loadNotifs();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user, loadNotifs]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    const root = document.documentElement;
    if (newMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    window.dispatchEvent(new Event("theme-changed"));
  };

  // Desktop sidebar state - varsayılan açık (false = sidebar görünür)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Desktop sidebar toggle - tek tıklamada çalışır
  const toggleDesktopSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem("sidebarCollapsed", String(newValue));
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: newValue }));
      return newValue;
    });
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="h-16 flex items-center">
        {/* Left Section: Logo + Hamburger menus */}
        <div className="flex items-center justify-between gap-2 px-2 sm:px-4 lg:w-56 lg:pr-2 flex-shrink-0">
          <Link
            to="/dashboard"
            className="hidden lg:flex items-center flex-shrink-0 ml-2 sm:ml-4"
            aria-label="Ana sayfa"
          >
            <img
              src="/logo.png"
              alt="Aktüerya"
              className="h-11 w-auto max-w-[200px] object-contain"
            />
          </Link>
          <div className="flex items-center">
          {/* Desktop Sidebar Toggle - Sidebar bitiş çizgisinde */}
          <button
            className="hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors lg:mr-0"
            aria-label="Kenar çubuğunu daralt/genişlet"
            onClick={() => {
              setSidebarCollapsed((prev) => {
                const newState = !prev;
                localStorage.setItem("sidebarCollapsed", String(newState));
                return newState;
              });
            }}
          >
            <svg 
              className={`w-5 h-5 text-gray-700 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-90' : 'rotate-0'}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>

          {/* Mobile Hamburger Menu */}
          <button
            className="inline-flex lg:hidden items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Menüyü aç/kapat"
            onClick={() => {
              try { 
                window.dispatchEvent(new Event('mobile-sidebar:toggle')); 
              } catch {}
            }}
          >
            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          </div>
        </div>

        {/* Center Section: Page Title */}
        {pageTitle && (
          <div className="flex-1 flex justify-center px-4 min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-semibold text-gray-800 truncate max-w-xl">
              {pageTitle}
            </h1>
          </div>
        )}

        {/* Right Section: Icons */}
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 px-2 sm:px-4 flex-shrink-0">
          
          {/* Support Button / Ticket Aç */}
          <Link
            to="/profile?tab=tickets"
            className="relative flex items-center gap-1.5 p-1.5 sm:p-2 rounded-lg hover:bg-blue-50 transition-colors group"
            aria-label="Destek Al"
            title="Destek Al"
          >
            <span className="hidden md:inline text-xs font-normal text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Ticket Aç
            </span>
            <Ticket className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-blue-500 group-hover:text-blue-600 transition-colors flex-shrink-0" strokeWidth={1.75} />
          </Link>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="relative p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            aria-label={isDarkMode ? "Açık Moda Geç" : "Koyu Moda Geç"}
            title={isDarkMode ? "Açık Moda Geç" : "Koyu Moda Geç"}
          >
            {isDarkMode ? (
              // Sun icon for light mode
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 group-hover:text-yellow-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              // Moon icon for dark mode
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 group-hover:text-indigo-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Notifications */}
          <div
            className="relative"
            onMouseEnter={() => { if (notifCloseTimer.current) { clearTimeout(notifCloseTimer.current); notifCloseTimer.current = null; } }}
            onMouseLeave={() => { if (notifOpen) { notifCloseTimer.current = window.setTimeout(()=> setNotifOpen(false), 1000); } }}
          >
            <button
              onClick={async () => {
                const next = !notifOpen;
                setNotifOpen(next);
                if (next) {
                  await loadNotifs();
                  // mark as read
                  try {
                    const token = localStorage.getItem("access_token");
                    const userId = user?.id || Number(localStorage.getItem("user_id") || "0");
                    await fetch(`${API_BASE_URL}/api/notifications/mark-read`, { 
                      method: "POST", 
                      headers: { 
                        "x-tenant-id": String(tenantId),
                        "x-user-id": String(userId),
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      } 
                    });
                    setNotifs((prev)=>prev.map(n=>({ ...n, read: true })));
                  } catch {}
                }
              }}
              className="relative p-1.5 sm:p-2 rounded-lg hover:bg-amber-50 transition-colors group"
              aria-label="Bildirimler"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 group-hover:text-amber-600 transition-colors" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25-2.5 7.5-2.5 7.5S3 18.5 3 20h18s.5-1.5.5-3.5S19 14.25 19 9c0-3.87-3.13-7-7-7zm0 18c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z"/>
              </svg>
              {unread > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none shadow-md border border-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-2">
                <div className="px-2 py-1 text-sm font-medium text-gray-700">Bildirimler</div>
                <div className="max-h-72 overflow-auto divide-y">
                  {loading ? (
                    <div className="p-3 text-sm text-gray-500">Yükleniyor...</div>
                  ) : notifs.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Henüz bildiriminiz yok.</div>
                  ) : (
                    notifs.map((n) => {
                      const d = n.created_at ? new Date(n.created_at) : null;
                      return (
                        <div key={n.id} className="px-2 py-2 text-sm hover:bg-gray-50">
                          <div className="text-gray-900">{n.title}</div>
                          <div className="text-xs text-gray-500">{d ? d.toLocaleString("tr-TR") : ""}</div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-2 flex justify-end">
                  <Link to="/profile/notifications" className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1">Tümünü Gör</Link>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <UserMenu user={user} logout={logout} />
        </div>
      </div>
    </div>
  );
  }
  
  function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem("access_token"));
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [demoExpiredOpen, setDemoExpiredOpen] = useState(false);
  const [deviceLimitExceededOpen, setDeviceLimitExceededOpen] = useState(false);
  const [tenantId, setTenantId] = useState(() => localStorage.getItem("tenant_id") || "1");
  
  // Desktop sidebar collapse state - localStorage'dan oku
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });
  
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    const root = document.documentElement;
    if (savedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Listen for theme changes from other tabs/components
    const handleThemeChange = () => {
      const currentTheme = localStorage.getItem("theme") || "light";
      if (currentTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };
    
    window.addEventListener("storage", handleThemeChange);
    window.addEventListener("theme-changed", handleThemeChange);
    
    return () => {
      window.removeEventListener("storage", handleThemeChange);
      window.removeEventListener("theme-changed", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    const onAuthChange = () => {
      setIsLoggedIn(!!localStorage.getItem("access_token"));
      setTenantId(localStorage.getItem("tenant_id") || "1");
    };
    window.addEventListener("storage", onAuthChange);
    // Custom event fired in LoginPage after setting token
    window.addEventListener("auth-changed", onAuthChange as EventListener);
    return () => {
      window.removeEventListener("storage", onAuthChange);
      window.removeEventListener("auth-changed", onAuthChange as EventListener);
    };
  }, []);

  useEffect(() => {
    migrateScopedStorageKeysOnce([
      "wizardData",
      "kidem_autosave_fallback",
      "fm_page_state_v1",
    ]);
  }, [isLoggedIn, tenantId]);

  // Listen for demo-expired event
  useEffect(() => {
    const handleDemoExpired = () => {
      setDemoExpiredOpen(true);
    };
    window.addEventListener("demo-expired", handleDemoExpired);
    return () => {
      window.removeEventListener("demo-expired", handleDemoExpired);
    };
  }, []);

  // Listen for device-limit-exceeded event
  useEffect(() => {
    const handleDeviceLimitExceeded = () => {
      setDeviceLimitExceededOpen(true);
    };
    window.addEventListener("device-limit-exceeded", handleDeviceLimitExceeded);
    return () => {
      window.removeEventListener("device-limit-exceeded", handleDeviceLimitExceeded);
    };
  }, []);

  useEffect(() => {
    try { window.dispatchEvent(new Event('mobile-sidebar:close')); } catch {}
  }, [location.pathname]);

  // Canlı kullanıcı takibi: Giriş yapmış kullanıcı program açıkken her 30 saniyede heartbeat gönder
  useEffect(() => {
    const onLoginPage = location.pathname === "/login" || location.pathname === "/forgot-password" || location.pathname === "/reset-password";
    if (!isLoggedIn || onLoginPage) return;
    const token = getAccessToken();
    if (!token) return;

    const sendHeartbeat = () => {
      fetch(`${API_BASE_URL}/api/heartbeat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Id": String(tenantId || "1"),
          "Content-Type": "application/json",
        },
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30 * 1000); // 30 saniye
    return () => clearInterval(interval);
  }, [isLoggedIn, location.pathname, tenantId]);

  // 🔴 KRİTİK: Background token refresh - Token'ı otomatik olarak yenile
  // Her 5 dakikada bir token'ı kontrol et ve expire olmadan önce refresh et
  useEffect(() => {
    // Sadece login sayfasında değilse çalıştır
    if (location.pathname === '/login' || location.pathname === '/forgot-password' || location.pathname === '/reset-password') {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      return; // Token yoksa refresh yapma
    }

    // İlk kontrol - token expire olmadan önce refresh et
    const checkAndRefreshToken = async () => {
      if (isTokenExpired()) {
        if (import.meta.env.DEV) console.log('[BACKGROUND REFRESH] Token expiring soon, refreshing...');
        try {
          const newToken = await refreshAccessToken();
          if (newToken) {
            if (import.meta.env.DEV) console.log('[BACKGROUND REFRESH] Token refreshed successfully');
          } else {
            if (import.meta.env.DEV) console.error('[BACKGROUND REFRESH] Token refresh failed');
          }
        } catch (error) {
          if (import.meta.env.DEV) console.error('[BACKGROUND REFRESH] Token refresh error:', error);
        }
      }
    };

    // İlk kontrol
    checkAndRefreshToken();

    // Her 5 dakikada bir kontrol et (300000 ms = 5 dakika)
    const interval = setInterval(() => {
      checkAndRefreshToken();
    }, 5 * 60 * 1000); // 5 dakika

    return () => {
      clearInterval(interval);
    };
  }, [location.pathname]);

  const activeKey = useMemo(() => {
    if (location.pathname.startsWith("/employment") || location.pathname.startsWith("/is-tazminati")) return "is" as const;
    if (location.pathname.startsWith("/admin")) return "actuary" as const;
    return "actuary" as const;
  }, [location.pathname]);

  const handleNavigateActuary = () => {
    navigate("/admin");
  };

  const handleComingSoon = () => setComingSoonOpen(true);
  const handleNavigateEmployment = () => navigate("/employment");
  const handleCloseComingSoon = () => setComingSoonOpen(false);

  const isLoginPage = location.pathname === "/login" || location.pathname === "/forgot-password" || location.pathname === "/reset-password";
  const isStandaloneLayout = isLoginPage || location.pathname.startsWith('/test-');

  // Scroll to top on route change - DOM render'dan ÖNCE çalışır
  useLayoutEffect(() => {
    // Tüm scroll pozisyonlarını zorla sıfırla
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Main content container'ı da sıfırla
    const mainContent = document.querySelector('[class*="ml-56"]');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
    
    // Tüm overflow container'ları sıfırla
    document.querySelectorAll('[style*="overflow"]').forEach((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [location.pathname, location.search]); // pathname VE search params değişince tetikle

  return (
    <div 
      className="min-h-screen"
      style={{
        boxSizing: 'border-box',
        overflowX: 'hidden',
        maxWidth: '100vw',
        position: 'relative'
      }}
    >
      {/* ====================================
          LAYOUT MASTER CONTAINER
          - Desktop (≥1024px): Sidebar fixed, content offset
          - Mobile (≤768px): Sidebar overlay, content full width
          ==================================== */}

      {/* SIDEBAR CONTAINER - Login ve test sayfalarında gizle */}
      {!isStandaloneLayout && (
        <Sidebar
          collapsed={sidebarCollapsed}
          activeKey={activeKey}
          onNavigateActuary={handleNavigateActuary}
          onComingSoon={handleComingSoon}
          onNavigateEmployment={handleNavigateEmployment}
        />
      )}

      {/* TOP HEADER BAR - Login ve test sayfalarında gizle */}
      {!isStandaloneLayout && (
        <HeaderBar 
          sidebarCollapsed={sidebarCollapsed} 
          setSidebarCollapsed={setSidebarCollapsed} 
        />
      )}

      {/* Feedback modal disabled */}


      {/* MAIN CONTENT CONTAINER - LAYOUT OTORİTESİ 
          Desktop (≥1024px): ml-64 (256px sidebar offset)
          Tablet (768-1023px): ml-0 (sidebar overlay)
          Mobile (<768px): ml-0 (sidebar overlay)
          Test sayfaları: ResponsiveShell kendi layout'unu yönetir
      */}
      <div 
        className={
          isStandaloneLayout
            ? "" 
            : `
              bg-gray-50 dark:bg-gray-900 
              min-h-screen 
              pt-16
              transition-[margin] duration-300
              overflow-x-hidden
              max-w-full
              ${sidebarCollapsed ? '' : 'lg:ml-56'}
            `
        }
        style={{
          boxSizing: 'border-box'
        }}
      >
        {/* CONTENT WRAPPER - Padding kontratı 
            Mobile: 12px
            Tablet: 16px  
            Desktop: 20px
            Large: 24px
            Test sayfaları: ResponsiveShell kendi padding'ini yönetir
        */}
        <div
          className={
            isStandaloneLayout
              ? "p-0" 
              : "w-full min-w-0 px-4 sm:px-6 lg:px-10"
          }
          style={{
            boxSizing: 'border-box',
            minHeight: '100vh'
          }}
        >
        <div className={isStandaloneLayout ? "" : "w-full max-w-[1400px] mx-auto"}>
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={isLoggedIn ? <Navigate to="/admin" /> : <Navigate to="/login" />}
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/professional-license-activation" element={<ProfessionalLicenseActivation />} />
          
          <Route
            path="/admin"
            element={<ProfessionalProtectedRoute><DashboardPage /></ProfessionalProtectedRoute>}
          />
          {/* Standalone pages */}
          <Route path="/prim-hesaplama" element={<ProfessionalProtectedRoute><PrimHesaplamaPage /></ProfessionalProtectedRoute>} />
          <Route path="/dashboard" element={<ProfessionalProtectedRoute><DashboardPage /></ProfessionalProtectedRoute>} />
          
          {/* Module Routes with Independent Structure - Protected */}
          <Route path="/fazla-mesai/*" element={<ProfessionalProtectedRoute><FazlaMesaiRouter /></ProfessionalProtectedRoute>} />
          <Route path="/fazla-mesai-alacagi" element={<Navigate to="/fazla-mesai" replace />} />
          
          <Route path="/kidem-tazminati/*" element={<ProfessionalProtectedRoute><KidemRouter /></ProfessionalProtectedRoute>} />
          <Route path="/ihbar-tazminati/*" element={<ProfessionalProtectedRoute><IhbarRouter /></ProfessionalProtectedRoute>} />
          <Route path="/yillik-izin/*" element={<ProfessionalProtectedRoute><YillikRouter /></ProfessionalProtectedRoute>} />
          <Route path="/hafta-tatili-alacagi/*" element={<ProfessionalProtectedRoute><HaftaTatiliRouter /></ProfessionalProtectedRoute>} />
          <Route path="/rapor/hafta-tatili-alacagi/:type/:id" element={<ProfessionalProtectedRoute><HaftaTatiliRaporPage /></ProfessionalProtectedRoute>} />
          
          {/* Calculation Routes - Protected */}
          <Route path="/calculations/view/:id" element={<ProfessionalProtectedRoute><ViewCalculation /></ProfessionalProtectedRoute>} />
          <Route path="/calculations/edit/:id" element={<ProfessionalProtectedRoute><EditCalculation /></ProfessionalProtectedRoute>} />
          <Route path="/calculations/print/:id" element={<ProfessionalProtectedRoute><PrintCalculation /></ProfessionalProtectedRoute>} />
          
          {/* Independent Page Routes - Protected */}
          <Route path="/ubgt-alacagi/:id?" element={<ProfessionalProtectedRoute><UbgtIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/ubgt-bilirkisi/:id?" element={<ProfessionalProtectedRoute><UbgtBilirkisiIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/ucret-alacagi/:id?" element={<ProfessionalProtectedRoute><UcretIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/bakiye-ucret-alacagi/:id?" element={<ProfessionalProtectedRoute><BakiyeUcretIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/davaci-ucreti/:id?" element={<ProfessionalProtectedRoute><DavaciUcretiPage /></ProfessionalProtectedRoute>} />
          <Route path="/is-arama-izni-ucreti/:id?" element={<ProfessionalProtectedRoute><IsAramaIzniIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/prim-alacagi/:id?" element={<ProfessionalProtectedRoute><PrimAlacagiPage /></ProfessionalProtectedRoute>} />
          <Route path="/kotu-niyet-tazminati/:id?" element={<ProfessionalProtectedRoute><KotuNiyetIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/bosta-gecen-sure-ucreti/:id?" element={<ProfessionalProtectedRoute><BostaGecenSureIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/ayrimcilik-tazminati/:id?" element={<ProfessionalProtectedRoute><AyrimcilikIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/ise-almama-tazminati/:id?" element={<ProfessionalProtectedRoute><IseAlmamaIndependent /></ProfessionalProtectedRoute>} />
          <Route path="/haksiz-fesih-tazminati/:id?" element={<ProfessionalProtectedRoute><HaksizFesihIndependent /></ProfessionalProtectedRoute>} />
          
          {/* Redirect old employment routes to new independent pages */}
          <Route path="/employment/yillik-izin" element={<Navigate to="/yillik-izin" replace />} />
          <Route path="/employment/fazla-mesai" element={<Navigate to="/fazla-mesai" replace />} />
          <Route path="/employment/ubgt" element={<Navigate to="/ubgt-alacagi" replace />} />
          <Route path="/employment/hafta-tatili" element={<Navigate to="/hafta-tatili-alacagi" replace />} />
          <Route path="/employment/ucret" element={<Navigate to="/ucret-alacagi" replace />} />
          <Route path="/employment/bakiye-ucret" element={<Navigate to="/bakiye-ucret-alacagi" replace />} />
          <Route path="/employment/prim" element={<Navigate to="/prim-alacagi" replace />} />
          <Route path="/employment/kotu-niyet" element={<Navigate to="/kotu-niyet-tazminati" replace />} />
          <Route path="/employment/bosta-gecen-sure" element={<Navigate to="/bosta-gecen-sure-ucreti" replace />} />
          <Route path="/employment/ise-almama" element={<Navigate to="/ise-almama-tazminati" replace />} />
          <Route path="/employment/ayrimcilik" element={<Navigate to="/ayrimcilik-tazminati" replace />} />
          
          {/* Redirect old ihbar routes */}
          <Route path="/ihbar/30isci" element={<Navigate to="/ihbar-tazminati/30isci" replace />} />
          <Route path="/ihbar/30-isciden-fazla" element={<Navigate to="/ihbar-tazminati/30isci" replace />} />
          <Route path="/ihbar/borclar" element={<Navigate to="/ihbar-tazminati/borclar" replace />} />
          <Route path="/ihbar/borclar-kanunu" element={<Navigate to="/ihbar-tazminati/borclar" replace />} />
          <Route path="/ihbar/gemi" element={<Navigate to="/ihbar-tazminati/gemi" replace />} />
          <Route path="/ihbar/gemi-adam" element={<Navigate to="/ihbar-tazminati/gemi" replace />} />
          <Route path="/ihbar/mevsim" element={<Navigate to="/ihbar-tazminati/mevsim" replace />} />
          <Route path="/ihbar/mevsimlik-isci" element={<Navigate to="/ihbar-tazminati/mevsim" replace />} />
          <Route path="/ihbar/basin" element={<Navigate to="/ihbar-tazminati/basin" replace />} />
          <Route path="/ihbar/basin-is" element={<Navigate to="/ihbar-tazminati/basin" replace />} />
          {/* Toplu İş Sözleşmesi ihbar tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/ihbar/toplu" element={<Navigate to="/ihbar-tazminati/toplu" replace />} /> */}
          {/* <Route path="/ihbar/toplu-sozlesme" element={<Navigate to="/ihbar-tazminati/toplu" replace />} /> */}
          {/* Part Time ihbar tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/ihbar/part" element={<Navigate to="/ihbar-tazminati/part" replace />} /> */}
          <Route path="/ihbar/part-time" element={<Navigate to="/ihbar-tazminati/kismi" replace />} />
          {/* Parça Başı ihbar tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/ihbar/parca" element={<Navigate to="/ihbar-tazminati/parca" replace />} /> */}
          {/* <Route path="/ihbar/parca-basi" element={<Navigate to="/ihbar-tazminati/parca" replace />} /> */}
          <Route path="/ihbar/kismi" element={<Navigate to="/ihbar-tazminati/kismi" replace />} />
          <Route path="/ihbar/kismi-sureli" element={<Navigate to="/ihbar-tazminati/kismi" replace />} />
          <Route path="/ihbar/belirli" element={<Navigate to="/ihbar-tazminati/belirli" replace />} />
          <Route path="/ihbar/belirli-sureli" element={<Navigate to="/ihbar-tazminati/belirli" replace />} />
          {/* Redirect old kidem routes */}
          <Route path="/is-tazminati/kidem" element={<Navigate to="/kidem-tazminati" replace />} />
          <Route path="/is-tazminati/ihbar" element={<Navigate to="/ihbar-tazminati" replace />} />
          <Route path="/is-tazminati/yillik-izin" element={<Navigate to="/yillik-izin" replace />} />
          
          {/* Redirect old kidem routes to new structure */}
          <Route path="/kidem/30isci" element={<Navigate to="/kidem-tazminati/30isci" replace />} />
          <Route path="/kidem/borclar" element={<Navigate to="/kidem-tazminati/borclar" replace />} />
          <Route path="/kidem/gemi" element={<Navigate to="/kidem-tazminati/gemi" replace />} />
          <Route path="/kidem/mevsimlik" element={<Navigate to="/kidem-tazminati/mevsimlik" replace />} />
          <Route path="/kidem/belirli-sureli" element={<Navigate to="/kidem-tazminati/belirli-sureli" replace />} />
          <Route path="/kidem/basin" element={<Navigate to="/kidem-tazminati/basin" replace />} />
          {/* Toplu İş Sözleşmesi kıdem tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/kidem/toplu-sozlesme" element={<Navigate to="/kidem-tazminati/toplu" replace />} /> */}
          <Route path="/kidem/part-time" element={<Navigate to="/kidem-tazminati/kismi-sureli" replace />} />
          {/* Parça Başı kıdem tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/kidem/parca-basi" element={<Navigate to="/kidem-tazminati/parca-basi" replace />} /> */}
          <Route path="/kidem/kismi-sureli" element={<Navigate to="/kidem-tazminati/kismi-sureli" replace />} />
          
          {/* Redirect old paths to new independent pages */}
          <Route path="/is-tazminati/kidem/30-isciden-fazla" element={<Navigate to="/kidem-tazminati/30isci" replace />} />
          <Route path="/is-tazminati/kidem/borclar-kanunu" element={<Navigate to="/kidem-tazminati/borclar" replace />} />
          <Route path="/is-tazminati/kidem/gemi-adamlari" element={<Navigate to="/kidem-tazminati/gemi" replace />} />
          <Route path="/is-tazminati/kidem/mevsimlik" element={<Navigate to="/kidem-tazminati/mevsimlik" replace />} />
          <Route path="/is-tazminati/kidem/basin-is" element={<Navigate to="/kidem-tazminati/basin" replace />} />
          {/* Toplu İş Sözleşmesi kıdem tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/kidem/toplu-is-sozlesmesi" element={<Navigate to="/kidem-tazminati/toplu" replace />} /> */}
          <Route path="/is-tazminati/kidem/part-time" element={<Navigate to="/kidem-tazminati/kismi-sureli" replace />} />
          {/* Parça Başı kıdem tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/kidem/parca-basi" element={<Navigate to="/kidem-tazminati/parca-basi" replace />} /> */}
          <Route path="/is-tazminati/kidem/kismi-sureli" element={<Navigate to="/kidem-tazminati/kismi-sureli" replace />} />
          <Route path="/is-tazminati/kidem/belirli-sureli" element={<Navigate to="/kidem-tazminati/belirli-sureli" replace />} />
          
          {/* Redirect old ihbar routes to new structure */}
          <Route path="/is-tazminati/ihbar/30-isciden-fazla" element={<Navigate to="/ihbar-tazminati/30isci" replace />} />
          <Route path="/is-tazminati/ihbar/borclar-kanunu" element={<Navigate to="/ihbar-tazminati/borclar" replace />} />
          <Route path="/is-tazminati/ihbar/gemi-adam" element={<Navigate to="/ihbar-tazminati/gemi" replace />} />
          <Route path="/is-tazminati/ihbar/mevsimlik-isci" element={<Navigate to="/ihbar-tazminati/mevsim" replace />} />
          <Route path="/is-tazminati/ihbar/basin-is" element={<Navigate to="/ihbar-tazminati/basin" replace />} />
          {/* Toplu İş Sözleşmesi ihbar tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/ihbar/toplu-sozlesme" element={<Navigate to="/ihbar-tazminati/toplu" replace />} /> */}
          {/* Part Time ihbar tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/ihbar/part-time" element={<Navigate to="/ihbar-tazminati/part" replace />} /> */}
          <Route path="/is-tazminati/ihbar/part-time" element={<Navigate to="/ihbar-tazminati/kismi" replace />} />
          {/* Parça Başı ihbar tazminatı kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/ihbar/parca-basi" element={<Navigate to="/ihbar-tazminati/parca" replace />} /> */}
          <Route path="/is-tazminati/ihbar/kismi-sureli" element={<Navigate to="/ihbar-tazminati/kismi" replace />} />
          <Route path="/is-tazminati/ihbar/belirli-sureli" element={<Navigate to="/ihbar-tazminati/belirli" replace />} />
          
          {/* Redirect old yillik-izin routes to new structure */}
          <Route path="/is-tazminati/yillik-izin/30-isciden-fazla" element={<Navigate to="/yillik-izin/standart" replace />} />
          <Route path="/is-tazminati/yillik-izin/borclar-kanunu" element={<Navigate to="/yillik-izin/borclar" replace />} />
          <Route path="/is-tazminati/yillik-izin/gemi-adam" element={<Navigate to="/yillik-izin/gemi" replace />} />
          <Route path="/is-tazminati/yillik-izin/mevsimlik-isci" element={<Navigate to="/yillik-izin/mevsim" replace />} />
          <Route path="/is-tazminati/yillik-izin/basin-is" element={<Navigate to="/yillik-izin/basin" replace />} />
          {/* Toplu İş Sözleşmesi yıllık izin kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/yillik-izin/toplu-sozlesme" element={<Navigate to="/yillik-izin/toplu" replace />} /> */}
          {/* Part Time yıllık izin kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/yillik-izin/part-time" element={<Navigate to="/yillik-izin/part" replace />} /> */}
          <Route path="/is-tazminati/yillik-izin/part-time" element={<Navigate to="/yillik-izin/kismi" replace />} />
          {/* Parça Başı yıllık izin kaldırıldı - dosya projede kalıyor */}
          {/* <Route path="/is-tazminati/yillik-izin/parca-basi" element={<Navigate to="/yillik-izin/parca" replace />} /> */}
          <Route path="/is-tazminati/yillik-izin/kismi-sureli" element={<Navigate to="/yillik-izin/kismi" replace />} />
          <Route path="/is-tazminati/yillik-izin/belirli-sureli" element={<Navigate to="/yillik-izin/belirli" replace />} />
          
          {/* Profile dashboard - Protected */}
          <Route path="/profile" element={<ProfessionalProtectedRoute><ProfilePage /></ProfessionalProtectedRoute>} />
          <Route path="/profile/saved-calculations" element={<ProfessionalProtectedRoute><ProfilePage /></ProfessionalProtectedRoute>} />
          <Route path="/profile/ai-packages" element={<ProfessionalProtectedRoute><ProfilePage /></ProfessionalProtectedRoute>} />
          <Route path="/profile/notifications" element={<ProfessionalProtectedRoute><NotificationsPage /></ProfessionalProtectedRoute>} />
          
          {/* Admin Routes - Protected */}
          <Route
            path="/admin-access-denied"
            element={<AdminAccessDeniedPage />}
          />
          <Route
            path="/admin/users"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminUsersPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/users/new"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminCreateUserPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/users/:id/edit"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminUserEditPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/subscriptions"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminSubscriptionsPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/tickets"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminTicketsPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/feedback"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminFeedbackPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <LogsPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminTenantAnalytics />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          {/* Backward compatibility - old URL */}
          <Route
            path="/admin/tenant-analytics"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminTenantAnalytics />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/demo-conversion"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <DemoConversionPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          {/* <Route
            path="/admin/payment-settings"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <PaymentSettingsPage />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          /> */}  {/* Geçici kapatıldı */}
          <Route
            path="/admin/professional-licenses"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <LicensesManagement />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/email-notifications"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <AdminEmailNotifications />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
          <Route
            path="/admin/licenses"
            element={
              <ProfessionalProtectedRoute>
                <AdminRoute>
                  <LicensesManagement />
                </AdminRoute>
              </ProfessionalProtectedRoute>
            }
          />
        </Routes>
        </div>
        </div>
        {/* END: Content Wrapper */}
      </div>
      {/* END: Main Content Container */}

      {/* Coming Soon Modal */}
      <ComingSoonModal open={comingSoonOpen} onClose={handleCloseComingSoon} />
      
      {/* Demo Expired Modal - Cannot be closed */}
      <DemoExpiredModal open={demoExpiredOpen} />
      
      {/* Device Limit Exceeded Modal - Cannot be closed */}
      <DeviceLimitExceededModal open={deviceLimitExceededOpen} />
      
      <Toaster />
      
      {/* Global Calculation Tools - Not ve Etiket Paneli - Test sayfalarında gizle */}
      {!isStandaloneLayout && <GlobalCalculationTools />}
      
      {/* Hukuk Bot - Sağ Alt Canlı Sohbet */}
      {/* {!isLoginPage && <HukukBot />} */}  {/* Geçici olarak kapatıldı */}
    </div>
  );
}

export default App;
