import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/context/ToastContext";
import { clearTokens } from "@/utils/authToken";
import { API_BASE_URL } from "@/utils/apiClient";

export default function SettingsPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [notifications, setNotifications] = useState({
    email: true,
    login: true,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Load notification settings on mount
  useEffect(() => {
    loadNotificationSettings();
  }, []);
  
  // Load theme from localStorage or default to light
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") || "light";
      // Apply theme immediately on mount
      const root = document.documentElement;
      if (savedTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      return savedTheme;
    }
    return "light";
  });
  const [isLoading, setIsLoading] = useState(false);

  // Apply theme when it changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
    // Dispatch event for other components/tabs
    window.dispatchEvent(new Event("theme-changed"));
  }, [theme]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      error("Yeni şifreler eşleşmiyor");
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      error("Yeni şifre en az 8 karakter olmalıdır");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem("access_token");
      
      if (!token) {
        error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Şifre değiştirilemedi");
      }

      if (data.success) {
        success("Şifre başarıyla değiştirildi! Yeni şifrenizle giriş yapın.");
        
        // Wait a moment for the success message to show
        setTimeout(() => {
          // Clear all tokens and user data
          clearTokens();
          
          // Redirect to login page
          navigate("/login", { replace: true });
        }, 1500);
      } else {
        throw new Error(data.error || "Şifre değiştirilemedi");
      }
    } catch (err: any) {
      console.error("Şifre değiştirme hatası:", err);
      error(err.message || "Şifre değiştirilirken bir hata oluştu");
      setIsLoading(false);
    }
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    success(`Tema ${value === "light" ? "açık" : "koyu"} moda değiştirildi`);
  };

  // Load notification settings from backend
  const loadNotificationSettings = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const email = localStorage.getItem("email");
      
      if (!email) return;

      const response = await fetch(`${API_BASE_URL}/api/auth/me?email=${encodeURIComponent(email)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-tenant-id": localStorage.getItem("tenant_id") || "1",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications({
          email: data.emailNotifications ?? true,
          login: data.loginAlerts ?? true,
        });
      }
    } catch (err) {
      console.error("Bildirim ayarları yüklenemedi:", err);
    }
  };

  // Save notification settings to backend
  const handleNotificationChange = async (type: "email" | "login", value: boolean) => {
    const newNotifications = { ...notifications, [type]: value };
    setNotifications(newNotifications);
    setLoadingNotifications(true);

    try {
      const token = localStorage.getItem("access_token");
      
      const response = await fetch(`${API_BASE_URL}/api/auth/update-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": localStorage.getItem("tenant_id") || "1",
        },
        body: JSON.stringify({
          emailNotifications: newNotifications.email,
          loginAlerts: newNotifications.login,
        }),
      });

      if (!response.ok) {
        throw new Error("Ayarlar kaydedilemedi");
      }

      success("Bildirim ayarları güncellendi");
    } catch (err: any) {
      console.error("Bildirim ayarları kaydetme hatası:", err);
      error(err.message || "Ayarlar kaydedilirken bir hata oluştu");
      // Revert on error
      setNotifications(notifications);
    } finally {
      setLoadingNotifications(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Şifre Değiştir</CardTitle>
          <CardDescription>Hesap güvenliğiniz için şifrenizi güncelleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Eski Şifre</Label>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                value={passwordData.oldPassword}
                onChange={handlePasswordChange}
                placeholder="Mevcut şifrenizi girin"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Yeni Şifre</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Yeni şifrenizi girin"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Yeni Şifre Tekrar</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Yeni şifrenizi tekrar girin"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Bildirim Ayarları</CardTitle>
          <CardDescription>Bildirim tercihlerinizi yönetin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Bildirimleri</Label>
              <p className="text-sm text-gray-500">
                Önemli güncellemeler ve bildirimler için email alın
              </p>
            </div>
              <Switch
                id="email-notifications"
                checked={notifications.email}
                onCheckedChange={(checked) => handleNotificationChange("email", checked)}
                disabled={loadingNotifications}
              />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="login-alerts">Giriş Uyarıları</Label>
              <p className="text-sm text-gray-500">
                Hesabınıza yeni bir cihazdan giriş yapıldığında bildirim alın
              </p>
            </div>
              <Switch
                id="login-alerts"
                checked={notifications.login}
                onCheckedChange={(checked) => handleNotificationChange("login", checked)}
                disabled={loadingNotifications}
              />
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Tema Ayarı</CardTitle>
          <CardDescription>Görünüm tercihlerinizi seçin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="theme">Tema</Label>
            <Select
              id="theme"
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
            >
              <option value="light">Açık</option>
              <option value="dark">Koyu</option>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
