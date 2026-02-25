import React, { ReactNode } from "react";
import { ToastProvider, Toaster } from "../localContext/ToastContext";

type Props = {
  title?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  fluid?: boolean;
  hideHeader?: boolean;
  noBackgroundColor?: boolean;
};

export default function Layout({ 
  title = '', 
  rightSlot, 
  children, 
  fluid, 
  hideHeader = false, 
}: Props) {
  const pageColor = '#1E88E5'; // Kıdem tazminatı rengi

  if (hideHeader) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
          <div style={{ height: '4px', background: pageColor }}></div>
          <main className="w-full py-6" style={{ paddingBottom: '3.5rem' }}>
            <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8">
              <div className={`w-full mx-auto ${fluid ? 'max-w-none' : 'max-w-7xl'}`}>
                {children}
              </div>
            </div>
          </main>
          <Toaster />
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
        <div style={{ height: '4px', background: pageColor }}></div>
        
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className={`h-14 flex items-center justify-between gap-3 w-full min-w-0 px-4 sm:px-6 lg:px-8 ${!fluid ? 'max-w-7xl mx-auto' : ''}`}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {rightSlot}
            </div>
          </div>
        </header>

        <main className="w-full py-6" style={{ paddingBottom: '3.5rem' }}>
          <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8">
            <div className={`w-full mx-auto ${fluid ? 'max-w-none' : 'max-w-7xl'}`}>
              {children}
            </div>
          </div>
        </main>

        <footer className="relative">
          <div className="fixed left-0 right-0 bottom-0 px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
            Beta Sürüm © 2025
          </div>
        </footer>
        <Toaster />
      </div>
    </ToastProvider>
  );
}
