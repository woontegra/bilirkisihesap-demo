import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import UploadAvatarDialog from "./UploadAvatarDialog";
import { Camera } from "lucide-react";
import { API_BASE_URL } from "@/utils/apiClient";

function formatSubscriptionDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function getSubscriptionTypeLabel(type: string | null): string {
  if (!type) return "Abonelik Yok";
  const labels: Record<string, string> = {
    annual: "Yıllık Standart Abonelik",
    monthly: "Aylık Standart Abonelik",
    trial: "Deneme Aboneliği",
  };
  return labels[type] || type;
}

export default function ProfileHeader() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<string | null>(null);

  // Load avatar - önce base64'ten, yoksa backend'den
  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }

    // Önce localStorage'dan base64'i kontrol et
    try {
      const base64Avatar = localStorage.getItem(`avatar_base64_${user.id}`);
      if (base64Avatar && base64Avatar.startsWith('data:image/')) {
        console.log('[ProfileHeader] Using base64 avatar from localStorage');
        setAvatarUrl(base64Avatar);
        return;
      }
    } catch (err) {
      console.error('[ProfileHeader] Failed to read base64 from localStorage:', err);
    }

    // Base64 yoksa backend path'ini kullan
    if (user?.profilePicture) {
      let profilePath = user.profilePicture;
      
      // Eğer path / ile başlamıyorsa ekle
      if (!profilePath.startsWith('/')) {
        profilePath = '/' + profilePath;
      }
      
      const baseUrl = `${API_BASE_URL}${profilePath}`;
      
      console.log('[ProfileHeader] Using backend avatar URL:', baseUrl);
      
      if (avatarUrl !== baseUrl) {
        setAvatarUrl(baseUrl);
      }
    } else {
      setAvatarUrl(null);
    }
  }, [user?.id, user?.profilePicture]);

  // Abonelik bitiş tarihi (tenant bazlı) - profil üstündeki "Yenileme" için
  useEffect(() => {
    if (!user?.email) {
      setSubscriptionEndsAt(null);
      setSubscriptionType(null);
      return;
    }
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    const token = localStorage.getItem("access_token");
    const email = encodeURIComponent(user.email);

    const load = async () => {
      try {
        let res = await fetch(`${API_BASE_URL}/api/auth/me?email=${email}`, {
          headers: {
            "x-tenant-id": String(tenantId),
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          res = await fetch(`${API_BASE_URL}/api/admin/users/email/${email}`, {
            headers: {
              "x-tenant-id": String(tenantId),
              Authorization: `Bearer ${token}`,
              "x-user-role": "admin",
            },
          });
        }
        if (!res.ok) return;
        const data = await res.json();
        setSubscriptionEndsAt(data.subscriptionEndsAt || null);
        setSubscriptionType(data.subscriptionType || null);
      } catch {
        setSubscriptionEndsAt(null);
        setSubscriptionType(null);
      }
    };
    load();
  }, [user?.email]);

  const initials = (user?.name || user?.email || "U?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const displayName = user?.name || user?.email || "Kullanıcı";
  const displayEmail = user?.email || "";

  const handleAvatarChange = (url: string | null) => {
    setAvatarUrl(url);
    // AuthContext'teki user'ı da güncelle (eğer refreshUser henüz çalışmadıysa)
    // Bu sayede sayfa yenilenmeden profil resmi görünür
  };

  return (
    <>
      <Card className={cn(
        "mb-6 border-gray-200 dark:border-gray-700",
        "bg-gradient-to-br from-blue-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900",
        "shadow-md"
      )}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative group">
              <Avatar 
                className={cn(
                  "h-16 w-16 border-2 border-white dark:border-gray-700 shadow-md ring-2 ring-blue-100 dark:ring-gray-700",
                  "cursor-pointer transition-all duration-200",
                  "group-hover:ring-blue-300 dark:group-hover:ring-blue-500",
                  "group-hover:scale-105"
                )}
                onClick={() => setIsDialogOpen(true)}
              >
                {avatarUrl ? (
                  <AvatarImage 
                    src={avatarUrl} 
                    alt={displayName}
                    onLoad={() => {
                      console.log('[ProfileHeader] Avatar image loaded successfully:', avatarUrl);
                    }}
                    onError={(e) => {
                      console.error('[ProfileHeader] Avatar image failed to load:', avatarUrl);
                      console.error('[ProfileHeader] Error event:', e);
                      // Fallback'e geçmek için avatarUrl'i null yap
                      setAvatarUrl(null);
                    }}
                  />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xl font-semibold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              
              {/* Hover Overlay */}
              <div className={cn(
                "absolute inset-0 rounded-full bg-black/50 dark:bg-black/70",
                "flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                "cursor-pointer"
              )}
              onClick={() => setIsDialogOpen(true)}
              >
                <div className="flex flex-col items-center gap-1">
                  <Camera className="h-5 w-5 text-white" />
                  <span className="text-xs text-white font-medium">Profil resmi yükle</span>
                </div>
              </div>
            </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </h2>
            {displayEmail && (
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                {displayEmail}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {getSubscriptionTypeLabel(subscriptionType)}
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Yenileme: {formatSubscriptionDate(subscriptionEndsAt)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <UploadAvatarDialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      currentAvatarUrl={avatarUrl}
      onAvatarChange={handleAvatarChange}
      userName={displayName}
    />
    </>
  );
}

