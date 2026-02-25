import React, { ReactNode } from "react";
import { usePageStyle } from "../localHooks/usePageStyle";

type Props = {
  title?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  fluid?: boolean;
  hideHeader?: boolean;
  pageKey?: Parameters<typeof usePageStyle>[0];
  noBackgroundColor?: boolean;
};

const toTitleCaseTr = (s: string) => {
  try {
    return s
      .split(/(\s+|[-–—])/)
      .map((part) => {
        if (/^(\s+|[-–—])$/.test(part)) return part;
        const lower = part.toLocaleLowerCase('tr-TR');
        return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
      })
      .join('');
  } catch {
    return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
};

export default function Layout({ 
  title = '', 
  rightSlot, 
  children, 
  fluid, 
  hideHeader = false, 
  pageKey, 
  noBackgroundColor = false 
}: Props) {
  const pageStyle = usePageStyle(pageKey);
  const Icon = pageStyle?.icon;

  if (hideHeader) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
        <div style={{ height: '4px', background: pageStyle?.color || '#6A1B9A' }}></div>
        <main className="w-full py-6" style={{ paddingBottom: '3.5rem' }}>
          <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8">
            <div className={`w-full mx-auto ${fluid ? 'max-w-none' : 'max-w-7xl'}`}>
              {children}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      {/* Page color indicator */}
      <div style={{ height: '4px', background: pageStyle?.color || '#6A1B9A' }}></div>
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className={`h-14 flex items-center justify-between gap-3 w-full min-w-0 px-4 sm:px-6 lg:px-8 ${!fluid ? 'max-w-7xl mx-auto' : ''}`}>
          {/* Title section */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
          </div>
          
          {/* Actions slot */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {rightSlot}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full py-6" style={{ paddingBottom: '3.5rem' }}>
        <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8">
          <div className={`w-full mx-auto ${fluid ? 'max-w-none' : 'max-w-7xl'}`}>
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative">
        <div className="fixed left-0 right-0 bottom-0 px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
          Beta Sürüm © 2025
        </div>
      </footer>
    </div>
  );
}
