import { useState, useEffect } from 'react';
import { 
  askAI, 
  getRemainingQuestions as fetchRemaining,
  createAISession,
  getAISessions,
  getSessionMessages,
  deleteAISession,
  renameAISession
} from '@/api/ai.js';

interface Message {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: {
    preview: string;
    createdAt: string;
    role: string;
  } | null;
}

export function useHukukBot() {
  // Chat state
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [remainingQuestions, setRemainingQuestions] = useState<number | null>(null);
  const [needsPackage, setNeedsPackage] = useState(false);
  
  // Popup states
  const [showPurchasePopup, setShowPurchasePopup] = useState(false);
  const [showBlockedPopup, setShowBlockedPopup] = useState(false);
  
  // Session state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // İlk açılışta kalan soru hakkını ve oturumları çek
  useEffect(() => {
    if (isOpen && remainingQuestions === null) {
      loadRemainingQuestions();
      loadSessions();
    }
  }, [isOpen]);

  // Active session değiştiğinde mesajları yükle
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  const loadRemainingQuestions = async () => {
    try {
      const response = await fetchRemaining();
      if (response.success) {
        setRemainingQuestions(response.data.remainingQuestions);
        setNeedsPackage(response.data.remainingQuestions === 0);
      }
    } catch (error) {
      console.error('Kalan soru hakkı yüklenemedi:', error);
    }
  };

  // Oturumları yükle
  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await getAISessions();
      if (response.success) {
        setSessions(response.data.sessions || []);
        
        // Eğer aktif session yoksa ve oturumlar varsa, ilkini seç
        if (!activeSessionId && response.data.sessions.length > 0) {
          setActiveSessionId(response.data.sessions[0].id);
        }
      }
    } catch (error) {
      console.error('Oturumlar yüklenemedi:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Oturum mesajlarını yükle
  const loadMessages = async (sessionId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await getSessionMessages(sessionId);
      if (response.success) {
        const loadedMessages = response.data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.createdAt),
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Yeni oturum oluştur
  const createSession = async (title = 'Yeni Sohbet') => {
    try {
      const response = await createAISession(title);
      if (response.success) {
        const newSession = response.data.session;
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        return newSession.id;
      }
    } catch (error) {
      console.error('Oturum oluşturulamadı:', error);
      return null;
    }
  };

  // Oturum sil
  const deleteSession = async (sessionId: string) => {
    try {
      const response = await deleteAISession(sessionId);
      if (response.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        
        // Silinen oturum aktifse, yeni bir oturum oluştur veya başka birine geç
        if (activeSessionId === sessionId) {
          const remainingSessions = sessions.filter((s) => s.id !== sessionId);
          if (remainingSessions.length > 0) {
            setActiveSessionId(remainingSessions[0].id);
          } else {
            // Hiç oturum kalmadıysa yeni oluştur
            await createSession();
          }
        }
      }
    } catch (error) {
      console.error('Oturum silinemedi:', error);
    }
  };

  // Oturum adını değiştir
  const renameSession = async (sessionId: string, title: string) => {
    try {
      const response = await renameAISession(sessionId, title);
      if (response.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      }
    } catch (error) {
      console.error('Oturum adı değiştirilemedi:', error);
    }
  };

  // Mesaj gönder
  const sendMessage = async (content: string) => {
    console.log('📤 [SendMessage] Başladı:', {
      content: content.substring(0, 50),
      loading,
      remainingQuestions,
      activeSessionId,
    });

    if (!content.trim() || loading) {
      console.log('⛔ [SendMessage] Durduruldu: Boş mesaj veya loading');
      return;
    }

    // Kalan soru kontrolü
    if (remainingQuestions !== null && remainingQuestions <= 0) {
      console.log('⛔ [SendMessage] Soru hakkı bitti');
      setNeedsPackage(true);
      setShowPurchasePopup(true);
      return;
    }

    // Eğer aktif oturum yoksa, yeni oluştur
    let sessionId = activeSessionId;
    if (!sessionId) {
      console.log('🆕 [SendMessage] Yeni session oluşturuluyor...');
      sessionId = await createSession();
      if (!sessionId) {
        console.error('❌ [SendMessage] Oturum oluşturulamadı');
        alert('Oturum oluşturulamadı. Lütfen sayfayı yenileyin.');
        return;
      }
      console.log('✅ [SendMessage] Yeni session oluşturuldu:', sessionId);
    }

    // Kullanıcı mesajını ekle
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await askAI(content.trim(), sessionId);

      if (response.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.data.answer,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        
        // SessionId güncellendi mi kontrol et
        if (response.data.sessionId && response.data.sessionId !== activeSessionId) {
          setActiveSessionId(response.data.sessionId);
          await loadSessions(); // Listeyi yenile
        }
        
        // Kalan soru hakkını güncelle
        if (typeof response.data.remainingQuestions === 'number') {
          setRemainingQuestions(response.data.remainingQuestions);
          setNeedsPackage(response.data.remainingQuestions === 0);
        }
      } else {
        throw new Error(response.error || 'Yanıt alınamadı');
      }
    } catch (error: any) {
      console.error('Hukuk Bot hatası:', error);

      // Güvenlik filtresi - Riskli soru engellendi
      if (error.response?.status === 400 && error.response?.data?.code === 'LEGAL_FILTER_BLOCKED') {
        setShowBlockedPopup(true);
        // Son mesajı kaldır (engellenen mesaj)
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Soru hakkı bitti mi?
      if (error.response?.status === 403 && error.response?.data?.code === 'NO_CREDITS') {
        setNeedsPackage(true);
        setRemainingQuestions(0);
        setShowPurchasePopup(true);
        // Son mesajı kaldır
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${error.response?.data?.error || error.message || 'Bilinmeyen hata'}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    // Chat state
    isOpen,
    messages,
    loading,
    remainingQuestions,
    needsPackage,
    
    // Popup state
    showPurchasePopup,
    setShowPurchasePopup,
    showBlockedPopup,
    setShowBlockedPopup,
    
    // Session state
    sessions,
    activeSessionId,
    setActiveSessionId,
    isLoadingSessions,
    isLoadingMessages,
    
    // Functions
    sendMessage,
    toggleChat,
    closeChat,
    clearMessages,
    loadSessions,
    createSession,
    deleteSession,
    renameSession,
    loadMessages,
  };
}
