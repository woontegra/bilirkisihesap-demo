/**
 * NoteCard.tsx
 * İhbar Tazminatı Borçlar Kanunu sayfası için notlar component'i
 */

const NOTE_ITEMS: string[] = [
  "Süreli fesih",
  "",
  "Madde 17 - Belirsiz süreli iş sözleşmelerinin feshinden önce durumun diğer tarafa bildirilmesi gerekir.",
  "",
  "İş sözleşmeleri;",
  "",
  "a) İşi altı aydan az sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak iki hafta sonra,",
  "",
  "b) İşi altı aydan birbuçuk yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak dört hafta sonra,",
  "",
  "c) İşi birbuçuk yıldan üç yıla kadar sürmüş olan işçi için, bildirimin diğer tarafa yapılmasından başlayarak altı hafta sonra,",
  "",
  "d) İşi üç yıldan fazla sürmüş işçi için, bildirim yapılmasından başlayarak sekiz hafta sonra,",
  "",
  "feshedilmiş sayılır.",
  "",
  "Bu süreler asgari olup sözleşmeler ile artırılabilir.",
  "",
  "Bildirim şartına uymayan taraf, bildirim süresine ilişkin ücret tutarında tazminat ödemek zorundadır.",
  "",
  "İşveren bildirim süresine ait ücreti peşin vermek suretiyle iş sözleşmesini feshedebilir.",
];

export default function NoteCard() {
  return (
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
      <div className="p-4 notes-content">
        <div className="text-sm text-slate-600 dark:text-slate-300 leading-snug space-y-0.5">
          {NOTE_ITEMS.map((item, index) => {
            if (item === "") return <span key={index} className="block h-0.5" aria-hidden />;
            const isHeading = item === "Süreli fesih" || item === "İş sözleşmeleri;";
            const isListItem = /^[a-d]\)/.test(item) || item === "feshedilmiş sayılır.";
            const isMadde = item.startsWith("Madde 17");
            
            if (isHeading) {
              return <p key={index} className="font-semibold text-slate-800 dark:text-slate-200 mt-1.5 first:mt-0">{item}</p>;
            }
            if (isListItem) {
              return <p key={index} className="pl-6">{item}</p>;
            }
            if (isMadde) {
              return <p key={index}>{item}</p>;
            }
            return <p key={index}>• {item}</p>;
          })}
        </div>
      </div>
    </div>
  );
}
