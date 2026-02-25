import { User, Bookmark, CreditCard, Users, Settings, MessageSquare, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_MENU_ITEMS = [
  { key: "info", label: "Profil Bilgileri", icon: User },
  { key: "saved", label: "Kaydedilen Hesaplamalar", icon: Bookmark },
  { key: "subscription", label: "Abonelik Bilgilerim", icon: CreditCard },
  { key: "tickets", label: "Destek Talepleri", icon: MessageSquare },
  { key: "subusers", label: "Alt Kullanıcılar", icon: Users },
  { key: "settings", label: "Ayarlar", icon: Settings },
];

interface ProfileSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Alt Kullanıcılar menüsü sadece ana tenant (tenant_id === 1) için gösterilir */
  menuItems?: typeof ALL_MENU_ITEMS;
}

export default function ProfileSidebar({ activeTab, onTabChange, menuItems = ALL_MENU_ITEMS }: ProfileSidebarProps) {
  return (
    <div className="hidden md:block w-56 shrink-0">
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          
          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-500 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 shrink-0",
                isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
              )} />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

