import axios from 'axios';
import { API_BASE_URL } from '@/utils/apiClient';

const API_URL = API_BASE_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  const tenantId = localStorage.getItem('tenant_id');
  return {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId || '1',
  };
};

// ============================================
// CHAT & ASK
// ============================================

/**
 * Hukuk Bot'a soru sor (Session ile)
 * @param {string} message - Kullanıcı mesajı
 * @param {string} sessionId - Oturum ID (opsiyonel)
 * @returns {Promise<Object>} - AI yanıtı ve kalan soru hakkı
 */
export const askAI = async (message, sessionId = null) => {
  const response = await axios.post(
    `${API_URL}/api/ai/chat`,
    { message, sessionId },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

/**
 * Kalan soru hakkını getir
 * @returns {Promise<Object>} - Kalan soru bilgisi
 */
export const getRemainingQuestions = async () => {
  const response = await axios.get(
    `${API_URL}/api/ai/remaining-questions`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

/**
 * Aylık kullanım istatistiklerini getir
 * @returns {Promise<Object>} - İstatistik verisi
 */
export const getUsageStats = async () => {
  const response = await axios.get(
    `${API_URL}/api/ai/usage-stats`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// ============================================
// SESSION YÖNETİMİ
// ============================================

/**
 * Yeni AI oturumu oluştur
 * @param {string} title - Oturum başlığı (opsiyonel)
 * @returns {Promise<Object>} - Yeni oturum bilgisi
 */
export const createAISession = async (title = 'Yeni Sohbet') => {
  const response = await axios.post(
    `${API_URL}/api/ai/session`,
    { title },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

/**
 * Tüm AI oturumlarını listele
 * @returns {Promise<Object>} - Oturum listesi
 */
export const getAISessions = async () => {
  const response = await axios.get(
    `${API_URL}/api/ai/sessions`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

/**
 * Oturum mesajlarını getir
 * @param {string} sessionId - Oturum ID
 * @returns {Promise<Object>} - Mesaj listesi
 */
export const getSessionMessages = async (sessionId) => {
  const response = await axios.get(
    `${API_URL}/api/ai/session/${sessionId}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

/**
 * Oturumu sil
 * @param {string} sessionId - Oturum ID
 * @returns {Promise<Object>} - Silme sonucu
 */
export const deleteAISession = async (sessionId) => {
  const response = await axios.delete(
    `${API_URL}/api/ai/session/${sessionId}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

/**
 * Oturum adını değiştir
 * @param {string} sessionId - Oturum ID
 * @param {string} title - Yeni başlık
 * @returns {Promise<Object>} - Güncelleme sonucu
 */
export const renameAISession = async (sessionId, title) => {
  const response = await axios.patch(
    `${API_URL}/api/ai/session/${sessionId}`,
    { title },
    { headers: getAuthHeaders() }
  );
  return response.data;
};
