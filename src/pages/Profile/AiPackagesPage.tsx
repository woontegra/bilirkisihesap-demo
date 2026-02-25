import { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Zap, Crown, TrendingUp, ShieldCheck, Clock } from 'lucide-react';
import { API_BASE_URL } from '@/utils/apiClient';

const API_URL = API_BASE_URL;

interface PackageOption {
  id: string;
  name: string;
  questions: number;
  price: number;
  popular?: boolean;
  icon: any;
  badge?: string;
  color: string;
}

const PACKAGES: PackageOption[] = [
  { 
    id: 'package_50', 
    name: 'Başlangıç', 
    questions: 50, 
    price: 249,
    icon: Sparkles,
    badge: 'Deneme',
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'package_150', 
    name: 'Profesyonel', 
    questions: 150, 
    price: 599, 
    popular: true,
    icon: Crown,
    badge: 'En Popüler',
    color: 'from-purple-500 to-pink-500'
  },
  { 
    id: 'package_300', 
    name: 'Kurumsal', 
    questions: 300, 
    price: 999,
    icon: TrendingUp,
    badge: 'En İyi Değer',
    color: 'from-orange-500 to-red-500'
  },
];

export default function AiPackagesPage() {
  const [remainingQuestions, setRemainingQuestions] = useState(0);
  const [purchasedPackages, setPurchasedPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenant_id');

      if (!token) {
        // Token yoksa login sayfasına yönlendir
        window.location.href = '/login';
        return;
      }

      const [questionsRes, packagesRes] = await Promise.all([
        axios.get(`${API_URL}/api/payments/remaining-questions`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': tenantId || '1',
          },
        }),
        axios.get(`${API_URL}/api/payments/packages`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': tenantId || '1',
          },
        }),
      ]);

      if (questionsRes.data.success) {
        setRemainingQuestions(questionsRes.data.data.remainingQuestions);
      }

      if (packagesRes.data.success) {
        setPurchasedPackages(packagesRes.data.data.packages || []);
      }
    } catch (error: any) {
      console.error('Load data error:', error);
      
      // Token süresi dolmuş veya geçersiz
      if (error?.response?.status === 401) {
        alert('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (packageId: string) => {
    setPurchasing(packageId);

    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenant_id');

      const response = await axios.post(
        `${API_URL}/api/paytr/initiate`,
        { packageId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': tenantId || '1',
          },
        }
      );

      if (response.data.success && response.data.data.paymentUrl) {
        window.location.href = response.data.data.paymentUrl;
      } else {
        throw new Error('Ödeme URL\'si alınamadı');
      }
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      
      // Token süresi dolmuş veya geçersiz
      if (error?.response?.status === 401) {
        alert('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      alert(error.response?.data?.error || 'Ödeme başlatılamadı');
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <Sparkles className="w-8 h-8 text-purple-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-blue-900/20 py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header - AI Temalı */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl mb-6 shadow-2xl shadow-purple-500/50 animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 mb-4">
            AI Hukuk Asistanı
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Yapay zeka destekli hukuki danışmanlık için soru paketi seçin
          </p>
        </div>

        {/* Mevcut Bakiye Kartı - Glassmorphism */}
        <div className="mb-12 relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 p-[2px] shadow-2xl shadow-purple-500/50">
          <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Kullanılabilir Soru Hakkınız
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                    {remainingQuestions}
                  </span>
                  <span className="text-3xl font-bold text-gray-400">soru</span>
                </div>
              </div>
              <div className="hidden sm:flex items-center justify-center w-32 h-32 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl">
                <div className="text-7xl">⚖️</div>
              </div>
            </div>
          </div>
        </div>

        {/* Paket Kartları - Premium AI Tasarım */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 overflow-x-hidden">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <div
                key={pkg.id}
                className="relative group"
              >
                {/* Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-r ${pkg.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 rounded-[22px]`}></div>
                
                {/* Card */}
                <div className={`relative bg-white dark:bg-slate-800 rounded-[22px] min-h-[420px] transition-all duration-300 ${
                  pkg.popular 
                    ? 'shadow-2xl shadow-purple-500/30 ring-2 ring-purple-500' 
                    : 'shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:shadow-2xl hover:-translate-y-2'
                }`}>
                  {/* Badge - Sağ Üst Köşe */}
                  {pkg.badge && (
                    <div className={`absolute top-3 right-3 z-10 bg-gradient-to-r ${pkg.color} text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl border-2 border-white dark:border-slate-800`}>
                      {pkg.badge}
                    </div>
                  )}

                  <div className="p-8 pt-8 h-full flex flex-col">
                    {/* Icon - Sabit pozisyon için mt-0 */}
                    <div className={`w-16 h-16 mt-0 bg-gradient-to-br ${pkg.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>

                    {/* Başlık - Sabit hizalama */}
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 mt-0">
                      {pkg.name}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                      {pkg.questions} Soru Hakkı
                    </p>

                    {/* Fiyat */}
                    <div className="mb-[18px]">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${pkg.color}`}>
                          ₺{pkg.price}
                        </span>
                      </div>
                    </div>

                    {/* Özellikler */}
                    <ul className="space-y-3 mb-5">
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${pkg.color} flex items-center justify-center flex-shrink-0`}>
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="font-medium">{pkg.questions} AI Yanıt</span>
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${pkg.color} flex items-center justify-center flex-shrink-0`}>
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span>GPT-4 Teknolojisi</span>
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${pkg.color} flex items-center justify-center flex-shrink-0`}>
                          <Clock className="w-3 h-3 text-white" />
                        </div>
                        <span>Anında Yanıt</span>
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${pkg.color} flex items-center justify-center flex-shrink-0`}>
                          <ShieldCheck className="w-3 h-3 text-white" />
                        </div>
                        <span>7/24 Erişim</span>
                      </li>
                    </ul>

                    {/* Satın Al Butonu */}
                    <button
                      onClick={() => handleBuy(pkg.id)}
                      disabled={purchasing !== null}
                      className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 mt-auto ${
                        pkg.popular
                          ? `bg-gradient-to-r ${pkg.color} text-white shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/70 hover:scale-105`
                          : `bg-gradient-to-r ${pkg.color} text-white shadow-lg hover:shadow-xl hover:scale-105`
                      } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                    >
                      {purchasing === pkg.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Yükleniyor...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Zap className="w-5 h-5" />
                          Satın Al
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Satın Alma Geçmişi */}
        {purchasedPackages.length > 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              Satın Alma Geçmişi
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Paket</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Soru Miktarı</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Fiyat</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasedPackages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900 dark:text-white">{pkg.packageName}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                          <Sparkles className="w-3 h-3" />
                          {pkg.questionAmount} soru
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-gray-900 dark:text-white">₺{(pkg.price / 100).toFixed(2)}</span>
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {new Date(pkg.paidAt || pkg.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
