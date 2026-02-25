import { useMemo } from "react";
import { calculateIncomeTaxForYear, calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";

interface HaftaTatiliReportNetConversionProps {
  totalBrut: number;
  selectedYear: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const SGK_ORANI = 0.14;
const ISSIZLIK_ORANI = 0.01;
const DAMGA_ORANI = 0.00759;

export default function HaftaTatiliReportNetConversion({ totalBrut, selectedYear }: HaftaTatiliReportNetConversionProps) {
  const sgk = useMemo(() => round2(totalBrut * SGK_ORANI), [totalBrut]);
  const issizlik = useMemo(() => round2(totalBrut * ISSIZLIK_ORANI), [totalBrut]);
  const gelirMatrahi = useMemo(() => Math.max(0, totalBrut - sgk - issizlik), [totalBrut, sgk, issizlik]);
  const gelir = useMemo(() => round2(calculateIncomeTaxForYear(selectedYear, gelirMatrahi)), [selectedYear, gelirMatrahi]);
  const gelirDilimleri = useMemo(() => calculateIncomeTaxWithBrackets(selectedYear, gelirMatrahi).summary, [selectedYear, gelirMatrahi]);
  const damga = useMemo(() => round2(totalBrut * DAMGA_ORANI), [totalBrut]);
  const net = useMemo(() => round2(totalBrut - (sgk + issizlik + gelir + damga)), [totalBrut, sgk, issizlik, gelir, damga]);

  const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #d1d5db', fontSize:13}}>
      <tbody>
        <tr style={{background:'#f3f4f6', fontWeight:600}}>
          <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Brüt Hafta Tatili Ücreti</td>
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
          <td style={{border:'1px solid #d1d5db', padding:'8px'}}>Net Hafta Tatili Ücreti</td>
          <td style={{border:'1px solid #d1d5db', padding:'8px', textAlign:'right'}}>₺{fmt(net)}</td>
        </tr>
      </tbody>
    </table>
  );
}


