import { useState, useEffect } from "react";
import { apiPost } from "@/utils/apiClient";

interface UbgtReportNetConversionProps {
  totalBrut: number;
  selectedYear: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function UbgtReportNetConversion({ totalBrut, selectedYear }: UbgtReportNetConversionProps) {
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelir, setGelir] = useState(0);
  const [gelirDilimleri, setGelirDilimleri] = useState("");
  const [damga, setDamga] = useState(0);
  const [net, setNet] = useState(0);

  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        // apiPost kullan - otomatik olarak tenant ID ve diğer header'ları ekler
        const response = await apiPost('/api/ubgt/calculate-net', {
          brutAmount: totalBrut,
          year: selectedYear
        });
        if (!response.ok) {
          const errorResult = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
          throw new Error(errorResult.error || `HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.success && result.data) {
          setSgk(result.data.ssk || 0);
          setIssizlik(result.data.issizlik || 0);
          setGelir(result.data.gelirVergisi || 0);
          setGelirDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamga(result.data.damgaVergisi || 0);
          setNet(result.data.netAmount || 0);
        }
      } catch (error) { console.error("UbgtReportNetConversion hesaplama hatası:", error); }
    };
    if (totalBrut > 0) calculateFromBackend();
    else { setSgk(0); setIssizlik(0); setGelir(0); setGelirDilimleri(""); setDamga(0); setNet(0); }
  }, [totalBrut, selectedYear]);

  const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #d1d5db', fontSize:13}}>
      <tbody>
        <tr style={{background:'#f3f4f6', fontWeight:600}}>
          <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Brüt UBGT Ücreti</td>
          <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>₺{fmt(totalBrut)}</td>
        </tr>
        <tr>
          <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>SGK Primi (%14)</td>
          <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>₺{fmt(sgk)}</td>
        </tr>
        <tr>
          <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>İşsizlik Primi (%1)</td>
          <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>₺{fmt(issizlik)}</td>
        </tr>
        <tr>
          <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Gelir Vergisi {gelirDilimleri}</td>
          <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>₺{fmt(gelir)}</td>
        </tr>
        <tr>
          <td style={{border:'1px solid #e5e7eb', padding:'8px'}}>Damga Vergisi (binde 7,59)</td>
          <td style={{border:'1px solid #e5e7eb', padding:'8px', textAlign:'right'}}>₺{fmt(damga)}</td>
        </tr>
        <tr style={{background:'#dcfce7', fontWeight:600, color:'#16a34a'}}>
          <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Net UBGT Ücreti</td>
          <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>₺{fmt(net)}</td>
        </tr>
      </tbody>
    </table>
  );
}
