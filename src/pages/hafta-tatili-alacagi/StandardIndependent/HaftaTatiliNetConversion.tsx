import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, apiPost } from "@/utils/apiClient";
import { Plus } from "lucide-react";
import MahsuplasamaModal from "./MahsuplasamaModal";
import { useToast } from "@/context/ToastContext";

// 2 ondalık basamağa yuvarla
const round2 = (n: number) => Math.round(n * 100) / 100;

interface HaftaTatiliTableRow {
  period: string;
  weekCount: number;
  wage: number;
  coefficient: number;
  dailyWage: number;
  haftaTatiliDays: number;
  haftaTatiliTotal: number;
}

interface DateRange {
  id: string;
  start: string;
  end: string;
}

interface HaftaTatiliNetConversionProps {
  haftaTatiliBrutTotal: number; // Hafta Tatili toplam brüt ücreti
  tableData?: HaftaTatiliTableRow[]; // Hesaplama tablosu verileri
  dateRanges?: DateRange[]; // Çalışma dönemleri (yıl belirleme için)
  onSummaryChange?: (summary: {
    brut: number;
    ssk: number;
    gelir: number;
    damga: number;
    net: number;
    hakkaniyet: number;
    settleAmount: string;
  }) => void;
}

export default function HaftaTatiliNetConversion({ haftaTatiliBrutTotal, tableData = [], dateRanges = [], onSummaryChange }: HaftaTatiliNetConversionProps) {
  const { error: showToastError } = useToast();
  
  // Brütten Nete Çevir state (haftaTatili prefix'li)
  const [haftaTatiliBrut, setHaftaTatiliBrut] = useState<number>(0);
  const [brutInputValue, setBrutInputValue] = useState<string>(""); // Input için ayrı string state
  const [haftaTatiliSettleAmount, setHaftaTatiliSettleAmount] = useState<string>(""); // Mahsuplaşma miktarı
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [mahsuplasamaData, setMahsuplasamaData] = useState<{ [year: number]: { [month: number]: number } }>({});

  // İşten çıkış tarihine göre yıl belirleme (en son bitiş tarihi)
  const selectedYear = useMemo(() => {
    if (dateRanges && dateRanges.length > 0) {
      const exitDates = dateRanges
        .map(r => r.end)
        .filter(d => d && d.trim() !== "")
        .map(d => new Date(d))
        .filter(d => !isNaN(d.getTime()));
      
      if (exitDates.length > 0) {
        const latestExit = exitDates.reduce((latest, current) => 
          current > latest ? current : latest
        );
        const year = latestExit.getFullYear();
        if (year >= 2010 && year <= 2030) {
          return year;
        }
      }
    }
    return new Date().getFullYear();
  }, [dateRanges]);

  // Hafta Tatili brut total değiştiğinde otomatik güncelle
  useEffect(() => {
    const roundedTotal = round2(haftaTatiliBrutTotal);
    setHaftaTatiliBrut(roundedTotal);
    setBrutInputValue(roundedTotal > 0 ? roundedTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺" : "");
  }, [haftaTatiliBrutTotal]);

  // Input değişikliği - her yazımda hesapla
  const handleBrutInputChange = (value: string) => {
    setBrutInputValue(value);
    // Parse et ve numeric değeri güncelle
    let cleanValue = value.replace(/₺/g, "").replace(/\s/g, "").trim();
    cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
    const numValue = Number(cleanValue) || 0;
    setHaftaTatiliBrut(numValue);
  };

  // Enter tuşuna basıldığında hesapla (zaten her yazımda hesaplanıyor ama kullanıcı alışkanlığı için)
  const handleBrutKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Değer zaten güncel, sadece input'tan çık
      (e.target as HTMLInputElement).blur();
    }
  };

  // Backend'den hesaplanan değerler
  const [haftaTatiliBrutYillik, setHaftaTatiliBrutYillik] = useState<number>(0);
  const [haftaTatiliSgkPrim, setHaftaTatiliSgkPrim] = useState<number>(0);
  const [haftaTatiliIssizlikPrim, setHaftaTatiliIssizlikPrim] = useState<number>(0);
  const [haftaTatiliGelirVergisi, setHaftaTatiliGelirVergisi] = useState<number>(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState<string>("");
  const [haftaTatiliDamgaVergisi, setHaftaTatiliDamgaVergisi] = useState<number>(0);
  const [haftaTatiliNetYillik, setHaftaTatiliNetYillik] = useState<number>(0);
  const [haftaTatiliSskPrim, setHaftaTatiliSskPrim] = useState<number>(0);

  // Backend'den net hesaplama çek
  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        console.log("[HaftaTatiliNetConversion] Backend'e gönderiliyor:", { brutAmount: haftaTatiliBrut, year: selectedYear });
        
        const response = await apiPost('/api/hafta-tatili/calculate-net', {
          brutAmount: haftaTatiliBrut,
          year: selectedYear
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[HaftaTatiliNetConversion] Backend hatası:", errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("[HaftaTatiliNetConversion] Backend'den gelen sonuç:", result);
        
        if (result.success && result.data) {
          const { ssk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netAmount } = result.data;
          console.log("[HaftaTatiliNetConversion] State güncelleniyor:", { ssk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netAmount });
          console.log("[HaftaTatiliNetConversion] gelirVergisiDilimleri tipi:", typeof gelirVergisiDilimleri, "değeri:", gelirVergisiDilimleri);
          
          // gelirVergisiDilimleri obje ise string'e çevir
          let gelirVergisiString = "";
          if (typeof gelirVergisiDilimleri === "string") {
            gelirVergisiString = gelirVergisiDilimleri;
          } else if (gelirVergisiDilimleri && typeof gelirVergisiDilimleri === "object") {
            // Eğer obje ise summary property'sini al
            gelirVergisiString = gelirVergisiDilimleri.summary || "";
            console.log("[HaftaTatiliNetConversion] gelirVergisiDilimleri obje! summary:", gelirVergisiString);
          }
          
          setHaftaTatiliBrutYillik(haftaTatiliBrut);
          setHaftaTatiliSgkPrim(ssk || 0);
          setHaftaTatiliIssizlikPrim(issizlik || 0);
          setHaftaTatiliGelirVergisi(gelirVergisi || 0);
          setGelirVergisiDilimleri(gelirVergisiString);
          setHaftaTatiliDamgaVergisi(damgaVergisi || 0);
          setHaftaTatiliNetYillik(netAmount || 0);
          setHaftaTatiliSskPrim((ssk || 0) + (issizlik || 0));
        } else {
          console.error("[HaftaTatiliNetConversion] Backend success=false veya data yok:", result);
          showToastError("Brütten nete çevirme hesaplaması başarısız oldu. Backend yanıtı hatalı.");
        }
      } catch (error) {
        console.error("[HaftaTatiliNetConversion] Net hesaplama hatası:", error);
        showToastError(`Brütten nete çevirme sırasında hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
      }
    };

    if (haftaTatiliBrut > 0) {
      console.log("[HaftaTatiliNetConversion] haftaTatiliBrut > 0, backend çağrılıyor:", haftaTatiliBrut);
      calculateFromBackend();
    } else {
      console.log("[HaftaTatiliNetConversion] haftaTatiliBrut <= 0, state sıfırlanıyor");
      setHaftaTatiliBrutYillik(0);
      setHaftaTatiliSgkPrim(0);
      setHaftaTatiliIssizlikPrim(0);
      setHaftaTatiliGelirVergisi(0);
      setHaftaTatiliDamgaVergisi(0);
      setHaftaTatiliNetYillik(0);
      setHaftaTatiliSskPrim(0);
    }
  }, [haftaTatiliBrut, selectedYear]);

  // Hakkaniyet indirimi (1/3)
  const haftaTatiliHakkaniyetIndirimi = useMemo(
    () => haftaTatiliBrutYillik / 3,
    [haftaTatiliBrutYillik]
  );

  // Notify parent on changes
  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      brut: haftaTatiliBrutYillik,
      ssk: haftaTatiliSskPrim,
      gelir: haftaTatiliGelirVergisi,
      damga: haftaTatiliDamgaVergisi,
      net: haftaTatiliNetYillik,
      hakkaniyet: haftaTatiliHakkaniyetIndirimi,
      settleAmount: haftaTatiliSettleAmount,
    });
  }, [haftaTatiliBrutYillik, haftaTatiliSskPrim, haftaTatiliGelirVergisi, haftaTatiliDamgaVergisi, haftaTatiliNetYillik, haftaTatiliHakkaniyetIndirimi, haftaTatiliSettleAmount, onSummaryChange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Kart 1: Brütten Nete Çevir - ZARİF */}
      <div className="md:col-span-2 p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
        <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
          Brütten Nete Çevir
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Brüt Hafta Tatili Ücreti
            </Label>
            <Input
              type="text"
              placeholder="Örn: 25000"
              value={brutInputValue}
              onChange={(e) => handleBrutInputChange(e.target.value)}
              onKeyDown={handleBrutKeyDown}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <div className="space-y-2 pt-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">Brüt Hafta Tatili Ücreti</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{haftaTatiliBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">SGK Primi (%14)</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{haftaTatiliSgkPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">İşsizlik Primi (%1)</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{haftaTatiliIssizlikPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {typeof gelirVergisiDilimleri === "string" ? gelirVergisiDilimleri : ""}</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{haftaTatiliGelirVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59)</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{haftaTatiliDamgaVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Net Hafta Tatili Ücreti</span>
              <span className="text-sm font-bold text-green-700 dark:text-green-400">{haftaTatiliNetYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-4 pt-3 border-t border-yellow-200 dark:border-yellow-800/30">
            Tablodaki brüt Hafta Tatili toplamının nete çevrimi
          </p>
        </div>
      </div>

      {/* Kart 2: Hakkaniyet İndirimi + Mahsuplaşma (Dönemsel Haftalık ile aynı yapı) */}
      <Card className="md:col-span-1 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-l-4 border-pink-500 dark:border-pink-600 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 dark:bg-gray-800/50">
        <CardContent className="space-y-6 pt-6">
          {/* Hakkaniyet İndirimi Bölümü */}
          <div>
            <h3 className="text-base font-bold text-pink-900 dark:text-pink-400 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Hakkaniyet İndirimi
            </h3>
            <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
              1/3 Hakkaniyet İndirimi
            </Label>
            <Input
              type="text"
              value={`${haftaTatiliHakkaniyetIndirimi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`}
              disabled
              className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Toplam Hafta Tatili Ücreti ({haftaTatiliBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) − 1/3 Hakkaniyet İndirimi ({haftaTatiliHakkaniyetIndirimi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) =
              <span className="ml-1 font-semibold">{(haftaTatiliBrutYillik - haftaTatiliHakkaniyetIndirimi).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
            </p>
          </div>
          {/* Mahsuplaşma Bölümü */}
          <div>
            <h3 className="text-base font-bold text-pink-900 dark:text-pink-400 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Mahsuplaşma
            </h3>
            <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mahsuplaşma Miktarı
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                value={haftaTatiliSettleAmount ? `${haftaTatiliSettleAmount} ₺` : ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/₺/g, "").trim();
                  setHaftaTatiliSettleAmount(val);
                }}
                placeholder="0,00 ₺"
                className="flex-1 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 min-w-[140px]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMahsuplasamaModal(true)}
                className="text-xs flex-shrink-0 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Mahsuplaşma </span>Ekle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mahsuplaşma Modal */}
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onOpenChange={setShowMahsuplasamaModal}
        tableData={tableData}
        onSave={(total, data) => {
          // Toplam değeri formatla ve state'e kaydet
          const formattedTotal = total.toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          setHaftaTatiliSettleAmount(formattedTotal);
          setMahsuplasamaData(data);
        }}
      />
    </div>
  );
}

