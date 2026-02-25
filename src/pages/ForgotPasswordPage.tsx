import React, { useState } from "react";
import { Mail, ArrowLeft, Shield, Sparkles, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { API_BASE_URL } from "@/utils/apiClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Backend'e şifre sıfırlama isteği gönder
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSent(true);
        success("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
      } else {
        const data = await response.json();
        error(data.error || "Bir hata oluştu. Lütfen tekrar deneyin.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Animated Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
        
        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-emerald-400/20 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${10 + Math.random() * 20}s`,
              }}
            />
          ))}
        </div>

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Main Content */}
        <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md">
            <div className="relative group">
              {/* Glow Effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 rounded-3xl opacity-20 group-hover:opacity-30 blur transition duration-1000" />
              
              {/* Main Card */}
              <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
                <div className="flex flex-col items-center text-center">
                  {/* Success Icon */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-2xl" />
                    <div className="relative bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full p-4 border border-emerald-500/30">
                      <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                    </div>
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent mb-4">
                    E-posta Gönderildi
                  </h1>

                  {/* Message */}
                  <p className="text-slate-400 mb-2 text-sm">
                    Şifre sıfırlama bağlantısı gönderildi:
                  </p>
                  <p className="text-emerald-400 font-medium mb-6 break-all">
                    {email}
                  </p>
                  <p className="text-slate-500 text-sm mb-8">
                    Lütfen e-posta kutunuzu kontrol edin ve bağlantıya tıklayın.
                  </p>

                  {/* Back to Login Button */}
                  <Link
                    to="/login"
                    className="relative group/btn overflow-hidden rounded-xl p-[2px] transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 opacity-80 group-hover/btn:opacity-100 transition-opacity" />
                    <div className="relative bg-gradient-to-r from-cyan-600 to-blue-600 group-hover/btn:from-cyan-500 group-hover/btn:to-blue-500 px-6 py-3 rounded-xl transition-all duration-300">
                      <span className="font-semibold text-white text-sm tracking-wide flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Giriş Sayfasına Dön
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Animations */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(-100vh) translateX(50px); opacity: 0; }
          }
          .animate-float {
            animation: float linear infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      
      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 20}s`,
            }}
          />
        ))}
      </div>

      {/* Gradient Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-amber-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        {/* Glassmorphism Card */}
        <div className="w-full max-w-md">
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500 rounded-3xl opacity-20 group-hover:opacity-30 blur transition duration-1000" />
            
            {/* Main Card */}
            <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="relative inline-block mb-6">
                  {/* Icon Glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-cyan-500/20 blur-2xl" />
                  <div className="relative bg-gradient-to-br from-amber-500/20 to-cyan-500/20 rounded-full p-4 border border-amber-500/30">
                    <Mail className="h-10 w-10 text-amber-400" />
                  </div>
                </div>
                
                {/* Title */}
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent tracking-tight mb-3">
                  Şifre Sıfırlama
                </h1>
                
                {/* Subtitle */}
                <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Güvenli Kurtarma Sistemi
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  E-posta adresinize şifre sıfırlama bağlantısı göndereceğiz
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    E-posta Adresi
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(251,191,36,0.15)] transition-all duration-300"
                    placeholder="ornek@email.com"
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full group overflow-hidden rounded-xl p-[2px] transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-50"
                >
                  {/* Button Gradient Border */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Button Content */}
                  <div className="relative bg-gradient-to-r from-amber-600 to-cyan-600 group-hover:from-amber-500 group-hover:to-cyan-500 px-6 py-3.5 rounded-xl transition-all duration-300">
                    <span className="font-semibold text-white text-sm tracking-wide flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Gönderiliyor...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Sıfırlama Bağlantısı Gönder
                        </>
                      )}
                    </span>
                  </div>
                  
                  {/* Button Glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-cyan-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
                </button>

                {/* Back to Login Link */}
                <Link
                  to="/login"
                  className="block text-center text-slate-400 hover:text-cyan-400 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Giriş sayfasına dön
                </Link>
              </form>

              {/* Footer Badge */}
              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span>Güvenli Bağlantı</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(50px); opacity: 0; }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </div>
  );
}

