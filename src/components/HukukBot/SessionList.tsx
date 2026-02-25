import { useState } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Loader2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

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

interface SessionListProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onCreateNew: () => void;
  isLoading: boolean;
}

export default function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onRename,
  onCreateNew,
  isLoading,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = (session: Session) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = (sessionId: string) => {
    if (editTitle.trim()) {
      onRename(sessionId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: tr,
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="hidden md:flex w-72 border-r border-white/10 bg-black/20 flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <button
          onClick={onCreateNew}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-4 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-purple-500/50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Yeni Sohbet
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-white/50 text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Henüz sohbet yok</p>
            <p className="text-xs mt-1">Yeni sohbet başlatın</p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = session.id === editingId;

            return (
              <div
                key={session.id}
                className={`
                  group relative p-3 rounded-lg cursor-pointer transition-all
                  ${isActive
                    ? 'bg-gradient-to-r from-indigo-600/50 to-purple-600/50 shadow-lg'
                    : 'bg-white/5 hover:bg-white/10'
                  }
                `}
                onClick={() => !isEditing && onSelect(session.id)}
              >
                {isEditing ? (
                  // Edit Mode
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm outline-none focus:border-purple-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(session.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      maxLength={50}
                    />
                    <button
                      onClick={() => handleSaveEdit(session.id)}
                      className="p-1 hover:bg-white/10 rounded text-green-400"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 hover:bg-white/10 rounded text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-white font-medium text-sm truncate flex-1">
                        {session.title}
                      </h4>
                      
                      {/* Hover Actions */}
                      <div 
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleStartEdit(session)}
                          className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white"
                          title="Yeniden adlandır"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Bu sohbeti silmek istediğinize emin misiniz?')) {
                              onDelete(session.id);
                            }
                          }}
                          className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-red-400"
                          title="Sil"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Last Message Preview */}
                    {session.lastMessage && (
                      <p className="text-white/50 text-xs truncate mb-1">
                        {session.lastMessage.role === 'user' ? '👤 ' : '🤖 '}
                        {session.lastMessage.preview}
                      </p>
                    )}

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-white/40 text-xs">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {session.messageCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(session.updatedAt)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
