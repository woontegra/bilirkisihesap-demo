import React from "react";

export type KidemReportData = {
  iseGirisTarihi?: string;
  istenCikisTarihi?: string;
  calismaSuresi?: string;
  brutUcret?: number;
  prim?: number;
  ikramiye?: number;
  yemek?: number;
  toplamBrut?: number;
  netTazminat?: number;
  totals?: { toplam: number; yil: number; ay: number; gun: number };
  damgaVergisi?: number;
  gelirVergisi?: number;
  muafiyetTutari?: number;
  gelirVergisiUygulanacak?: boolean;
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
};

export default function KidemTazminatiReportModal({ data }: { data: KidemReportData }) {
  const totals = data.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 };
  const aylikBrutUcret = totals.toplam > 0 ? totals.toplam : (data.toplamBrut && (totals.yil > 0 || totals.ay > 0 || totals.gun > 0)) ? data.toplamBrut / (totals.yil + totals.ay / 12 + totals.gun / 365) : 0;
  const yilTutar = aylikBrutUcret * totals.yil;
  const ayTutar = (aylikBrutUcret / 12) * totals.ay;
  const gunTutar = (aylikBrutUcret / 365) * totals.gun;

  return (
    <div id="calc-table" style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827" }}>
      <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>Kıdem Tazminatı Hesap Özeti</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "12px", border: "1px solid #d1d5db" }}>
        <thead style={{ background: "#f3f4f6" }}>
          <tr>
            <th style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "left" }}>Alan</th>
            <th style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "left" }}>Değer</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>İşe Giriş</td><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{data?.iseGirisTarihi || "-"}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>İşten Çıkış</td><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{data?.istenCikisTarihi || "-"}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Çalışma Süresi</td><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{data?.calismaSuresi || "-"}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Çıplak Brüt</td><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{formatCurrency(data?.brutUcret)}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Prim</td><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{formatCurrency(data?.prim)}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>İkramiye</td><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{formatCurrency(data?.ikramiye)}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Yemek</td><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{formatCurrency(data?.yemek)}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px", fontWeight: 600 }}>Toplam Brüt</td><td style={{ border: "1px solid #d1d5db", padding: "8px", fontWeight: 600 }}>{formatCurrency(data?.toplamBrut)}</td></tr>
          <tr><td style={{ border: "1px solid #d1d5db", padding: "8px", color: "#15803d", fontWeight: 600 }}>Net Tazminat</td><td style={{ border: "1px solid #d1d5db", padding: "8px", color: "#15803d", fontWeight: 600 }}>{formatCurrency(data?.netTazminat)}</td></tr>
        </tbody>
      </table>
      {data.totals && (
        <div style={{ marginTop: "16px", marginBottom: "12px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Kıdem Tazminatı Hesaplama</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "12px", border: "1px solid #d1d5db" }}>
            <tbody>
              {totals.yil > 0 && <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{formatCurrency(aylikBrutUcret)} × {totals.yil} yıl</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(yilTutar)}</td></tr>}
              {totals.ay > 0 && <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{formatCurrency(aylikBrutUcret)} / 12 × {totals.ay} ay</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(ayTutar)}</td></tr>}
              {totals.gun > 0 && <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>{formatCurrency(aylikBrutUcret)} / 365 × {totals.gun} gün</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(gunTutar)}</td></tr>}
              <tr style={{ background: "#f3f4f6", fontWeight: 600 }}><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Toplam Brüt</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(data?.toplamBrut)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {data.toplamBrut && (data.damgaVergisi !== undefined || data.gelirVergisi !== undefined) && (
        <div style={{ marginTop: "16px", marginBottom: "12px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Brütten Nete Çeviri</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "12px", border: "1px solid #d1d5db" }}>
            <tbody>
              <tr style={{ background: "#f3f4f6", fontWeight: 600 }}><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Toplam Brüt Kıdem Tazminatı</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(data.toplamBrut)}</td></tr>
              {data.muafiyetTutari !== undefined && <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>24 Aylık Muafiyet Tutarı</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(data.muafiyetTutari)}</td></tr>}
              {data.gelirVergisi !== undefined && <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Gelir Vergisi {!data.gelirVergisiUygulanacak && "(Muafiyet Nedeniyle Uygulanmadı)"}</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(data.gelirVergisi)}</td></tr>}
              {data.damgaVergisi !== undefined && <tr><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Damga Vergisi (binde 7,59)</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(data.damgaVergisi)}</td></tr>}
              <tr style={{ background: "#f0fdf4", fontWeight: 600, color: "#15803d" }}><td style={{ border: "1px solid #d1d5db", padding: "8px" }}>Net Kıdem Tazminatı</td><td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>{formatCurrency(data.netTazminat)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const normalizeAmount = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const computeToplamBrutFromTotals = (totals: { toplam: number; yil: number; ay: number; gun: number }) => {
  const base = totals?.toplam || 0;
  const yil = totals?.yil || 0;
  const ay = totals?.ay || 0;
  const gun = totals?.gun || 0;
  return base * yil + (base / 12) * ay + (base / 365) * gun;
};

export const formatCalismaSuresi = (totals: { yil: number; ay: number; gun: number }) => {
  const yil = totals?.yil ?? 0;
  const ay = totals?.ay ?? 0;
  const gun = totals?.gun ?? 0;
  return `${yil} Yıl ${ay} Ay ${gun} Gün`;
};

type BuildArgs = {
  formValues?: Record<string, any>;
  calismaSuresi?: string;
  toplamBrut?: number;
  netTazminat?: number;
  totals?: { toplam: number; yil: number; ay: number; gun: number };
  damgaVergisi?: number;
  gelirVergisi?: number;
  muafiyetTutari?: number;
  gelirVergisiUygulanacak?: boolean;
};

export const buildKidemReportData = ({
  formValues = {},
  calismaSuresi,
  toplamBrut,
  netTazminat,
  totals,
  damgaVergisi,
  gelirVergisi,
  muafiyetTutari,
  gelirVergisiUygulanacak,
}: BuildArgs): KidemReportData => {
  const getField = (primary: string, fallback?: string) => formValues?.[primary] || (fallback ? formValues?.[fallback] : undefined);
  return {
    iseGirisTarihi: getField("iseGiris", "startDate") || "",
    istenCikisTarihi: getField("istenCikis", "endDate") || "",
    calismaSuresi,
    brutUcret: normalizeAmount(getField("brut", "brutUcret")),
    prim: normalizeAmount(getField("prim")),
    ikramiye: normalizeAmount(getField("ikramiye")),
    yemek: normalizeAmount(getField("yemek")),
    toplamBrut,
    netTazminat,
    totals,
    damgaVergisi,
    gelirVergisi,
    muafiyetTutari,
    gelirVergisiUygulanacak,
  };
};
