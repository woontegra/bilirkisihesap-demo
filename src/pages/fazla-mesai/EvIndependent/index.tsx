import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Youtube } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";

export default function EvIsciFazlaMesaiPage() {
  const videoLink = getVideoLink("fazla-ev");

  return (
    <Layout
      title=""
      description="Ev İşçileri Fazla Mesai Hesaplama"
      hideHeader={true}
      fluid={true}
      pageKey="ev-isci-fazla-mesai"
      noBackgroundColor={false}
    >
      {videoLink && (
        <div className="flex justify-end px-4 sm:px-6 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Button
            onClick={() => window.open(videoLink, "_blank")}
            variant="outline"
            size="sm"
            className="gap-2 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400"
          >
            <Youtube className="h-4 w-4" />
            Kullanım Videosu İzle
          </Button>
        </div>
      )}
      <div className="p-4 md:p-6 lg:p-8 min-h-screen">
        <div className="w-full space-y-6">
          {/* Uyarı Kartı */}
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
              <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <CardTitle className="text-orange-900 dark:text-orange-100">
                  Önemli Bilgilendirme
                </CardTitle>
              </div>
              </CardHeader>
            <CardContent className="space-y-4 text-sm text-orange-800 dark:text-orange-200">
              <p className="leading-relaxed">
                Ev İşçileri bakımından yapılan hesaplamalarda işçinin çalışma hayatı ve ev hayatının birlikte olup olmamasına göre değerlendirme yapılması gerektiğine dair Yargıtay yerleşik içtihatlarının uygulanması halinde aşağıda verilen örneklemeler dahilinde ev ve çalışma hayatının iç içe geçtiği çalışmalarda fazla çalışma hesaplaması yapılıp yapılmaması gerektiğine ilişkin değerlendirme siz hukukçuların - profesyonellerin takdirine sunulur.
              </p>
              <p className="leading-relaxed">
                Ev ve çalışma hayatı ayrı olan fazla çalışmaların deliller ile ispatlandığı durumlarda standart hesaplama / Bilirkişi-1 hesaplama araçlarını kullanabilirsiniz.
              </p>
              </CardContent>
            </Card>

          {/* Yargıtay İçtihatları */}
          <Card>
            <CardHeader>
              <CardTitle>Yargıtay İçtihatları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 9. Hukuk Dairesi */}
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0">
                      <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-md text-xs font-semibold">
                        9. Hukuk Dairesi
        </div>
                </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-semibold">Esas:</span> 2016/28557 E.
                        <span className="ml-4 font-semibold">Karar:</span> 2016/16963 K.
          </div>
        </div>
      </div>

                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Gerekçe:</p>
                    <p className="leading-relaxed">
                      Davacının davalı ...'ın yönetim kurulu başkanı olduğu ... Şirketi'nde sigortalı olarak gösterilip Mevlüt'ün yazlık evinde çalıştığı, o evin müştemilatında ikamet ettiği, çalışma şekil ve şartları dikkate alındığında davacının ev ve çalışma hayatının iç içe geçtiği, bu tür çalışmada fazla mesai olamayacağının Dairemizin yerleşik bir içtihatı olduğu, kaldı ki davacının dahi çalışma saatleri konusunda bir açıklamasının bulunmadığı, anlaşıldığından fazla mesai alacağı talebinin reddi gerekirken kabulü hatalıdır.
                    </p>
                </div>
              </div>
              </div>

              {/* 22. Hukuk Dairesi */}
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0">
                      <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-md text-xs font-semibold">
                        22. Hukuk Dairesi
                        </div>
                  </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-semibold">Esas:</span> 2015/21212 E.
                        <span className="ml-4 font-semibold">Karar:</span> 2017/31087 K.
                </div>
                </div>
              </div>

                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Gerekçe:</p>
                    <p className="leading-relaxed mb-3">
                      Davacı işçinin fazla çalışma ücreti ile genel tatil ücreti ve hafta tatili ücretine hak kazanıp kazanmadığı hususu taraflar arasında uyuşmazlık konusudur.
                    </p>
                    <p className="leading-relaxed">
                      Somut olayda, mahkemece, davacının, haftalık ellialtıbuçuk saat fazla çalışma yaptığı, hafta tatili izni kullanmadığı ve genel tatil günlerinde çalıştığı kabul edilmiştir. Davacı, davalı ...'a ait evde 01.11.1997-17.04.2014 tarihleri arasında temizlik, ev ve bahçe bakımı ile bekçilik işlerinde çalışmıştır. Davacının çalışma şekli kendine özgü çalışma şartları olan, serbest zaman kullanma imkanı bulunan ve çalıştığı evin müştemilatında ikamet edilmesi sebebiyle özel hayat ve iş hayatının iç içe geçtiği bir çalışma biçimidir. Dosya kapsamında dinlenen davacı tanıklarının tamamının davacı ile birlikte çalışan kişiler olmadıkları ve davacının tam gün ve sürekli olarak çalışma yerinde kaldığından özel hayat ve iş hayatının iç içe geçtiği dikkate alındığında davacının fazla çalışma yaptığı, hafta tatili ve genel tatil günlerinde çalıştığı yeterli ve inandırıcı delillerle ispat edilemediğinden bu taleplerin reddi yerine kabulüne karar verilmesi usul ve kanuna aykırı olup bozmayı gerekmiştir.
                    </p>
                  </div>
                    </div>
                  </div>
            </CardContent>
          </Card>
                    </div>
    </div>
    </Layout>
  );
}
