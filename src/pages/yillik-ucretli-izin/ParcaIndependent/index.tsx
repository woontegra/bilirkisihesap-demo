import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import Layout from "@/components/Layout";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/utils/exclusionStorage";
import { API_BASE_URL } from "@/utils/apiClient";
import { getAsgariUcretByDate } from "@/utils/asgariUcretler";
// Constants - inline (Parça Başı)
const NOTE_ITEMS: string[] = ["Parça başı çalışanlarda yıllık izin hakkı vardır.", "İzin süresi çalışma süresine göre hesaplanır."];
const SAVE_ENDPOINT = `${API_BASE_URL}/api/saved-cases`;
const SAVE_TYPE = "Yıllık Ücretli İzin";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Parça Başı Yıllık Ücretli İzin Alacağı";
const PRINT_TITLE = "Parça Başı Yıllık Ücretli İzin Hesaplama";
const PRINT_HEADING = "Parça Başı Yıllık Ücretli İzin Hesaplama";
const REPORT_TITLE = "Yıllık Ücretli İzin";
type UsedRow = { id: string; start: string; end: string; days: string };
const createEmptyRow = (): UsedRow => ({ id: Math.random().toString(36).slice(2), start: "", end: "", days: "" });
const createInitialRows = (count = 7): UsedRow[] => Array.from({ length: count }, () => createEmptyRow());
const toDays = (value: string) => Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
import "@/styles/soft-glow.css";

export default function YillikIzinPage() {
  // Dates and duration
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(7));
  const [employerPayment, setEmployerPayment] = useState("");
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<{ id: number; name: string; data: UsedRow[]; createdAt: string }[]>([]);

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const setRow = (id: string, patch: Partial<UsedRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const { success, error } = useToast();

  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  const [breakdown, setBreakdown] = useState({ y1: 0, y2: 0, y3: 0, d1: 0, d2: 0, d3: 0, total: 0 });
  const [usedTotal, setUsedTotal] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [brutIzin, setBrutIzin] = useState(0);
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [netIzin, setNetIzin] = useState(0);

  const selectedYear = useMemo(() => {
    if (istenCikis) {
      const year = new Date(istenCikis).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) {
        return year;
      }
    }
    return new Date().getFullYear();
  }, [istenCikis]);

  const asgariUcretHatasi = useMemo(() => {
    if (!istenCikis || !brutUcret) return null;
    const girilenUcret = parseFloat(String(brutUcret).replace(/\./g, "").replace(",", "."));
    if (isNaN(girilenUcret) || girilenUcret <= 0) return null;
    const asgariUcret = getAsgariUcretByDate(istenCikis);
    if (!asgariUcret) return null;
    if (girilenUcret < asgariUcret) {
      const yil = new Date(istenCikis).getFullYear();
      return { mesaj: `Girilen ücret, ${yil} yılı asgari brüt ücretinden düşük olamaz (${asgariUcret.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺).`, asgariUcret: asgariUcret };
    }
    return null;
  }, [istenCikis, brutUcret]);

  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/yillik-izin/parca`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ years: diff.yil, brutUcret: brutUcret, usedRows: rows, exitYear: selectedYear })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.success && result.data) {
          setBreakdown(result.data.breakdown || { y1: 0, y2: 0, y3: 0, d1: 0, d2: 0, d3: 0, total: 0 });
          setUsedTotal(result.data.usedTotal || 0);
          setRemainingDays(result.data.remainingDays || 0);
          setBrutIzin(result.data.brutIzin || 0);
          setSgk(result.data.sgk || 0);
          setIssizlik(result.data.issizlik || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNetIzin(result.data.netIzin || 0);
        }
      } catch (error) { console.error("Yıllık izin hesaplama hatası:", error); }
    };
    if (diff.yil > 0) calculateFromBackend();
  }, [diff.yil, brutUcret, rows, selectedYear]);

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleNewCalculation = () => {
    setIseGiris("");
    setIstenCikis("");
    setBrutUcret("");
    setRows(createInitialRows(7));
    setEmployerPayment("");
  };

  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const handleSave = async () => {
    if (saving.current) return;
    const validation = validateSave({
      iseGiris,
      istenCikis,
      remainingDays,
      brutIzin,
    });
    if (!validation.isValid) {
      error(validation.message);
      return;
    }

    saving.current = true;
    setIsSaving(true);
    try {
      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const payload = {
        hesaplama_tipi: SAVE_TYPE,
        brut_toplam: Number(brutIzin.toFixed(2)),
        net_toplam: Number(netIzin.toFixed(2)),
        ise_giris: iseGiris || null,
        isten_cikis: istenCikis || null,
        eklentiler: { employer_payment: employerPayment }
      };
      await fetch(SAVE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) }, body: JSON.stringify(payload) });
      success("Hesaplama başarıyla kaydedildi.");
    } catch {
      error("Kayıt sırasında hata oluştu.");
    }
    finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Layout fluid hideHeader={true} pageKey="yillik-izin" noBackgroundColor={true}>
      <div className="min-h-screen px-6 py-8 page-background">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="soft-card" style={{ padding: '20px' }}>
              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">İşe Giriş Tarihi</label>
                  <input 
                    type="date" 
                    value={iseGiris} 
                    onChange={(e) => {
                      let value = e.target.value;
                      // Yıl kısmını 4 karakterle sınırla
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join('-');
                          e.target.value = value;
                        }
                      }
                      setIseGiris(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)) {
                        const newDate = new Date(newValue);
                        const exitDate = new Date(istenCikis);
                        if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                          error("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">İşten Çıkış Tarihi</label>
                  <input 
                    type="date" 
                    value={istenCikis} 
                    onChange={(e) => {
                      let value = e.target.value;
                      // Yıl kısmını 4 karakterle sınırla
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join('-');
                          e.target.value = value;
                        }
                      }
                      setIstenCikis(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(iseGiris)) {
                        const newDate = new Date(newValue);
                        const entryDate = new Date(iseGiris);
                        if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                          error("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                        }
                      }
                    }}
                    className="w-full mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm" 
                  />
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
                <div className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium">
                  <button type="button" onClick={() => setAccordionOpen((s)=>!s)} className="flex items-center gap-2">
                    <span>Kullanılan İzinleri Dışla</span>
                    <svg className={`w-4 h-4 transition-transform ${accordionOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <div className="flex gap-2 items-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => { setExclusionSaveName(""); setShowExclusionSaveModal(true); }} disabled={rows.every(r => !r.start || !r.end)} className="inline-flex items-center gap-1">Kaydet<span className="text-blue-800 hover:text-blue-900 cursor-help" title="Girdiğiniz kullanılan izin günlerini bir isim vererek kaydedin. Başka hesaplamalarda tekrar kullanabilirsiniz.">ⓘ</span></Button>
                    <Button type="button" variant="outline" size="sm" onClick={async () => { const sets = await getAllExclusionSets(); const setsWithCalculatedDays = sets.map(set => ({ ...set, data: set.data.map(row => { if (row.start && row.end && (!row.days || row.days === "0" || row.days === "")) { const startDate = new Date(row.start); const endDate = new Date(row.end); if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) { const diffTime = Math.abs(endDate.getTime() - startDate.getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; return { ...row, days: String(diffDays) }; } } return row; }) })); setSavedExclusionSets(setsWithCalculatedDays); setShowExclusionLoadModal(true); }} className="inline-flex items-center gap-1">İçe Aktar<span className="text-blue-800 hover:text-blue-900 cursor-help" title="Daha önce kaydettiğiniz kullanılan izin günlerini yükleyin. Aynı davacı için farklı hesaplamalarda zaman kazandırır.">ⓘ</span></Button>
                  </div>
                </div>
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
                <label className="text-sm font-medium text-gray-700">Çıplak Brüt Ücret</label>
                <input 
                  value={brutUcret} 
                  onChange={(e)=>setBrutUcret(e.target.value)} 
                  placeholder="Örn: 25.000,00" 
                  className={`w-full mt-1 rounded-md border px-3 py-2 text-sm ${
                    asgariUcretHatasi 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-200'
                  }`} 
                />
                {asgariUcretHatasi && (
                  <p className="text-red-600 text-xs mt-1">{asgariUcretHatasi.mesaj}</p>
                )}
                
                {/* Brütten Nete Çevir - ZARİF */}
                <div className="mt-4 p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-500 dark:border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200">
                  <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-400 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">₺</span>
                    Brütten Nete Çevir
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Brüt Yıllık İzin Ücreti</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(brutIzin)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">SGK Primi (%14)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(sgk)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">İşsizlik Primi (%1)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(issizlik)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Gelir Vergisi {gelirVergisiDilimleri}</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(gelirVergisi)}₺</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-yellow-200 dark:border-yellow-800/30">
                      <span className="text-gray-700 dark:text-gray-300">Damga Vergisi (binde 7,59)</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-{fmt(damgaVergisi)}₺</span>
                    </div>
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Net Yıllık İzin Ücreti</span>
                      <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmt(netIzin)}₺</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-800/30">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Davalı tarafından iş akdinin sonlanması ile yıllık ücretli izin bedeli adı altında yapılan ödemedir</span>
                      <input
                        value={employerPayment}
                        onChange={(e)=>setEmployerPayment(e.target.value)}
                        placeholder="Örn: 10.000"
                        className="w-full sm:w-40 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-right bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
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
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Not: İş Kanunu – Yıllık İzin 14. Madde</div>
                <div className="space-y-2 text-slate-600 dark:text-slate-300">
                  {NOTE_ITEMS.map((note, index) => (
                    <p key={index}>{note}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : "Kaydet"}
        previewButton={{
          title: REPORT_TITLE,
          copyTargetId: "calc-table",
          renderContent: () => (
            <div>
              <div id="calc-table">
                <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #999', fontSize:13, fontFamily:'Inter, Arial, sans-serif'} as CSSProperties}>
                  <thead style={{background:'#f3f4f6'}}>
                    <tr>
                      <th style={{padding:'6px 8px', border:'1px solid #ccc', textAlign:'left'}}>Yıl</th>
                      <th style={{padding:'6px 8px', border:'1px solid #ccc', textAlign:'left'}}>Hak Edilen İzin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{padding:'6px 8px', border:'1px solid #ccc'}}>0-5 yıl</td>
                      <td style={{padding:'6px 8px', border:'1px solid #ccc'}}>14 gün</td>
                    </tr>
                    <tr>
                      <td style={{padding:'6px 8px', border:'1px solid #ccc'}}>6-14 yıl</td>
                      <td style={{padding:'6px 8px', border:'1px solid #ccc'}}>20 gün</td>
                    </tr>
                    <tr>
                      <td style={{padding:'6px 8px', border:'1px solid #ccc'}}>15 yıl ve üzeri</td>
                      <td style={{padding:'6px 8px', border:'1px solid #ccc'}}>26 gün</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ),
        }}
      />
      {showExclusionSaveModal && createPortal(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionSaveModal(false)}><div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}><h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kullanılan İzinleri Kaydet</h3><div className="mb-4"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Liste Adı</label><input type="text" placeholder="Örn: Davacı A - Kullanılan İzinler" value={exclusionSaveName} onChange={(e) => setExclusionSaveName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm dark:bg-slate-700 dark:text-white" /></div><div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => { setShowExclusionSaveModal(false); setExclusionSaveName(""); }}>İptal</Button><Button onClick={async () => { if (!exclusionSaveName.trim()) { showToastError("Lütfen bir isim girin."); return; } const saved = await saveExclusionSet(exclusionSaveName.trim(), rows.filter(r => r.start && r.end)); if (saved) { success(`"${exclusionSaveName.trim()}" olarak kaydedildi!`); setShowExclusionSaveModal(false); setExclusionSaveName(""); } else { showToastError("Kaydetme işlemi başarısız oldu."); } }} disabled={!exclusionSaveName.trim()}>Kaydet</Button></div></div></div>, document.body)}
      {showExclusionLoadModal && createPortal(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowExclusionLoadModal(false)}><div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}><h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kayıtlı Kullanılan İzinler</h3>{savedExclusionSets.length === 0 ? <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">Henüz kayıtlı bir liste yok.</p> : <div className="max-h-60 overflow-y-auto space-y-2 mb-4">{savedExclusionSets.map((set) => <div key={set.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600"><div><div className="font-medium text-sm text-slate-800 dark:text-slate-200">{set.name}</div><div className="text-xs text-gray-500 dark:text-slate-400">{set.data.length} kayıt</div></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setRows(set.data.length > 0 ? set.data : createInitialRows(7)); success(`"${set.name}" yüklendi!`); setShowExclusionLoadModal(false); }}>Yükle</Button><Button size="sm" variant="outline" onClick={async () => { if (confirm(`"${set.name}" listesini silmek istediğinize emin misiniz?`)) { const deleted = await deleteExclusionSet(set.id); if (deleted) { success("Liste silindi."); const updatedSets = await getAllExclusionSets(); setSavedExclusionSets(updatedSets); } else { showToastError("Silme işlemi başarısız oldu."); } } }} className="text-red-600 hover:text-red-700 dark:text-red-400"><Trash2 className="w-4 h-4" /></Button></div></div>)}</div>}<div className="flex justify-end"><Button variant="outline" onClick={() => setShowExclusionLoadModal(false)}>Kapat</Button></div></div></div>, document.body)}
    </Layout>
  );
}
