import { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Save, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '@/utils/apiClient';

const API_URL = API_BASE_URL;

export default function PaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  const [settings, setSettings] = useState({
    merchantId: '',
    merchantKey: '',
    merchantSalt: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenant_id');

      const response = await axios.get(`${API_URL}/api/admin/payment-settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId || '1',
        },
      });

      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenant_id');

      const response = await axios.post(
        `${API_URL}/api/admin/payment-settings`,
        settings,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': tenantId || '1',
          },
        }
      );

      if (response.data.success) {
        alert('✅ Ayarlar başarıyla kaydedildi');
      }
    } catch (error: any) {
      console.error('Save settings error:', error);
      alert(error.response?.data?.error || 'Ayarlar kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-indigo-600" />
          Ödeme Ayarları
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          PayTR entegrasyon ayarlarını buradan yönetin
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-6">
          {/* Merchant ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Merchant ID
            </label>
            <input
              type="text"
              value={settings.merchantId}
              onChange={(e) => setSettings({ ...settings, merchantId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="PayTR Merchant ID"
            />
          </div>

          {/* Merchant Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Merchant Key
            </label>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                value={settings.merchantKey}
                onChange={(e) => setSettings({ ...settings, merchantKey: e.target.value })}
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="PayTR Merchant Key"
              />
              <button
                type="button"
                onClick={() => setShowKeys(!showKeys)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showKeys ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Merchant Salt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Merchant Salt
            </label>
            <input
              type={showKeys ? 'text' : 'password'}
              value={settings.merchantSalt}
              onChange={(e) => setSettings({ ...settings, merchantSalt: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="PayTR Merchant Salt"
            />
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ℹ️ Bu bilgileri PayTR hesabınızdan alabilirsiniz.
              <br />
              Alternatif olarak <code className="bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">.env</code> dosyasına da ekleyebilirsiniz:
            </p>
            <pre className="mt-3 text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
{`PAYTR_MERCHANT_ID=your_merchant_id
PAYTR_MERCHANT_KEY=your_merchant_key  
PAYTR_MERCHANT_SALT=your_merchant_salt`}
            </pre>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Ayarları Kaydet
              </>
            )}
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          ⚠️ <strong>Dikkat:</strong> Bu bilgiler hassastır. Yetkisiz kişilerle paylaşmayınız.
        </p>
      </div>
    </div>
  );
}

















