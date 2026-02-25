import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, apiPost } from "@/utils/apiClient";
import { Plus } from "lucide-react";
import MahsuplasamaModal from "./MahsuplasamaModal";

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
        console.log("[GemiHaftaTatiliNetConversion] Backend'e gönderiliyor:", { brutAmount: haftaTatiliBrut, year: selectedYear });
        
        const response = await apiPost('/api/hafta-tatili/calculate-net', {
          brutAmount: haftaTatiliBrut,
          year: selectedYear
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[GemiHaftaTatiliNetConversion] Backend hatası:", errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("[GemiHaftaTatiliNetConversion] Backend'den gelen sonuç:", result);
        
        if (result.success && result.data) {
          const { ssk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netAmount } = result.data;
          setHaftaTatiliBrutYillik(haftaTatiliBrut);
          setHaftaTatiliSgkPrim(ssk || 0);
          setHaftaTatiliIssizlikPrim(issizlik || 0);
          setHaftaTatiliGelirVergisi(gelirVergisi || 0);
          setGelirVergisiDilimleri(gelirVergisiDilimleri || "");
          setHaftaTatiliDamgaVergisi(damgaVergisi || 0);
          setHaftaTatiliNetYillik(netAmount || 0);
          setHaftaTatiliSskPrim((ssk || 0) + (issizlik || 0));
        }
      } catch (error) {
        console.error("[GemiHaftaTatiliNetConversion] Net hesaplama hatası:", error);
      }
    };

    if (haftaTatiliBrut > 0) {
      calculateFromBackend();
    } else {
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
      {/* Kart 1: Brütten Nete Çevir */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Brütten Nete Çevir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
              Brüt Hafta Tatili Ücreti
            </Label>
            <Input
              type="text"
              placeholder="Örn: 25000"
              value={brutInputValue}
              onChange={(e) => handleBrutInputChange(e.target.value)}
              onKeyDown={handleBrutKeyDown}
              className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            />
          </div>
          <div className="space-y-2 pt-2 border-t border-gray-200 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">Brüt Hafta Tatili Ücreti</span>
              <span className="font-semibold text-gray-900">{haftaTatiliBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">SGK Primi (%14)</span>
              <span className="font-semibold text-red-600">-{haftaTatiliSgkPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">İşsizlik Primi (%1)</span>
              <span className="font-semibold text-red-600">-{haftaTatiliIssizlikPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">Gelir Vergisi {typeof gelirVergisiDilimleri === "string" ? gelirVergisiDilimleri : ""}</span>
              <span className="font-semibold text-red-600">-{haftaTatiliGelirVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
              <span className="font-semibold text-red-600">-{haftaTatiliDamgaVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-green-700">Net Hafta Tatili Ücreti</span>
              <span className="text-sm font-bold text-green-700">{haftaTatiliNetYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">
            Tablodaki brüt Hafta Tatili toplamının nete çevrimi
          </p>
        </CardContent>
      </Card>

      {/* Kart 2: Mahsuplaşma */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Mahsuplaşma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
              1/3 Hakkaniyet İndirimi
            </Label>
            <Input
              type="text"
              value={`${haftaTatiliHakkaniyetIndirimi.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ₺`}
              disabled
              className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Toplam Hafta Tatili Ücreti ({haftaTatiliBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) − 1/3 Hakkaniyet İndirimi ({haftaTatiliHakkaniyetIndirimi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) =
              <span className="ml-1 font-semibold">{(haftaTatiliBrutYillik - haftaTatiliHakkaniyetIndirimi).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
            </p>
          </div>
          <div>
            <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="flex-1 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                style={{ minWidth: '140px' }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMahsuplasamaModal(true)}
                className="h-[42px] whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Mahsuplaşma </span>
                <span className="sm:hidden">Ekle</span>
                <span className="hidden sm:inline">Ekle</span>
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
