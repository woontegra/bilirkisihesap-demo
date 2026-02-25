/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import React, { ReactNode } from "react";
import { X } from "lucide-react";

export type ReportInfoRow = {
  label: string;
  value: string | ReactNode;
};

export type ReportSection = {
  title?: string;
  content: ReactNode;
};

type BaseReportLayoutProps = {
  // Header bilgileri
  reportTitle: string;
  reportDate?: string;
  
  // Kimlik bilgileri (üstte grid)
  identityInfo?: ReportInfoRow[];
  
  // Ana içerik bölümleri
  sections: ReportSection[];
  
  // Export ve close fonksiyonları
  onClose?: () => void;
  onPrint?: () => void;
  onWord?: () => void;
  onPdf?: () => void;
  
  // Busy states
  wordBusy?: boolean;
  pdfBusy?: boolean;
  
  // Modal kontrolü
  isOpen?: boolean;
};

const BORDER_STYLE = "1px solid #999";
const CELL_PADDING = "5px 8px";

export default function BaseReportLayout({
  reportTitle,
  reportDate = new Date().toLocaleDateString("tr-TR"),
  identityInfo = [],
  sections,
  onClose,
  onPrint,
  onWord,
  onPdf,
  wordBusy = false,
  pdfBusy = false,
  isOpen = true,
}: BaseReportLayoutProps) {
  if (!isOpen) return null;

  return (
    <div 
      id="report-content" 
      style={{
        fontFamily: 'Inter, "Segoe UI", Tahoma, sans-serif',
        color: '#111827',
        maxWidth: '900px',
        margin: '0 auto',
        backgroundColor: '#fff',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '2px solid #1f2937',
        paddingBottom: '12px',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#1f2937',
            margin: '0 0 4px 0',
          }}>
            {reportTitle}
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#6b7280',
            margin: 0,
          }}>
            Rapor Tarihi: {reportDate}
          </p>
        </div>
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onPrint && (
            <button
              onClick={onPrint}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1f2937',
                backgroundColor: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Yazdır"
            >
              🖨️ Yazdır
            </button>
          )}
          {onWord && (
            <button
              onClick={onWord}
              disabled={wordBusy}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1e40af',
                backgroundColor: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: '6px',
                cursor: wordBusy ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: wordBusy ? 0.6 : 1,
              }}
              title="Word İndir"
            >
              📄 {wordBusy ? 'İndiriliyor...' : 'Word'}
            </button>
          )}
          {onPdf && (
            <button
              onClick={onPdf}
              disabled={pdfBusy}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#991b1b',
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                cursor: pdfBusy ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: pdfBusy ? 0.6 : 1,
              }}
              title="PDF İndir"
            >
              📕 {pdfBusy ? 'İndiriliyor...' : 'PDF'}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '6px',
                fontSize: '13px',
                color: '#6b7280',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Kimlik Bilgileri - Çizgili Grid */}
      {identityInfo.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: BORDER_STYLE,
            fontSize: '10px',
          }}>
            <tbody>
              {identityInfo.map((row, idx) => (
                <tr key={idx}>
                  <td style={{
                    border: BORDER_STYLE,
                    padding: CELL_PADDING,
                    backgroundColor: '#f9fafb',
                    fontWeight: 600,
                    width: '30%',
                    verticalAlign: 'top',
                  }}>
                    {row.label}
                  </td>
                  <td style={{
                    border: BORDER_STYLE,
                    padding: CELL_PADDING,
                    verticalAlign: 'top',
                  }}>
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sections */}
      {sections.map((section, idx) => (
        <div key={idx} style={{ marginBottom: '14px' }}>
          {section.title && (
            <h2 style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#1f2937',
              margin: '0 0 8px 0',
              paddingBottom: '4px',
              borderBottom: '1px solid #e5e7eb',
            }}>
              {section.title}
            </h2>
          )}
          {section.content}
        </div>
      ))}
    </div>
  );
}

// Helper component: Standart Tablo
export function ReportTable({
  headers,
  rows,
  footer,
  alignRight = [],
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
  footer?: (string | ReactNode)[];
  alignRight?: number[]; // Sağa hizalanacak sütun index'leri
}) {
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      border: BORDER_STYLE,
      fontSize: '10px',
    }}>
      <thead>
        <tr style={{ backgroundColor: '#f3f4f6' }}>
          {headers.map((header, idx) => (
            <th key={idx} style={{
              border: BORDER_STYLE,
              padding: CELL_PADDING,
              textAlign: alignRight.includes(idx) ? 'right' : 'left',
              fontWeight: 600,
            }}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {row.map((cell, cellIdx) => (
              <td key={cellIdx} style={{
                border: BORDER_STYLE,
                padding: CELL_PADDING,
                textAlign: alignRight.includes(cellIdx) ? 'right' : 'left',
              }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr style={{ backgroundColor: '#dcfce7', fontWeight: 600 }}>
            {footer.map((cell, idx) => (
              <td key={idx} style={{
                border: BORDER_STYLE,
                padding: CELL_PADDING,
                textAlign: alignRight.includes(idx) ? 'right' : 'left',
              }}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

// Helper component: Brüt → Net Tablosu
export function BrutNetTable({
  rows,
  netLabel = "Net Tutar",
}: {
  rows: { label: string; value: string; isNet?: boolean; isDeduction?: boolean }[];
  netLabel?: string;
}) {
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      border: BORDER_STYLE,
      fontSize: '10px',
    }}>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} style={{
            backgroundColor: row.isNet ? '#dcfce7' : (idx % 2 === 0 ? '#f9fafb' : '#fff'),
            fontWeight: row.isNet ? 600 : 400,
            color: row.isDeduction ? '#dc2626' : (row.isNet ? '#15803d' : '#111827'),
          }}>
            <td style={{
              border: BORDER_STYLE,
              padding: CELL_PADDING,
              width: '60%',
            }}>
              {row.label}
            </td>
            <td style={{
              border: BORDER_STYLE,
              padding: CELL_PADDING,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Helper component: Mahsuplaşma Tablosu
export function MahsuplasmaTable({
  rows,
  netRow,
}: {
  rows: { label: string; value: string; isDeduction?: boolean }[];
  netRow: { label: string; value: string };
}) {
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      border: BORDER_STYLE,
      fontSize: '10px',
    }}>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} style={{
            backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#fff',
            color: row.isDeduction ? '#dc2626' : '#111827',
          }}>
            <td style={{
              border: BORDER_STYLE,
              padding: CELL_PADDING,
              width: '60%',
            }}>
              {row.label}
            </td>
            <td style={{
              border: BORDER_STYLE,
              padding: CELL_PADDING,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {row.value}
            </td>
          </tr>
        ))}
        <tr style={{
          backgroundColor: '#dcfce7',
          fontWeight: 600,
          color: '#15803d',
        }}>
          <td style={{
            border: BORDER_STYLE,
            padding: CELL_PADDING,
          }}>
            {netRow.label}
          </td>
          <td style={{
            border: BORDER_STYLE,
            padding: CELL_PADDING,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {netRow.value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
