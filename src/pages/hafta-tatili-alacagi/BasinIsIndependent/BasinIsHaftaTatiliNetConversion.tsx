import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, apiPost } from "@/utils/apiClient";
import { Plus } from "lucide-react";
import BasinIsHaftaTatiliMahsuplasamaModal from "./BasinIsHaftaTatiliMahsuplasamaModal";
// 2 ondalık basamağa yuvarla
const round2 = (n: number) => Math.round(n * 100) / 100;

interface BasinIsHaftaTatiliTableRow {
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

interface BasinIsHaftaTatiliNetConversionProps {
  basinIsHaftaTatiliBrutTotal: number; // Basın İş Hafta Tatili toplam brüt ücreti
  tableData?: BasinIsHaftaTatiliTableRow[]; // Hesaplama tablosu verileri
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

export default function BasinIsHaftaTatiliNetConversion({ basinIsHaftaTatiliBrutTotal, tableData = [], dateRanges = [], onSummaryChange }: BasinIsHaftaTatiliNetConversionProps) {
  // Brütten Nete Çevir state (basinIsHaftaTatili prefix'li)
  const [basinIsHaftaTatiliBrut, setBasinIsHaftaTatiliBrut] = useState<number>(0);
  const [brutInputValue, setBrutInputValue] = useState<string>(""); // Input için ayrı string state
  const [basinIsHaftaTatiliSettleAmount, setBasinIsHaftaTatiliSettleAmount] = useState<string>(""); // Mahsuplaşma miktarı
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

  // Basın İş Hafta Tatili brut total değiştiğinde otomatik güncelle
  useEffect(() => {
    const roundedTotal = round2(basinIsHaftaTatiliBrutTotal);
    setBasinIsHaftaTatiliBrut(roundedTotal);
    setBrutInputValue(roundedTotal > 0 ? roundedTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺" : "");
  }, [basinIsHaftaTatiliBrutTotal]);

  // Input değişikliği - her yazımda hesapla
  const handleBrutInputChange = (value: string) => {
    setBrutInputValue(value);
    // Parse et ve numeric değeri güncelle
    let cleanValue = value.replace(/₺/g, "").replace(/\s/g, "").trim();
    cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
    const numValue = Number(cleanValue) || 0;
    setBasinIsHaftaTatiliBrut(numValue);
  };

  // Enter tuşuna basıldığında
  const handleBrutKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  // Backend'den hesaplanan değerler
  const [basinIsHaftaTatiliBrutYillik, setBasinIsHaftaTatiliBrutYillik] = useState<number>(0);
  const [basinIsHaftaTatiliSgkPrim, setBasinIsHaftaTatiliSgkPrim] = useState<number>(0);
  const [basinIsHaftaTatiliIssizlikPrim, setBasinIsHaftaTatiliIssizlikPrim] = useState<number>(0);
  const [basinIsHaftaTatiliGelirVergisi, setBasinIsHaftaTatiliGelirVergisi] = useState<number>(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState<string>("");
  const [basinIsHaftaTatiliDamgaVergisi, setBasinIsHaftaTatiliDamgaVergisi] = useState<number>(0);
  const [basinIsHaftaTatiliNetYillik, setBasinIsHaftaTatiliNetYillik] = useState<number>(0);
  const [basinIsHaftaTatiliSskPrim, setBasinIsHaftaTatiliSskPrim] = useState<number>(0);

  // Backend'den net hesaplama çek
  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        console.log("[BasinIsHaftaTatiliNetConversion] Backend'e gönderiliyor:", { brutAmount: basinIsHaftaTatiliBrut, year: selectedYear });
        
        const response = await apiPost('/api/hafta-tatili/calculate-net', {
          brutAmount: basinIsHaftaTatiliBrut,
          year: selectedYear
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[BasinIsHaftaTatiliNetConversion] Backend hatası:", errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("[BasinIsHaftaTatiliNetConversion] Backend'den gelen sonuç:", result);
        
        if (result.success && result.data) {
          const { ssk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netAmount } = result.data;
          setBasinIsHaftaTatiliBrutYillik(basinIsHaftaTatiliBrut);
          setBasinIsHaftaTatiliSgkPrim(ssk || 0);
          setBasinIsHaftaTatiliIssizlikPrim(issizlik || 0);
          setBasinIsHaftaTatiliGelirVergisi(gelirVergisi || 0);
          setGelirVergisiDilimleri(gelirVergisiDilimleri || "");
          setBasinIsHaftaTatiliDamgaVergisi(damgaVergisi || 0);
          setBasinIsHaftaTatiliNetYillik(netAmount || 0);
          setBasinIsHaftaTatiliSskPrim((ssk || 0) + (issizlik || 0));
        }
      } catch (error) {
        console.error("[BasinIsHaftaTatiliNetConversion] Net hesaplama hatası:", error);
      }
    };

    if (basinIsHaftaTatiliBrut > 0) {
      calculateFromBackend();
    } else {
      setBasinIsHaftaTatiliBrutYillik(0);
      setBasinIsHaftaTatiliSgkPrim(0);
      setBasinIsHaftaTatiliIssizlikPrim(0);
      setBasinIsHaftaTatiliGelirVergisi(0);
      setBasinIsHaftaTatiliDamgaVergisi(0);
      setBasinIsHaftaTatiliNetYillik(0);
      setBasinIsHaftaTatiliSskPrim(0);
    }
  }, [basinIsHaftaTatiliBrut, selectedYear]);

  // Hakkaniyet indirimi (1/3)
  const basinIsHaftaTatiliHakkaniyetIndirimi = useMemo(
    () => basinIsHaftaTatiliBrutYillik / 3,
    [basinIsHaftaTatiliBrutYillik]
  );

  // Notify parent on changes
  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      brut: basinIsHaftaTatiliBrutYillik,
      ssk: basinIsHaftaTatiliSskPrim,
      gelir: basinIsHaftaTatiliGelirVergisi,
      damga: basinIsHaftaTatiliDamgaVergisi,
      net: basinIsHaftaTatiliNetYillik,
      hakkaniyet: basinIsHaftaTatiliHakkaniyetIndirimi,
      settleAmount: basinIsHaftaTatiliSettleAmount,
    });
  }, [basinIsHaftaTatiliBrutYillik, basinIsHaftaTatiliSskPrim, basinIsHaftaTatiliGelirVergisi, basinIsHaftaTatiliDamgaVergisi, basinIsHaftaTatiliNetYillik, basinIsHaftaTatiliHakkaniyetIndirimi, basinIsHaftaTatiliSettleAmount, onSummaryChange]);

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
              <span className="font-semibold text-gray-900">{basinIsHaftaTatiliBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">SGK Primi (%14)</span>
              <span className="font-semibold text-red-600">-{basinIsHaftaTatiliSgkPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">İşsizlik Primi (%1)</span>
              <span className="font-semibold text-red-600">-{basinIsHaftaTatiliIssizlikPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">Gelir Vergisi {typeof gelirVergisiDilimleri === "string" ? gelirVergisiDilimleri : ""}</span>
              <span className="font-semibold text-red-600">-{basinIsHaftaTatiliGelirVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
              <span className="font-semibold text-red-600">-{basinIsHaftaTatiliDamgaVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-green-700">Net Hafta Tatili Ücreti</span>
              <span className="text-sm font-bold text-green-700">{basinIsHaftaTatiliNetYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
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
              value={`${basinIsHaftaTatiliHakkaniyetIndirimi.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ₺`}
              disabled
              className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Toplam Hafta Tatili Ücreti ({basinIsHaftaTatiliBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) − 1/3 Hakkaniyet İndirimi ({basinIsHaftaTatiliHakkaniyetIndirimi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺) =
              <span className="ml-1 font-semibold">{(basinIsHaftaTatiliBrutYillik - basinIsHaftaTatiliHakkaniyetIndirimi).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
            </p>
          </div>
          <div>
            <Label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mahsuplaşma Miktarı
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                value={basinIsHaftaTatiliSettleAmount ? `${basinIsHaftaTatiliSettleAmount} ₺` : ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/₺/g, "").trim();
                  setBasinIsHaftaTatiliSettleAmount(val);
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
      <BasinIsHaftaTatiliMahsuplasamaModal
        open={showMahsuplasamaModal}
        onOpenChange={setShowMahsuplasamaModal}
        tableData={tableData}
        onSave={(total, data) => {
          // Toplam değeri formatla ve state'e kaydet
          const formattedTotal = total.toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          setBasinIsHaftaTatiliSettleAmount(formattedTotal);
          setMahsuplasamaData(data);
        }}
      />
    </div>
  );
}


