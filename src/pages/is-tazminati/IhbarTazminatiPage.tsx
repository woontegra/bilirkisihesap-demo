import { useMemo, useState } from "react";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import Layout from "@/components/Layout";
import { useLocation, NavLink } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import KidemTazminatiForm from "./KidemTazminatiForm";
import ToplamHesaplama from "./ToplamHesaplama";
import NoteCard from "./NoteCard";
import EklentiModal from "./EklentiModal";
import { IHBAR_TABS } from "@/config/tabsConfig";
import { API_BASE_URL } from "@/utils/apiClient";

export default function IhbarTazminatiPage() {
  const { success, error, info } = useToast();
  const [ihbarTotals, setIhbarTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [ihbarAppliedEklenti, setIhbarAppliedEklenti] = useState<number | undefined>(undefined);
  const [ihbarModalOpen, setIhbarModalOpen] = useState(false);
  const [ihbarModalTitle, setIhbarModalTitle] = useState<string>("Eklenti Hesaplama");
  const [ihbarApplyFn, setIhbarApplyFn] = useState<(v: number) => void>(() => () => {});
  const [ihbarExitDate, setIhbarExitDate] = useState<string>("");
  const [ihbarActiveField, setIhbarActiveField] = useState<string | null>(null);
  const [ihbarEklentiValues, setIhbarEklentiValues] = useState<Record<string, string[]>>({});
  const [ihbarFormValues, setIhbarFormValues] = useState<any>(null);

  const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const handlePrint = () => {
    try {
      const style = document.createElement("style");
      style.setAttribute("media", "print");
      style.innerHTML = `
        @media print {
          body * { visibility: hidden !important; }
          #ihbar-print, #ihbar-print * { visibility: visible !important; }
          #ihbar-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; }
          #ihbar-print .grid { display: block !important; }
          #ihbar-print .lg\\:grid-cols-2 > * { width: 100% !important; }
          #ihbar-print button { display: none !important; }
        }
      `;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => { try { document.head.removeChild(style); } catch {} }, 1000);
    } catch {}
  };

  const base = ihbarTotals.toplam || 0;
  const brutToplam = base * (ihbarTotals.yil || 0) + (base / 12) * (ihbarTotals.ay || 0) + (base / 365) * (ihbarTotals.gun || 0);
  const damgaVergisi = brutToplam * 0.00759;
  const netTazminat = brutToplam - damgaVergisi;

  // İhbar süresi (hafta) ve tutar hesaplama
  const ihbarWeeks = (() => {
    const totalMonths = (ihbarTotals.yil || 0) * 12 + (ihbarTotals.ay || 0) + ((ihbarTotals.gun || 0) > 0 ? 0.01 : 0);
    if (totalMonths < 6) return 2;
    if (totalMonths < 18) return 4; // 6 ay – 1,5 yıl
    if (totalMonths < 36) return 6; // 1,5 – 3 yıl
    return 8; // 3 yıldan fazla
  })();
  const ihbarAmount = (ihbarTotals.toplam ? (ihbarTotals.toplam / 30) * ihbarWeeks * 7 : 0);
  const gelirVergisi = ihbarAmount * 0.15;
  const damgaVergisiIhbar = ihbarAmount * 0.00759;
  const netIhbar = ihbarAmount - gelirVergisi - damgaVergisiIhbar;

  const [ihbarActiveTab, setIhbarActiveTab] = useState<string>(IHBAR_TABS[0]?.key || "IhbarTab_OtuzIsci");
  const location = useLocation();
  const navState = (location.state as any) || {};
  const initialBrutFromNav = useMemo(() => {
    try {
      // Prefer explicitly sent brutUcret if present; else derive from toplamTutar
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
    <Layout
      title="İHBAR TAZMİNATI HESAPLAMA"
      rightSlot={
        <ReportPreviewButton
          title="İhbar Tazminatı"
          copyTargetId="calc-table"
          buttonClassName="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition"
          renderContent={() => (
            <div>
              <div id="calc-table">
                <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #999', fontSize:13, fontFamily:'Inter, Arial, sans-serif'} as React.CSSProperties}>
                  <thead style={{background:'#f3f4f6'}}>
                    <tr>
                      <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Alan</th>
                      <th style={{border:'1px solid #999', padding:'6px', textAlign:'left'}}>Değer</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Çalışma Süresi</td><td style={{border:'1px solid #ccc', padding:'6px'}}>{ihbarTotals.yil} yıl {ihbarTotals.ay} ay {ihbarTotals.gun} gün</td></tr>
                    <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>İhbar Süresi</td><td style={{border:'1px solid #ccc', padding:'6px'}}>{ihbarWeeks} hafta</td></tr>
                    <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Aylık Toplam</td><td style={{border:'1px solid #ccc', padding:'6px'}}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(ihbarTotals.toplam)}</td></tr>
                    <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Brüt İhbar</td><td style={{border:'1px solid #ccc', padding:'6px'}}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(ihbarAmount)}</td></tr>
                    <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Gelir Vergisi (%15)</td><td style={{border:'1px solid #ccc', padding:'6px'}}>-{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(gelirVergisi)}</td></tr>
                    <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Damga Vergisi (binde 7,59)</td><td style={{border:'1px solid #ccc', padding:'6px'}}>-{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(damgaVergisiIhbar)}</td></tr>
                  </tbody>
                  <tfoot style={{background:'#f9fafb'}}>
                    <tr>
                      <td style={{border:'1px solid #999', textAlign:'right', fontWeight:600, padding:'6px'}}>Net İhbar Tazminatı</td>
                      <td style={{border:'1px solid #999', fontWeight:600, padding:'6px', textAlign:'right'}}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(netIhbar)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        />
      }
    >
      <div className="mb-6">
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {[
            { to: "/is-tazminati/ihbar/30-isciden-fazla", label: "İş Kanununa Göre" },
            { to: "/is-tazminati/ihbar/borclar-kanunu", label: "Borçlar Kanunu İşçi Alacağı" },
            { to: "/is-tazminati/ihbar/gemi-adam", label: "Gemi Adamları" },
            { to: "/is-tazminati/ihbar/mevsimlik-isci", label: "Mevsimlik İşçi" },
            { to: "/is-tazminati/ihbar/basin-is", label: "Basın İş" },
            { to: "/is-tazminati/ihbar/kismi-sureli", label: "Kısmi Süreli / Part Time" },
            { to: "/is-tazminati/ihbar/belirli-sureli", label: "Belirli Süreli İş Sözleşmesi" },
          ].map((l) => (
            <NavLink key={l.to} to={l.to} className={({isActive}) => `px-3 py-1.5 rounded-full text-sm border transition-colors ${isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div id="ihbar-print" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <KidemTazminatiForm
            onTotalsChange={setIhbarTotals}
            appliedEklenti={ihbarAppliedEklenti}
            initialBrut={initialBrutFromNav}
            showIhbarShortcut={false}
            initialIseGiris={navState?.iseGiris}
            initialIstenCikis={navState?.istenCikis}
            initialPrim={navState?.prim}
            initialIkramiye={navState?.ikramiye}
            initialYol={navState?.yol}
            initialYemek={navState?.yemek}
            onRequestEklenti={(fieldKey, title, apply) => {
              setIhbarActiveField(fieldKey);
              setIhbarModalTitle(title || "Eklenti Hesaplama");
              setIhbarApplyFn(() => (v: number) => {
                setIhbarAppliedEklenti(v);
                apply(v);
              });
              setIhbarModalOpen(true);
            }}
            onExitDateChange={setIhbarExitDate}
            onValuesChange={setIhbarFormValues}
          />

          {/* İhbar Tazminatı hesap kartı */}
          <div className="mt-4 p-4 rounded-lg bg-white border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-2">İhbar Tazminatı</h3>
            <div className="text-sm sm:text-base space-y-1">
              <p className="flex items-center justify-between"><span>İhbar Süresi:</span> <span className="font-medium">{ihbarWeeks} hafta</span></p>
              <p className="flex items-center justify-between"><span>Günlük Ücret (Toplam/30):</span> <span className="font-medium">({fmt(ihbarTotals.toplam || 0)} ₺ / 30 × {ihbarWeeks} × 7)</span></p>
              <hr className="my-2" />
              <p className="flex items-center justify-between"><span>Tutar:</span> <span className="font-semibold text-gray-900">{fmt(ihbarAmount)} ₺</span></p>
              <p className="text-xs text-gray-500 mt-2">İş Kanunu madde 17’ye göre hesaplanan ihbar süresi esas alınmıştır.</p>
            </div>
          </div>

          {/* Brüt -> Net kutusu (İhbar) */}
          {(() => {
            return (
              <div className="mt-4 p-4 rounded-lg bg-white border border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-2">Brüt’ten Net’e Çeviri</h3>
                <div className="space-y-1 text-sm sm:text-base">
                  <p className="flex items-center justify-between"><span>Brüt İhbar Tazminatı:</span> <span className="font-medium">{fmt(ihbarAmount)} ₺</span></p>
                  <p className="flex items-center justify-between"><span>Gelir Vergisi (%15):</span> <span className="font-medium text-red-600">-{fmt(gelirVergisi)}</span></p>
                  <p className="flex items-center justify-between"><span>Damga Vergisi (Binde 7,59):</span> <span className="font-medium text-red-600">-{fmt(damgaVergisiIhbar)}</span></p>
                  <hr className="my-2" />
                  <p className="flex items-center justify-between"><span>Net İhbar Tazminatı:</span> <span className="font-semibold text-green-700">{fmt(netIhbar)}</span></p>
                </div>
              </div>
            );
          })()}

          <div className="mt-2 flex justify-end gap-2">
            <button onClick={handlePrint} className="bg-gray-600 text-white rounded-md px-4 py-2 hover:bg-gray-700 transition">🖨️ Yazdır</button>
            <button
              title="Hesaplamayı kaydet"
              className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition"
              onClick={async () => {
                try {
                  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
                  const payload = {
                    tenant_id: tenantId,
                    type: "İhbar Tazminatı",
                    brut_total: Number(ihbarAmount.toFixed(2)),
                    net_total: Number(netIhbar.toFixed(2)),
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
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Not: İhbar Tazminatı</div>
              <div className="space-y-2 text-slate-600 dark:text-slate-300">
                <p>Madde 17 - Belirsiz süreli iş sözleşmelerinin feshinden önce durumun diğer tarafa bildirilmesi gerekir.</p>
                <p>İş sözleşmeleri;</p>
                <p className="pl-4">a) İşi altı aydan az sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak iki hafta sonra,</p>
                <p className="pl-4">b) İşi altı aydan birbuçuk yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak dört hafta sonra,</p>
                <p className="pl-4">c) İşi birbuçuk yıldan üç yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak altı hafta sonra,</p>
                <p className="pl-4">d) İşi üç yıldan fazla sürmüş işçi için, bildirim yapılmasından başlayarak sekiz hafta sonra,</p>
                <p className="pl-4">feshedilmiş sayılır.</p>
                <p>Bu süreler asgari olup sözleşmeler ile artırılabilir.</p>
                <p>Bildirim şartına uymayan taraf, bildirim süresine ilişkin ücret tutarında tazminat ödemek zorundadır.</p>
                <p>İşveren bildirim süresine ait ücreti peşin vermek suretiyle iş sözleşmesini feshedebilir.</p>
                <p>İşverenin bildirim şartına uymaması veya bildirim süresine ait ücreti peşin ödeyerek sözleşmeyi feshetmesi, bu Kanunun 18, 19, 20 ve 21 inci maddesi hükümlerinin uygulanmasına engel olmaz. 18 inci maddenin birinci fıkrası uyarınca bu Kanunun 18, 19, 20 ve 21 inci maddelerinin uygulanma alanı dışında kalan işçilerin iş sözleşmesinin, fesih hakkının kötüye kullanılarak sona erdirildiği durumlarda işçiye bildirim süresinin üç katı tutarında tazminat ödenir. Fesih için bildirim şartına da uyulmaması ayrıca dördüncü fıkra uyarınca tazminat ödenmesini gerektirir.</p>
                <p>Bu maddeye göre ödenecek tazminatlar ile bildirim sürelerine ait peşin ödenecek ücretin hesabında 32 nci maddenin birinci fıkrasında yazılan ücrete ek olarak işçiye sağlanmış para veya para ile ölçülmesi mümkün sözleşme ve Kanundan doğan menfaatler de göz önünde tutulur.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EklentiModal
        open={ihbarModalOpen}
        title={ihbarModalTitle}
        months={ihbarActiveField ? ihbarEklentiValues[ihbarActiveField] : undefined}
        onMonthsChange={(i, val) => {
          if (!ihbarActiveField) return;
          setIhbarEklentiValues((prev) => {
            const arr = (prev[ihbarActiveField] ?? Array(12).fill(""));
            const next = arr.slice();
            next[i] = val;
            return { ...prev, [ihbarActiveField]: next };
          });
        }}
        onApply={(v) => { ihbarApplyFn(v); setIhbarModalOpen(false); info("Eklenti hesaplandı", "Seçili kaleme uygulandı"); }}
      />
    </Layout>
  );
}
