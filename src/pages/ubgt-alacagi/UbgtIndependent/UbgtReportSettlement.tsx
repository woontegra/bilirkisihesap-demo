import { useState, useEffect } from "react";
import { apiPost } from "@/utils/apiClient";

interface UbgtReportSettlementProps {
  totalBrut: number;
  selectedYear: number;
}

export default function UbgtReportSettlement({ totalBrut, selectedYear }: UbgtReportSettlementProps) {
  const [netAmount, setNetAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNet = async () => {
      if (!totalBrut || totalBrut <= 0) {
        setNetAmount(0);
        return;
      }

      try {
        setLoading(true);
        // apiPost kullan - otomatik olarak tenant ID ve diğer header'ları ekler
        const response = await apiPost('/api/ubgt/calculate-net', {
          brutAmount: totalBrut,
          year: selectedYear
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setNetAmount(result.data.netAmount || 0);
          }
        } else {
          const errorResult = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
          console.error("Net hesaplama hatası:", errorResult);
        }
      } catch (error) {
        console.error("Net hesaplama hatası:", error);
        setNetAmount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchNet();
  }, [totalBrut, selectedYear]);

  const hakkaniyet = netAmount / 3;
  const sonuc = Math.max(0, netAmount - hakkaniyet);
  const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return <div className="text-sm text-gray-500">Hesaplanıyor...</div>;
  }

  return (
    <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #d1d5db', fontSize:13}}>
      <tbody>
        <tr style={{background:'#f3f4f6', fontWeight:600}}>
          <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Net UBGT Ücreti</td>
          <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>₺{fmt(netAmount)}</td>
        </tr>
        <tr>
          <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>1/3 Hakkaniyet İndirimi</td>
          <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>₺{fmt(hakkaniyet)}</td>
        </tr>
        <tr style={{background:'#dcfce7', fontWeight:600, color:'#16a34a'}}>
          <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Mahsup Sonucu</td>
          <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>₺{fmt(sonuc)}</td>
        </tr>
      </tbody>
    </table>
  );
}

