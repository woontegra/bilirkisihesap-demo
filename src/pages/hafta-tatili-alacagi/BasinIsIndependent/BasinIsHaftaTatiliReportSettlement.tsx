import { useMemo } from "react";

interface BasinIsHaftaTatiliReportSettlementProps {
  totalNet: number;
}

export default function BasinIsHaftaTatiliReportSettlement({ totalNet }: BasinIsHaftaTatiliReportSettlementProps) {
  const hakkaniyet = useMemo(() => totalNet / 3, [totalNet]);
  const sonuc = useMemo(() => Math.max(0, totalNet - hakkaniyet), [totalNet, hakkaniyet]);

  return (
    <div className="text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>Net Hafta Tatili Ücreti</div>
        <div className="text-right font-medium">{totalNet.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</div>
        <div>1/3 Hakkaniyet İndirimi</div>
        <div className="text-right">{hakkaniyet.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</div>
        <div className="font-semibold">Mahsup Sonucu</div>
        <div className="text-right font-semibold">{sonuc.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</div>
      </div>
    </div>
  );
}






