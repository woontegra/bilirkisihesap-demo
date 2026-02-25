interface ChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export default function ChatButton({ onClick, isOpen }: ChatButtonProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 z-50 w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-full shadow-2xl hover:shadow-purple-500/50 flex items-center justify-center transition-all duration-300 hover:scale-110 group"
      aria-label="Hukuk Bot"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300"></div>
      <span className="text-3xl relative z-10 group-hover:scale-110 transition-transform duration-300">
        ⚖️
      </span>
      
      {/* Pulse animation */}
      <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-75"></div>
    </button>
  );
}


