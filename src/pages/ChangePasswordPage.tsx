import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/context/ToastContext";
import { apiPost } from "@/utils/apiClient";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Check if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      // Not authenticated, redirect to login
      navigate("/login");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    // Validation
    if (!newPassword || !confirmPassword) {
      setErrorMessage("Lütfen tüm alanları doldurun");
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Şifre en az 8 karakter olmalıdır");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Şifreler eşleşmiyor");
      setLoading(false);
      return;
    }

    try {
      // Call change password API
      // Note: For forced password change, we don't need old password
      // The backend will check must_change_password flag
      const response = await apiPost("/api/auth/change-password", {
        newPassword: newPassword,
        // For forced password change, we can skip oldPassword
        // Backend should handle this case
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Şifre değiştirilemedi");
      }

      const data = await response.json();

      if (data.success) {
        success("Şifre başarıyla değiştirildi");
        
        // Redirect to dashboard after successful password change
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } else {
        throw new Error(data.error || "Şifre değiştirilemedi");
      }
    } catch (err: any) {
      console.error("Change password error:", err);
      const errorMsg = err.message || "Şifre değiştirilirken bir hata oluştu";
      setErrorMessage(errorMsg);
      error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Şifre Değiştirme Zorunlu</CardTitle>
          <CardDescription>
            Güvenliğiniz için lütfen şifrenizi değiştirin
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Yeni Şifre</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  className="pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Şifreyi tekrar girin"
                  className="pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
            </Button>
          </form>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
            Bu adımı tamamlamadan devam edemezsiniz
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
