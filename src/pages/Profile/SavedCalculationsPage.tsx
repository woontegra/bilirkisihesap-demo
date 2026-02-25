import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { Trash2, Edit, FileText, Search, X, CheckSquare, Square, Download, Upload, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import UbgtReportModal from "@/pages/ubgt-alacagi/UbgtIndependent/UbgtReportModal";
import { API_BASE_URL } from "@/utils/apiClient";

type SavedCase = {
  id: number;
  tenant_id: number;
  hesaplama_tipi: string;
  notes?: string | null;
  kayit_adi?: string | null;
  ise_giris: string | null;
  isten_cikis: string | null;
  toplam: number | null;
  brut_toplam?: number | null;
  net_toplam?: number | null;
  created_at?: string;
  data?: any;
};

const fmt = new Intl.NumberFormat("tr-TR", { 
  style: "currency", 
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2 
});

export default function SavedCalculationsPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [showUbgtReportModal, setShowUbgtReportModal] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]); // Seçili ID'ler
  const [isDeleting, setIsDeleting] = useState(false); // Silme işlemi durumu
  const [isExporting, setIsExporting] = useState(false); // Yedekleme durumu
  const [isImporting, setIsImporting] = useState(false); // Geri yükleme durumu
  const fileInputRef = useRef<HTMLInputElement>(null); // Dosya input ref
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [savingNameId, setSavingNameId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/saved-cases`, {
        headers: {
          "x-tenant-id": String(tenantId),
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      // Backend'den gelen data formatını frontend formatına map et
      // Yeni Prisma formatı: { id, name, type, data: Json, createdAt, tenantId }
      const mappedCases = (Array.isArray(data) ? data : []).map((item: any) => {
        // data field'ı JSON string olabilir veya object olabilir
        let parsedData: any = {};
        if (item.data) {
          if (typeof item.data === 'string') {
            try {
              parsedData = JSON.parse(item.data);
            } catch {
              parsedData = {};
            }
          } else {
            parsedData = item.data;
          }
        }
        
        // parsedData içinde data objesi varsa (yeni format: veri.data = { data: {...} })
        const innerData = parsedData.data || parsedData;
        
        // Mevsimlik İşçi için periods array'inden ilk ve son tarihleri al
        let mevsimlikStartDate = null;
        let mevsimlikEndDate = null;
        if (parsedData.form?.periods && Array.isArray(parsedData.form.periods) && parsedData.form.periods.length > 0) {
          const sortedPeriods = [...parsedData.form.periods].sort((a: any, b: any) => {
            const dateA = a.start ? new Date(a.start).getTime() : 0;
            const dateB = b.start ? new Date(b.start).getTime() : 0;
            return dateA - dateB;
          });
          mevsimlikStartDate = sortedPeriods[0]?.start || null;
          const sortedByEnd = [...parsedData.form.periods].sort((a: any, b: any) => {
            const dateA = a.end ? new Date(a.end).getTime() : 0;
            const dateB = b.end ? new Date(b.end).getTime() : 0;
            return dateB - dateA;
          });
          mevsimlikEndDate = sortedByEnd[0]?.end || null;
        }
        
        return {
          id: item.id,
          tenant_id: item.tenantId || item.tenant_id || tenantId,
          hesaplama_tipi: (
            item.type || // Yeni format
            item.calculation_type || // Eski format
            item.hesaplama_tipi ||
            parsedData.calculation_type ||
            ""
          ).toLowerCase(),
          notes: item.name || item.notes || item.aciklama || item.record_name || null, // Yeni format: name
          kayit_adi: item.name || item.record_name || item.aciklama || item.kayit_adi || item.notes || null, // Yeni format: name
          ise_giris: (() => {
            const itemType = (item.type || '').toLowerCase();
            // Debug için fazla_mesai sayfaları
            if (itemType.includes('fazla_mesai') && (itemType.includes('bilirkisi_2') || itemType.includes('vardiya_8') || itemType.includes('vardiya_12') || itemType.includes('vardiya_24') || itemType.includes('gemi') || itemType.includes('ev') || itemType.includes('fazla_sure') || itemType.includes('fazla_süre'))) {
              console.log('[SavedCalculationsPage] Fazla Mesai tarih arama:', {
                id: item.id,
                type: item.type,
                parsedDataForm: parsedData.form,
                parsedDataIseGiris: parsedData.ise_giris,
                parsedDataStartDate: parsedData.start_date,
                innerDataForm: innerData.form,
                innerDataIseGiris: innerData.ise_giris,
                innerDataStartDate: innerData.start_date,
                itemIseGiris: item.ise_giris,
                itemStartDate: item.start_date
              });
            }
            // Fazla mesai sayfaları için öncelik: form.iseGiris > ise_giris > start_date
            const result = mevsimlikStartDate || parsedData.form?.iseGiris || parsedData.form?.startDate || innerData.form?.iseGiris || innerData.form?.startDate || parsedData.ise_giris || parsedData.start_date || innerData.start_date || innerData.ise_giris || parsedData.data?.form?.iseGiris || parsedData.data?.form?.startDate || item.ise_giris || item.start_date || null;
            return result;
          })(),
          isten_cikis: (() => {
            const itemType = (item.type || '').toLowerCase();
            // Debug için fazla_mesai sayfaları
            if (itemType.includes('fazla_mesai') && (itemType.includes('bilirkisi_2') || itemType.includes('vardiya_8') || itemType.includes('vardiya_12') || itemType.includes('vardiya_24') || itemType.includes('gemi') || itemType.includes('ev') || itemType.includes('fazla_sure') || itemType.includes('fazla_süre'))) {
              console.log('[SavedCalculationsPage] Fazla Mesai çıkış tarihi arama:', {
                id: item.id,
                type: item.type,
                parsedDataForm: parsedData.form,
                parsedDataIstenCikis: parsedData.isten_cikis,
                parsedDataEndDate: parsedData.end_date,
                innerDataForm: innerData.form,
                innerDataIstenCikis: innerData.isten_cikis,
                innerDataEndDate: innerData.end_date,
                itemIstenCikis: item.isten_cikis,
                itemEndDate: item.end_date
              });
            }
            // Fazla mesai sayfaları için öncelik: form.istenCikis > isten_cikis > end_date
            const result = mevsimlikEndDate || parsedData.form?.istenCikis || parsedData.form?.endDate || parsedData.form?.exitDate || innerData.form?.istenCikis || innerData.form?.endDate || innerData.form?.exitDate || parsedData.isten_cikis || parsedData.end_date || innerData.end_date || innerData.isten_cikis || parsedData.data?.form?.istenCikis || parsedData.data?.form?.endDate || parsedData.data?.form?.exitDate || item.isten_cikis || item.end_date || null;
            return result;
          })(),
          toplam: parsedData.total || innerData.total || item.toplam || item.total || null,
          brut_toplam: parsedData.brut_total || innerData.brut_total || innerData.results?.brut || parsedData.results?.brut || item.brut_total || item.brut_toplam || null,
          net_toplam: (() => {
            // Basın İş ve diğer sayfalar için net toplamı bul
            // Öncelik sırası: results.net > net_total > diğer alanlar
            // fazla_mesai_bilirkisi_2 için: parsedData.results.net veya parsedData.net_total
            // Fazla mesai sayfaları için öncelik: innerData.results.net (çünkü veri.data.data.results.net formatında)
            const netFromResults = innerData.results?.net || parsedData.results?.net || parsedData.data?.results?.net;
            const netFromTotal = parsedData.net_total || innerData.net_total || parsedData.data?.net_total;
            const netFromItem = item.net_total || item.net_toplam;
            
            const itemType = (item.type || '').toLowerCase();
            // Debug için fazla_mesai sayfaları
            if (itemType.includes('fazla_mesai') && (itemType.includes('bilirkisi_2') || itemType.includes('vardiya_8') || itemType.includes('vardiya_12') || itemType.includes('vardiya_24') || itemType.includes('gemi') || itemType.includes('ev') || itemType.includes('fazla_sure') || itemType.includes('fazla_süre'))) {
              console.log('[SavedCalculationsPage] Fazla Mesai net toplam arama:', {
                id: item.id,
                type: item.type,
                netFromResults,
                netFromTotal,
                netFromItem,
                parsedDataResults: parsedData.results,
                innerDataResults: innerData.results,
                parsedDataNetTotal: parsedData.net_total,
                innerDataNetTotal: innerData.net_total,
                parsedDataData: parsedData.data,
                innerData: innerData,
                itemData: item.data
              });
            }
            
            // Debug için (geliştirme aşamasında)
            if ((item.type || '').toLowerCase() === 'kidem_basin') {
              console.log('[SavedCalculationsPage] Basın İş net toplam arama:', {
                id: item.id,
                netFromResults,
                netFromTotal,
                netFromItem,
                parsedDataResults: parsedData.results,
                innerDataResults: innerData.results,
                parsedDataNetTotal: parsedData.net_total,
                innerDataNetTotal: innerData.net_total
              });
            }
            
            // Fazla mesai sayfaları için öncelik: innerData.results.net > parsedData.net_total > item.net_total
            const result = netFromResults || netFromTotal || netFromItem || null;
            return result;
          })(),
          created_at: item.createdAt || item.created_at || item.date || null,
          data: parsedData || item.detay || item.data || null,
        };
      });
      
      setCases(mappedCases);
    } catch (err) {
      console.error("Failed to load cases:", err);
      error("Hesaplamalar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  /**
   * YEDEKLEME - Backend'den şifreli .bhbackup dosyası indir
   */
  const handleExportBackup = async () => {
    if (cases.length === 0) {
      error("Yedeklenecek hesaplama bulunamadı");
      return;
    }

    try {
      setIsExporting(true);

      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        error("Oturum bulunamadı, lütfen giriş yapın");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/backups/export`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "x-tenant-id": String(tenantId),
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Bilinmeyen hata" }));
        throw new Error(errData.message || "Yedek oluşturulamadı");
      }

      // Dosyayı blob olarak al
      const blob = await res.blob();
      
      // İndirme işlemi
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Dosya adını header'dan al veya default kullan
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `bilirkisi-${new Date().toISOString().split('T')[0]}.bhbackup`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) filename = match[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success("Yedek başarıyla oluşturuldu ve indirildi");
    } catch (err: any) {
      console.error("Backup export error:", err);
      error(err.message || "Yedek oluşturulurken bir hata oluştu");
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * GERİ YÜKLEME - .bhbackup dosyasını backend'e gönder
   */
  const handleImportBackup = async (file: File) => {
    if (!file.name.endsWith(".bhbackup")) {
      error("Geçersiz dosya türü. Sadece .bhbackup dosyaları yüklenebilir.");
      return;
    }

    try {
      setIsImporting(true);

      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        error("Oturum bulunamadı, lütfen giriş yapın");
        return;
      }

      const formData = new FormData();
      formData.append("backup", file);

      const res = await fetch(`${API_BASE_URL}/api/backups/import`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "x-tenant-id": String(tenantId),
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Yedek geri yüklenemedi");
      }

      success(data.message || "Yedek başarıyla geri yüklendi");
      
      // Kayıtları yeniden yükle
      await loadCases();
    } catch (err: any) {
      console.error("Backup import error:", err);
      error(err.message || "Yedek geri yüklenirken bir hata oluştu");
    } finally {
      setIsImporting(false);
      // File input'u temizle
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /**
   * Dosya seçim handler
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportBackup(file);
    }
  };

  // Tek silme
  const handleDelete = async (id: number) => {
    console.log("handleDelete called", id);
    if (!window.confirm("Bu hesaplamayı silmek istediğinize emin misiniz?")) {
      console.log("Delete cancelled by user");
      return;
    }
    
    try {
      console.log("Deleting calculation:", id);
      // Önce yeni endpoint'i dene
      let res = await fetch(`${API_BASE_URL}/api/saved-cases/${id}`, {
        method: "DELETE",
        headers: { 
          "x-tenant-id": String(tenantId),
          "Content-Type": "application/json",
        },
      });
      
      // Eğer 404 ise eski endpoint'i dene
      if (res.status === 404) {
        console.log("Trying old endpoint...");
        res = await fetch(`${API_BASE_URL}/api/saved-cases/${id}`, {
          method: "DELETE",
          headers: { 
            "x-tenant-id": String(tenantId),
            "Content-Type": "application/json",
          },
        });
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Delete error:", res.status, errorText);
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      // Response'u parse et
      let data;
      try {
        data = await res.json();
      } catch {
        // JSON değilse başarılı say
        data = { success: true };
      }
      
      if (data.success !== false) {
        console.log("Delete successful");
        success("Hesaplama silindi");
        setCases((prev) => prev.filter((c) => c.id !== id));
        setSelectedIds((prev) => prev.filter((sid) => sid !== id)); // Seçili listeden de çıkar
      } else {
        console.error("Delete failed:", data);
        error(data.message || "Silme işlemi başarısız");
      }
    } catch (err: any) {
      console.error("Failed to delete:", err);
      error(err.message || "Silme işlemi başarısız");
    }
  };

  // Toplu silme (seçilenleri)
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      error("Lütfen silmek istediğiniz hesaplamaları seçin");
      return;
    }

    if (!window.confirm(`${selectedIds.length} adet hesaplama silinecek. Emin misiniz?`)) {
      return;
    }

    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/saved-cases/${id}`, {
          method: "DELETE",
          headers: { 
            "x-tenant-id": String(tenantId),
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          successCount++;
          setCases((prev) => prev.filter((c) => c.id !== id));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsDeleting(false);
    setSelectedIds([]);

    if (successCount > 0) {
      success(`${successCount} hesaplama silindi`);
    }
    if (failCount > 0) {
      error(`${failCount} hesaplama silinemedi`);
    }
  };

  // Tümünü sil
  const handleDeleteAll = async () => {
    if (filteredCases.length === 0) {
      error("Silinecek hesaplama yok");
      return;
    }

    if (!window.confirm(`Tüm hesaplamalar (${filteredCases.length} adet) silinecek. Bu işlem geri alınamaz! Emin misiniz?`)) {
      return;
    }

    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const c of filteredCases) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/saved-cases/${c.id}`, {
          method: "DELETE",
          headers: { 
            "x-tenant-id": String(tenantId),
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          successCount++;
          setCases((prev) => prev.filter((item) => item.id !== c.id));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsDeleting(false);
    setSelectedIds([]);

    if (successCount > 0) {
      success(`${successCount} hesaplama silindi`);
    }
    if (failCount > 0) {
      error(`${failCount} hesaplama silinemedi`);
    }
  };

  // Kayıt adı güncelle (GET sonra PUT)
  const handleSaveName = async (id: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setEditingNameId(null);
      return;
    }
    setSavingNameId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/saved-cases/${id}`, {
        headers: { "x-tenant-id": String(tenantId) },
      });
      if (!res.ok) throw new Error("Kayıt yüklenemedi");
      const item = await res.json();
      const putRes = await fetch(`${API_BASE_URL}/api/saved-cases/${id}`, {
        method: "PUT",
        headers: {
          "x-tenant-id": String(tenantId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmed,
          type: item.type,
          data: item.data,
        }),
      });
      if (!putRes.ok) throw new Error("Güncellenemedi");
      setCases((prev) =>
        prev.map((c) => (c.id === id ? { ...c, kayit_adi: trimmed, notes: trimmed } : c))
      );
      success("Kayıt adı güncellendi");
    } catch (err: any) {
      error(err.message || "Kayıt adı güncellenemedi");
    } finally {
      setSavingNameId(null);
      setEditingNameId(null);
    }
  };

  // Kaydı kopyala (GET sonra POST, liste yenilenir - yeni kayıt en üstte)
  const handleCopy = async (c: SavedCase) => {
    setCopyingId(c.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/saved-cases/${c.id}`, {
        headers: { "x-tenant-id": String(tenantId) },
      });
      if (!res.ok) throw new Error("Kayıt yüklenemedi");
      const item = await res.json();
      const name = (item.name || c.kayit_adi || "Kopya").trim();
      const copyName = name.startsWith("Kopya") ? `${name} (2)` : `Kopya - ${name}`;
      const postRes = await fetch(`${API_BASE_URL}/api/saved-cases`, {
        method: "POST",
        headers: {
          "x-tenant-id": String(tenantId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: copyName,
          type: item.type,
          data: item.data,
        }),
      });
      if (!postRes.ok) {
        const errData = await postRes.json().catch(() => ({}));
        throw new Error(errData.error || "Kopyalama başarısız");
      }
      const created = await postRes.json();
      success("Hesaplama kopyalandı");
      await loadCases();
      // Kopyalanan kaydı orijinalin hemen altına taşı
      setCases((prev) => {
        const newItem = prev.find((x) => x.id === created.id);
        if (!newItem) return prev;
        const without = prev.filter((x) => x.id !== created.id);
        const idx = without.findIndex((x) => x.id === c.id);
        if (idx === -1) return prev;
        return [...without.slice(0, idx + 1), newItem, ...without.slice(idx + 1)];
      });
    } catch (err: any) {
      error(err.message || "Kopyalama başarısız");
    } finally {
      setCopyingId(null);
    }
  };

  // Checkbox toggle
  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  // Tümünü seç/kaldır
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCases.map((c) => c.id));
    }
  };

  // Filtrelenmiş hesaplamalar
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) {
      return cases;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return cases.filter((c) => {
      // Kayıt adında ara
      const kayitAdi = (c.kayit_adi || c.notes || "").toLowerCase();
      if (kayitAdi.includes(query)) return true;
      
      // Hesaplama tipinde ara
      const hesaplamaTipi = (c.hesaplama_tipi || "").toLowerCase();
      if (hesaplamaTipi.includes(query)) return true;
      
      // Tarih alanlarında ara (format: dd.mm.yyyy veya yyyy-mm-dd)
      const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        try {
          const date = new Date(dateStr);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          return `${day}.${month}.${year}`;
        } catch {
          return dateStr;
        }
      };
      
      const baslangic = formatDate(c.ise_giris).toLowerCase();
      const bitis = formatDate(c.isten_cikis).toLowerCase();
      if (baslangic.includes(query) || bitis.includes(query)) return true;
      
      // Net toplamda ara (sayısal değer)
      if (c.net_toplam) {
        const netStr = c.net_toplam.toString().toLowerCase();
        if (netStr.includes(query)) return true;
      }
      
      return false;
    });
  }, [cases, searchQuery]);

  // Calculation type'a göre route mapping
  const getRouteForCalculationType = (type: string, data?: any): string => {
    const t = (type || "").toLowerCase().replace(/[_\s]/g, "_");
    
    console.log("🔍 getRouteForCalculationType called:");
    console.log("  - Original type:", type);
    console.log("  - Normalized t:", t);
    console.log("  - Checking is_arama:", t.includes("is_arama"));

    // ► Fazla Mesai – Tanıklı Standart
    if (t.includes("tanikli") && t.includes("standart")) {
      return "/fazla-mesai/tanikli-standart";
    }

    // ► Fazla Mesai – Haftalık Karma
    if (t.includes("haftalik") && t.includes("karma")) {
      return "/fazla-mesai/haftalik-karma";
    }

    // ► Fazla Mesai – Dönemsel Haftalık
    if (t.includes("donemsel") && t.includes("haftalik")) {
      return "/fazla-mesai/donemsel-haftalik";
    }

    // ► Fazla Mesai – Dönemsel
    if (t.includes("donemsel")) {
      return "/fazla-mesai/donemsel";
    }

    // ► Fazla Mesai – Standart
    if (t === "standart_fazla_mesai" || t === "standard_fazla_mesai" || t === "standart" || t === "fazla_mesai") {
      return "/fazla-mesai/standart";
    }

    // ► Fazla Mesai Bilirkişi 1 - UBGT'den önce kontrol edilmeli (fazla_mesai_bilirkisi_1 vs ubgt_bilirkisi)
    if (t.includes("fazla_mesai") && (t.includes("bilirkisi_1") || t.includes("bilirkişi_1"))) {
      return "/fazla-mesai/bilirkisi-1";
    }

    // ► Fazla Mesai Bilirkişi 2 - UBGT'den önce kontrol edilmeli
    if (t.includes("fazla_mesai") && (t.includes("bilirkisi_2") || t.includes("bilirkişi_2"))) {
      return "/fazla-mesai/bilirkisi-2";
    }

    // ► Bilirkişi 1 (genel - fazla_mesai olmayan durumlar için)
    if (t.includes("bilirkisi_1") || t.includes("bilirkişi_1")) {
      return "/fazla-mesai/bilirkisi-1";
    }

    // ► Bilirkişi 2 (genel - fazla_mesai olmayan durumlar için)
    if (t.includes("bilirkisi_2") || t.includes("bilirkişi_2")) {
      return "/fazla-mesai/bilirkisi-2";
    }

    // ► Yeraltı İşçileri
    if (t.includes("yeralti") || t.includes("yeraltı")) {
      return "/fazla-mesai/yeralti-isci";
    }

    // ► Vardiya
    if (t.includes("vardiya12")) return "/fazla-mesai/vardiya12";
    if (t.includes("vardiya24")) return "/fazla-mesai/vardiya24";

    // ► Gemi
    if (t.includes("gemi_7_24") || t.includes("gemi-7-24") || (t.includes("gemi") && (data?.pageType === "gemi-7-24" || data?.route?.includes("gemi-7-24")))) {
      return "/fazla-mesai/gemi-7-24";
    }
    if (t.includes("gemi")) return "/fazla-mesai/gemi";

    // ► Ev hizmetleri
    if (t.includes("ev")) return "/fazla-mesai/ev";

    // ► Fazla sürelerle çalışma
    if (t.includes("fazla_sure") || t.includes("fazla_süre")) return "/fazla-mesai/fazla-surelerle-calisma";

    // ► UBGT - önce bilirkişi kontrolü (fazla_mesai_bilirkisi ile karışmaması için)
    // ÖNEMLİ: Bu kontrol Fazla Mesai Bilirkişi kontrollerinden SONRA olmalı
    // UBGT Bilirkişi: hem ubgt hem bilirkisi içermeli ama fazla_mesai içermemeli
    if (t.includes("ubgt") && t.includes("bilirkisi") && !t.includes("fazla_mesai")) {
      return "/ubgt-bilirkisi";
    }
    if (t.includes("ubgt")) {
      return "/ubgt-alacagi";
    }

    // ► Kıdem
    if (t.includes("kidem")) return "/kidem-tazminati/30isci";

    // ► İhbar
    if (t.includes("ihbar")) return "/ihbar-tazminati/30isci";

    // ► Hafta tatili
    if (t.includes("hafta_tatili")) return "/hafta-tatili-alacagi";

    // ► Ücret
    if (t.includes("ucret")) return "/ucret-alacagi";

    // ► İş Arama İzni Ücreti
    if (t.includes("is_arama") || t.includes("iş_arama") || t.includes("is-arama")) return "/is-arama-izni-ucreti";

    // ► Bakiye Ücret Alacağı
    if (t.includes("bakiye")) return "/bakiye-ucret-alacagi";

    // ► Prim Alacağı
    if (t.includes("prim")) return "/prim-alacagi";

    // ► Kötü Niyet Tazminatı
    if (t.includes("kotu_niyet") || t.includes("kötü_niyet")) return "/kotu-niyet-tazminati";

    // ► İşe Almama Tazminatı
    if (t.includes("ise_almama") || t.includes("işe_almama") || t.includes("almama")) return "/ise-almama-tazminati";

    // ► Ayrımcılık Tazminatı
    if (t.includes("ayrimcilik") || t.includes("ayrımcılık")) return "/ayrimcilik-tazminati";

    // ► Haksız Fesih Tazminatı
    if (t.includes("haksiz_fesih") || t.includes("haksız_fesih")) return "/haksiz-fesih-tazminati";

    // ► Davacı Ücreti
    if (t.includes("davaci") || t.includes("davacı")) return "/davaci-ucreti";

    // ► Varsayılan fallback → Standart Fazla Mesai
    return "/fazla-mesai/standart";
  };


  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Yükleniyor...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Kaydedilen Hesaplamalar</CardTitle>
            <CardDescription>Daha önce kaydettiğiniz hesaplamaları görüntüleyin ve yönetin</CardDescription>
          </div>
          
          {/* Yedekleme Butonları */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleExportBackup}
              disabled={isExporting || cases.length === 0}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Yedekleniyor..." : "Yedekle"}
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".bhbackup"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? "Geri Yükleniyor..." : "Geri Yükle"}
            </Button>
          </div>
        </div>
        
        {/* Bilgilendirme Mesajı */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-900 dark:text-blue-100">
          <div className="flex gap-2">
            <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Yedek dosyaları hakkında:</strong>
              <ul className="mt-1 ml-4 list-disc space-y-1">
                <li>Yedek dosyaları yalnızca Bilirkişi Hesap uygulamasıyla geri yüklenebilir</li>
                <li>Bu dosyalar harici yazılımlar tarafından açılamaz</li>
                <li>Yedek dosyanız kişiye özeldir, başka kullanıcılar tarafından yüklenemez</li>
              </ul>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 lg:px-6">
        {/* Arama ve Toplu İşlemler */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Kayıt adı, hesaplama tipi, tarih veya tutar ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Toplu İşlem Butonları */}
          <div className="flex items-center gap-3 flex-wrap">
            {searchQuery && (
              <div className="text-sm text-gray-500">
                {filteredCases.length} sonuç bulundu
              </div>
            )}
            
            {selectedIds.length > 0 && (
              <div className="text-sm font-medium text-blue-600">
                {selectedIds.length} kayıt seçildi
              </div>
            )}

            <div className="flex-1" />

            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Seçilenleri Sil ({selectedIds.length})
              </Button>
            )}

            {filteredCases.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Tümünü Sil
              </Button>
            )}
          </div>
        </div>

        {filteredCases.length === 0 && !loading ? (
          searchQuery ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sonuç bulunamadı</h3>
              <p className="text-sm text-gray-500 mb-6">
                "{searchQuery}" için arama sonucu bulunamadı
              </p>
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
              >
                Aramayı Temizle
              </Button>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Henüz kaydedilmiş hesaplama yok</h3>
              <p className="text-sm text-gray-500 mb-6">
                Hesaplama yaptığınızda sonuçları burada saklayabilirsiniz
              </p>
            </div>
          )
        ) : (
          <div className="min-w-0 overflow-hidden">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 text-[11px] sm:text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-1 py-2 text-center font-medium text-gray-500 dark:text-gray-400 uppercase w-8">
                    <button
                      onClick={toggleSelectAll}
                      className="inline-flex items-center justify-center hover:text-blue-600 transition-colors"
                      title={selectedIds.length === filteredCases.length ? "Tümünü Kaldır" : "Tümünü Seç"}
                    >
                      {selectedIds.length === filteredCases.length && filteredCases.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="px-1 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-6">
                    #
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[25%]">
                    Kayıt Adı
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[12%]">
                    Tarih
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[12%]">
                    Başlangıç
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[12%]">
                    Bitiş
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[14%]">
                    Net Toplam
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium text-gray-500 dark:text-gray-400 uppercase w-[140px] min-w-[140px]">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCases.map((c, index) => {
                  const isSelected = selectedIds.includes(c.id);
                  
                  return (
                    <tr 
                      key={c.id}
                      className={cn(
                        "transition-colors",
                        isSelected 
                          ? "bg-blue-50 dark:bg-blue-900/20" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      )}
                    >
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => toggleSelectId(c.id)}
                          className="inline-flex items-center justify-center hover:text-blue-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-gray-500 dark:text-gray-400">
                          {index + 1}
                        </div>
                      </td>
                    <td className="px-2 py-2 min-w-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      {editingNameId === c.id ? (
                        <Input
                          className="h-7 text-[11px] max-w-full"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={() => {
                            handleSaveName(c.id, editingNameValue);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveName(c.id, editingNameValue);
                            }
                            if (e.key === "Escape") {
                              setEditingNameId(null);
                              setEditingNameValue("");
                            }
                          }}
                          autoFocus
                          disabled={savingNameId === c.id}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-left font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded px-1 py-0.5 min-w-0 w-full truncate block"
                          title={c.kayit_adi || undefined}
                          onClick={() => {
                            setEditingNameId(c.id);
                            setEditingNameValue((c.kayit_adi || "").trim() || "");
                          }}
                        >
                          {savingNameId === c.id ? "Kaydediliyor..." : (c.kayit_adi || "—")}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="text-gray-500 dark:text-gray-400 truncate">
                        {c.created_at ? (() => {
                          try {
                            return new Date(c.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
                          } catch {
                            return "-";
                          }
                        })() : "-"}
                      </div>
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="text-gray-500 dark:text-gray-400 truncate">
                        {c.ise_giris ? (() => {
                          try {
                            return new Date(c.ise_giris).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
                          } catch {
                            return c.ise_giris;
                          }
                        })() : "-"}
                      </div>
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="text-gray-500 dark:text-gray-400 truncate">
                        {c.isten_cikis ? (() => {
                          try {
                            return new Date(c.isten_cikis).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
                          } catch {
                            return c.isten_cikis;
                          }
                        })() : "-"}
                      </div>
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {c.net_toplam != null ? fmt.format(Number(c.net_toplam)) : "-"}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-medium overflow-visible whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 flex-shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/calculations/edit/${c.id}`);
                          }}
                          title="Düzenle"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(c);
                          }}
                          disabled={copyingId === c.id}
                          title="Kopyala"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(c.id);
                          }}
                          title="Sil"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {showUbgtReportModal && previewData && (
        <UbgtReportModal
          open={showUbgtReportModal}
          onClose={() => setShowUbgtReportModal(false)}
          ubgtTableData={previewData.periods || []}
          workerPeriods={previewData.workerPeriods || []}
          selectedHolidayCount={previewData.selectedHolidays?.length || 0}
          totalHolidayDays={previewData.calculatedUbgtDays || 0}
          ubgtExpiryStart={previewData.zamanasimi?.start || null}
        />
      )}

    </Card>
  );
}
