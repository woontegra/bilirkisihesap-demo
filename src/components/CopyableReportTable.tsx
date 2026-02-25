import React from 'react';

/**
 * MERKEZI WORD KOPYALAMA COMPONENT'İ
 * 
 * AMAÇ:
 * - Kullanıcılar mouse ile seçip Word'e yapıştırdığında DÜZGÜN görünsün
 * - Mevcut UI'a DOKUNMADAN, sadece kopyalama için table-based çözüm
 * 
 * ÖNEMLİ:
 * - SADECE <table>, <tr>, <td> kullanır
 * - div, flex, grid KULLANMAZ
 * - Inline style kullanır (Word uyumluluğu için)
 * - Gizli olarak render edilir (display: none)
 * - YENİ hesaplama YAPMAZ, sadece props'tan gelen veriyi gösterir
 */

export interface ReportRow {
  startDate: string;
  endDate: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fm: number;
  net: number;
  label?: string;
}

export interface CopyableReportTableProps {
  title?: string;
  rows: ReportRow[];
  showWeeks?: boolean;
  showCoefficient?: boolean;
}

const CopyableReportTable: React.FC<CopyableReportTableProps> = ({
  title = 'Fazla Mesai Hesaplama Raporu',
  rows,
  showWeeks = true,
  showCoefficient = true,
}) => {
  // Inline styles - Word/LibreOffice/Google Docs uyumlu
  const tableStyle: React.CSSProperties = {
    display: 'none', // Kullanıcıya görünmez, sadece kopyalama için
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'Arial, sans-serif',
    fontSize: '11pt',
  };

  const thStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '8px',
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    textAlign: 'left',
  };

  const tdStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '8px',
    textAlign: 'left',
  };

  const tdNumberStyle: React.CSSProperties = {
    ...tdStyle,
    textAlign: 'right',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14pt',
    fontWeight: 'bold',
    marginBottom: '10px',
    textAlign: 'center',
  };

  const formatNumber = (num: number): string => {
    return num.toFixed(2).replace('.', ',');
  };

  const formatCurrency = (num: number): string => {
    return num.toFixed(2).replace('.', ',') + ' ₺';
  };

  return (
    <div id="copyable-report-container" style={{ display: 'none' }}>
      <table id="copyable-report-table" style={tableStyle}>
        <caption style={titleStyle}>{title}</caption>
        <thead>
          <tr>
            <th style={thStyle}>Dönem</th>
            {showWeeks && <th style={thStyle}>Hafta</th>}
            <th style={thStyle}>Brüt Ücret</th>
            {showCoefficient && <th style={thStyle}>Katsayı</th>}
            <th style={thStyle}>FM Saati</th>
            <th style={thStyle}>FM Tutarı</th>
            <th style={thStyle}>Net Tutar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td style={tdStyle}>
                {row.label || `${row.startDate} - ${row.endDate}`}
              </td>
              {showWeeks && (
                <td style={tdNumberStyle}>{row.weeks}</td>
              )}
              <td style={tdNumberStyle}>{formatCurrency(row.brut)}</td>
              {showCoefficient && (
                <td style={tdNumberStyle}>{formatNumber(row.katsayi)}</td>
              )}
              <td style={tdNumberStyle}>{formatNumber(row.fmHours)}</td>
              <td style={tdNumberStyle}>{formatCurrency(row.fm)}</td>
              <td style={tdNumberStyle}>{formatCurrency(row.net)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...thStyle, textAlign: 'right' }} colSpan={showWeeks && showCoefficient ? 5 : showWeeks || showCoefficient ? 4 : 3}>
              <strong>TOPLAM</strong>
            </td>
            <td style={{ ...thStyle, textAlign: 'right' }}>
              <strong>{formatCurrency(rows.reduce((sum, row) => sum + row.fm, 0))}</strong>
            </td>
            <td style={{ ...thStyle, textAlign: 'right' }}>
              <strong>{formatCurrency(rows.reduce((sum, row) => sum + row.net, 0))}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default CopyableReportTable;
