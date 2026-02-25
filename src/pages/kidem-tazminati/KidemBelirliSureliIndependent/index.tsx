import React from "react";
import { ToastProvider, Toaster } from "@/context/ToastContext";
import { getVideoLink } from "@/config/videoLinks";
import { Youtube } from "lucide-react";

export default function KidemBelirliSureliIndependent() {
  const videoLink = getVideoLink("kidem-belirli");

  return (
    <ToastProvider>
      <div>
        <div style={{ height: "4px", background: "#1E88E5" }} />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: "80px" }}>
            {/* Header */}
            <div className="mb-8 flex justify-end">
              {videoLink && (
                <button
                  onClick={() => window.open(videoLink, "_blank")}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 bg-white border border-red-200 hover:border-red-300 transition-all"
                >
                  <Youtube className="w-4 h-4" />
                  Kullanım Videosu İzle
                </button>
              )}
            </div>

            {/* Ana Kart */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-8 sm:p-10 lg:p-12">
                <div className="text-gray-800 leading-relaxed" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt" }}>
                  <p className="text-justify mb-6">
                    4857 s. İş K. "Belirli ve belirsiz süreli iş sözleşmesi" başlıklı 11. Maddesinde; "İş ilişkisinin bir süreye bağlı olarak yapılmadığı halde sözleşme belirsiz süreli sayılır. Belirli süreli işlerde veya belli bir işin tamamlanması veya belirli bir olgunun ortaya çıkması gibi objektif koşullara bağlı olarak işveren ile işçi arasında yazılı şekilde yapılan iş sözleşmesi belirli süreli iş sözleşmesidir.
                  </p>

                  <p className="text-justify mb-6">
                    Belirli süreli iş sözleşmesi, esaslı bir neden olmadıkça, birden fazla üst üste (zincirleme) yapılamaz. Aksi halde iş sözleşmesi başlangıçtan itibaren belirsiz süreli kabul edilir.
                  </p>

                  <p className="text-justify mb-6">
                    Esaslı nedene dayalı zincirleme iş sözleşmeleri, belirli süreli olma özelliğini korurlar." Şeklinde düzenlenmiştir.
                  </p>

                  <p className="text-justify mb-6">
                    4857 s. İş K. "Belirli ve belirsiz süreli iş sözleşmesi ayırımın sınırları" başlıklı 12. Maddesinde; "Belirli süreli iş sözleşmesi ile çalıştırılan işçi, ayırımı haklı kılan bir neden olmadıkça, salt iş sözleşmesinin süreli olmasından dolayı belirsiz süreli iş sözleşmesiyle çalıştırılan emsal işçiye göre farklı işleme tâbi tutulamaz.
                  </p>

                  <p className="text-justify mb-6">
                    Belirli süreli iş sözleşmesi ile çalışan işçiye, belirli bir zaman ölçüt alınarak ödenecek ücret ve paraya ilişkin bölünebilir menfaatler, işçinin çalıştığı süreye orantılı olarak verilir. Herhangi bir çalışma şartından yararlanmak için aynı işyeri veya işletmede geçirilen kıdem arandığında belirli süreli iş sözleşmesine göre çalışan işçi için farklı kıdem uygulanmasını haklı gösteren bir neden olmadıkça, belirsiz süreli iş sözleşmesi ile çalışan emsal işçi hakkında esas alınan kıdem uygulanır.
                  </p>

                  <p className="text-justify mb-6">
                    Emsal işçi, işyerinde aynı veya benzeri işte belirsiz süreli iş sözleşmesiyle çalıştırılan işçidir. İşyerinde böyle bir işçi bulunmadığı takdirde, o işkolunda şartlara uygun bir işyerinde aynı veya benzer işi üstlenen belirsiz süreli iş sözleşmesiyle çalıştırılan işçi dikkate alınır." Şeklinde düzenlenmiştir.
                  </p>

                  <p className="text-justify mb-6">
                    1475 s. İş Kanunun (22.05.2003 tarihli 4857 s. İş Kanunun 120. Maddesi ile 14. Maddesi hariç diğer maddeleri yürürlükten kaldırılmıştır.) "Kıdem tazminatı" başlıklı 14. Maddesi; "(Değişik birinci fıkra: 29/7/1983 - 2869/3 md.) Bu Kanuna tabi işçilerin hizmet akitlerinin:
                  </p>

                  <p className="text-justify mb-4 pl-4">
                    1. İşveren tarafından bu Kanunun 17 nci maddesinin II numaralı bendinde gösterilen sebepler dışında,
                  </p>

                  <p className="text-justify mb-4 pl-4">
                    2. İşçi tarafından bu Kanunun 16 ncı maddesi uyarınca,
                  </p>

                  <p className="text-justify mb-4 pl-4">
                    3. Muvazzaf askerlik hizmeti dolayısıyle,
                  </p>

                  <p className="text-justify mb-4 pl-4">
                    4. Bağlı bulundukları kanunla veya Cumhurbaşkanlığı kararnamesiyle kurulu kurum veya sandıklardan yaşlılık, emeklilik veya malullük aylığı yahut toptan ödeme almak amacıyla;
                  </p>

                  <p className="text-justify mb-4 pl-4">
                    5. (Ek: 25/8/1999 - 4447/45 md.) 506 Sayılı Kanunun 60 ıncı maddesinin birinci fıkrasının (A) bendinin (a) ve (b) alt bentlerinde öngörülen yaşlar dışında kalan diğer şartları veya aynı Kanunun Geçici 81 inci maddesine göre yaşlılık aylığı bağlanması için öngörülen sigortalılık süresini ve prim ödeme gün sayısını tamamlayarak kendi istekleri ile işten ayrılmaları nedeniyle,
                  </p>

                  <p className="text-justify mb-6">
                    Feshedilmesi veya kadının evlendiği tarihten itibaren bir yıl içerisinde kendi arzusu ile sona erdirmesi veya işçinin ölümü sebebiyle son bulması hallerinde işçinin işe başladığı tarihten itibaren hizmet aktinin devamı süresince her geçen tam yıl için işverence işçiye 30 günlük ücreti tutarında kıdem tazminatı ödenir. Bir yıldan artan süreler için de aynı oran üzerinden ödeme yapılır.
                  </p>

                  <p className="text-justify mb-6">
                    (Değişik fıkralar: 17/10/1980 - 2320/1 md.):
                  </p>

                  <p className="text-justify mb-6">
                    İşçilerin kıdemleri, hizmet akdinin devam etmiş veya fasılalarla yeniden akdedilmiş olmasına bakılmaksızın aynı işverenin bir veya değişik işyerlerinde çalıştıkları süreler gözönüne alınarak hesaplanır. İşyerlerinin devir veya intikali yahut herhangi bir suretle bir işverenden başka bir işverene geçmesi veya başka bir yere nakli halinde işçinin kıdemi, işyeri veya işyerlerindeki hizmet akitleri sürelerinin toplamı üzerinden hesaplanır. 12/7/1975 tarihinden, itibaren işyerinin devri veya herhangi bir suretle el değiştirmesi halinde işlemiş kıdem tazminatlarından her iki işveren sorumludur. Ancak, işyerini devreden işverenlerin bu sorumlulukları işçiyi çalıştırdıkları sürelerle ve devir esnasındaki işçinin aldığı ücret seviyesiyle sınırlıdır. 12/7/1975 tarihinden evvel işyeri devrolmuş veya herhangi bir suretle el değiştirmişse devir mukavelesinde aksine bir hüküm yoksa işlemiş kıdem tazminatlarından yeni işveren sorumludur.
                  </p>

                  <p className="text-justify mb-6">
                    İşçinin birinci bendin 4 üncü fıkrası hükmünden faydalanabilmesi için aylık veya toptan ödemeye hak kazanmış bulunduğunu ve kendisine aylık bağlanması veya toptan ödeme yapılması için yaşlılık sigortası bakımından bağlı bulunduğu kuruma veya sandığa müracaat etmiş olduğunu belgelemesi şarttır. İşçinin ölümü halinde bu şart aranmaz.
                  </p>

                  <p className="text-justify mb-6">
                    T.C. Emekli Sandığı Kanunu ve Sosyal Sigortalar Kanununa veya yalnız Sosyal Sigortalar Kanununa tabi olarak sadece aynı ya da değişik kamu kuruluşlarında geçen hizmet sürelerinin birleştirilmesi suretiyle Sosyal Sigortalar Kanununa göre yaşlılık veya malullük aylığına ya da toptan ödemeye hak kazanan işçiye, bu kamu kuruluşlarında geçirdiği hizmet sürelerinin toplamı üzerinden son kamu kuruluşu işverenince kıdem tazminatı ödenir.
                  </p>

                  <p className="text-justify mb-6">
                    Yukarıda belirtilen kamu kuruluşlarında işçinin hizmet akdinin evvelce bu maddeye göre kıdem tazminatı ödenmesini gerektirmeyecek şekilde sona ermesi suretiyle geçen hizmet süreleri kıdem tazminatının hesabında dikkate alınmaz.
                  </p>

                  <p className="text-justify mb-6">
                    Ancak, bu tazminatın T.C. Emekli Sandığına tabi olarak geçen hizmet süresine ait kısmı için ödenecek miktar, yaşlılık veya malullük aylığının başlangıç tarihinde T.C. Emekli Sandığı Kanununun yürürlükteki hükümlerine göre emeklilik ikramiyesi için öngörülen miktardan fazla olamaz.
                  </p>

                  <p className="text-justify mb-6">
                    Bu maddede geçen kamu kuruluşları deyimi, genel, katma ve özel bütçeli idareler ile 468 sayılı Kanunun 4 üncü maddesinde sayılan kurumları kapsar.
                  </p>

                  <p className="text-justify mb-6">
                    Aynı kıdem süresi için bir defadan fazla kıdem tazminatı veya ikramiye ödenmez.
                  </p>

                  <p className="text-justify mb-6">
                    Kıdem tazminatının hesaplanması, son ücret üzerinden yapılır. Parça başı, akort, götürü veya yüzde usulü gibi ücretin sabit olmadığı hallerde son bir yıllık süre içinde ödenen ücretin o süre içinde çalışılan günlere bölünmesi suretiyle bulunacak ortalama ücret bu tazminatın hesabına esas tutulur.
                  </p>

                  <p className="text-justify mb-6">
                    Ancak, son bir yıl içinde işçi ücretine zam yapıldığı takdirde, tazminata esas ücret, işçinin işten ayrılma tarihi ile zammın yapıldığı tarih arasında alınan ücretin aynı süre içinde çalışılan günlere bölünmesi suretiyle hesaplanır.
                  </p>

                  <p className="text-justify mb-6">
                    (Değişik: 29/7/1983 – 2869/3 md.) 13 üncü maddesinde sözü geçen tazminat ile bu maddede yer alan kıdem tazminatına esas olacak ücretin hesabında 26 ncı maddenin birinci fıkrasında yazılı ücrete ilaveten işçiye sağlanmış olan para ve para ile ölçülmesi mümkün akdi ve kanundan doğan menfaatler de gözönünde tutulur. Kıdem tazminatının zamanında ödenmemesi sebebiyle açılacak davanın sonunda hakim gecikme süresi için, ödenmeyen süreye göre mevduata uygulanan en yüksek faizin ödenmesine hükmeder. İşçinin mevzuattan doğan diğer hakları saklıdır.
                  </p>

                  <p className="text-justify mb-6">
                    (Değişik: 17/10/1980 - 2320/1 md.) Bu maddede belirtilen kıdem tazminatı ile ilgili 30 günlük süre hizmet akidleri veya toplu iş sözleşmeleri ile işçi lehine değiştirilebilir.
                  </p>

                  <p className="text-justify mb-6">
                    (Değişik: 10/12/1982 - 2762/1 md.) Ancak, toplu sözleşmelerle ve hizmet akitleriyle belirlenen kıdem tazminatlarının yıllık miktarı, Devlet Memurları Kanununa tabi en yüksek Devlet memuruna 5434 sayılı T.C. Emekli Sandığı Kanunu hükümlerine göre bir hizmet yılı için ödenecek azami emeklilik ikramiyesini geçemez.
                  </p>

                  <p className="text-justify mb-6">
                    (Değişik fıkralar: 17/10/1980 - 2320/1 md.):
                  </p>

                  <p className="text-justify mb-6">
                    İşçinin ölümü halinde yukarıdaki hükümlere göre doğan tazminat tutarı, kanuni mirasçılarına ödenir.
                  </p>

                  <p className="text-justify mb-6">
                    Kıdem tazminatından doğan sorumluluğu işveren şahıslara veya sigorta şirketlerine sigorta ettiremez.
                  </p>

                  <p className="text-justify mb-6">
                    İşveren sorumluluğu altında ve sadece yaşlılık, emeklilik, malullük, ölüm ve toptan ödeme hallerine mahsus olmak kaydiyle Devlet veya kanunla veya Cumhurbaşkanlığı kararnamesiyle kurulu kurumlarda veya % 50 hisseden fazlası Devlete ait bir bankada veya bir kurumda işveren tarafından kıdem tazminatı ile ilgili bir fon tesis edilir.
                  </p>

                  <p className="text-justify mb-8">
                    Fon tesisi ile ilgili hususlar kanunla düzenlenir." Şeklinde düzenlenmiştir.
                  </p>

                  <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt" }}>Sonuç İtibariyle;</h3>

                  <p className="text-justify mb-6">
                    Belirli süreli iş sözleşmeleri, sözleşmede belirtilen sürenin dolması ile kendiliğinden sona ermektedir. Bu sona erme şekli, işçi ve işverenin tek taraflı tasarrufu ve/veya eylemine bağlı değildir. Taraflar arasında imza edile belirli süreli iş sözleşmeleri taraflar arasında ki ortak irade ve tasarruflarıyla belirlenmiş bir son bulma şeklidir.
                  </p>

                  <p className="text-justify mb-6">
                    Belirli süreli iş sözleşmesinin süresinin bitimi ile kendiliğinden sona ermesi hali, yukarıda 1475 sayılı Kanun&apos;un 14. maddesinde sayılan 7 ayrı kıdem tazminatı ödeme hallerine girmediğinden, belirli süreli iş sözleşmesiyle çalışan işçilere sürenin bitiminde kıdem tazminatı ödenmemektedir.
                  </p>

                  <p className="text-justify mb-8">
                    Bu hususlar dahilinde belirli süreli iş sözleşmesinde 1475 s. Kanunun 14. Maddesindeki şartlar oluşur ise kıdem tazminatı hesaplaması yapılabilmektedir.
                  </p>

                  <p className="text-justify font-semibold text-red-600" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt" }}>
                    Hesaplama yapılması gereken durumlarda diğer kıdem tazminatı hesaplama araçları ile hesaplama yapabilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </ToastProvider>
  );
}
