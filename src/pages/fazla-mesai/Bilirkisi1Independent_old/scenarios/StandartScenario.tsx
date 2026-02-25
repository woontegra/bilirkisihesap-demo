/**
 * STANDART Scenario - Backend'den hesaplama
 * Backend'den gelen rows'ı döndürür
 * Backward compatibility için hem eski hem yeni prop'ları destekler
 */

import { useMemo } from 'react';

interface StandartScenarioProps {
  // YENİ YÖNTEM: Backend'den gelen rows (StandartPage için)
  backendRows?: any[];
  witnessIntersectionFMRef: React.MutableRefObject<number>;
  
  // ESKİ YÖNTEM: Diğer sayfalar için (backward compatibility)
  standardState?: any;
  weeklyDays?: string;
  activeTab?: string;
  katSayi?: number;
  zamanasimiBaslangic?: string;
  include270?: boolean;
  mode270?: string;
  rows?: any[];
}

export function useStandartScenario(props: StandartScenarioProps) {
  const { backendRows, witnessIntersectionFMRef } = props;

  const derivedRows = useMemo(() => {
    // YENİ YÖNTEM: Backend'den gelen rows'ı kullan
    if (backendRows !== undefined) {
      console.log('[StandartScenario] Backend rows:', backendRows.length, 'satır');
      
      if (backendRows.length > 0 && backendRows[0].fmHours) {
        witnessIntersectionFMRef.current = backendRows[0].fmHours;
      }
      
      return backendRows;
    }
    
    // ESKİ YÖNTEM: Diğer sayfalar için boş array döndür (backward compatibility)
    console.log('[StandartScenario] Eski yöntem kullanılıyor - boş array döndürülüyor');
    return [];
  }, [backendRows, witnessIntersectionFMRef]);

  return derivedRows;
}
