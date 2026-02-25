import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import KidemTazminatiForm from "./KidemTazminatiForm";
import EklentiModal from "./EklentiModal";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import { API_BASE_URL } from "@/utils/apiClient";

export default function KotuNiyetTazminatiPage() {
  const { success, error, info } = useToast();
  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const location = useLocation();
  const navState = (location.state as any) || {};
  // Eklenti modal durumu
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>("Eklenti Hesaplama");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({});
  const [applyFn, setApplyFn] = useState<(v: number) => void>(() => () => {});

  const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  // Geçici: İhbar formülü birebir kullanılıyor
  const base = totals.toplam || 0;
  const brutToplam = base * (totals.yil || 0) + (base / 12) * (totals.ay || 0) + (base / 365) * (totals.gun || 0);
  const damgaVergisi = brutToplam * 0.00759;
  const netTazminat = brutToplam - damgaVergisi;

  // İhbar haftaları kuralı (geçici olarak aynı)
  const weeks = (() => {
    const totalMonths = (totals.yil || 0) * 12 + (totals.ay || 0) + ((totals.gun || 0) > 0 ? 0.01 : 0);
    if (totalMonths < 6) return 2;
    if (totalMonths < 18) return 4;
    if (totalMonths < 36) return 6;
    return 8;
  })();
  const ihbarLikeAmount = (totals.toplam ? (totals.toplam / 30) * weeks * 7 * 3 : 0);
  const gelirVergisi = ihbarLikeAmount * 0.15;
  const damgaVergisiIhbar = ihbarLikeAmount * 0.00759;
  const netIhbarLike = ihbarLikeAmount - gelirVergisi - damgaVergisiIhbar;

  const initialBrutFromNav = useMemo(() => {
    try {
      if (navState?.brutUcret) return String(navState.brutUcret);
      const search = new URLSearchParams(location.search);
      const fromQuery = Number(search.get("toplamTutar") || "");
      const fromState = navState?.toplamTutar;
      const val = Number(isNaN(fromQuery) ? fromState : fromQuery);
      if (!val || !isFinite(val)) return undefined;
      return String(val.toFixed(2)).replace(".", ",");
    } catch { return undefined; }
  }, [location.search, location.state]);

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">KÖTÜ NİYET TAZMİNATI HESAPLAMA</h1>
          <ReportPreviewButton
            title="Kötü Niyet Tazminatı"
            copyTargetId="calc-table"
            buttonClassName="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition"
            renderContent={() => (
              <div>
                <div id="calc-table">
                  <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #999', fontSize:13, fontFamily:'Inter, Arial, sans-serif'} as React.CSSProperties}>
                    <thead style={{background:'#f3f4f6'}}>
                      <tr>
                        <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Alan</th>
                        <th style={{border:'1px solid #999', padding:'6px', textAlign:'right'}}>Değer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Hafta (kural)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>{weeks} hafta</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Brüt</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>{fmt(ihbarLikeAmount)}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Gelir Vergisi (%15)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>-{fmt(gelirVergisi)}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Damga Vergisi (binde 7,59)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>-{fmt(damgaVergisiIhbar)}</td></tr>
                    </tbody>
                    <tfoot style={{background:'#f9fafb'}}>
                      <tr>
                        <td style={{border:'1px solid #999', textAlign:'right', fontWeight:600, padding:'6px'}}>Net</td>
                        <td style={{border:'1px solid #999', fontWeight:600, padding:'6px', textAlign:'right'}}>{fmt(netIhbarLike)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <div id="kotu-niyet-print" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <KidemTazminatiForm
            onTotalsChange={setTotals}
            onRequestEklenti={(fieldKey, title, apply) => {
              setActiveField(fieldKey);
              setModalTitle(title || "Eklenti Hesaplama");
              setApplyFn(() => (v: number) => { apply(v); });
              setModalOpen(true);
            }}
            showIhbarShortcut={false}
            initialBrut={initialBrutFromNav}
            initialIseGiris={navState?.iseGiris}
            initialIstenCikis={navState?.istenCikis}
            initialPrim={navState?.prim}
            initialIkramiye={navState?.ikramiye}
            initialYol={navState?.yol}
            initialYemek={navState?.yemek}
          />

          

          {/* Kötü Niyet Tazminatı (geçici) */}
          <div className="mt-4 p-4 rounded-lg bg-white border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-2">Kötü Niyet Tazminatı</h3>
            <div className="text-sm sm:text-base space-y-1">
              <p className="flex items-center justify-between"><span>Hafta (geçici kural):</span> <span className="font-medium">{weeks} hafta</span></p>
              <p className="flex items-center justify-between"><span>Hesap:</span> <span className="font-medium">({fmt(totals.toplam || 0)} / 30 × {weeks} × 7 × 3)</span></p>
              <hr className="my-2" />
              <p className="flex items-center justify-between"><span>Brüt:</span> <span className="font-semibold text-gray-900">{fmt(ihbarLikeAmount)}</span></p>
              <p className="flex items-center justify-between"><span>Gelir Vergisi (%15):</span> <span className="font-medium text-red-600">-{fmt(gelirVergisi)}</span></p>
              <p className="flex items-center justify-between"><span>Damga Vergisi (Binde 7,59):</span> <span className="font-medium text-red-600">-{fmt(damgaVergisiIhbar)}</span></p>
              <hr className="my-2" />
              <p className="flex items-center justify-between"><span>Net:</span> <span className="font-semibold text-green-700">{fmt(netIhbarLike)}</span></p>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                try {
                  const style = document.createElement("style");
                  style.setAttribute("media", "print");
                  style.innerHTML = `@media print { body * { visibility: hidden !important; } #kotu-niyet-print, #kotu-niyet-print * { visibility: visible !important; } #kotu-niyet-print { position: absolute; left:0; top:0; width:100%; padding:0 12mm; } }`;
                  document.head.appendChild(style);
                  window.print();
                  setTimeout(() => { try { document.head.removeChild(style); } catch {} }, 1000);
                } catch {}
              }}
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
                  const payload = {
                    tenant_id: tenantId,
                    type: "Kötü Niyet Tazminatı",
                    brut_total: Number(ihbarLikeAmount.toFixed(2)),
                    net_total: Number(netIhbarLike.toFixed(2)),
                  };
                  const res = await fetch(`${API_BASE_URL}/api/saved-cases`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!res.ok) throw new Error("save_failed");
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

        {/* Sağ: Not */}
        <div>
          <div className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
              </div>
            </div>
            <div className="p-4 text-sm leading-6 notes-content">
              <div className="space-y-2 text-slate-600 dark:text-slate-300">
                <p>1- Kötü niyet tazminatından iş güvencesinden yararlanamayan işçiler yararlanabilir.</p>
                <p>2- İhbar önelinin 3 katı tutarında hesaplama yapılır.</p>
                <p>3- Borçlar Kanunu 434'üncü maddesinde düzenlenmiştir. İş Kanunu'nda yoktur, ancak Borçlar Kanununa tabi veya İş Kanunu'na tabi olsa dahi iş güvencesi kapsamı dışındaki çalışanlar için geçerlidir.</p>
                <p>4- Hizmet sözleşmesinin fesih hakkının kötüye kullanılarak sona erdirildiği durumlarda işveren, işçiye fesih bildirim süresine ait ücretin 3 katı tutarında tazminat ödemekle yükümlüdür. Sözleşmenin belirsiz süreli olması gerekir.</p>
                <p>5- İşverence yapılan feshin hangi andan itibaren kötü niyetli olduğu ölçütü Yargıtay kararlarında belirlenmiştir. Nitekim Yargıtay objektif iyi niyet kurallarına aykırılık ölçütüne başvurmaktadır. Tutar: İşçinin (giydirilmiş) ücreti esas alınır (gelir ve damga vergisi kesilir), süre olarak ihbar süresinin 3 katıdır.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <EklentiModal
        open={modalOpen}
        title={modalTitle}
        months={activeField ? eklentiValues[activeField] : undefined}
        onClose={() => setModalOpen(false)}
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
