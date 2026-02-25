import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
  warnings?: string[];
  customFormatter?: (n: number) => string;
};

const fmtDefault = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ToplamHesaplama({ toplam, yil, ay, gun, warnings = [], customFormatter }: Props) {
  const hesap1 = toplam * (yil || 0);
  const hesap2 = (toplam / 12) * (ay || 0);
  const hesap3 = (toplam / 365) * (gun || 0);
  const sonuc = hesap1 + hesap2 + hesap3;

  const formatValue = customFormatter || ((n: number) => fmtDefault(n));
  const formatForDisplay = customFormatter ? ((n: number) => `${fmtDefault(n)}₺`) : ((n: number) => `${fmtDefault(n)}₺`);

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-l-4 border-purple-500 dark:border-purple-400 shadow-sm hover:shadow-md transition-all duration-200" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
      <CardHeader className="border-b border-gray-200 dark:border-gray-700">
        <CardTitle className="text-sm md:text-base font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2" style={{ wordBreak: 'break-word' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Kıdem Tazminatı Hesaplaması
        </CardTitle>
        <CardDescription className="text-xs dark:text-gray-400" style={{ wordBreak: 'break-word' }}>Detaylı hesaplama sonuçları</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700" style={{ minWidth: 0 }}>
            <span className="text-xs text-gray-600 dark:text-gray-400" style={{ wordBreak: 'break-word', flex: 1, minWidth: 0 }}>{formatValue(toplam)} × {yil} yıl</span>
            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100" style={{ flexShrink: 0, marginLeft: '8px' }}>{formatForDisplay(hesap1 || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700" style={{ minWidth: 0 }}>
            <span className="text-xs text-gray-600 dark:text-gray-400" style={{ wordBreak: 'break-word', flex: 1, minWidth: 0 }}>{formatValue(toplam)} / 12 × {ay} ay</span>
            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100" style={{ flexShrink: 0, marginLeft: '8px' }}>{formatForDisplay(hesap2 || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700" style={{ minWidth: 0 }}>
            <span className="text-xs text-gray-600 dark:text-gray-400" style={{ wordBreak: 'break-word', flex: 1, minWidth: 0 }}>{formatValue(toplam)} / 365 × {gun} gün</span>
            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100" style={{ flexShrink: 0, marginLeft: '8px' }}>{formatForDisplay(hesap3 || 0)}</span>
          </div>
          <div className="flex items-center justify-between pt-2" style={{ minWidth: 0 }}>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100" style={{ wordBreak: 'break-word', flex: 1, minWidth: 0 }}>Toplam Brüt Ücret</span>
            <span className="text-base font-bold text-purple-700 dark:text-purple-400" style={{ flexShrink: 0, marginLeft: '8px' }}>{formatForDisplay(sonuc || 0)}</span>
          </div>
        </div>
        {warnings?.length > 0 && (
          <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded bg-red-100 text-red-700 text-xs sm:text-sm dark:bg-red-900/20 dark:text-red-300">
            {warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
