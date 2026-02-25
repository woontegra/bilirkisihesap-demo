interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 md:mb-4 animate-fadeIn`}>
      <div
        className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-3 md:px-4 py-2 md:py-3 ${
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
            : 'bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg'
        }`}
      >
        <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        <p
          className={`text-[10px] md:text-xs mt-1 md:mt-2 ${
            isUser ? 'text-white/70' : 'text-white/50'
          }`}
        >
          {timestamp.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}


