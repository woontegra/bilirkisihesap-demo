import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/utils/apiClient";
import UBGTMahsuplasamaModal from "./UBGTMahsuplasamaModal";

// 2 ondalık basamağa yuvarla
const round2 = (n: number) => Math.round(n * 100) / 100;

interface UbgtTableRow {
  period: string;
  wage: number;
  coefficient: number;
  dailyWage: number;
  ubgtDays: number;
  ubgtTotal: number;
}

interface DateRange {
  id: string;
  start: string;
  end: string;
}

interface UbgtNetConversionProps {
  ubgtBrutTotal: number; // UBGT toplam brüt ücreti
  tableData?: UbgtTableRow[]; // Hesaplama tablosu verileri
  dateRanges?: DateRange[]; // Çalışma dönemleri (yıl belirleme için)
  initialMahsuplasamaData?: { [year: number]: { [holidayName: string]: number } }; // Kaydedilmiş mahsuplaşma verileri
  onSummaryChange?: (summary: {
    brut: number;
    ssk: number;
    gelir: number;
    damga: number;
    net: number;
    hakkaniyet: number;
    settleAmount: string;
  }) => void;
  onMahsuplasamaDataChange?: (data: { [year: number]: { [holidayName: string]: number } }) => void;
}

export default function UbgtNetConversion({ ubgtBrutTotal, tableData = [], dateRanges = [], initialMahsuplasamaData, onSummaryChange, onMahsuplasamaDataChange }: UbgtNetConversionProps) {
  // Brütten Nete Çevir state (ubgt prefix'li)
  const [ubgtBrut, setUbgtBrut] = useState<number>(0);
  const [brutInputValue, setBrutInputValue] = useState<string>(""); // Input için ayrı string state
  const [ubgtSettleAmount, setUbgtSettleAmount] = useState<string>(""); // Mahsuplaşma miktarı
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [mahsuplasamaData, setMahsuplasamaData] = useState<{ [year: number]: { [holidayName: string]: number } }>(initialMahsuplasamaData || {});
  
  // Initial data yüklendiğinde state'i güncelle
  useEffect(() => {
    if (initialMahsuplasamaData && Object.keys(initialMahsuplasamaData).length > 0) {
      setMahsuplasamaData(initialMahsuplasamaData);
      // Toplamı hesapla ve input'a yaz
      let total = 0;
      Object.keys(initialMahsuplasamaData).forEach((yearStr) => {
        const year = parseInt(yearStr, 10);
        if (initialMahsuplasamaData[year]) {
          Object.keys(initialMahsuplasamaData[year]).forEach((holidayName) => {
            total += initialMahsuplasamaData[year][holidayName] || 0;
          });
        }
      });
      setUbgtSettleAmount(total.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [initialMahsuplasamaData]);

  // UBGT brut total değiştiğinde otomatik güncelle
  useEffect(() => {
    const roundedTotal = round2(ubgtBrutTotal);
    setUbgtBrut(roundedTotal);
    setBrutInputValue(roundedTotal > 0 ? roundedTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺" : "");
  }, [ubgtBrutTotal]);

  // Input değişikliği - her yazımda hesapla
  const handleBrutInputChange = (value: string) => {
    setBrutInputValue(value);
    // Parse et ve numeric değeri güncelle
    let cleanValue = value.replace(/₺/g, "").replace(/\s/g, "").trim();
    cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
    const numValue = Number(cleanValue) || 0;
    setUbgtBrut(numValue);
  };

  // Enter tuşuna basıldığında
  const handleBrutKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

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

  // Backend'den hesaplanan değerler
  const [ubgtBrutYillik, setUbgtBrutYillik] = useState<number>(0);
  const [ubgtSgkPrim, setUbgtSgkPrim] = useState<number>(0);
  const [ubgtIssizlikPrim, setUbgtIssizlikPrim] = useState<number>(0);
  const [ubgtGelirVergisi, setUbgtGelirVergisi] = useState<number>(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState<string>("");
  const [ubgtDamgaVergisi, setUbgtDamgaVergisi] = useState<number>(0);
  const [ubgtNetYillik, setUbgtNetYillik] = useState<number>(0);
  const [ubgtSskPrim, setUbgtSskPrim] = useState<number>(0);

  // Backend'den net hesaplama çek
  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        console.log("[UbgtNetConversion] Backend'e gönderiliyor:", { brutAmount: ubgtBrut, year: selectedYear });
        
        // apiPost kullan - otomatik olarak tenant ID ve diğer header'ları ekler
        const response = await apiPost('/api/ubgt/calculate-net', {
          brutAmount: ubgtBrut,
          year: selectedYear
        });
        
        console.log("[UbgtNetConversion] Response status:", response.status);
        
        if (!response.ok) {
          const errorResult = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
          console.error("[UbgtNetConversion] Backend hatası:", errorResult);
          throw new Error(errorResult.error || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("[UbgtNetConversion] Backend'den gelen sonuç:", result);
        
        if (result.success && result.data) {
          const { ssk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netAmount } = result.data;
          console.log("[UbgtNetConversion] State güncelleniyor:", { ssk, issizlik, gelirVergisi, gelirVergisiDilimleri, damgaVergisi, netAmount });
          
          setUbgtBrutYillik(ubgtBrut);
          setUbgtSgkPrim(ssk || 0);
          setUbgtIssizlikPrim(issizlik || 0);
          setUbgtGelirVergisi(gelirVergisi || 0);
          setGelirVergisiDilimleri(gelirVergisiDilimleri || "");
          setUbgtDamgaVergisi(damgaVergisi || 0);
          setUbgtNetYillik(netAmount || 0);
          setUbgtSskPrim((ssk || 0) + (issizlik || 0));
        } else {
          console.error("[UbgtNetConversion] Backend success=false veya data yok:", result);
        }
      } catch (error) {
        console.error("[UbgtNetConversion] Net hesaplama hatası:", error);
      }
    };

    if (ubgtBrut > 0) {
      console.log("[UbgtNetConversion] ubgtBrut > 0, backend çağrılıyor:", ubgtBrut);
      calculateFromBackend();
    } else {
      console.log("[UbgtNetConversion] ubgtBrut <= 0, state sıfırlanıyor");
      setUbgtBrutYillik(0);
      setUbgtSgkPrim(0);
      setUbgtIssizlikPrim(0);
      setUbgtGelirVergisi(0);
      setUbgtDamgaVergisi(0);
      setUbgtNetYillik(0);
      setUbgtSskPrim(0);
    }
  }, [ubgtBrut, selectedYear]);

  // Hakkaniyet indirimi (1/3)
  const ubgtHakkaniyetIndirimi = useMemo(
    () => ubgtBrutYillik / 3,
    [ubgtBrutYillik]
  );

  // Notify parent on changes
  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      brut: ubgtBrutYillik,
      ssk: ubgtSskPrim,
      gelir: ubgtGelirVergisi,
      damga: ubgtDamgaVergisi,
      net: ubgtNetYillik,
      hakkaniyet: ubgtHakkaniyetIndirimi,
      settleAmount: ubgtSettleAmount,
    });
  }, [ubgtBrutYillik, ubgtSskPrim, ubgtGelirVergisi, ubgtDamgaVergisi, ubgtNetYillik, ubgtHakkaniyetIndirimi, ubgtSettleAmount, onSummaryChange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
      {/* Kart 1: Brütten Nete Çevir - ZARİF */}
      <div className="md:col-span-2 p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
        <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
          Brütten Nete Çevir
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Brüt UBGT Ücreti
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
              <span className="text-gray-700 dark:text-gray-300">Brüt UBGT Ücreti</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{ubgtBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">SGK Primi (%14)</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{ubgtSgkPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">İşsizlik Primi (%1)</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{ubgtIssizlikPrim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {gelirVergisiDilimleri}</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{ubgtGelirVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
              <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59)</span>
              <span className="font-semibold text-red-600 dark:text-red-400">-{ubgtDamgaVergisi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Net UBGT Ücreti</span>
              <span className="text-sm font-bold text-green-700 dark:text-green-400">{ubgtNetYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-4 pt-3 border-t border-yellow-200 dark:border-yellow-800/30">
            Tablodaki brüt UBGT toplamının nete çevrimi
          </p>
        </div>
      </div>

      {/* Kart 2: Hakkaniyet İndirimi + Mahsuplaşma (tanıklı fazla mesai ile aynı düzen) */}
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
              value={`${ubgtHakkaniyetIndirimi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`}
              disabled
              className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Toplam UBGT Ücreti ({ubgtBrutYillik.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺) − 1/3 Hakkaniyet İndirimi ({ubgtHakkaniyetIndirimi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺) =
              <span className="ml-1 font-semibold">{(ubgtBrutYillik - ubgtHakkaniyetIndirimi).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺</span>
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
                value={ubgtSettleAmount ? (() => {
                  const numValue = parseFloat(ubgtSettleAmount.replace(/\./g, '').replace(/,/g, '.')) || 0;
                  return numValue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₺';
                })() : ''}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                  const numValue = parseFloat(cleaned) || 0;
                  setUbgtSettleAmount(numValue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }}
                placeholder="0,00₺"
                className="flex-1 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 min-w-[140px]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMahsuplasamaModal(true)}
                className="text-xs flex-shrink-0 whitespace-nowrap"
              >
                <span className="hidden sm:inline">Mahsuplaşma </span>Ekle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UBGT Mahsuplaşma Modal */}
      <UBGTMahsuplasamaModal
        open={showMahsuplasamaModal}
        onOpenChange={setShowMahsuplasamaModal}
        tableData={tableData}
        initialData={mahsuplasamaData}
        onSave={(total, data) => {
          setUbgtSettleAmount(total.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setMahsuplasamaData(data);
          if (onMahsuplasamaDataChange) {
            onMahsuplasamaDataChange(data);
          }
        }}
      />
    </div>
  );
}
