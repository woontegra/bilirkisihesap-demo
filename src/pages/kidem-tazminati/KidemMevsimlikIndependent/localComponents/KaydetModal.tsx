import React, { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

interface KaydetModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (kayitAdi: string) => void;
  isSaving: boolean;
  defaultName?: string;
}

export default function KaydetModal({ open, onClose, onSave, isSaving, defaultName }: KaydetModalProps) {
  const [kayitAdi, setKayitAdi] = useState(defaultName || "");

  useEffect(() => {
    if (open) {
      setKayitAdi(defaultName || "");
    }
  }, [open, defaultName]);

  if (!open) return null;

  const handleSubmit = () => {
    if (kayitAdi.trim()) {
      onSave(kayitAdi.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl sm:max-w-[425px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">
          Hesaplamayı Kaydet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Hesaplamanızı kaydetmek için bir isim giriniz.
        </p>
        <div className="py-2">
          <Label htmlFor="kayit-adi-basin" className="block text-sm font-medium mb-2">
            Hesaplama Adı
          </Label>
          <Input
            id="kayit-adi-basin"
            value={kayitAdi}
            onChange={(e) => setKayitAdi(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz - Kıdem Tazminatı"
            className="mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            disabled={isSaving}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bu isim kaydedilen hesaplamalarınız sayfasında görünecektir.
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !kayitAdi.trim()}>
            {isSaving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}
