import React, { ReactNode } from "react";

const BORDER_STYLE = "1px solid #999";
const CELL_PADDING = "6px 8px";

export function ReportTable({
  headers,
  rows,
  footer,
  alignRight = [],
  columnWidths,
  fontSize = "14px",
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
  footer?: (string | ReactNode)[];
  alignRight?: number[];
  columnWidths?: string[];
  fontSize?: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER_STYLE, fontSize }} className="w-full">
        {columnWidths?.length ? (
          <colgroup>
            {columnWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr style={{ backgroundColor: "#f3f4f6" }}>
            {headers.map((header, idx) => (
              <th key={idx} style={{ border: BORDER_STYLE, padding: CELL_PADDING, textAlign: alignRight.includes(idx) ? "right" : "left", fontWeight: 600 }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} style={{ border: BORDER_STYLE, padding: CELL_PADDING, textAlign: alignRight.includes(cellIdx) ? "right" : "left" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr style={{ backgroundColor: "#dcfce7", fontWeight: 600 }}>
              {footer.map((cell, idx) => (
                <td key={idx} style={{ border: BORDER_STYLE, padding: CELL_PADDING, textAlign: alignRight.includes(idx) ? "right" : "left" }}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function BrutNetTable({
  rows,
  netLabel = "Net Tutar",
  fontSize = "14px",
}: {
  rows: { label: string; value: string; isNet?: boolean; isDeduction?: boolean }[];
  netLabel?: string;
  fontSize?: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER_STYLE, fontSize }} className="w-full">
        <thead>
          <tr>
            <td colSpan={2} style={{ border: BORDER_STYLE, padding: 0, height: 0, lineHeight: 0, fontSize: 0 }}>&#8203;</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              style={{
                backgroundColor: row.isNet ? "#dcfce7" : idx % 2 === 0 ? "#f9fafb" : "#fff",
                fontWeight: row.isNet ? 600 : 400,
                color: row.isDeduction ? "#dc2626" : row.isNet ? "#15803d" : "#111827",
              }}
            >
              <td style={{ border: BORDER_STYLE, padding: CELL_PADDING, width: "60%" }}>{row.label}</td>
              <td style={{ border: BORDER_STYLE, padding: CELL_PADDING, textAlign: "right" }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MahsuplasmaTable({
  rows,
  netRow,
}: {
  rows: { label: string; value: string; isDeduction?: boolean }[];
  netRow: { label: string; value: string };
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER_STYLE, fontSize: "14px" }} className="w-full">
        <thead>
          <tr>
            <td colSpan={2} style={{ border: BORDER_STYLE, padding: 0, height: 0, lineHeight: 0, fontSize: 0 }}>&#8203;</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#f9fafb" : "#fff", color: row.isDeduction ? "#dc2626" : "#111827" }}>
              <td style={{ border: BORDER_STYLE, padding: CELL_PADDING, width: "60%" }}>{row.label}</td>
              <td style={{ border: BORDER_STYLE, padding: CELL_PADDING, textAlign: "right" }}>{row.value}</td>
            </tr>
          ))}
          <tr style={{ backgroundColor: "#dcfce7", fontWeight: 600, color: "#15803d" }}>
            <td style={{ border: BORDER_STYLE, padding: CELL_PADDING }}>{netRow.label}</td>
            <td style={{ border: BORDER_STYLE, padding: CELL_PADDING, textAlign: "right" }}>{netRow.value}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
