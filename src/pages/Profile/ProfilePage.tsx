import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileInfoPage from "./ProfileInfoPage";
import SavedCalculationsPage from "./SavedCalculationsPage";
import SubscriptionPage from "./SubscriptionPage";
import SubUsersPage from "./SubUsersPage";
import SettingsPage from "./SettingsPage";
import AiPackagesPage from "./AiPackagesPage";
import { User, Bookmark, CreditCard, Users, Settings, MessageSquare, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import TicketsPage from "./TicketsPage";

const ALL_MENU_ITEMS = [
  { key: "info", label: "Profil Bilgileri", icon: User },
  { key: "saved", label: "Kaydedilen Hesaplamalar", icon: Bookmark },
  { key: "subscription", label: "Abonelik Bilgilerim", icon: CreditCard },
  { key: "tickets", label: "Destek Talepleri", icon: MessageSquare },
  { key: "subusers", label: "Alt Kullanıcılar", icon: Users },
  { key: "settings", label: "Ayarlar", icon: Settings },
];

export default function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  // Alt Kullanıcılar sadece ana tenant (1) için; diğer tenant'larda gizle
  const menuItems = tenantId === 1
    ? ALL_MENU_ITEMS
    : ALL_MENU_ITEMS.filter((item) => item.key !== "subusers");

  // URL'den tab bilgisini oku - varsayılan "subscription" yerine "info"
  const params = new URLSearchParams(location.search);
  const urlTab = params.get("tab");
  const [activeTab, setActiveTab] = useState<string>(
    urlTab && menuItems.some((item) => item.key === urlTab) ? urlTab : "subscription"
  );

  // URL'den tab bilgisini oku ve state'i güncelle; tenant'ta subusers erişimini engelle
  useEffect(() => {
    if (location.pathname === "/profile/saved-calculations") {
      setActiveTab("saved");
      navigate("/profile?tab=saved", { replace: true });
    } else if (location.pathname === "/profile/ai-packages") {
      setActiveTab("ai-packages");
      navigate("/profile?tab=ai-packages", { replace: true });
    } else if (location.pathname === "/profile") {
      const params = new URLSearchParams(location.search);
      const tab = params.get("tab");
      if (tab === "subusers" && tenantId !== 1) {
        setActiveTab("subscription");
        navigate("/profile?tab=subscription", { replace: true });
      } else if (tab && menuItems.some((item) => item.key === tab)) {
        setActiveTab(tab);
      }
    }
  }, [location.pathname, location.search, navigate, tenantId, menuItems]);

  // Tab değiştiğinde URL'i güncelle
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/profile?tab=${tab}`, { replace: true });
  };

  const renderContent = () => {
    if (activeTab === "subusers" && tenantId !== 1) return <SubscriptionPage />;
    switch (activeTab) {
      case "info":
        return <ProfileInfoPage />;
      case "saved":
        return <SavedCalculationsPage />;
      case "subscription":
        return <SubscriptionPage />;
      case "ai-packages":
        return <AiPackagesPage />;
      case "tickets":
        return <TicketsPage />;
      case "subusers":
        return <SubUsersPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <ProfileInfoPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-[99%] mx-auto px-2 sm:px-4 lg:px-6 py-4 lg:py-6">
        {/* Header */}
        <ProfileHeader />

        {/* Tab Buttons - Tüm ekran boyutlarında üstte yan yana */}
        <div className="mb-6 overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          <div className="flex gap-2 pb-2 flex-wrap">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              
              return (
                <button
                  key={item.key}
                  onClick={() => handleTabChange(item.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors border",
                    isActive
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area - Tam genişlik (sidebar yok) */}
        <div className="w-full min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
