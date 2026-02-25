/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

/**
 * NotCard - Pure Presentational Component
 *
 * ÖNEMLİ:
 * - HESAPLAMA YOK
 * - State YOK
 * - Hook YOK
 * - AŞAĞIDAKİ METİN KULLANICIDAN GELDİĞİ HALİYLE
 *   TEK HARF DEĞİŞTİRİLMEDEN YERLEŞTİRİLMİŞTİR
 */

export default function NotCard() {
  return (
    <div className="mt-6">
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Başlık */}
        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm">📝</span>
            </div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Notlar
            </h3>
          </div>
        </div>

        {/* İçerik */}
        <div className="p-4 max-h-[420px] overflow-y-auto space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed notes-content">

          <Section icon="📌">
            Fazla çalışma alacağının hesaplanmasında birden fazla değişken dikkate alınmaktadır.
            Hesaplama süreci, öncelikle işçinin fiili çalışma döneminin belirlenmesi ile başlamakta olup;
            bu kapsamda davacının işe giriş ve işten ayrılış tarihleri esas alınarak çalışma aralığı
            tespit edilmektedir.
          </Section>

          <Section icon="💰">
            Ücret hesabına esas olmak üzere işçinin çıplak brüt ücreti dikkate alınmakta;
            bu ücretin tespit edilememesi hâlinde ilgili dönem için geçerli olan asgari ücret üzerinden
            hesaplama yapılmaktadır. Ayrıca bilinen ücretin asgari ücretin üzerinde olması ve geçmiş
            dönem ücret bilgilerinin bulunmaması hâlinde, sistem içerisinde yer alan katsayı hesaplama
            modülü aracılığıyla ücret çarpanı belirlenerek geçmiş dönem ücretlerinin oransal şekilde
            hesaplanabilmesine imkân tanınmaktadır.
          </Section>

          <Section icon="⏱️">
            Fazla mesai saatlerinin belirlenmesinde günlük fiili çalışma süresi esas alınmaktadır.
            Günlük çalışma süresi, işçinin işe giriş saati ile işten çıkış saati arasındaki sürenin
            tespiti ve bu süreden 4857 sayılı İş Kanunu'nun 68. maddesi kapsamında öngörülen ara dinlenme
            sürelerinin düşülmesi suretiyle hesaplanmaktadır.
          </Section>

          <Section icon="📈">
            Uzun süreli fiili çalışmalarda (özellikle 11 saat ve üzeri çalışmalarda) ara dinlenme süresi
            kademeli olarak artırılmakta (örneğin 1,5 saat ve üzeri) ve net günlük çalışma süresi bu
            şekilde belirlenmektedir.
          </Section>

          <Section icon="🗓️">
            Net günlük çalışma süresi, haftalık çalışma günü sayısı ile çarpılarak haftalık fiili
            çalışma süresine ulaşılmakta; çıkan çalışma süresinden haftalık yasal çalışma süresi olan
            45 saat çıkarılarak haftalık fazla çalışma süresi hesap edilmektedir.
          </Section>

          <Section icon="⚠️">
            İşçinin haftada 7 gün çalıştığına ilişkin iddia bulunması ve ayrıca hafta tatili ücreti
            talebinin mevcut olması hâlinde, hesaplamada hafta tatili günü ayrıca ele alınmakta;
            haftalık fazla çalışma hesabı yapılırken:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Günlük 7,5 saatlik yasal çalışma süresi dışlanmakta,</li>
              <li>6 günlük fiili çalışma toplamı esas alınmakta,</li>
              <li>
                Bu toplamdan haftalık 45 saatlik yasal çalışma süresi çıkarılarak haftalık fazla
                mesai süresi belirlenmektedir.
              </li>
            </ul>
            <div className="mt-2">
              Hafta tatiline denk gelen 1 günlük çalışma ise ayrıca hesaplama konusu yapılmaktadır.
            </div>
          </Section>

          <Section icon="🔄">
            Vardiyalı çalışma, gece çalışması ve farklı günlerde değişken süreli çalışmalar bakımından
            hesaplama işlemleri, sistem içerisinde ayrı hesaplama modülleri üzerinden yürütülmektedir.
          </Section>

          <Section icon="📋">
            Hesaplama sürecinde;
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>İşçinin kullandığı yıllık izin günleri,</li>
              <li>Ücretli veya ücretsiz izin süreleri,</li>
              <li>Sağlık raporu nedeniyle çalışılmayan günler vb.</li>
            </ul>
            <div className="mt-2">
              istenildiği takdirde toplam çalışma süresinden dışlanarak hesaplama yapılabilmektedir.
            </div>
          </Section>

          <Section icon="⏳">
            Ayrıca zamanaşımı bakımından ilgili dönemlerin ayrıştırılması suretiyle hesaplama
            yapılmasına imkân tanınmaktadır.
          </Section>

          <Section icon="⚖️">
            İş sözleşmesinde fazla çalışma ücretinin aylık ücrete dâhil olduğuna ilişkin hüküm bulunan
            işçiler bakımından, sistem içerisinde yıllık 270 saatlik fazla çalışma süresinin
            dışlanmasına yönelik seçenekli hesaplama yöntemleri yer almaktadır. Bu kapsamda;
            <ul className="list-disc ml-5 mt-2 space-y-2">
              <li>
                İşçinin iş akdinin başlangıcından itibaren toplam 270 saatin tek seferde dışlanması
                (işçinin iş akdinin başlangıç tarihinden itibaren haftalık fazla mesai hesaplamasının
                dışlanarak kalan haftalar için fazla mesai saati hesaplaması yapılması; 270 /
                hesaplanan haftalık fazla mesai saati = çıkan hafta sayısının, iş akdinin başlangıç
                tarihine ilişkin oluşturulan birer yıllık dönem başlangıçlarından itibaren
                dışlanması; kalan haftalar bakımından hesaplama yapılması),
              </li>
              <li>
                Ya da kalan 270/52 hafta= 5,2 fazla çalışma saati haftalık fazla çalışma saatinden
                dışlanmak suretiyle 270 saatlik dışlama uygulanmasına yer verilmiştir.
                ( T.C. Yargıtay 9. Hukuk Dairesi'nin 31.05.2023 tarih, E. 2023/4285, K. 2023/8376 sayılı
                kararında; "...İş sözleşmelerinde fazla çalışma ücretinin aylık ücrete dâhil olduğu
                yönündeki kurallara sınırlı olarak değer verilmelidir. Dairemizin kararlılık kazanmış
                olan uygulamasına göre yıllık 270 saatle sınırlı olarak söz konusu hükümlerin geçerli
                olduğu kabul edilmektedir. Fazla çalışmaların aylık ücret içinde ödendiğinin
                öngörülmesi ve buna uygun ödeme yapılması hâlinde, yıllık 270 saatlik fazla çalışma
                süresinin (aylık 22,5 saat, haftalık 5,2 saat) ispatlanan fazla çalışmalardan
                indirilmesi gerekir...")
              </li>
            </ul>
          </Section>

          <Section icon="📚">
            Hakkaniyet indirimi yönünden, ilgili yargı kararları doğrultusunda belirlenen 1/3
            oranındaki indirim, sistem tarafından otomatik olarak uygulanabilmektedir. Bu kapsamda
            Yargıtay Hukuk Genel Kurulu'nun 15.04.2021 tarih, 2016/(7)9-2387 Esas, 2021/504 Karar sayılı
            ilamı doğrultusunda indirim hesaplaması sistem içerisinde yer almaktadır.
          </Section>

          <Section icon="🔁">
            İşçiye ödenmiş fazla mesai ücretlerinin mevcut olması hâlinde; mahsup ve dönemsel
            ayrıştırmalar bakımından işçinin işe giriş ve işten çıkış tarihleri arasındaki sürede
            12'şer aylık periyotlar hâlinde ayrı ayrı hesaplama tablolarına veri girişi yapılabilmesine
            olanak sağlanmaktadır.
          </Section>

          <Section icon="💳">
            Ücret hesaplamalarında brüt tutardan net tutara geçiş süreci sistem tarafından otomatik
            olarak gerçekleştirilmekte olup; bu kapsamda:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Gelir vergisi oranları,</li>
              <li>Hesaplama yapılan yılın vergi dilimleri,</li>
              <li>Kademeli vergi sistemi</li>
            </ul>
            <div className="mt-2">
              dikkate alınarak net ücret hesaplaması yapılmaktadır.
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm">
        {icon}
      </div>
      <div>{children}</div>
    </div>
  );
}
