import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import KidemTazminatiForm from "./KidemTazminatiForm";
import ToplamHesaplama from "./ToplamHesaplama";
import NoteCard from "./NoteCard";
import EklentiModal from "./EklentiModal";
import { API_BASE_URL } from "@/utils/apiClient";


export default function KidemTazminatiPage() {
  const { success, error, info } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [appliedEklenti, setAppliedEklenti] = useState<number | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>("Eklenti Hesaplama");
  const modalApplyRef = useState<(v: number) => void>(() => () => {})[0];
  const [applyFn, setApplyFn] = useState<(v: number) => void>(() => () => {});
  const [exitDate, setExitDate] = useState<string>("");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({
    prim: Array(12).fill(""),
    ikramiye: Array(12).fill(""),
    yol: Array(12).fill(""),
    yemek: Array(12).fill(""),
  });
  const [formValues, setFormValues] = useState<any>(null);

  // Kıdem Tazminatı Tavanları
  const tavanUcretleri = [
    { donem: "01 Temmuz 2025 - 31 Aralık 2025", tutar: 53919.68, start: new Date("2025-07-01"), end: new Date("2025-12-31") },
    { donem: "01 Ocak 2025 - 30 Haziran 2025", tutar: 40635.43, start: new Date("2025-01-01"), end: new Date("2025-06-30") },
    { donem: "01 Temmuz 2024 - 31 Aralık 2024", tutar: 41682.42, start: new Date("2024-07-01"), end: new Date("2024-12-31") },
    { donem: "01 Ocak 2024 - 30 Haziran 2024", tutar: 35089.85, start: new Date("2024-01-01"), end: new Date("2024-06-30") },
    { donem: "01 Temmuz 2023 - 31 Aralık 2023", tutar: 23489.83, start: new Date("2023-07-01"), end: new Date("2023-12-31") },
    { donem: "01 Ocak 2023 - 30 Haziran 2023", tutar: 19982.83, start: new Date("2023-01-01"), end: new Date("2023-06-30") },
    { donem: "01 Temmuz 2022 - 31 Aralık 2022", tutar: 15317.40, start: new Date("2022-07-01"), end: new Date("2022-12-31") },
    { donem: "01 Ocak 2022 - 30 Haziran 2022", tutar: 10849.75, start: new Date("2022-01-01"), end: new Date("2022-06-30") },
    { donem: "01 Temmuz 2021 - 31 Aralık 2021", tutar: 8284.91, start: new Date("2021-07-01"), end: new Date("2021-12-31") },
    { donem: "01 Ocak 2021 - 30 Haziran 2021", tutar: 7389.06, start: new Date("2021-01-01"), end: new Date("2021-06-30") },
    { donem: "01 Temmuz 2020 - 31 Aralık 2020", tutar: 7117.17, start: new Date("2020-07-01"), end: new Date("2020-12-31") },
    { donem: "01 Ocak 2020 - 30 Haziran 2020", tutar: 6730.15, start: new Date("2020-01-01"), end: new Date("2020-06-30") },
    { donem: "01 Temmuz 2019 - 31 Aralık 2019", tutar: 6379.86, start: new Date("2019-07-01"), end: new Date("2019-12-31") },
    { donem: "01 Ocak 2019 - 30 Haziran 2019", tutar: 6017.60, start: new Date("2019-01-01"), end: new Date("2019-06-30") },
    { donem: "01 Temmuz 2018 - 31 Aralık 2018", tutar: 5434.42, start: new Date("2018-07-01"), end: new Date("2018-12-31") },
    { donem: "01 Ocak 2018 - 30 Haziran 2018", tutar: 5001.76, start: new Date("2018-01-01"), end: new Date("2018-06-30") },
    { donem: "01 Temmuz 2017 - 31 Aralık 2017", tutar: 4732.48, start: new Date("2017-07-01"), end: new Date("2017-12-31") },
    { donem: "01 Ocak 2017 - 30 Haziran 2017", tutar: 4246.10, start: new Date("2017-01-01"), end: new Date("2017-06-30") },
    { donem: "01 Temmuz 2016 - 31 Aralık 2016", tutar: 4297.21, start: new Date("2016-07-01"), end: new Date("2016-12-31") },
    { donem: "01 Ocak 2016 - 30 Haziran 2016", tutar: 4092.53, start: new Date("2016-01-01"), end: new Date("2016-06-30") },
    { donem: "01 Temmuz 2015 - 31 Aralık 2015", tutar: 3828.37, start: new Date("2015-07-01"), end: new Date("2015-12-31") },
    { donem: "01 Ocak 2015 - 30 Haziran 2015", tutar: 3541.37, start: new Date("2015-01-01"), end: new Date("2015-06-30") },
    { donem: "01 Temmuz 2014 - 31 Aralık 2014", tutar: 3482.22, start: new Date("2014-07-01"), end: new Date("2014-12-31") },
    { donem: "01 Ocak 2014 - 30 Haziran 2014", tutar: 3254.44, start: new Date("2014-01-01"), end: new Date("2014-06-30") },
    { donem: "01 Temmuz 2013 - 31 Aralık 2013", tutar: 3129.25, start: new Date("2013-07-01"), end: new Date("2013-12-31") },
    { donem: "01 Ocak 2013 - 30 Haziran 2013", tutar: 3039.58, start: new Date("2013-01-01"), end: new Date("2013-06-30") },
    { donem: "01 Temmuz 2012 - 31 Aralık 2012", tutar: 2917.27, start: new Date("2012-07-01"), end: new Date("2012-12-31") },
    { donem: "01 Ocak 2012 - 30 Haziran 2012", tutar: 2623.23, start: new Date("2012-01-01"), end: new Date("2012-06-30") },
    { donem: "01 Temmuz 2011 - 31 Aralık 2011", tutar: 2517.01, start: new Date("2011-07-01"), end: new Date("2011-12-31") },
    { donem: "01 Ocak 2011 - 30 Haziran 2011", tutar: 2427.04, start: new Date("2011-01-01"), end: new Date("2011-06-30") },
    { donem: "01 Temmuz 2010 - 31 Aralık 2010", tutar: 2361.15, start: new Date("2010-07-01"), end: new Date("2010-12-31") },
    { donem: "01 Ocak 2010 - 30 Haziran 2010", tutar: 2260.05, start: new Date("2010-01-01"), end: new Date("2010-06-30") },
    { donem: "01 Temmuz 2009 - 31 Aralık 2009", tutar: 2173.18, start: new Date("2009-07-01"), end: new Date("2009-12-31") },
    { donem: "01 Ocak 2009 - 30 Haziran 2009", tutar: 2087.92, start: new Date("2009-01-01"), end: new Date("2009-06-30") },
    { donem: "01 Temmuz 2008 - 31 Aralık 2008", tutar: 2100.19, start: new Date("2008-07-01"), end: new Date("2008-12-31") },
    { donem: "01 Ocak 2008 - 30 Haziran 2008", tutar: 1960.69, start: new Date("2008-01-01"), end: new Date("2008-06-30") },
    { donem: "01 Temmuz 2007 - 31 Aralık 2007", tutar: 1857.44, start: new Date("2007-07-01"), end: new Date("2007-12-31") },
    { donem: "01 Ocak 2007 - 30 Haziran 2007", tutar: 1770.63, start: new Date("2007-01-01"), end: new Date("2007-06-30") },
    { donem: "01 Temmuz 2006 - 31 Aralık 2006", tutar: 1723.17, start: new Date("2006-07-01"), end: new Date("2006-12-31") },
    { donem: "01 Ocak 2006 - 30 Haziran 2006", tutar: 1648.90, start: new Date("2006-01-01"), end: new Date("2006-06-30") },
    { donem: "01 Temmuz 2005 - 31 Aralık 2005", tutar: 1574.74, start: new Date("2005-07-01"), end: new Date("2005-12-31") },
    { donem: "01 Ocak 2005 - 30 Haziran 2005", tutar: 1485.43, start: new Date("2005-01-01"), end: new Date("2005-06-30") },
  ];

  const tr = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
  const matchedTavan = (() => {
    if (!exitDate) return null;
    const d = new Date(exitDate);
    if (Number.isNaN(Number(d))) return null;
    return tavanUcretleri.find((x) => d >= x.start && d <= x.end) || null;
  })();

  const cappedToplam = matchedTavan && totals.toplam > matchedTavan.tutar ? matchedTavan.tutar : totals.toplam;

  const handlePrint = () => {
    try {
      const style = document.createElement("style");
      style.setAttribute("media", "print");
      style.innerHTML = `
        @media print {
          body * { visibility: hidden !important; }
          #kidem-print, #kidem-print * { visibility: visible !important; }
          #kidem-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; }
          /* Tek kolona düşür */
          #kidem-print .grid { display: block !important; }
          #kidem-print .lg\\:grid-cols-2 > * { width: 100% !important; }
          /* Butonları gizle */
          #kidem-print button { display: none !important; }
        }
      `;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => { try { document.head.removeChild(style); } catch {} }, 1000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center">KIDEM TAZMİNATI HESAPLAMA</h1>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {[
            { to: "/is-tazminati/kidem/30-isciden-fazla", label: "İş Kanununa Göre" },
            { to: "/is-tazminati/kidem/borclar-kanunu", label: "Borçlar Kanunu İşçi Alacağı" },
            { to: "/is-tazminati/kidem/gemi-adam", label: "Gemi Adamları" },
            { to: "/is-tazminati/kidem/mevsimlik-isci", label: "Mevsimlik İşçi" },
            { to: "/is-tazminati/kidem/basin-is", label: "Basın İş" },
            { to: "/is-tazminati/kidem/kismi-sureli", label: "Kısmi Süreli / Part Time" },
            { to: "/is-tazminati/kidem/belirli-sureli", label: "Belirli Süreli İş Sözleşmesi" },
          ].map((l) => (
            <NavLink key={l.to} to={l.to} className={({isActive}) => `px-3 py-1.5 rounded-full text-sm border transition-colors ${isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div id="kidem-print" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {matchedTavan && totals.toplam > matchedTavan.tutar && (
            <div className="mb-3 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              ⚠️ Toplam brüt tutar, {matchedTavan.donem} dönemi için geçerli kıdem tazminatı tavanı olan {tr.format(matchedTavan.tutar)}’yi aştığı için bu tutar esas alınmıştır.
            </div>
          )}
          <KidemTazminatiForm
            onTotalsChange={setTotals}
            appliedEklenti={appliedEklenti}
            onRequestEklenti={(fieldKey, title, apply) => {
              setModalTitle(title);
              setApplyFn(() => apply);
              setActiveField(fieldKey);
              if (!eklentiValues[fieldKey]) {
                setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
              }
              setModalOpen(true);
            }}
            onExitDateChange={setExitDate}
            onValuesChange={setFormValues}
          />
          <ToplamHesaplama toplam={cappedToplam} yil={totals.yil} ay={totals.ay} gun={totals.gun} />

          {/* Brüt'ten Net'e Çeviri - Her zaman gerçek toplam ücreti kullan (tavan değil) */}
          {(() => {
            // Gerçek toplam ücreti kullan, tavan uygulanmamış hali
            const base = Number(totals.toplam || 0);
            const brutToplam = base * (totals.yil || 0) + (base / 12) * (totals.ay || 0) + (base / 365) * (totals.gun || 0);
            const damgaVergisi = brutToplam * 0.00759;
            const netTazminat = brutToplam - damgaVergisi;
            const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
            return (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="font-semibold text-gray-700 mb-2">Brüt'ten Net'e Çeviri</h3>
                <p className="text-xs text-gray-500 mb-2">(Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi yapılmıştır.)</p>
                <div className="space-y-1 text-sm sm:text-base">
                  <p className="flex items-center justify-between"><span>Brüt Kıdem Tazminatı:</span> <span className="font-medium">{fmt(brutToplam)} ₺</span></p>
                  <p className="flex items-center justify-between"><span>Damga Vergisi (Binde 7,59):</span> <span className="font-medium text-red-600">-{fmt(damgaVergisi)} ₺</span></p>
                  <hr className="my-2" />
                  <p className="flex items-center justify-between"><span>Net Kıdem Tazminatı:</span> <span className="font-semibold text-green-700">{fmt(netTazminat)} ₺</span></p>
                </div>
              </div>
            );
          })()}
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={handlePrint}
              className="bg-gray-600 text-white rounded-md px-4 py-2 hover:bg-gray-700 transition"
            >
              🖨️ Yazdır
            </button>
            <button
              title="Hesaplamayı kaydet"
              className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition"
              onClick={async () => {
                try {
                  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
                  const eklentiler: Record<string, number> = {};
                  if (formValues) {
                    const num = (s: string) => Number(String(s ?? "").replace(/\./g, "").replace(",", ".")) || 0;
                    if (formValues.prim) eklentiler.prim = num(formValues.prim);
                    if (formValues.ikramiye) eklentiler.ikramiye = num(formValues.ikramiye);
                    if (formValues.yol) eklentiler.yol = num(formValues.yol);
                    if (formValues.yemek) eklentiler.yemek = num(formValues.yemek);
                    (formValues.extras || []).forEach((it: any) => {
                      if (it?.label) eklentiler[it.label] = num(it.value);
                    });
                  }
                  // Compute brut and net based on final total (year/month/day)
                  const base = Number(cappedToplam || 0);
                  const brut_toplam = base * (totals.yil || 0) + (base / 12) * (totals.ay || 0) + (base / 365) * (totals.gun || 0);
                  const net_toplam = brut_toplam - brut_toplam * 0.00759;
                  const payload = {
                    tenant_id: tenantId,
                    hesaplama_tipi: "Kıdem Tazminatı",
                    ise_giris: formValues?.iseGiris || null,
                    isten_cikis: formValues?.istenCikis || null,
                    toplam: Number(cappedToplam || 0),
                    tavan: matchedTavan?.tutar ?? null,
                    aciklama: matchedTavan && totals.toplam > matchedTavan.tutar ? `Tavan aşıldı, sınır ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(matchedTavan.tutar)} olarak alındı` : "",
                    eklentiler,
                    brut_toplam: Number(brut_toplam.toFixed(2)),
                    net_toplam: Number(net_toplam.toFixed(2)),
                    detay: {
                      form: formValues || null,
                      totals,
                      eklentiValues,
                      matchedTavan: matchedTavan ? { donem: matchedTavan.donem, tutar: matchedTavan.tutar } : null,
                      computed: { brut_toplam: Number(brut_toplam.toFixed(2)), net_toplam: Number(net_toplam.toFixed(2)) }
                    }
                  };
                  const res = await fetch(`${API_BASE_URL}/api/saved-cases`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) },
                    body: JSON.stringify(payload),
                  });
                  if (!res.ok) {
                    const msg = await res.text().catch(()=>"");
                    throw new Error(msg || "save_failed");
                  }
                  success("Hesaplama başarıyla kaydedildi.");
                } catch (e) {
                  error("Hesaplama kaydedilirken bir hata oluştu.");
                }
              }}
            >
              💾 Kaydet
            </button>
          </div>
        </div>
        <div>
          <NoteCard />
        </div>
      </div>

      <EklentiModal
        open={modalOpen}
        title={modalTitle}
        onClose={() => setModalOpen(false)}
        months={activeField ? eklentiValues[activeField] : undefined}
        onMonthsChange={(i, val) => {
          if (!activeField) return;
          setEklentiValues((prev) => {
            const arr = (prev[activeField] ?? Array(12).fill(""));
            const next = arr.slice();
            next[i] = val;
            return { ...prev, [activeField]: next };
          });
        }}
        onApply={(v) => { applyFn(v); setModalOpen(false); info("Eklenti hesaplandı", "Seçili kaleme uygulandı"); }}
      />
    </div>
  );
}
