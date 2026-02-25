import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import ToolsPanel from "./ToolsPanel";
import DraggableNote from "./DraggableNote";
import CalculationTag from "./CalculationTag";
import AddTagModal from "./AddTagModal";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/apiClient";

interface Note {
  id: string;
  calculationId: string;
  x: number;
  y: number;
  text: string;
}

interface Tag {
  id: string;
  calculationId: string;
  color: string;
  label: string;
}

// calculationId'nin geçerli olup olmadığını kontrol et
const isValidCalculationId = (id: string | undefined): boolean => {
  if (!id) return false;
  // Sayısal ID veya draft ID
  return (/^\d+$/.test(id) || id.startsWith("draft-")) && id.length > 0;
};

// URL'den id parametresini çıkar veya sayfa bazlı geçici ID oluştur
const extractIdFromPath = (pathname: string): string => {
  // /fazla-mesai/vardiya24/123 veya /ubgt-alacagi/456 gibi URL'lerden id'yi çıkar
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  
  // Son segment sayısal ise gerçek id olarak döndür
  if (lastSegment && /^\d+$/.test(lastSegment)) {
    return lastSegment;
  }
  
  // Yoksa sayfa bazlı geçici ID oluştur (draft-sayfa-yolu)
  // Örn: /fazla-mesai/vardiya24 → draft-fazla-mesai-vardiya24
  const pageKey = segments.join("-") || "home";
  return `draft-${pageKey}`;
};

// ID'nin geçici (draft) olup olmadığını kontrol et
const isDraftId = (id: string): boolean => {
  return id.startsWith("draft-");
};

export default function GlobalCalculationTools() {
  const location = useLocation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // URL'den calculationId al (her zaman bir değer döner - gerçek veya draft)
  const calculationId = extractIdFromPath(location.pathname);
  const isDraft = isDraftId(calculationId);

  // Notları ve etiketleri yükle
  useEffect(() => {
    if (!calculationId || !isValidCalculationId(calculationId)) {
      setNotes([]);
      setTags([]);
      return;
    }

    // Draft ID'ler için API çağrısı yapma (backend tanımıyor)
    // Doğrudan calculationId üzerinden kontrol et (isDraft değişkenine güvenme)
    if (calculationId.startsWith("draft-")) {
      setNotes([]);
      setTags([]);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [notesRes, tagsRes] = await Promise.all([
          apiGet(`/api/calculation/${calculationId}/notes`),
          apiGet(`/api/calculation/${calculationId}/tags`)
        ]);

        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(notesData);
        }

        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          setTags(tagsData);
        }
      } catch (error) {
        console.error("Error loading calculation tools data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [calculationId]);

  // Not ekleme (kaydedilmiş hesaplamada API, taslakta yerel state)
  const handleAddNote = useCallback(async () => {
    if (!calculationId || !isValidCalculationId(calculationId)) return;

    if (calculationId.startsWith("draft-")) {
      const newNote: Note = {
        id: `draft-note-${Date.now()}`,
        calculationId,
        x: 150,
        y: 150,
        text: "",
      };
      setNotes((prev) => [...prev, newNote]);
      return;
    }

    try {
      const res = await apiPost(`/api/calculation/${calculationId}/notes`, { x: 150, y: 150, text: "" });
      if (res.ok) {
        const newNote = await res.json();
        setNotes((prev) => [...prev, newNote]);
      }
    } catch (error) {
      console.error("Error adding note:", error);
    }
  }, [calculationId]);

  // Not güncelleme (text) — taslakta sadece state, kaydedilmişte API
  const handleNoteTextChange = useCallback(
    async (noteId: string, text: string) => {
      if (!calculationId) return;

      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, text } : n))
      );

      if (calculationId.startsWith("draft-")) return;

      try {
        await apiPut(`/api/calculation/${calculationId}/notes/${noteId}`, { text });
      } catch (error) {
        console.error("Error updating note text:", error);
      }
    },
    [calculationId]
  );

  // Not güncelleme (pozisyon) — taslakta sadece state, kaydedilmişte API
  const handleNoteDragEnd = useCallback(
    async (noteId: string, x: number, y: number) => {
      if (!calculationId) return;

      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, x, y } : n))
      );

      if (calculationId.startsWith("draft-")) return;

      try {
        await apiPut(`/api/calculation/${calculationId}/notes/${noteId}`, { x, y });
      } catch (error) {
        console.error("Error updating note position:", error);
      }
    },
    [calculationId]
  );

  // Not silme — taslakta sadece state, kaydedilmişte API
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!calculationId) return;

      setNotes((prev) => prev.filter((n) => n.id !== noteId));

      if (calculationId.startsWith("draft-")) return;

      try {
        await apiDelete(`/api/calculation/${calculationId}/notes/${noteId}`);
      } catch (error) {
        console.error("Error deleting note:", error);
      }
    },
    [calculationId]
  );

  // Etiket ekleme
  const handleAddTag = useCallback(
    async (color: string, label: string) => {
      if (!calculationId || calculationId.startsWith("draft-")) return;

      try {
        const res = await apiPost(`/api/calculation/${calculationId}/tags`, { color, label });

        if (res.ok) {
          const newTag = await res.json();
          setTags((prev) => [...prev, newTag]);
        }
      } catch (error) {
        console.error("Error adding tag:", error);
      }
    },
    [calculationId, isDraft]
  );

  // Etiket silme
  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      if (!calculationId || calculationId.startsWith("draft-")) return;

      setTags((prev) => prev.filter((t) => t.id !== tagId));

      try {
        await apiDelete(`/api/calculation/${calculationId}/tags/${tagId}`);
      } catch (error) {
        console.error("Error deleting tag:", error);
      }
    },
    [calculationId, isDraft]
  );

  // Her zaman geçerli bir ID var (gerçek veya draft)
  const hasValidId = isValidCalculationId(calculationId);

  return (
    <>
      {/* Etiketler - Sayfa başında sabit pozisyonda göster */}
      {tags.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 flex flex-wrap justify-center gap-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-[90vw]">
          {tags.map((tag) => (
            <CalculationTag
              key={tag.id}
              id={tag.id}
              color={tag.color}
              label={tag.label}
              onDelete={handleDeleteTag}
            />
          ))}
        </div>
      )}

      {/* Sürüklenebilir notlar */}
      {notes.map((note) => (
        <DraggableNote
          key={note.id}
          id={note.id}
          x={note.x}
          y={note.y}
          text={note.text}
          onChange={handleNoteTextChange}
          onDragEnd={handleNoteDragEnd}
          onDelete={handleDeleteNote}
        />
      ))}

      {/* Araç Paneli - Her zaman görünür ve aktif */}
      <ToolsPanel
        onAddNote={handleAddNote}
        onAddTag={() => setShowTagModal(true)}
        calculationId={calculationId}
      />

      {/* Etiket Ekleme Modalı */}
      <AddTagModal
        open={showTagModal}
        onClose={() => setShowTagModal(false)}
        onAdd={handleAddTag}
      />
    </>
  );
}

