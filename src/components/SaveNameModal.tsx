import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type SaveNameModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
};

export default function SaveNameModal({
  open,
  onClose,
  onSave,
  defaultName = "",
}: SaveNameModalProps) {
  const [name, setName] = useState(defaultName);

  // defaultName değiştiğinde veya modal açıldığında state'i güncelle
  useEffect(() => {
    if (open) {
      setName(defaultName);
    }
  }, [open, defaultName]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName("");
      onClose();
    }
  };

  const handleClose = () => {
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Hesaplamayı Kaydet</DialogTitle>
        <DialogDescription>
          Hesaplamanızı kaydetmek için bir isim giriniz.
        </DialogDescription>
        <div className="py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hesaplama Adı
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                handleSave();
              }
            }}
            placeholder="Örn: Ahmet Yılmaz - Kıdem Tazminatı"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <p className="mt-2 text-xs text-gray-500">
            Bu isim kaydedilen hesaplamalarınız sayfasında görünecektir.
          </p>
        </div>
        <DialogFooter>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kaydet
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

