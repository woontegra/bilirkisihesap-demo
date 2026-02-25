// Calculation type'a göre route mapping
export function getRouteForCalculationType(type: string, data?: any): string {
  const normalizedType = (type || "").toLowerCase().replace(/[_\s]/g, "_");
  
  // Bağımsız sayfalar
  if (normalizedType === "davaci_ucreti" || normalizedType === "davacı_ücreti" || normalizedType === "davaci_ucreti_hesaplama") {
    return "/davaci-ucreti";
  }
  if (normalizedType === "ucret_alacagi" || normalizedType === "ücret_alacağı" || normalizedType === "ucret") {
    return "/ucret-alacagi";
  }
  if (normalizedType === "bakiye_ucret_alacagi" || normalizedType === "bakiye_ücret_alacağı" || normalizedType === "bakiye_ucret") {
    return "/bakiye-ucret-alacagi";
  }
  if (normalizedType === "prim_alacagi" || normalizedType === "prim_alacağı" || normalizedType === "prim") {
    return "/prim-alacagi";
  }
  if (normalizedType === "is_arama_izni" || normalizedType === "iş_arama_izni" || normalizedType.includes("is_arama") || normalizedType.includes("iş_arama")) {
    return "/is-arama-izni-ucreti";
  }
  
  // Hafta tatili alacağı
  if (normalizedType === "hafta_tatili_standart" || normalizedType === "hafta_tatili_standard") {
    return "/hafta-tatili-alacagi/standard";
  }
  if (normalizedType === "hafta_tatili_gemi_adami" || normalizedType === "hafta_tatili_gemi_adamı") {
    return "/hafta-tatili-alacagi/gemi-adami";
  }
  if (normalizedType === "hafta_tatili_alacagi" || normalizedType === "hafta_tatili" || normalizedType === "hafta_tatili_alacağı") {
    return "/hafta-tatili-alacagi";
  }
  
  // Diğer tazminatlar
  if (normalizedType === "kotu_niyet_tazminati" || normalizedType === "kötü_niyet_tazminatı" || normalizedType === "kotu_niyet") {
    return "/kotu-niyet-tazminati";
  }
  if (normalizedType === "bosta_gecen_sure_ucreti" || normalizedType === "boşta_geçen_süre_ücreti" || normalizedType === "bosta_gecen") {
    return "/bosta-gecen-sure-ucreti";
  }
  if (normalizedType === "ise_almama_tazminati" || normalizedType === "işe_başlatmama_tazminatı" || normalizedType === "ise_almama" || normalizedType === "işe_almama_tazminatı") {
    return "/ise-almama-tazminati";
  }
  if (normalizedType === "ayrimcilik_tazminati" || normalizedType === "ayrımcılık_tazminatı" || normalizedType === "ayrimcilik") {
    return "/ayrimcilik-tazminati";
  }
  if (normalizedType === "haksiz_fesih_tazminati" || normalizedType === "haksız_fesih_tazminatı" || normalizedType === "haksiz_fesih") {
    return "/haksiz-fesih-tazminati";
  }
  
  // Fazla mesai
  if (normalizedType.includes("fazla_mesai") || normalizedType.includes("fazla_mesai_alacagi")) {
    // ÖNEMLİ: Önce type içindeki spesifik kontrolleri yap (fazla_mesai_bilirkisi_1 gibi)
    // Bu kontroller pageType kontrolünden ÖNCE olmalı
    // Debug için log ekle
    console.log("[calculationRouter] Fazla Mesai kontrolü:", { 
      normalizedType, 
      includesBilirkisi1: normalizedType.includes("bilirkisi_1"),
      includesBilirkisi2: normalizedType.includes("bilirkisi_2")
    });
    
    // Dönemsel Haftalık - EN ÖNCE kontrol edilmeli
    if (normalizedType.includes("donemsel_haftalik") || normalizedType.includes("dönemsel_haftalık") || normalizedType.includes("donemsel-haftalik") || normalizedType.includes("dönemsel-haftalık")) {
      console.log("[calculationRouter] ✅ Dönemsel Haftalık route döndürülüyor");
      return "/fazla-mesai/donemsel-haftalik";
    }
    
    // Dönemsel - Dönemsel Haftalık'tan sonra kontrol edilmeli
    if (normalizedType.includes("donemsel") || normalizedType.includes("dönemsel")) {
      console.log("[calculationRouter] ✅ Dönemsel route döndürülüyor");
      return "/fazla-mesai/donemsel";
    }
    
    // Haftalık Karma - Dönemsel kontrollerinden sonra
    if (normalizedType.includes("haftalik_karma") || normalizedType.includes("haftalık_karma") || normalizedType.includes("haftalik-karma") || normalizedType.includes("haftalık-karma")) {
      console.log("[calculationRouter] ✅ Haftalık Karma route döndürülüyor");
      return "/fazla-mesai/haftalik-karma";
    }
    
    // Tanıklı Standart - Haftalık Karma'dan sonra kontrol edilmeli
    if (normalizedType.includes("tanikli_standart") || normalizedType.includes("tanıklı_standart") || normalizedType.includes("tanikli-standart") || normalizedType.includes("tanıklı-standart")) {
      console.log("[calculationRouter] ✅ Tanıklı Standart route döndürülüyor");
      return "/fazla-mesai/tanikli-standart";
    }
    
    // Fazla Mesai Bilirkişi 1
    if (normalizedType.includes("bilirkisi_1") || normalizedType.includes("bilirkişi_1")) {
      console.log("[calculationRouter] ✅ Fazla Mesai Bilirkişi 1 route döndürülüyor");
      return "/fazla-mesai/bilirkisi-1";
    }
    // Fazla Mesai Bilirkişi 2
    if (normalizedType.includes("bilirkisi_2") || normalizedType.includes("bilirkişi_2")) {
      console.log("[calculationRouter] ✅ Fazla Mesai Bilirkişi 2 route döndürülüyor");
      return "/fazla-mesai/bilirkisi-2";
    }
    
    // Data içinde pageType veya route bilgisi varsa onu kullan
    // İç içe yapıları kontrol et: data.pageType, data.form.pageType, data.data.form.pageType
    const pageTypeValue = data?.pageType || data?.route || data?.form?.pageType || data?.form?.route || data?.data?.form?.pageType || data?.data?.form?.route || data?.data?.pageType || data?.data?.route || "";
    if (pageTypeValue) {
      const pageType = String(pageTypeValue).toLowerCase();
      if (pageType.includes("donemsel-haftalik") || pageType.includes("dönemsel-haftalık") || pageType.includes("donemsel_haftalik") || pageType.includes("dönemsel_haftalık")) {
        return "/fazla-mesai/donemsel-haftalik";
      }
      if (pageType.includes("donemsel") || pageType.includes("dönemsel")) {
        return "/fazla-mesai/donemsel";
      }
      if (pageType.includes("haftalik-karma") || pageType.includes("haftalık-karma") || pageType.includes("haftalik_karma") || pageType.includes("haftalık_karma")) {
        return "/fazla-mesai/haftalik-karma";
      }
      if (pageType.includes("tanikli-standart") || pageType.includes("tanıklı-standart") || pageType.includes("tanikli_standart") || pageType.includes("tanıklı_standart")) {
        return "/fazla-mesai/tanikli-standart";
      }
      if (pageType.includes("bilirkisi-1") || pageType.includes("bilirkisi1") || pageType.includes("bilirkişi-1") || pageType.includes("bilirkişi1")) {
        return "/fazla-mesai/bilirkisi-1";
      }
      if (pageType.includes("bilirkisi-2") || pageType.includes("bilirkisi2") || pageType.includes("bilirkişi-2") || pageType.includes("bilirkişi2")) {
        return "/fazla-mesai/bilirkisi-2";
      }
      if (pageType.includes("yeralti") || pageType.includes("yeraltı")) {
        return "/fazla-mesai/yeralti-isci";
      }
      if (pageType.includes("gece")) {
        return "/fazla-mesai/gece";
      }
      // Önce daha uzun eşleşmeleri kontrol et (48, 24, 12, sonra 8)
      if (pageType.includes("vardiya48") || pageType.includes("vardiya-48")) {
        return "/fazla-mesai/vardiya48";
      }
      if (pageType.includes("vardiya24") || pageType.includes("vardiya-24")) {
        return "/fazla-mesai/vardiya24";
      }
      if (pageType.includes("vardiya12") || pageType.includes("vardiya-12")) {
        return "/fazla-mesai/vardiya12";
      }
      if (pageType.includes("gemi")) {
        return "/fazla-mesai/gemi";
      }
      if (pageType.includes("ev")) {
        return "/fazla-mesai/ev";
      }
      if (pageType.includes("fazla-sure") || pageType.includes("fazla-süre") || pageType.includes("fazla_sure")) {
        return "/fazla-mesai/fazla-surelerle-calisma";
      }
      if (pageType.includes("standart")) {
        return "/fazla-mesai/standart";
      }
    }
    
    // Data içinde taniklar varsa ve davaci/davali varsa bilirkisi-1 olabilir
    if (data?.taniklar && Array.isArray(data.taniklar) && data.taniklar.length > 0) {
      if (data.davaci || data.davali) {
        return "/fazla-mesai/bilirkisi-1";
      }
    }
    
    // Type içinde spesifik tip kontrolü - fazla_mesai içeren durumlar için
    if (normalizedType.includes("fazla_mesai") && (normalizedType.includes("bilirkisi") || normalizedType.includes("bilirkişi"))) {
      if (normalizedType.includes("2") || normalizedType.includes("iki") || normalizedType.includes("_2")) {
        return "/fazla-mesai/bilirkisi-2";
      }
      if (normalizedType.includes("1") || normalizedType.includes("bir") || normalizedType.includes("_1")) {
        return "/fazla-mesai/bilirkisi-1";
      }
      return "/fazla-mesai/bilirkisi-1";
    }
    if (normalizedType.includes("yeralti") || normalizedType.includes("yeraltı")) {
      return "/fazla-mesai/yeralti-isci";
    }
    if (normalizedType.includes("vardiya")) {
      // Önce daha uzun eşleşmeleri kontrol et (48, 24, 12, sonra 8)
      // ÖNEMLİ: 48 kontrolü 8'den önce olmalı çünkü "48" string'i "8" içeriyor
      if (normalizedType.includes("48") || normalizedType.includes("_48")) {
        return "/fazla-mesai/vardiya48";
      }
      if (normalizedType.includes("24") || normalizedType.includes("_24")) {
        return "/fazla-mesai/vardiya24";
      }
      if (normalizedType.includes("12") || normalizedType.includes("_12")) {
        return "/fazla-mesai/vardiya12";
      }
    }
    if (normalizedType.includes("gemi")) {
      return "/fazla-mesai/gemi";
    }
    if (normalizedType.includes("ev")) {
      return "/fazla-mesai/ev";
    }
    if (normalizedType.includes("fazla_sure") || normalizedType.includes("fazla_süre")) {
      return "/fazla-mesai/fazla-surelerle-calisma";
    }
    if (normalizedType.includes("standart")) {
      return "/fazla-mesai/standart";
    }
    return "/fazla-mesai/standart";
  }
  
  // UBGT - Fazla Mesai kontrollerinden SONRA kontrol edilmeli (fazla_mesai_bilirkisi ile karışmaması için)
  if (normalizedType === "ubgt_bilirkisi" || normalizedType === "ubgt_alacagi_bilirkisi" || (normalizedType.includes("ubgt") && normalizedType.includes("bilirkisi") && !normalizedType.includes("fazla_mesai"))) {
    return "/ubgt-bilirkisi";
  }
  if (normalizedType === "ubgt_alacagi" || normalizedType === "ubgt") {
    return "/ubgt-alacagi";
  }
  
  // Kıdem tazminatı
  if (normalizedType.includes("kidem") || normalizedType.includes("kıdem") || normalizedType.includes("kidem_tazminati")) {
    if (normalizedType.includes("30") || normalizedType.includes("30isci")) {
      return "/kidem-tazminati/30isci";
    }
    if (normalizedType.includes("borclar") || normalizedType.includes("borçlar")) {
      return "/kidem-tazminati/borclar";
    }
    if (normalizedType.includes("gemi")) {
      return "/kidem-tazminati/gemi";
    }
    if (normalizedType.includes("mevsimlik")) {
      return "/kidem-tazminati/mevsimlik";
    }
    if (normalizedType.includes("basin") || normalizedType.includes("basın")) {
      return "/kidem-tazminati/basin";
    }
    // Toplu İş Sözleşmesi kıdem tazminatı kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("toplu")) {
    //   return "/kidem-tazminati/toplu";
    // }
    if (normalizedType.includes("part") || normalizedType.includes("part_time")) {
      return "/kidem-tazminati/kismi-sureli";
    }
    // Parça Başı kıdem tazminatı kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("parca") || normalizedType.includes("parça")) {
    //   return "/kidem-tazminati/parca-basi";
    // }
    if (normalizedType.includes("kismi") || normalizedType.includes("kısmi")) {
      return "/kidem-tazminati/kismi-sureli";
    }
    if (normalizedType.includes("belirli") || normalizedType.includes("belirli_sureli")) {
      return "/kidem-tazminati/belirli-sureli";
    }
    return "/kidem-tazminati/30isci";
  }
  
  // İhbar tazminatı
  if (normalizedType.includes("ihbar") || normalizedType.includes("ihbar_tazminati")) {
    if (normalizedType.includes("30") || normalizedType.includes("30isci")) {
      return "/ihbar-tazminati/30isci";
    }
    if (normalizedType.includes("borclar") || normalizedType.includes("borçlar")) {
      return "/ihbar-tazminati/borclar";
    }
    if (normalizedType.includes("gemi")) {
      return "/ihbar-tazminati/gemi";
    }
    if (normalizedType.includes("mevsim")) {
      return "/ihbar-tazminati/mevsim";
    }
    if (normalizedType.includes("basin") || normalizedType.includes("basın")) {
      return "/ihbar-tazminati/basin";
    }
    // Toplu İş Sözleşmesi ihbar tazminatı kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("toplu")) {
    //   return "/ihbar-tazminati/toplu";
    // }
    // Part Time ihbar tazminatı kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("part")) {
    //   return "/ihbar-tazminati/part";
    // }
    // Parça Başı ihbar tazminatı kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("parca") || normalizedType.includes("parça")) {
    //   return "/ihbar-tazminati/parca";
    // }
    if (normalizedType.includes("kismi") || normalizedType.includes("kısmi")) {
      return "/ihbar-tazminati/kismi";
    }
    if (normalizedType.includes("belirli")) {
      return "/ihbar-tazminati/belirli";
    }
    return "/ihbar-tazminati/30isci";
  }
  
  // Yıllık izin
  if (normalizedType.includes("yillik") || normalizedType.includes("yıllık") || normalizedType.includes("izin") || normalizedType.includes("yillik_izin")) {
    if (normalizedType.includes("standart") || normalizedType.includes("30")) {
      return "/yillik-izin/standart";
    }
    if (normalizedType.includes("borclar") || normalizedType.includes("borçlar")) {
      return "/yillik-izin/borclar";
    }
    if (normalizedType.includes("gemi")) {
      return "/yillik-izin/gemi";
    }
    if (normalizedType.includes("mevsim")) {
      return "/yillik-izin/mevsim";
    }
    if (normalizedType.includes("basin") || normalizedType.includes("basın")) {
      return "/yillik-izin/basin";
    }
    // Toplu İş Sözleşmesi yıllık izin kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("toplu")) {
    //   return "/yillik-izin/toplu";
    // }
    // Part Time yıllık izin kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("part")) {
    //   return "/yillik-izin/part";
    // }
    // Parça Başı yıllık izin kaldırıldı - dosya projede kalıyor
    // if (normalizedType.includes("parca") || normalizedType.includes("parça")) {
    //   return "/yillik-izin/parca";
    // }
    if (normalizedType.includes("kismi") || normalizedType.includes("kısmi")) {
      return "/yillik-izin/kismi";
    }
    if (normalizedType.includes("belirli")) {
      return "/yillik-izin/belirli";
    }
    return "/yillik-izin/standart";
  }
  
  // Varsayılan
  return "/fazla-mesai/standart";
}


