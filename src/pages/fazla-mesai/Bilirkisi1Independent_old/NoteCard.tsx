interface NoteCardProps {
  isReadOnly?: boolean;
}

export default function NoteCard({ isReadOnly = false }: NoteCardProps) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border-[0.5px] border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b-[0.5px] border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="font-semibold text-xs text-slate-800 dark:text-slate-200 leading-tight">Notlar</h3>
        </div>
      </div>
      <div className="p-3 notes-content">
        <ul className="space-y-2 text-xs leading-tight">
            <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300 leading-tight">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px]">ℹ️</span>
              <span className="leading-tight">Arayüz statik form görünümündedir.</span>
            </li>
            <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300 leading-tight">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px]">⏱️</span>
              <span className="leading-tight">Tarih ve saat değişince hesaplamalar otomatik güncellenir.</span>
            </li>
            <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300 leading-tight">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-[10px]">📋</span>
              <span className="leading-tight">Tablo biçimi raporlara uygundur.</span>
            </li>
            <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300 leading-tight">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[10px]">💱</span>
              <span className="leading-tight">Rakamlar TR formatında gösterilir.</span>
            </li>
          </ul>
      </div>
    </div>
  );
}
