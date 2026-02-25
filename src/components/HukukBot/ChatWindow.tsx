import { useState, useRef, useEffect } from 'react';
import { X, Send, ShoppingBag, Loader2, Plus, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MessageBubble from './MessageBubble';
import AIPurchasePopup from './AIPurchasePopup';
import AIBlockedPopup from './AIBlockedPopup';
import SessionList from './SessionList';

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

interface ChatWindowProps {
  isOpen: boolean;
  messages: Array<{ id: string | number; role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  loading: boolean;
  remainingQuestions: number | null;
  needsPackage: boolean;
  showPurchasePopup: boolean;
  onSetShowPurchasePopup: (show: boolean) => void;
  showBlockedPopup: boolean;
  onSetShowBlockedPopup: (show: boolean) => void;
  
  // Session props
  sessions: Session[];
  activeSessionId: string | null;
  onSetActiveSessionId: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  
  onClose: () => void;
  onSendMessage: (message: string) => void;
  onClearMessages: () => void;
}

export default function ChatWindow({
  isOpen,
  messages,
  loading,
  remainingQuestions,
  needsPackage,
  showPurchasePopup,
  onSetShowPurchasePopup,
  showBlockedPopup,
  onSetShowBlockedPopup,
  
  // Session
  sessions,
  activeSessionId,
  onSetActiveSessionId,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  isLoadingSessions,
  isLoadingMessages,
  
  onClose,
  onSendMessage,
  onClearMessages,
}: ChatWindowProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || needsPackage) return;

    onSendMessage(input);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 w-full md:w-[900px] h-screen md:h-[650px] md:max-w-[calc(100vw-2rem)] md:max-h-[calc(100vh-2rem)] flex md:rounded-2xl overflow-hidden shadow-2xl animate-slideUp">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-indigo-900/95 to-purple-900/95 backdrop-blur-xl"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
      
      {/* Content */}
      <div className="relative z-10 flex w-full h-full">
        {/* Session List - Sol Panel */}
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={onSetActiveSessionId}
          onDelete={onDeleteSession}
          onRename={onRenameSession}
          onCreateNew={onCreateSession}
          isLoading={isLoadingSessions}
        />

        {/* Chat Area - Sağ Panel */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b border-white/10 bg-gradient-to-r from-indigo-600/50 to-purple-600/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-white/10 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-2xl">⚖️</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base md:text-lg">Hukuk Bot</h3>
                  <p className="text-white/60 text-xs hidden sm:block">İş Hukuku Asistanı</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Mobil'de Yeni Sohbet Butonu */}
                <button
                  onClick={onCreateSession}
                  className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-all text-white/70 hover:text-white"
                  title="Yeni Sohbet"
                  disabled={isLoadingSessions}
                >
                  <Plus className="w-5 h-5" />
                </button>
                {/* Minimize (Küçült) */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/70 hover:text-white"
                  title="Küçült"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                {/* Kapat */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/70 hover:text-white"
                  title="Kapat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Soru Hakkı ve Paket Satın Al */}
            <div className="px-3 md:px-4 pb-3 flex items-center justify-between gap-2">
              <div className="text-white/80 text-xs">
                {remainingQuestions !== null && (
                  <span className="flex items-center gap-1">
                    <span className="hidden sm:inline">💬 Kalan:</span>
                    <strong className="text-white">{remainingQuestions}</strong>
                    <span className="hidden sm:inline">soru</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  onClose();
                  navigate('/profile/ai-packages');
                }}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white px-2 md:px-3 py-1.5 rounded-lg transition-all"
              >
                <ShoppingBag className="w-3 h-3" />
                <span className="hidden sm:inline">Paket Al</span>
              </button>
            </div>
          </div>

          {/* Paket Uyarısı */}
          {needsPackage && (
            <div className="mx-3 md:mx-4 mt-3 md:mt-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3 md:p-4 text-center">
              <p className="text-yellow-200 text-xs md:text-sm mb-2 md:mb-3">⚠️ Soru hakkınız dolmuştur</p>
              <button
                onClick={() => {
                  onClose();
                  navigate('/profile/ai-packages');
                }}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-3 md:px-4 py-2 rounded-lg font-semibold text-xs md:text-sm transition-all"
              >
                💳 Paket Satın Al
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-white/50 animate-spin mx-auto mb-3" />
                  <p className="text-white/50 text-sm">Mesajlar yükleniyor...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-white/50 mt-10 md:mt-20 px-4">
                <p className="text-base md:text-lg mb-2">👋 Merhaba!</p>
                <p className="text-xs md:text-sm">
                  İş hukuku ve aktüerya hesaplamaları hakkında<br className="hidden sm:block" />
                  sorularınızı sorabilirsiniz.
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                  />
                ))}
              </>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 md:p-4 border-t border-white/10 bg-black/20">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={needsPackage ? "Soru hakkınız tükenmiştir..." : "Mesajınızı yazın..."}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 md:px-4 py-2 md:py-3 text-sm md:text-base text-white placeholder-white/50 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || needsPackage}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || needsPackage}
                className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/50 flex items-center justify-center min-w-[44px] md:min-w-[48px]"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            <p className="text-white/40 text-[10px] md:text-xs mt-2 text-center px-2">
              💡 Yasal bilgilendirme amaçlıdır. Kesin görüş için avukata danışın.
            </p>
          </form>
        </div>
      </div>

      {/* Purchase Popup */}
      <AIPurchasePopup 
        open={showPurchasePopup} 
        onClose={() => onSetShowPurchasePopup(false)} 
      />

      {/* Blocked Popup - Güvenlik Filtresi */}
      <AIBlockedPopup 
        open={showBlockedPopup} 
        onClose={() => onSetShowBlockedPopup(false)} 
      />
    </div>
  );
}
