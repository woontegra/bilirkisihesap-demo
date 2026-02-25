import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Key, Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { apiPost } from "@/utils/apiClient";

/**
 * Format license key with auto-dash insertion
 * Input: A12B128J14KMGFR3
 * Output: A12B-128J-14KM-GFR3
 */
function formatLicenseKey(value: string): string {
  // Remove all non-alphanumeric characters and convert to uppercase
  const raw = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  
  let formatted = "";
  for (let i = 0; i < raw.length && i < 16; i++) {
    // Add dash after every 4 characters
    if (i > 0 && i % 4 === 0) {
      formatted += "-";
    }
    formatted += raw[i];
  }
  
  return formatted;
}

/**
 * Get or generate device ID with hardware fingerprinting
 * This creates a unique ID based on hardware characteristics
 * that persists even if localStorage is cleared
 */
async function getDeviceId(): Promise<string> {
  // Try to get cached deviceId first
  let deviceId = localStorage.getItem("professional_device_id");
  
  if (!deviceId) {
    // Generate device fingerprint based on hardware characteristics
    const fingerprint = await generateDeviceFingerprint();
    deviceId = "DEV-" + fingerprint;
    localStorage.setItem("professional_device_id", deviceId);
  }
  
  return deviceId;
}

/**
 * Generate unique device fingerprint based on hardware/browser characteristics
 */
async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];
  
  // 1. Screen resolution
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  
  // 2. Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // 3. Language
  components.push(navigator.language);
  
  // 4. Platform
  components.push(navigator.platform);
  
  // 5. Hardware concurrency (CPU cores)
  components.push(String(navigator.hardwareConcurrency || 0));
  
  // 6. User Agent
  components.push(navigator.userAgent);
  
  // 7. Canvas fingerprint (very unique per device)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('Device ID', 2, 15);
      components.push(canvas.toDataURL().substring(0, 100));
    }
  } catch (e) {
    // Canvas may be blocked, continue without it
  }
  
  // 8. WebGL Vendor/Renderer (GPU info)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as any;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch (e) {
    // WebGL may be disabled
  }
  
  // Combine all components and create hash
  const fingerprint = components.join('|');
  
  // Simple hash function (you can use crypto.subtle.digest for better hash)
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to base36 and ensure it's always positive
  return Math.abs(hash).toString(36).toUpperCase();
}

export default function ProfessionalLicenseActivation() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatLicenseKey(value);
    setLicenseKey(formatted);
    setErrorMessage("");
  };

  const handleActivate = async () => {
    // Validation: must be exactly 19 characters (16 + 3 dashes)
    if (licenseKey.length !== 19) {
      setErrorMessage("Lisans anahtarı 16 karakter olmalıdır");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const deviceId = await getDeviceId(); // Now async
      
      // Get user ID from localStorage or auth context
      const currentUser = localStorage.getItem("current_user");
      let userId: number | null = null;
      
      if (currentUser) {
        try {
          const parsed = JSON.parse(currentUser);
          userId = parsed.id;
        } catch (e) {
          console.error("Failed to parse current_user:", e);
        }
      }
      
      // Fallback: try to get from localStorage directly
      if (!userId) {
        const userIdStr = localStorage.getItem("user_id");
        if (userIdStr) {
          userId = parseInt(userIdStr, 10);
        }
      }
      
      if (!userId || isNaN(userId)) {
        setErrorMessage("Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
        error("Kullanıcı bilgisi bulunamadı");
        setLoading(false);
        return;
      }
      
      // Call new activate endpoint
      const response = await apiPost("/api/license/activate", {
        license_key: licenseKey,
        user_id: userId,
        device_id: deviceId
      });

      // apiPost returns Response object, need to check ok and parse JSON
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Lisans aktive edilemedi");
      }

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(true);
        
        // Save license status to localStorage
        localStorage.setItem("licenseValid", "true");
        localStorage.setItem("professionalLicenseKey", licenseKey);
        localStorage.setItem("licenseExpiry", data.license?.expires_at || "");
        
        success("Lisans başarıyla aktive edildi!");
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } else {
        // Handle errors
        const errorMessages: { [key: string]: string } = {
          INVALID_FORMAT: "Geçersiz lisans formatı",
          NOT_FOUND: "Lisans bulunamadı",
          EXPIRED: "Lisansın süresi dolmuş",
          DEVICE_LIMIT: "⚠️ Bu lisans maksimum cihaz sayısına ulaştı. Yönetici ile iletişime geçin.",
          LICENSE_ALREADY_IN_USE: "❌ Bu lisans başka bir kullanıcıya ait. License reassignment yapılamaz.",
          SERVER_ERROR: "Sunucu hatası. Lütfen tekrar deneyin."
        };
        
        const errorMsg = errorMessages[data.error] || data.message || "Lisans aktive edilemedi";
        setErrorMessage(errorMsg);
        error(errorMsg);
        
        localStorage.setItem("licenseValid", "false");
      }
    } catch (err: any) {
      console.error("License activation error:", err);
      
      // Try to parse error response
      let errorMsg = "Sunucu hatası. Lütfen tekrar deneyin.";
      try {
        if (err.response) {
          const errorData = await err.response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        }
      } catch (e) {
        // Ignore parsing errors
      }
      
      setErrorMessage(errorMsg);
      error(errorMsg);
      localStorage.setItem("licenseValid", "false");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading && licenseKey.length === 19) {
      handleActivate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-blue-600">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Lisans Aktivasyonu
          </CardTitle>
          <CardDescription className="text-base text-gray-600">
            Uygulamayı kullanmaya devam etmek için profesyonel lisans anahtarınızı giriniz.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {successMessage ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800 font-medium">
                Lisans başarıyla aktive edildi! Dashboard'a yönlendiriliyorsunuz...
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="license-key" className="text-sm font-medium text-gray-700 block">
                  Lisans Anahtarı
                </label>
                <Input
                  id="license-key"
                  type="text"
                  placeholder="A12B-128J-14KM-GFR3"
                  value={licenseKey}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  className="text-center text-lg font-mono tracking-wider uppercase"
                  maxLength={19}
                  autoFocus
                />
                <p className="text-xs text-gray-500 text-center">
                  Format: A12B-128J-14KM-GFR3 ({licenseKey.replace(/-/g, "").length}/16 karakter)
                </p>
                <p className="text-xs text-gray-400 text-center italic">
                  Tire işaretleri otomatik eklenir
                </p>
              </div>

              {errorMessage && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <XCircle className="h-5 w-5" />
                  <AlertDescription className="text-red-800">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleActivate}
                disabled={loading || licenseKey.length !== 19}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Aktive Ediliyor...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-5 w-5" />
                    Aktive Et
                  </>
                )}
              </Button>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-center text-gray-500">
                  Lisans anahtarınız hakkında bilgi almak için sistem yöneticinizle iletişime geçin.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

