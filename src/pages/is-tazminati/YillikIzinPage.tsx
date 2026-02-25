import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import ReportPreviewButton from "@/components/ReportPreviewButton";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { API_BASE_URL } from "@/utils/apiClient";

type UsedRow = { id: string; start: string; end: string; days: string };

const toDays = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

export default function YillikIzinPage() {
  // Dates and duration
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => Array.from({ length: 7 }, () => ({ id: Math.random().toString(36).slice(2), start: "", end: "", days: "" })));
  const [employerPayment, setEmployerPayment] = useState("");

  const addRow = () => setRows((prev) => [...prev, { id: Math.random().toString(36).slice(2), start: "", end: "", days: "" }]);
  const setRow = (id: string, patch: Partial<UsedRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  // Annual leave entitlement by years of service
  const breakdown = useMemo(() => {
    const y = Math.max(0, diff.yil || 0);
    const y1 = Math.min(5, y);             // first 5 years inclusive
    const y2 = Math.min(Math.max(y - 5, 0), 9); // years 6-14
    const y3 = Math.max(y - 14, 0);        // 15+
    const d1 = y1 * 14;
    const d2 = y2 * 20;
    const d3 = y3 * 26;
    const total = d1 + d2 + d3;
    return { y1, y2, y3, d1, d2, d3, total };
  }, [diff.yil]);

  const usedTotal = useMemo(() => rows.reduce((acc, r) => acc + toDays(r.days), 0), [rows]);
  const remainingDays = Math.max(0, breakdown.total - usedTotal);

  const brutIzin = useMemo(() => {
    const brut = toDays(brutUcret);
    return (brut / 30) * remainingDays;
  }, [brutUcret, remainingDays]);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const sgk = round2(brutIzin * 0.14);
  const issizlik = round2(brutIzin * 0.01);
  const gelirVergisi = round2(Math.max(0, (brutIzin - sgk - issizlik) * 0.15));
  const damgaVergisi = round2(brutIzin * 0.00759);
  const netIzin = round2(Math.max(0, brutIzin - sgk - issizlik - gelirVergisi - damgaVergisi));

  const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const handlePrint = () => {
    try {
      const style = document.createElement("style");
      style.setAttribute("media", "print");
      style.innerHTML = `@media print { body * { visibility: hidden !important; } #yillik-izin-print, #yillik-izin-print * { visibility: visible !important; } #yillik-izin-print { position: absolute; left:0; top:0; width:100%; padding:0 12mm; } #yillik-izin-print .grid { display:block !important; } #yillik-izin-print .lg\\:grid-cols-2 > * { width:100% !important; } #yillik-izin-print button { display:none !important; } }`;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => { try { document.head.removeChild(style); } catch {} }, 1000);
    } catch {}
  };

  const saving = useRef(false);
  const handleSave = async () => {
    if (saving.current) return; saving.current = true;
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const payload = {
        hesaplama_tipi: "Yıllık Ücretli İzin",
        brut_toplam: Number(brutIzin.toFixed(2)),
        net_toplam: Number(netIzin.toFixed(2)),
        ise_giris: iseGiris || null,
        isten_cikis: istenCikis || null,
        eklentiler: { employer_payment: employerPayment }
      };
      await fetch(`${API_BASE_URL}/api/saved-cases`, { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) }, body: JSON.stringify(payload) });
      alert("Hesaplama kaydedildi.");
    } catch { alert("Kayıt sırasında hata oluştu."); }
    finally { saving.current = false; }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">YILLIK ÜCRETLİ İZİN HESAPLAMA</h1>
          <ReportPreviewButton
            title="Yıllık Ücretli İzin"
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
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Çalışma Süresi</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>{diff.label}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Toplam İzin Hakkı (gün)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>{breakdown.total}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Kalan İzin Hakkı (gün)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>{remainingDays}</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Brüt İzin Ücreti</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>{fmt(brutIzin)} ₺</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>SGK Primi (%14)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>-{fmt(sgk)} ₺</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>İşsizlik Primi (%1)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>-{fmt(issizlik)} ₺</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Gelir Vergisi (%15)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>-{fmt(gelirVergisi)} ₺</td></tr>
                      <tr><td style={{border:'1px solid #ccc', padding:'6px'}}>Damga Vergisi (binde 7,59)</td><td style={{border:'1px solid #ccc', padding:'6px', textAlign:'right'}}>-{fmt(damgaVergisi)} ₺</td></tr>
                    </tbody>
                    <tfoot style={{background:'#f9fafb'}}>
                      <tr>
                        <td style={{border:'1px solid #999', textAlign:'right', fontWeight:600, padding:'6px'}}>Net İzin Ücreti</td>
                        <td style={{border:'1px solid #999', fontWeight:600, padding:'6px', textAlign:'right'}}>{fmt(netIzin)} ₺</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {[
            { to: "/is-tazminati/yillik-izin/30-isciden-fazla", label: "İş Kanununa Göre" },
            { to: "/is-tazminati/yillik-izin/borclar-kanunu", label: "Borçlar Kanunu İşçi Alacağı" },
            { to: "/is-tazminati/yillik-izin/gemi-adam", label: "Gemi Adamları" },
            { to: "/is-tazminati/yillik-izin/mevsimlik-isci", label: "Mevsimlik İşçi" },
            { to: "/is-tazminati/yillik-izin/basin-is", label: "Basın İş" },
            { to: "/is-tazminati/yillik-izin/kismi-sureli", label: "Kısmi Süreli / Part Time" },
            { to: "/is-tazminati/yillik-izin/belirli-sureli", label: "Belirli Süreli İş Sözleşmesi" },
          ].map((l) => (
            <NavLink key={l.to} to={l.to} className={({isActive}) => `px-3 py-1.5 rounded-full text-sm border transition-colors ${isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div id="yillik-izin-print" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">İşe Giriş Tarihi</label>
                <input type="date" value={iseGiris} onChange={(e) => setIseGiris(e.target.value)} className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">İşten Çıkış Tarihi</label>
                <input type="date" value={istenCikis} onChange={(e) => setIstenCikis(e.target.value)} className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700">Çalışma Süresi</label>
                <input disabled value={diff.label} className="w-full mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Annual leave calculation */}
            <div className="p-3 rounded-md border bg-gray-50">
              <div className="text-sm text-gray-700 font-medium mb-2">Yıllık İzin Hesaplama</div>
              <div className="text-sm text-gray-800 space-y-1">
                <div>14 × {breakdown.y1} = <span className="font-semibold">{breakdown.d1} gün</span></div>
                <div>20 × {breakdown.y2} = <span className="font-semibold">{breakdown.d2} gün</span></div>
                <div>26 × {breakdown.y3} = <span className="font-semibold">{breakdown.d3} gün</span></div>
                <div className="mt-2 border-t pt-2 font-semibold">Toplam = {breakdown.total} gün</div>
              </div>
              <div className="mt-3 text-base sm:text-lg font-semibold text-gray-900">Toplam Yıllık İzin Hakkı: {breakdown.total} Gün</div>
            </div>

            {/* Accordion for used leaves */}
            <div className="border rounded-md">
              <button type="button" onClick={() => setAccordionOpen((s)=>!s)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium">
                <span>Kullanılan İzinleri Dışla</span>
                <svg className={`w-4 h-4 transition-transform ${accordionOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
              </button>
              {accordionOpen && (
                <div className="px-3 pb-3">
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2 pr-2">İzin Başlangıç Tarihi</th>
                          <th className="py-2 pr-2">İzin Bitiş Tarihi</th>
                          <th className="py-2 pr-2">Kullanılan Gün</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 pr-2"><input type="date" value={r.start} onChange={(e)=>setRow(r.id,{start:e.target.value})} className="w-full rounded-md border border-gray-200 px-2 py-1" /></td>
                            <td className="py-2 pr-2"><input type="date" value={r.end} onChange={(e)=>setRow(r.id,{end:e.target.value})} className="w-full rounded-md border border-gray-200 px-2 py-1" /></td>
                            <td className="py-2 pr-2"><input value={r.days} onChange={(e)=>setRow(r.id,{days:e.target.value})} placeholder="Örn: 5" className="w-full rounded-md border border-gray-200 px-2 py-1" /></td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} className="pt-2">
                            <button type="button" onClick={addRow} className="text-blue-600 hover:text-blue-800 text-sm font-medium">+ Satır Ekle</button>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} className="py-2 text-right font-medium">TOPLAM</td>
                          <td className="py-2 font-semibold">{usedTotal} gün</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-2 text-sm sm:text-base font-semibold">Kalan İzin Hakkı: {remainingDays} Gün</div>
                </div>
              )}
            </div>

            {/* Gross to net */}
            <div className="mt-3 p-4 rounded-lg bg-white border border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Brütten Nete Çevir</div>
              <label className="text-sm font-medium text-gray-700">Çıplak Brüt Ücret</label>
              <input value={brutUcret} onChange={(e)=>setBrutUcret(e.target.value)} placeholder="Örn: 25.000,00" className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" />
              <div className="mt-3 space-y-1 text-sm sm:text-base">
                <p className="flex items-center justify-between"><span>Brüt Yıllık İzin Ücreti:</span> <span className="font-medium">{fmt(brutIzin)} ₺</span></p>
                <p className="flex items-center justify-between text-red-600"><span>SGK Primi (%14):</span> <span className="font-medium">-{fmt(sgk)} ₺</span></p>
                <p className="flex items-center justify-between text-red-600"><span>İşsizlik Primi (%1):</span> <span className="font-medium">-{fmt(issizlik)} ₺</span></p>
                <p className="flex items-center justify-between text-red-600"><span>Gelir Vergisi (%15):</span> <span className="font-medium">-{fmt(gelirVergisi)} ₺</span></p>
                <p className="flex items-center justify-between text-red-600"><span>Damga Vergisi (Binde 7,59):</span> <span className="font-medium">-{fmt(damgaVergisi)}</span></p>
                <hr className="my-2" />
                <p className="flex items-center justify-between"><span>Net Yıllık İzin Ücreti:</span> <span className="font-semibold text-green-700">{fmt(netIzin)}</span></p>
                <div className="flex items-center justify-between">
                  <span>Davalı tarafından iş akdinin sonlanması ile yıllık ücretli izin bedeli adı altında yapılan ödeme</span>
                  <input
                    value={employerPayment}
                    onChange={(e)=>setEmployerPayment(e.target.value)}
                    placeholder="Örn: 10.000"
                    className="w-40 sm:w-56 rounded-md border border-gray-200 px-3 py-1 text-sm text-right"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={handlePrint} className="bg-gray-600 text-white rounded-md px-4 py-2 hover:bg-gray-700 transition">🖨️ Yazdır</button>
                <button onClick={handleSave} className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition">💾 Kaydet</button>
              </div>
            </div>
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
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Not: İş Kanunu – Yıllık İzin 14. Madde:</div>
              <div className="space-y-2 text-slate-600 dark:text-slate-300">
                <p>1️⃣ Davacı, kullandığı yıllık izni kendi beyan edebilir ve eksik kalan kısmı talep edebilir.</p>
                <p>2️⃣ Davalı, elinde "Yıllık Ücretli İzin" başlıklı imzalı belge bulunduruyorsa, bu belgede belirtilen günler yıllık ücretli izin talebinden dışlanmalıdır.</p>
                <p>3️⃣ Davalı, işçinin işten çıkış tarihi itibariyle yıllık izin ücreti ödemesi yapmışsa, bu tutar hesaptan mahsup edilmelidir.</p>
                <p>4️⃣ Her ne kadar Yıllık İzin Yönetmeliği'nde, yıllık iznin kullanımında en az 10 gün kullandırılması kuralı bulunsa da; hesaplamada imzalı yıllık izin belgeleri ile belirlenen günler esas alınır.</p>
                <p>5️⃣ Yıllık Ücret için esas alınacak süre: 4857 sayılı İş Kanunun 53. Maddesinin 4. Fıkrasında "İşçilere verilecek yıllık ücretli izin süresi, hizmet süresi; a) Bir yıldan beş yıla kadar (beş yıl dahil) olanlara ondört günden, b) Beş yıldan fazla onbeş yıldan az olanlara yirmi günden, c) Onbeş yıl (dahil) ve daha fazla olanlara yirmialtı günden, Az olamaz. (Ek cümle: 10/9/2014-6552/5 md.) Yer altı işlerinde çalışan işçilerin yıllık ücretli izin süreleri dörder gün arttırılarak uygulanır." Denilerek belirlenmiştir.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
