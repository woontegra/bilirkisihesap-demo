import React, { useState, useEffect } from "react";
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { API_BASE_URL } from "@/utils/apiClient";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    // Check if token and email are present
    if (!token || !email) {
      showError("Geçersiz şifre sıfırlama bağlantısı");
      setTimeout(() => navigate('/login'), 2000);
    }
  }, [token, email, navigate, showError]);

  const validatePassword = () => {
    if (password.length < 6) {
      showError("Şifre en az 6 karakter olmalıdır");
      return false;
    }
    if (password !== confirmPassword) {
      showError("Şifreler eşleşmiyor");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword()) {
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          email,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        showSuccess("Şifreniz başarıyla güncellendi!");
        setTimeout(() => navigate('/login'), 2000);
      } else {
        showError(data.error || "Şifre güncellenemedi. Lütfen tekrar deneyin.");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      showError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return null;
  }

  if (success) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url("/forgot-password-bg.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="bg-white shadow-xl rounded-2xl p-8 md:p-10 w-full max-w-md relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="bg-green-100 rounded-full p-4 mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Şifre Güncellendi</h1>
            <p className="text-gray-600 mb-6">
              Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
            </p>
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Giriş sayfasına dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url("/forgot-password-bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/40"></div>
      <div className="bg-white shadow-xl rounded-2xl p-8 md:p-10 w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-100 rounded-full p-4 mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Yeni Şifre Oluştur</h1>
          <p className="text-gray-600 text-sm text-center">
            Hesabınız için yeni bir şifre belirleyin.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              E-posta
            </label>
            <input
              type="email"
              value={decodeURIComponent(email || '')}
              disabled
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-100 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Yeni Şifre
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="En az 6 karakter"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Şifre en az 6 karakter olmalıdır</p>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Yeni Şifre (Tekrar)
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Şifrenizi tekrar girin"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Şifreler eşleşmiyor</p>
            )}
            {password && confirmPassword && password === confirmPassword && (
              <p className="text-xs text-green-500 mt-1">✓ Şifreler eşleşiyor</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || password !== confirmPassword}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </button>

          <Link
            to="/login"
            className="block text-center text-gray-600 hover:text-gray-800 text-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Giriş sayfasına dön
          </Link>
        </form>
      </div>
    </div>
  );
}


















