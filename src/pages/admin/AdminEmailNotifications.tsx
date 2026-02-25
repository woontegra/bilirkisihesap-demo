import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/context/ToastContext";
import { Mail, Send, Users, Clock, CheckCircle, XCircle, Image, Code } from "lucide-react";
import { API_BASE_URL } from "@/utils/apiClient";

export default function AdminEmailNotifications() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    recipientType: "all",
    customEmails: "",
    subject: "",
    message: "",
    logoUrl: "",
    headerImageUrl: "",
    useCustomTemplate: false,
  });
  const [sendResult, setSendResult] = useState<any>(null);

  const recipientTypes = [
    { value: "all", label: "Tüm Kullanıcılar", icon: Users },
    { value: "active", label: "Aktif Aboneler", icon: CheckCircle },
    { value: "trial", label: "Deneme Kullanıcıları", icon: Clock },
    { value: "expired", label: "Süresi Dolmuş Kullanıcılar", icon: XCircle },
    { value: "custom", label: "Özel Email Listesi", icon: Mail },
  ];

  const templates = [
    { 
      name: "Yeni Özellik Duyurusu",
      subject: "🎉 Yeni Özellikler Eklendi!",
      message: "Sistemimize yeni özellikler ekledik. Detayları görmek için panele giriş yapabilirsiniz."
    },
    { 
      name: "Sistem Bakımı",
      subject: "⚙️ Planlı Sistem Bakımı",
      message: "Sistemimiz [TARIH] tarihinde bakıma girecektir. Bu süre zarfında hizmetlerimize erişemeyebilirsiniz."
    },
    { 
      name: "Abonelik Hatırlatması",
      subject: "⏰ Abonelik Yenileme Hatırlatması",
      message: "Aboneliğinizin süresi yakında dolacak. Kesintisiz hizmet için lütfen yenileme yapın."
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subject || !formData.message) {
      error("Konu ve mesaj alanlarını doldurun");
      return;
    }

    if (formData.recipientType === "custom" && !formData.customEmails) {
      error("Özel email listesi için en az bir email adresi girin");
      return;
    }

    setLoading(true);
    setSendResult(null);

    try {
      const token = localStorage.getItem("access_token");
      const tenantId = localStorage.getItem("tenant_id");

      const requestBody: any = {
        recipientType: formData.recipientType,
        subject: formData.subject,
        message: formData.message,
        logoUrl: formData.logoUrl,
        headerImageUrl: formData.headerImageUrl,
        useCustomTemplate: formData.useCustomTemplate,
      };

      // Parse custom emails if needed
      if (formData.recipientType === "custom") {
        const emails = formData.customEmails
          .split(/[,;\n]/)
          .map(e => e.trim())
          .filter(e => e && e.includes("@"));
        
        if (emails.length === 0) {
          error("Geçerli email adresi bulunamadı");
          setLoading(false);
          return;
        }

        requestBody.customEmails = emails;
      }

      const response = await fetch(`${API_BASE_URL}/api/email-notifications/send-bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId || "1",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Email gönderilemedi");
      }

      setSendResult(data.results);
      success(`Email başarıyla gönderildi: ${data.results.sent}/${data.results.total}`);
      
      // Reset form
      setFormData({
        recipientType: "all",
        customEmails: "",
        subject: "",
        message: "",
      });

    } catch (err: any) {
      console.error("Email gönderme hatası:", err);
      error(err.message || "Email gönderilirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: typeof templates[0]) => {
    setFormData(prev => ({
      ...prev,
      subject: template.subject,
      message: template.message,
    }));
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Email Bildirimleri</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Kullanıcılara toplu email gönderin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Email Gönder</CardTitle>
              <CardDescription>Toplu email bildirimi oluşturun</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Recipient Type */}
                <div className="space-y-2">
                  <Label htmlFor="recipientType">Alıcı Grubu</Label>
                  <Select
                    id="recipientType"
                    value={formData.recipientType}
                    onChange={(e) => setFormData({ ...formData, recipientType: e.target.value })}
                  >
                    {recipientTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Custom Emails */}
                {formData.recipientType === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="customEmails">Email Adresleri</Label>
                    <Textarea
                      id="customEmails"
                      placeholder="ornek1@email.com, ornek2@email.com&#10;Her satıra bir email veya virgül/noktalı virgül ile ayırın"
                      value={formData.customEmails}
                      onChange={(e) => setFormData({ ...formData, customEmails: e.target.value })}
                      rows={5}
                    />
                    <p className="text-sm text-gray-500">
                      Her satıra bir email veya virgül/noktalı virgül ile ayırın
                    </p>
                  </div>
                )}

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Konu</Label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="Email konusu..."
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Mesaj</Label>
                  <Textarea
                    id="message"
                    placeholder="Email mesajınızı buraya yazın..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={8}
                    required
                  />
                  <p className="text-sm text-gray-500">
                    Mesajınız otomatik olarak email şablonuna yerleştirilecektir
                  </p>
                </div>

                {/* Custom Design Options */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Image className="w-4 h-4 text-gray-600" />
                    <Label className="text-base font-semibold">Email Tasarımı (Opsiyonel)</Label>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Logo URL */}
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">Logo URL</Label>
                      <Input
                        id="logoUrl"
                        type="url"
                        placeholder="https://yoursite.com/logo.png"
                        value={formData.logoUrl}
                        onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                      />
                      <p className="text-xs text-gray-500">
                        Logo URL'si girerseniz email'de görünür (varsayılan: ⚖️ emoji)
                      </p>
                    </div>

                    {/* Header Image URL */}
                    <div className="space-y-2">
                      <Label htmlFor="headerImageUrl">Header Görsel URL</Label>
                      <Input
                        id="headerImageUrl"
                        type="url"
                        placeholder="https://yoursite.com/email-header.png"
                        value={formData.headerImageUrl}
                        onChange={(e) => setFormData({ ...formData, headerImageUrl: e.target.value })}
                      />
                      <p className="text-xs text-gray-500">
                        Email başlığında görünecek banner görsel (opsiyonel)
                      </p>
                    </div>

                    {/* Preview */}
                    {(formData.logoUrl || formData.headerImageUrl) && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">Önizleme:</p>
                        {formData.logoUrl && (
                          <div className="mb-2">
                            <img 
                              src={formData.logoUrl} 
                              alt="Logo Preview" 
                              className="max-w-[150px] h-auto"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML += '<p class="text-red-500 text-xs">❌ Görsel yüklenemedi</p>';
                              }}
                            />
                          </div>
                        )}
                        {formData.headerImageUrl && (
                          <div>
                            <img 
                              src={formData.headerImageUrl} 
                              alt="Header Preview" 
                              className="max-w-full h-auto rounded"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML += '<p class="text-red-500 text-xs">❌ Görsel yüklenemedi</p>';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Email Gönder
                      </>
                    )}
                  </Button>
                </div>

                {/* Send Result */}
                {sendResult && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                      Gönderim Tamamlandı
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-green-800 dark:text-green-200">
                        ✅ Başarılı: {sendResult.sent}/{sendResult.total}
                      </p>
                      {sendResult.failed > 0 && (
                        <p className="text-red-600 dark:text-red-400">
                          ❌ Başarısız: {sendResult.failed}
                        </p>
                      )}
                    </div>
                    {sendResult.errors && sendResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                          Hata Detayları
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {sendResult.errors.slice(0, 5).map((err: any, idx: number) => (
                            <li key={idx} className="text-red-600 dark:text-red-400">
                              {err.recipient}: {err.error}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Templates Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Hazır Şablonlar</CardTitle>
              <CardDescription>Hızlı kullanım için şablonlar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(template)}
                  className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {template.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {template.subject}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>💡 İpuçları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Email'ler 10'ar 10'ar gönderilir</p>
              <p>• Her kullanıcının adı otomatik eklenir</p>
              <p>• Özel listede virgül veya satır sonu kullanabilirsiniz</p>
              <p>• Email ayarları .env dosyasında yapılmalıdır</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

