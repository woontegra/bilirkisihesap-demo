import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/context/ToastContext";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/utils/apiClient";

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  tenantId: string; // ✅ Eklendi
  subscriptionType: string;
  subscriptionEndsAt: string;
}

interface Tenant {
  id: number;
  name: string;
  email: string | null;
}

export default function AdminCreateUserPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showNewTenantModal, setShowNewTenantModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantEmail, setNewTenantEmail] = useState("");
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  
  const [subscriptionType, setSubscriptionType] = useState("annual");
  
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<CreateUserForm>({
    defaultValues: {
      role: "user",
      subscriptionType: "annual",
      tenantId: "", // ✅ Boş başlat
    },
  });

  const currentTenantId = Number(localStorage.getItem("tenant_id") || "1");
  const token = localStorage.getItem("access_token");

  // ✅ Tenant'ları yükle
  useEffect(() => {
    fetchTenants();
  }, [currentTenantId, token]);

  // ✅ Abonelik tipine göre bitiş tarihini otomatik ayarla
  useEffect(() => {
    const calculateEndDate = () => {
      const now = new Date();
      let endDate: Date;

      switch (subscriptionType) {
        case "demo_1day":
          endDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
          break;
        case "demo_3days":
          endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          break;
        case "demo_7days":
          endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "monthly":
          endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case "annual":
          endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          return;
      }

      // ISO format: YYYY-MM-DD
      const formatted = endDate.toISOString().split('T')[0];
      setValue("subscriptionEndsAt", formatted);
    };

    calculateEndDate();
  }, [subscriptionType, setValue]);

  const fetchTenants = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tenants`, {
        headers: {
          "x-tenant-id": String(currentTenantId),
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error("Failed to load tenants:", err);
    }
  };

  // ✅ Yeni tenant oluştur
  const handleCreateTenant = async () => {
    if (!newTenantName.trim()) {
      error("Şirket adı gereklidir");
      return;
    }

    try {
      setIsCreatingTenant(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": String(currentTenantId),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTenantName,
          email: newTenantEmail || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Şirket oluşturulamadı");
      }

      const newTenant = await res.json();
      success(`${newTenant.name} şirketi oluşturuldu`);
      
      // Listeyi yenile ve yeni tenant'ı seç
      await fetchTenants();
      setValue("tenantId", String(newTenant.id));
      
      // Modal'ı kapat
      setShowNewTenantModal(false);
      setNewTenantName("");
      setNewTenantEmail("");
    } catch (err: any) {
      error(err.message || "Şirket oluşturulamadı");
    } finally {
      setIsCreatingTenant(false);
    }
  };

  const onSubmit = async (data: CreateUserForm) => {
    try {
      setIsLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": String(currentTenantId),
          Authorization: `Bearer ${token}`,
          "x-user-role": "admin",
        },
        body: JSON.stringify({
          ...data,
          tenantId: Number(data.tenantId), // ✅ Number'a çevir
          subscriptionEndsAt: data.subscriptionEndsAt || null,
        }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          error("Admin erişimi gerekli");
          navigate("/admin-access-denied");
          return;
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Kullanıcı oluşturulamadı");
      }

      success("Kullanıcı başarıyla oluşturuldu");
      navigate("/admin/users");
    } catch (err: any) {
      console.error("Failed to create user:", err);
      error(err.message || "Kullanıcı oluşturulamadı");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yeni Üyelik Aç</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Yeni bir kullanıcı oluşturun
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Bilgileri</CardTitle>
          <CardDescription>
            Kullanıcı oluşturmak için aşağıdaki bilgileri doldurun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ✅ TENANT SEÇİMİ - EN ÜSTTE */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tenantId">Şirket / Tenant *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewTenantModal(true)}
                    className="text-xs"
                  >
                    ➕ Yeni Şirket Ekle
                  </Button>
                </div>
                <Select
                  id="tenantId"
                  {...register("tenantId", { 
                    required: "Şirket seçimi gereklidir",
                    validate: (value) => {
                      if (!value || value === "") {
                        return "Lütfen bir şirket seçiniz";
                      }
                      return true;
                    }
                  })}
                  className={errors.tenantId ? "border-red-500" : ""}
                >
                  <option value="">-- Şirket Seçiniz --</option>
                  {tenants.length === 0 && (
                    <option value="" disabled>Yükleniyor...</option>
                  )}
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.id === 1 ? '🏢 ' : '🏪 '}
                      {tenant.name} {tenant.email ? `(${tenant.email})` : ''}
                    </option>
                  ))}
                </Select>
                {errors.tenantId && (
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.tenantId.message}</p>
                )}
                <p className="text-xs text-gray-500">
                  ⚠️ Her şirket ayrı bir tenant'tır. Kullanıcı sadece kendi şirketinin verilerini görecek!
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad *</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Ad soyad gereklidir" })}
                  placeholder="Ad Soyad"
                />
                {errors.name && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", { 
                    required: "Email gereklidir",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Geçerli bir email adresi giriniz",
                    },
                  })}
                  placeholder="email@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Parola *</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password", { 
                    required: "Parola gereklidir",
                    minLength: {
                      value: 6,
                      message: "Parola en az 6 karakter olmalıdır",
                    },
                  })}
                  placeholder="En az 6 karakter"
                />
                {errors.password && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Kullanıcı Rolü *</Label>
                <Select
                  id="role"
                  {...register("role", { required: true })}
                >
                  <option value="user">Kullanıcı</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriptionType">Abonelik Tipi *</Label>
                <Select
                  id="subscriptionType"
                  {...register("subscriptionType", { required: true })}
                  onChange={(e) => {
                    setValue("subscriptionType", e.target.value);
                    setSubscriptionType(e.target.value);
                  }}
                >
                  <option value="monthly">Aylık Abonelik</option>
                  <option value="annual">Yıllık Abonelik</option>
                  <optgroup label="Demo Hesaplar">
                    <option value="demo_1day">1 Günlük Demo</option>
                    <option value="demo_3days">3 Günlük Demo</option>
                    <option value="demo_7days">7 Günlük Demo</option>
                  </optgroup>
                </Select>
                {subscriptionType.startsWith('demo_') && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Demo hesap oluşturuyorsunuz. Bitiş tarihi otomatik hesaplanacak.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriptionEndsAt">
                  Abonelik Bitiş Tarihi
                  {subscriptionType.startsWith('demo_') && (
                    <span className="text-xs text-gray-500 ml-2">(Otomatik Hesaplandı)</span>
                  )}
                </Label>
                <Input
                  id="subscriptionEndsAt"
                  type="date"
                  max="9999-12-31"
                  {...register("subscriptionEndsAt")}
                  readOnly={subscriptionType.startsWith('demo_')}
                  className={subscriptionType.startsWith('demo_') ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}
                />
                {subscriptionType.startsWith('demo_') && (
                  <p className="text-xs text-gray-500">
                    Tarihi manuel olarak değiştirmek için "Yıllık Abonelik" seçin
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link to="/admin/users">
                <Button type="button" variant="outline">
                  İptal
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Oluşturuluyor..." : "Kullanıcı Oluştur"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ✅ Yeni Şirket Oluştur Modal */}
      {showNewTenantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewTenantModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Yeni Şirket Ekle</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newTenantName">Şirket Adı *</Label>
                <Input
                  id="newTenantName"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="Örn: ABC Hukuk Bürosu"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newTenantEmail">Email (Opsiyonel)</Label>
                <Input
                  id="newTenantEmail"
                  type="email"
                  value={newTenantEmail}
                  onChange={(e) => setNewTenantEmail(e.target.value)}
                  placeholder="info@firma.com"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewTenantModal(false);
                  setNewTenantName("");
                  setNewTenantEmail("");
                }}
                disabled={isCreatingTenant}
              >
                İptal
              </Button>
              <Button
                type="button"
                onClick={handleCreateTenant}
                disabled={isCreatingTenant || !newTenantName.trim()}
              >
                {isCreatingTenant ? "Oluşturuluyor..." : "Şirket Oluştur"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

