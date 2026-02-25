import { ReactNode } from "react";

/** Tüm sayfaları saran standart içerik container'ı */
export default function AppLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}




