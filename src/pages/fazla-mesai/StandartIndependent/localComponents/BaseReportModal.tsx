/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import React from "react";
import DraggableModal from "./DraggableModal";
import { ReportTable, BrutNetTable, MahsuplasmaTable } from "./BaseReportLayout";
import { useReportExport } from "../localUtils/useReportExport";

// Config tipi
export interface ReportConfig {
  title: string;
  sections?: {
    info?: boolean;
    periodTable?: boolean;
    grossToNet?: boolean;
    mahsuplasma?: boolean;
  };
  infoRows?: Array<{
    label: string;
    value: string | React.ReactNode;
    condition?: boolean; // Opsiyonel render kontrolü
  }>;
  customSections?: Array<{
    title?: string;
    content: React.ReactNode;
    condition?: boolean;
  }>;
  periodData?: {
    title?: string;
    headers: string[];
    rows: string[][];
    footer?: string[];
    alignRight?: number[];
  };
  grossToNetData?: {
    title?: string;
    rows: Array<{
      label: string;
      value: string;
      isDeduction?: boolean;
      isNet?: boolean;
    }>;
  };
  mahsuplasmaData?: {
    title?: string;
    rows: Array<{
      label: string;
      value: string;
      isDeduction?: boolean;
    }>;
    netRow: {
      label: string;
      value: string;
    };
  };
}

interface BaseReportModalProps {
  open: boolean;
  onClose: () => void;
  config: ReportConfig;
}

export default function BaseReportModal({ open, onClose, config }: BaseReportModalProps) {
  const { wordBusy, pdfBusy, handlePrint, handleDownloadWord, handleDownloadPDF } = useReportExport(config.title);

  if (!open) return null;

  const sections = config.sections || {};

  return (
    <DraggableModal
      open={open}
      onClose={onClose}
      title={`${config.title} – Rapor Görünümü`}
      headerActions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handlePrint}
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
          <button
            onClick={handleDownloadWord}
            disabled={wordBusy}
            data-export-type="word"
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
          <button
            onClick={handleDownloadPDF}
            disabled={pdfBusy}
            data-export-type="pdf"
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
        </div>
      }
    >
      <div id="report-content" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
        {/* Rapor Tarihi */}
        <div style={{ marginBottom: '12px', textAlign: 'right' }}>
          <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
            Tarih: {new Date().toLocaleDateString("tr-TR")}
          </p>
        </div>

        {/* Kimlik Bilgileri / Info Section */}
        {sections.info !== false && config.infoRows && config.infoRows.length > 0 && (
          <div className="report-section" style={{ marginBottom: '14px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #999',
              fontSize: '10px',
            }}>
              <tbody>
                {config.infoRows
                  .filter(row => row.condition !== false)
                  .map((row, idx) => (
                    <tr key={idx}>
                      <td style={{
                        border: '1px solid #999',
                        padding: '5px 8px',
                        backgroundColor: '#f9fafb',
                        fontWeight: 600,
                        width: '30%'
                      }}>
                        {row.label}
                      </td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                        {row.value || "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Custom Sections (Örnek: Hafta Tatili Kullanım Bilgisi, Dışlanabilir Günler) */}
        {config.customSections?.filter(section => section.condition !== false).map((section, idx) => (
          <div key={idx} className="report-section" style={{ marginBottom: '14px' }}>
            {section.title && (
              <h2 className="report-section-title" style={{
                fontSize: '12px',
                fontWeight: 700,
                margin: '0 0 8px 0',
                paddingBottom: '4px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                {section.title}
              </h2>
            )}
            {section.content}
          </div>
        ))}

        {/* Period Table (Hesaplama Cetveli) */}
        {sections.periodTable !== false && config.periodData && (
          <div className="report-section" style={{ marginBottom: '14px' }}>
            {config.periodData.title && (
              <h2 className="report-section-title" style={{
                fontSize: '12px',
                fontWeight: 700,
                margin: '0 0 8px 0',
                paddingBottom: '4px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                {config.periodData.title}
              </h2>
            )}
            <ReportTable
              headers={config.periodData.headers}
              rows={config.periodData.rows}
              footer={config.periodData.footer}
              alignRight={config.periodData.alignRight}
            />
          </div>
        )}

        {/* Brüt'ten Net'e Çeviri */}
        {sections.grossToNet !== false && config.grossToNetData && (
          <div className="report-section" style={{ marginBottom: '14px' }}>
            <h2 className="report-section-title" style={{
              fontSize: '12px',
              fontWeight: 700,
              margin: '0 0 8px 0',
              paddingBottom: '4px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              {config.grossToNetData.title || "Brüt'ten Net'e Çeviri"}
            </h2>
            <BrutNetTable rows={config.grossToNetData.rows} />
          </div>
        )}

        {/* Mahsuplaşma */}
        {sections.mahsuplasma !== false && config.mahsuplasmaData && (
          <div className="report-section report-section-last" style={{ marginBottom: '14px' }}>
            <h2 className="report-section-title" style={{
              fontSize: '12px',
              fontWeight: 700,
              margin: '0 0 8px 0',
              paddingBottom: '4px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              {config.mahsuplasmaData.title || "Mahsuplaşma"}
            </h2>
            <MahsuplasmaTable
              rows={config.mahsuplasmaData.rows}
              netRow={config.mahsuplasmaData.netRow}
            />
          </div>
        )}
      </div>
    </DraggableModal>
  );
}
