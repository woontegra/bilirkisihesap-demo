import React from 'react';
import { Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ToplamHesaplamaProps {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
  onPrint?: () => void;
}

export default function ToplamHesaplama({ 
  toplam, 
  yil, 
  ay, 
  gun, 
  onPrint 
}: ToplamHesaplamaProps) {
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Toplam Hesaplama</h3>
        {onPrint && (
          <button
            onClick={onPrint}
            className="p-1.5 text-gray-500 rounded-full hover:bg-gray-100"
            title="Yazdır"
          >
            <Printer className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm font-medium text-gray-600">Kıdem Süresi:</span>
          <span className="text-sm font-medium">
            {yil > 0 && <>{yil} yıl </>}
            {ay > 0 && <>{ay} ay </>}
            {gun > 0 ? <>{gun} gün</> : (yil === 0 && ay === 0 ? '0 gün' : '')}
          </span>
        </div>
        
        <div className="pt-3 mt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-base font-medium text-gray-900">Toplam Tutar:</span>
            <span className="text-xl font-bold text-blue-600">{formatCurrency(toplam)} ₺</span>
          </div>
        </div>
        
        <div className="pt-2 text-xs text-gray-500">
          * Brüt tutar üzerinden hesaplanmıştır. Net tutar için stopaj kesintileri uygulanır.
        </div>
      </div>
    </div>
  );
}
