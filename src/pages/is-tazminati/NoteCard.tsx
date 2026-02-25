interface NoteCardProps {
  title?: string;
  content?: string;
}

export default function NoteCard({ title, content }: NoteCardProps = {}) {
  // Eğer title ve content prop'ları verilmişse, sadece onları göster (bağımsız not)
  if (title && content) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-sm leading-relaxed">
        <div className="font-semibold mb-2">{title}</div>
        <div className="text-gray-700 whitespace-pre-line">{content}</div>
      </div>
    );
  }
  
  // Eğer prop'lar verilmemişse, varsayılan notu göster (geriye uyumluluk için)
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-sm leading-relaxed">
      <div className="font-semibold mb-2">NOT: Çıplak Brüt Ücret işçinin işi yapmak için aldığı eklentisiz maaşından ibarettir.</div>
      <p className="text-gray-700">
        Prim, İkramiye gibi ücretlerin hesaplamasında son 12 aylık bordroda yer alan tüm kalemler toplanır.
        Toplam 360'a bölünür, 30 ile çarpılır, çıkan bedeli hesaplama kutucuğuna yazınız.
      </p>
    </div>
  );
}
