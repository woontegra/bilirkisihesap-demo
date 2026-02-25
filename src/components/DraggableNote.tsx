import { useState, useRef, useEffect } from "react";
import { X, GripVertical } from "lucide-react";

interface DraggableNoteProps {
  id: string;
  x: number;
  y: number;
  text: string;
  onChange: (id: string, text: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
}

export default function DraggableNote({
  id,
  x,
  y,
  text,
  onChange,
  onDragEnd,
  onDelete
}: DraggableNoteProps) {
  const [position, setPosition] = useState({ x, y });
  const [isDragging, setIsDragging] = useState(false);
  const [noteText, setNoteText] = useState(text);
  const noteRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Sync position from props
  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  // Sync text from props
  useEffect(() => {
    setNoteText(text);
  }, [text]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const rect = noteRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      // Sınırlar içinde tut
      const boundedX = Math.max(0, Math.min(window.innerWidth - 250, newX));
      const boundedY = Math.max(0, Math.min(window.innerHeight - 200, newY));
      
      setPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onDragEnd(id, position.x, position.y);
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, id, position, onDragEnd]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setNoteText(newText);
    onChange(id, newText);
  };

  return (
    <div
      ref={noteRef}
      className={`fixed z-40 w-56 min-h-[140px] bg-amber-100 dark:bg-amber-200 rounded-lg shadow-lg transition-shadow ${
        isDragging ? "shadow-2xl cursor-grabbing" : "shadow-md"
      }`}
      style={{
        left: position.x,
        top: position.y,
        transform: "rotate(-1deg)"
      }}
    >
      {/* Header - Sürükleme alanı */}
      <div
        className="flex items-center justify-between px-2 py-1.5 bg-amber-200 dark:bg-amber-300 rounded-t-lg cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="w-4 h-4 text-amber-600" />
        <button
          onClick={() => onDelete(id)}
          className="p-0.5 hover:bg-amber-300 dark:hover:bg-amber-400 rounded transition-colors"
        >
          <X className="w-4 h-4 text-amber-700" />
        </button>
      </div>

      {/* Content */}
      <div className="p-2">
        <textarea
          value={noteText}
          onChange={handleTextChange}
          placeholder="Not yazın..."
          className="w-full h-24 bg-transparent resize-none border-none outline-none text-sm text-amber-900 placeholder-amber-500"
          style={{ fontFamily: "'Caveat', cursive, sans-serif" }}
        />
      </div>

      {/* Dekoratif katlama köşesi */}
      <div
        className="absolute bottom-0 right-0 w-6 h-6"
        style={{
          background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%)"
        }}
      />
    </div>
  );
}




