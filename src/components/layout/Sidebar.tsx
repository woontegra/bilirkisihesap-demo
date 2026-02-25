import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, ChevronRight, Users, UserPlus, CreditCard, MessageSquare, FileText, DollarSign, Key, TrendingUp, BarChart2, Mail, ArrowRight, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Separator } from "@/components/ui/separator";
import { usePageStyle, hexToRgba } from "@/hooks/usePageStyle";

type Props = {
  collapsed: boolean;
};

export default function Sidebar({ collapsed }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const pageStyle = usePageStyle();
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  // Tenant 1 is always admin OR user.role === "admin"
  const isAdmin = user?.role === "admin" || tenantId === 1 || (user as any)?.tenantId === 1;
  console.log("[Sidebar] Admin check - tenantId:", tenantId, "user.role:", user?.role, "user.tenantId:", (user as any)?.tenantId, "isAdmin:", isAdmin);
  
  // License check
  const licenseValid = localStorage.getItem("licenseValid") === "true";
  const [open, setOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'kidem-tazminati': false,
    'ihbar-tazminati': false,
    'fazla-mesai': false,
    'yillik-izin': false,
    'ubgt': false,
    'hafta-tatili': false,
  });
  
  // CSS variable'ı set et
  useEffect(() => {
    if (pageStyle?.color) {
      document.documentElement.style.setProperty('--pageColor', pageStyle.color);
    }
  }, [pageStyle?.color]);

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  };

  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  
  // Move ItemLink component outside of the render
  const ItemLink = ({ 
    to, 
    label, 
    isSubItem = false, 
    isParent = false, 
    isOpen = false, 
    onClick = () => {},
    activeVariant = 'page' as 'page' | 'light',
  }: { 
    to: string; 
    label: string; 
    isSubItem?: boolean; 
    isParent?: boolean; 
    isOpen?: boolean; 
    onClick?: () => void;
    activeVariant?: 'page' | 'light';
  }) => {
    const isActive = location.pathname === to || (to !== "#" && location.pathname.startsWith(to));
    
    if (isParent) {
      const content = (
        <>
          <span className="flex-shrink-0">
            <Menu className="w-4 h-4" />
          </span>
          <span className="text-left flex-1">{label}</span>
          <svg 
            className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </>
      );
      return (
        <button
          onClick={onClick}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13px] font-medium transition ${openMenus[to] ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'}`}
        >
          {content}
        </button>
      );
    }

    const content = (
      <>
        <span className="flex-shrink-0">
          {isSubItem ? (
            <ChevronRight className={`w-4 h-4 ${isActive ? (activeVariant === 'light' ? 'text-indigo-600' : 'text-white') : 'text-gray-400'}`} />
          ) : (
            <Menu className="w-4 h-4" />
          )}
        </span>
        <span className="text-left flex-1">{label}</span>
      </>
    );

    // Disable if no license (except for admin - tenantId = 1)
    const isDisabled = !licenseValid && to !== "/professional-license-activation" && tenantId !== 1;
    
    return (
      <NavLink
        to={to}
        className={({ isActive: navIsActive }) =>
          `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] transition-all ${
            navIsActive 
              ? activeVariant === 'light' 
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-medium"
                : "text-white font-medium" 
              : activeVariant === 'light'
                ? "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-800/70"
          } ${isSubItem ? 'pl-4' : ''} ${isDisabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`
        }
        style={({ isActive }) => isActive && activeVariant === 'page' && pageStyle?.color ? { 
          backgroundColor: pageStyle.color,
        } : {}}
        onClick={(e) => { 
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          if (onClick) onClick();
          if (window.innerWidth < 768) setMobileOpen(false); 
        }}
      >
        {content}
      </NavLink>
    );
  };

  // Listen to global events to control mobile sidebar
  useEffect(() => {
    const onOpen = () => setMobileOpen(true);
    const onClose = () => setMobileOpen(false);
    const onToggle = () => setMobileOpen((s) => !s);
    window.addEventListener("mobile-sidebar:open", onOpen as any);
    window.addEventListener("mobile-sidebar:close", onClose as any);
    window.addEventListener("mobile-sidebar:toggle", onToggle as any);
    return () => {
      window.removeEventListener("mobile-sidebar:open", onOpen as any);
      window.removeEventListener("mobile-sidebar:close", onClose as any);
      window.removeEventListener("mobile-sidebar:toggle", onToggle as any);
    };
  }, []);

  // Body scroll lock when mobile sidebar is open (<1024px)
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [mobileOpen]);

  const SectionButton = ({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
        open ? "bg-indigo-600/90 text-white" : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
      }`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg>
      <span>📂 {label}</span>
      <svg className={`ml-auto w-4 h-4 transition-transform ${open ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
    </button>
  );

  // ItemLink component is already defined at the top of the file

  const employmentItems = [
    { 
      id: 'davaci-ucreti',
      label: "Davacı Ücreti", 
      to: "/davaci-ucreti" 
    },
    {
      id: 'kidem-tazminati',
      label: "Kıdem Tazminatı",
      to: "#",
      isParent: true,
      children: [
        { id: 'kidem-30isci', label: "İş Kanununa Göre", to: "/kidem-tazminati/30isci" },
        { id: 'kidem-borclar', label: "Borçlar Kanunu İşçi Alacağı", to: "/kidem-tazminati/borclar" },
        { id: 'kidem-gemi', label: "Gemi Adamları", to: "/kidem-tazminati/gemi" },
        { id: 'kidem-mevsimlik', label: "Mevsimlik İşçi", to: "/kidem-tazminati/mevsimlik" },
        { id: 'kidem-basin', label: "Basın İş", to: "/kidem-tazminati/basin" },
        { id: 'kidem-kismi', label: "Kısmi Süreli / Part Time", to: "/kidem-tazminati/kismi-sureli" },
        { id: 'kidem-belirli', label: "Belirli Süreli İş Sözleşmesi", to: "/kidem-tazminati/belirli-sureli" },
      ]
    },
    { 
      id: 'ihbar-tazminati',
      label: "İhbar Tazminatı", 
      to: "#",
      isParent: true,
      children: [
        { id: 'ihbar-30isci', label: "İş Kanununa Göre", to: "/ihbar-tazminati/30isci" },
        { id: 'ihbar-borclar', label: "Borçlar Kanunu İşçi Alacağı", to: "/ihbar-tazminati/borclar" },
        { id: 'ihbar-gemi', label: "Gemi Adamları", to: "/ihbar-tazminati/gemi" },
        { id: 'ihbar-mevsim', label: "Mevsimlik İşçi", to: "/ihbar-tazminati/mevsim" },
        { id: 'ihbar-basin', label: "Basın İşçileri", to: "/ihbar-tazminati/basin" },
        { id: 'ihbar-kismi', label: "Kısmi Süreli / Part Time", to: "/ihbar-tazminati/kismi" },
        { id: 'ihbar-belirli', label: "Belirli Süreli İş Sözleşmesi", to: "/ihbar-tazminati/belirli" }
      ]
    },
    { 
      id: 'fazla-mesai',
      label: "Fazla Mesai Alacağı", 
      to: "#", 
      isParent: true,
      children: [
        { id: 'fm-standart', label: "Standart Fazla Mesai", to: "/fazla-mesai/standart" },
        { id: 'fm-tanikli-standart', label: "Tanıklı Standart", to: "/fazla-mesai/tanikli-standart" },
        { id: 'fm-haftalik-karma', label: "Haftalık Karma", to: "/fazla-mesai/haftalik-karma" },
        { id: 'fm-donemsel', label: "Dönemsel", to: "/fazla-mesai/donemsel" },
        { id: 'fm-donemsel-haftalik', label: "Dönemsel Haftalık", to: "/fazla-mesai/donemsel-haftalik" },
        { id: 'fm-yeralti', label: "Yeraltı İşçileri", to: "/fazla-mesai/yeralti-isci" },
        // { id: 'fm-bilirkisi2', label: "Bilirkişiler İçin – 2", to: "/fazla-mesai/bilirkisi-2" }, // Geçici olarak kaldırıldı
        { id: 'fm-vardiya12', label: "12 Saat Usulü Vardiya", to: "/fazla-mesai/vardiya12" },
        { id: 'fm-vardiya24', label: "24 Saat Usulü Vardiya", to: "/fazla-mesai/vardiya24" },
        { id: 'fm-gemi', label: "Gemi Adamı", to: "/fazla-mesai/gemi" },
        { id: 'fm-ev', label: "Ev İşçileri", to: "/fazla-mesai/ev" },
        { id: 'fm-fazla-sure', label: "Fazla Sürelerle Çalışma", to: "/fazla-mesai/fazla-surelerle-calisma" },
        { id: 'fm-basin-is', label: "Basın İş", to: "/fazla-mesai/basin-is-fazla-mesai" },
      ]
    },
    { 
      id: 'yillik-izin',
      label: "Yıllık Ücretli İzin Alacağı", 
      to: "#",
      isParent: true,
      children: [
        { id: 'yillik-standart', label: "İş Kanununa Göre", to: "/yillik-izin/standart" },
        { id: 'yillik-borclar', label: "Borçlar Kanunu İşçileri", to: "/yillik-izin/borclar" },
        { id: 'yillik-gemi', label: "Gemi Adamları", to: "/yillik-izin/gemi" },
        { id: 'yillik-mevsim', label: "Mevsimlik İşçiler", to: "/yillik-izin/mevsim" },
        { id: 'yillik-basin', label: "Basın İşçileri", to: "/yillik-izin/basin" },
        { id: 'yillik-kismi', label: "Kısmi Süreli / Part Time", to: "/yillik-izin/kismi" },
        { id: 'yillik-belirli', label: "Belirli Süreli Sözleşme", to: "/yillik-izin/belirli" },
      ]
    },
    { 
      id: 'ubgt',
      label: "UBGT Alacağı", 
      to: "#",
      isParent: true,
      children: [
        { id: 'ubgt-standart', label: "Standart UBGT", to: "/ubgt-alacagi" },
        { id: 'ubgt-bilirkisi', label: "Bilirkişi UBGT", to: "/ubgt-bilirkisi" },
      ]
    },
    { 
      id: 'hafta-tatili',
      label: "Hafta Tatili Alacağı", 
      to: "#",
      isParent: true,
      children: [
        { id: 'hafta-standart', label: "Standart", to: "/hafta-tatili-alacagi/standard" },
        { id: 'hafta-gemi', label: "Gemi Adamları", to: "/hafta-tatili-alacagi/gemi-adami" },
        { id: 'hafta-basin-is', label: "Basın İş", to: "/hafta-tatili-alacagi/basin-is" },
      ]
    },
    { 
      id: 'ucret',
      label: "Ücret Alacağı", 
      to: "/ucret-alacagi" 
    },
    { 
      id: 'is-arama-izni',
      label: "İş Arama İzni Ücreti", 
      to: "/is-arama-izni-ucreti" 
    },
    { 
      id: 'bakiye-ucret',
      label: "Bakiye Ücret Alacağı", 
      to: "/bakiye-ucret-alacagi" 
    },
    { 
      id: 'prim',
      label: "Prim Alacağı", 
      to: "/prim-alacagi" 
    },
    { 
      id: 'kotu-niyet',
      label: "Kötü Niyet Tazminatı", 
      to: "/kotu-niyet-tazminati" 
    },
    { id: 'bosta-gecen-sure', label: "Boşta Geçen Süre Ücreti", to: "/bosta-gecen-sure-ucreti" },
    { id: 'ise-almama', label: "İşe Başlatmama Tazminatı", to: "/ise-almama-tazminati" },
    { id: 'ayrimcilik', label: "Ayrımcılık Tazminatı", to: "/ayrimcilik-tazminati" },
    { id: 'haksiz-fesih', label: "Haksız Fesih Tazminatı", to: "/haksiz-fesih-tazminati" },
  ];

  return (
    <>
      {/* Desktop sidebar - Sadece 1024px+ için */}
      <nav className={`hidden lg:flex lg:flex-col w-56 bg-white dark:bg-gray-900 h-screen fixed top-0 left-0 z-30 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 ${collapsed ? '-translate-x-full' : 'translate-x-0'}`}>
        <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"></div>

        <div className="px-2.5 pt-3 pb-20 space-y-1.5 overflow-y-auto flex-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                isActive ? "bg-indigo-600/90 text-white" : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
              }`
            }
          >
            <Menu className="w-4 h-4 flex-shrink-0" />
            <span>Yönetim Paneli</span>
          </NavLink>
          <button
            onClick={() => setOpen(!open)}
            className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-md text-xs font-medium transition-colors ${
              open ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
            }`}
          >
            <span className="whitespace-nowrap">İş Tazminatı Hesaplamaları</span>
            <svg 
              className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className={`${open ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden transition-all duration-300`}>
            <ul className="mt-1 space-y-1">
              {employmentItems.map((item, idx) => (
                <li key={`menu-${item.id}-${idx}`}>
                  {item.isParent ? (
                    <div>
                      <ItemLink 
                        to={item.to} 
                        label={item.label} 
                        isParent={true}
                        isOpen={openMenus[item.id]}
                        onClick={() => toggleMenu(item.id)}
                      />
                      <div 
                        className={`${
                          openMenus[item.id] 
                            ? 'max-h-[3000px] opacity-100' 
                            : 'max-h-0 opacity-0'
                        } overflow-hidden transition-all duration-300`}
                      >
                        <ul className="mt-1 space-y-1">
                          {item.children?.map((child, index) => (
                            <li key={`submenu-${item.id}-${child.id || index}`}>
                              <ItemLink 
                                to={child.to} 
                                label={child.label} 
                                isSubItem 
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <ItemLink 
                      to={item.to} 
                      label={item.label} 
                      key={`menu-item-${item.id}`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Admin Section - Sabit Alt Panel */}
        {isAdmin && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 pt-3 pb-6">
            <div className="text-xs font-medium text-gray-400 uppercase mb-2 px-2.5">
              Admin Paneli
            </div>
            <NavLink
              to="/admin/users"
              end
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>Kullanıcı Yönetimi</span>
            </NavLink>
            <NavLink
              to="/admin/users/new"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              <span>Yeni Üyelik Aç</span>
            </NavLink>
            <NavLink
              to="/admin/subscriptions"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <CreditCard className="w-4 h-4 flex-shrink-0" />
              <span>Abonelik İşlemleri</span>
            </NavLink>
            <NavLink
              to="/admin/tickets"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span>Destek Talepleri</span>
            </NavLink>
            <NavLink
              to="/admin/feedback"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <Star className="w-4 h-4 flex-shrink-0" />
              <span>Kullanıcı Geri Bildirimleri</span>
            </NavLink>
            <NavLink
              to="/admin/analytics"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <BarChart2 className="w-4 h-4 flex-shrink-0" />
              <span>Tenant İstatistikleri</span>
            </NavLink>
            <NavLink
              to="/admin/demo-conversion"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
              <span>Demo → Satış Dönüşüm</span>
            </NavLink>
            <NavLink
              to="/admin/logs"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>Sistem Logları</span>
            </NavLink>
            {/* <NavLink
              to="/admin/payment-settings"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span>Ödeme Ayarları</span>
            </NavLink> */}  {/* Geçici kapatıldı */}
            <NavLink
              to="/admin/professional-licenses"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <Key className="w-4 h-4 flex-shrink-0" />
              <span>Lisans Yönetimi</span>
            </NavLink>
            <NavLink
              to="/admin/email-notifications"
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                  isActive
                    ? "bg-indigo-600/90 text-white"
                    : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                }`
              }
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span>Email Bildirimleri</span>
            </NavLink>
          </div>
        )}

        {/* Version Info - Desktop */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-3">
          <div className="text-xs text-center text-gray-500 dark:text-gray-400">
            <div className="font-medium">Bilirkişi Hesaplama Araçları</div>
            <div className="mt-1">Sürüm 1.0</div>
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet sidebar + backdrop - <1024px için overlay */}
      {/* Backdrop */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}
      {/* Mobile/Tablet sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? 'block' : 'hidden'}`}>
        <div 
          className="fixed inset-0 bg-black/40" 
          onClick={() => setMobileOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 w-56 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm flex flex-col border-r border-gray-200/60 dark:border-gray-800/60">
          <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"></div>
          <div className="p-4 overflow-y-auto flex-1 pb-24">
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/dashboard"
                    className={({ isActive }) =>
                      `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                        isActive ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                      }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Menu className="w-4 h-4 flex-shrink-0" />
                    <span>Yönetim Paneli</span>
                  </NavLink>
                </li>
                <li>
                  <button
                    onClick={() => setOpen(!open)}
                    className={`group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium shadow-none ${
                      open ? "bg-indigo-500 text-white" : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                    }`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg>
                  <span className="whitespace-nowrap">İş Tazminatı Hesaplamaları</span>
                  <svg className={`ml-auto w-4 h-4 transition-transform ${open ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
                </button>
                <div className={`${open ? 'max-h-[5000px]' : 'max-h-0'} overflow-hidden transition-all duration-300`}>
                  <ul className="pl-4 mt-1 space-y-1">
                    {employmentItems.map((item) => (
                    <li key={item.id}>
                      {item.isParent ? (
                          <div>
                            <button
                              onClick={() => toggleMenu(item.id)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13px] font-medium transition ${
                                openMenus[item.id] 
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
                              }`}
                            >
                              <Menu className="w-4 h-4 flex-shrink-0" />
                              <span className="text-left flex-1">{item.label}</span>
                              <svg 
                                className={`w-4 h-4 flex-shrink-0 transition-transform ${
                                  openMenus[item.id] 
                                    ? 'rotate-180' 
                                    : 'rotate-0'
                                }`} 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <div 
                              className={`${
                                openMenus[item.id] 
                                  ? 'max-h-[3000px] opacity-100' 
                                  : 'max-h-0 opacity-0'
                              } overflow-hidden transition-all duration-300 pl-4`}
                            >
                              <ul className="mt-1 space-y-1">
                                {item.children?.map((child) => (
                                  <li key={`${item.id}-${child.id}`}>
                                    <ItemLink 
                                      to={child.to} 
                                      label={child.label} 
                                      isSubItem 
                                      onClick={() => setMobileOpen(false)}
                                      activeVariant="light"
                                    />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <ItemLink 
                            to={item.to} 
                            label={item.label} 
                            onClick={() => setMobileOpen(false)}
                            activeVariant="light"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
              
              {/* Mobile Admin Section */}
              {isAdmin && (
                <>
                  <li>
                    <Separator className="my-2" />
                  </li>
                  <li>
                    <div className="px-2.5 py-2">
                      <div className="text-xs font-medium text-gray-400 uppercase mb-2">
                        Admin Paneli
                      </div>
                      <NavLink
                        to="/admin/users"
                        end
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <Users className="w-4 h-4 flex-shrink-0" />
                        <span>Kullanıcı Yönetimi</span>
                      </NavLink>
                      <NavLink
                        to="/admin/users/new"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <UserPlus className="w-4 h-4 flex-shrink-0" />
                        <span>Yeni Üyelik Aç</span>
                      </NavLink>
                      <NavLink
                        to="/admin/subscriptions"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <CreditCard className="w-4 h-4 flex-shrink-0" />
                        <span>Abonelik İşlemleri</span>
                      </NavLink>
                      <NavLink
                        to="/admin/tickets"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                        <span>Destek Talepleri</span>
                      </NavLink>
                      <NavLink
                        to="/admin/feedback"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <Star className="w-4 h-4 flex-shrink-0" />
                        <span>Kullanıcı Geri Bildirimleri</span>
                      </NavLink>
                      <NavLink
                        to="/admin/analytics"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <BarChart2 className="w-4 h-4 flex-shrink-0" />
                        <span>Tenant İstatistikleri</span>
                      </NavLink>
                      <NavLink
                        to="/admin/demo-conversion"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-600/90 text-white"
                              : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <ArrowRight className="w-4 h-4 flex-shrink-0" />
                        <span>Demo → Satış Dönüşüm</span>
                      </NavLink>
                      <NavLink
                        to="/admin/logs"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-600/90 text-white"
                              : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span>Sistem Logları</span>
                      </NavLink>
                      {/* <NavLink
                        to="/admin/payment-settings"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-600/90 text-white"
                              : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <DollarSign className="w-4 h-4 flex-shrink-0" />
                        <span>Ödeme Ayarları</span>
                      </NavLink> */}  {/* Geçici kapatıldı */}
                      <NavLink
                        to="/admin/professional-licenses"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-600/90 text-white"
                              : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <Key className="w-4 h-4 flex-shrink-0" />
                        <span>Lisans Yönetimi</span>
                      </NavLink>
                      <NavLink
                        to="/admin/email-notifications"
                        className={({ isActive }) =>
                          `group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors leading-tight text-[13px] font-medium ${
                            isActive
                              ? "bg-indigo-600/90 text-white"
                              : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-800 dark:text-gray-200"
                          }`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span>Email Bildirimleri</span>
                      </NavLink>
                    </div>
                  </li>
                </>
              )}
            </ul>
            
            {/* Version Info */}
            <div className="mt-auto h-[57px] sm:h-[61px] px-2.5 pt-0 pb-0 flex items-center justify-center border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                <div className="font-medium">Bilirkişi Hesaplama Araçları</div>
                <div className="mt-1">Sürüm 1.0</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
