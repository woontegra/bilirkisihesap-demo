import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { API_BASE_URL } from "@/utils/apiClient";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  caseId: number;
  onBack?: () => void;
};

export default function ReportPreviewStep({ open, setOpen, caseId, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/cases/generate-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": "1" },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Rapor oluşturulamadı");
      setResult(data);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full sm:max-w-[800px] bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] p-8 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Rapor Önizleme & İndirme</h2>

        <div className="space-y-2 text-sm">
          {error && <div className="text-red-600">{error}</div>}
          {result ? (
            <div className="space-y-2">
              <div className="text-gray-700">Toplam Tazminat: <b>{result?.calc?.toplam_tazminat}</b></div>
              <pre className="bg-gray-50 p-2 rounded border text-xs overflow-auto max-h-60">{JSON.stringify(result?.report?.summary, null, 2)}</pre>
            </div>
          ) : (
            <p className="text-gray-600">Raporu görmek için oluşturun.</p>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex justify-between items-center mt-auto">
          <button onClick={() => onBack?.()} className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 text-sm font-medium">← Geri</button>
          <button onClick={generate} disabled={loading} className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium">
            {loading ? "Oluşturuluyor..." : "Raporu Oluştur"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
