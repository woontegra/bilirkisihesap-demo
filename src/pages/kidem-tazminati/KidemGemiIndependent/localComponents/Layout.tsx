import React, { ReactNode } from "react";

type Props = {
  title?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  fluid?: boolean;
  hideHeader?: boolean;
  pageKey?: string;
  noBackgroundColor?: boolean;
};

const PAGE_COLOR = "#6A1B9A";

export default function Layout({
  rightSlot,
  children,
  fluid,
  hideHeader = false,
}: Props) {
  if (hideHeader) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
        <div style={{ height: "4px", background: PAGE_COLOR }} />
        <main className="w-full py-6" style={{ paddingBottom: "3.5rem" }}>
          <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8">
            <div className={`w-full mx-auto ${fluid ? "max-w-none" : "max-w-7xl"}`}>{children}</div>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <div style={{ height: "4px", background: PAGE_COLOR }} />
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className={`h-14 flex items-center justify-between gap-3 w-full min-w-0 px-4 sm:px-6 lg:px-8 ${!fluid ? "max-w-7xl mx-auto" : ""}`}>
          <div className="flex items-center gap-2 min-w-0 flex-1" />
          <div className="flex items-center gap-2 flex-shrink-0">{rightSlot}</div>
        </div>
      </header>
      <main className="w-full py-6" style={{ paddingBottom: "3.5rem" }}>
        <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8">
          <div className={`w-full mx-auto ${fluid ? "max-w-none" : "max-w-7xl"}`}>{children}</div>
        </div>
      </main>
    </div>
  );
}
