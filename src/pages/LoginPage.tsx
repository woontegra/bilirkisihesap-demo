import React, { useState, useEffect } from "react";
import { Lock, ChevronLeft, ChevronRight, Eye, EyeOff, Shield, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { login as authLogin } from "@/utils/authToken";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { success, error } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Use the new auth utility
      const data = await authLogin(email, password);
      
      // Update auth context
      setUser(data.user);
      // Start feedback timer (show modal after 3 min if still active and not dismissed)
      sessionStorage.setItem("feedback_login_at", Date.now().toString());

      // Save remember me preference
      if (rememberMe) {
        localStorage.setItem("remember_email", email);
      } else {
        localStorage.removeItem("remember_email");
      }
      
      // Save last login date
      localStorage.setItem("last_login_date", new Date().toISOString());
      
      // Dispatch auth event
      window.dispatchEvent(new Event("auth-changed"));
      success("Başarıyla giriş yapıldı");
      
      // Check if password change is required
      if (data.requirePasswordChange === true) {
        // Force password change - redirect to change password page
        navigate("/change-password");
        return;
      }
      
      // Check professional license status (from login response)
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const licenseValid = localStorage.getItem("licenseValid") === "true";
      
      // Admin tenant (tenantId === 1) always goes to dashboard
      if (tenantId === 1) {
        navigate("/dashboard");
        return;
      }
      if (!licenseValid) {
        navigate("/professional-license-activation");
        return;
      }
      
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      error(err.message || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  // Remember me email'i yükle
  React.useEffect(() => {
    const rememberedEmail = localStorage.getItem("remember_email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

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
        {/* Glassmorphism Login Card */}
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500 rounded-3xl opacity-20 group-hover:opacity-30 blur transition duration-1000" />
            
            {/* Main Card */}
            <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
              {/* Logo Area */}
              <div className="text-center mb-8">
                <div className="relative inline-block">
                  {/* Logo Glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-cyan-500/20 blur-2xl" />
                  
                  {/* Logo */}
                  <div className="relative">
                    <img 
                      src="/logo_beyaz.png" 
                      alt="Profesyonel Hesaplama Paneli" 
                      className="h-16 sm:h-20 w-auto mx-auto object-contain drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
                
                {/* Title */}
                <h1 className="mt-6 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent tracking-tight">
                  Profesyonel Hesaplama Paneli
                </h1>
                
                {/* Subtitle */}
                <p className="mt-2 text-sm text-slate-400 flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Güvenli Erişim Portalı
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Input */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    E-Posta
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

                {/* Password Input */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Şifre
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3.5 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 focus:outline-none transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800/50 text-amber-500 focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-0 transition"
                    />
                    <span className="text-slate-400 group-hover:text-slate-300 transition">Beni Hatırla</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    Şifremi Unuttum
                  </Link>
                </div>

                {/* Login Button */}
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
                          Giriş yapılıyor...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" />
                          GİRİŞ YAP
                        </>
                      )}
                    </span>
                  </div>
                  
                  {/* Button Glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-cyan-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
                </button>
              </form>

              {/* Footer Badge */}
              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span>Sistem Aktif • Sürüm 1.0</span>
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
