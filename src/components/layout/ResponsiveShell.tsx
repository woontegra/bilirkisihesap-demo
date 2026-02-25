import { ReactNode, useState, useEffect, createContext, useContext } from "react";
import { Menu, X } from "lucide-react";
import "./ResponsiveShell.css";

// Context for sidebar state
const SidebarContext = createContext<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
} | null>(null);

export const useResponsiveSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useResponsiveSidebar must be used within ResponsiveShell");
  }
  return context;
};

// Hamburger button component (can be used anywhere inside ResponsiveShell)
export function HamburgerButton({ className = "" }: { className?: string }) {
  const { isSidebarOpen, toggleSidebar } = useResponsiveSidebar();
  
  return (
    <button
      data-hamburger
      onClick={toggleSidebar}
      className={`
        lg:hidden
        p-2
        rounded-md
        hover:bg-gray-100 dark:hover:bg-gray-700
        transition-colors
        ${className}
      `}
      aria-label="Toggle menu"
    >
      {isSidebarOpen ? (
        <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
      ) : (
        <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
      )}
    </button>
  );
}

interface ResponsiveShellProps {
  children: ReactNode;
  title?: string;
  headerActions?: ReactNode;
  sidebarContent?: ReactNode;
  showSidebar?: boolean;
  showFooter?: boolean;
  showHeader?: boolean;
}

/**
 * ResponsiveShell - Merkezi Layout Yöneticisi
 * 
 * ============================================
 * BREAKPOINT: 1024px (lg)
 * ============================================
 * - <1024px: Mobile/Tablet
 *   - Hamburger menu görünür
 *   - Sidebar overlay (fixed, z-50)
 *   - Content full-width
 *   - Footer static (fixed değil)
 * 
 * - ≥1024px: Desktop
 *   - Hamburger menu gizli
 *   - Sidebar fixed offset (256px)
 *   - Content margin-left: 256px
 *   - Footer static
 * 
 * ============================================
 * COMPONENT YAPISI:
 * ============================================
 * 1. Hamburger Button (mobil/tablet)
 * 2. Sidebar (overlay veya fixed)
 * 3. Header (sticky)
 * 4. Content (main)
 * 5. Footer (static, en altta)
 */
export default function ResponsiveShell({
  children,
  title = "",
  headerActions,
  sidebarContent,
  showSidebar = true,
  showFooter = true,
  showHeader = true,
}: ResponsiveShellProps) {
  // Sidebar state (mobile/tablet için)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sidebar toggle
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar on outside click (mobile/tablet)
  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Sidebar veya hamburger butonuna tıklandıysa kapatma
      if (
        target.closest('[data-sidebar]') ||
        target.closest('[data-hamburger]')
      ) {
        return;
      }
      setIsSidebarOpen(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isSidebarOpen]);

  // Close sidebar on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Body scroll lock when sidebar open (mobile/tablet)
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar }}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* ============================================
          SIDEBAR
          - <1024px: Overlay (fixed, z-50)
          - ≥1024px: Fixed offset (w-56)
          ============================================ */}
      {showSidebar && sidebarContent && (
        <>
          {/* Backdrop - Sadece mobile/tablet ve sidebar açıkken */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            data-sidebar
            className={`
              fixed top-0 left-0 bottom-0
              w-56
              bg-white dark:bg-gray-900
              border-r border-gray-200 dark:border-gray-800
              z-50
              transition-transform duration-300
              overflow-y-auto
              
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              lg:translate-x-0
            `}
          >
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ============================================
          MAIN CONTAINER
          - Desktop: margin-left offset (sidebar varsa)
          - Mobile/Tablet: full-width
          ============================================ */}
      <div
        className={`
          flex flex-col min-h-screen
          transition-all duration-300
          ${showSidebar ? 'lg:ml-56' : ''}
        `}
      >
        {/* ============================================
            HEADER (Sticky)
            - Hamburger button (mobile/tablet)
            - Title
            - Actions
            - showHeader={false} ile gizlenebilir
            ============================================ */}
        {showHeader && (
          <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 gap-4">
              {/* Left: Hamburger + Title */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Hamburger Button - Sadece mobile/tablet (<1024px) */}
                {showSidebar && (
                  <button
                    data-hamburger
                    onClick={toggleSidebar}
                    className="
                      lg:hidden
                      p-2
                      rounded-md
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors
                    "
                    aria-label="Toggle menu"
                  >
                    {isSidebarOpen ? (
                      <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                    ) : (
                      <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                    )}
                  </button>
                )}

                {/* Title */}
                {title && (
                  <h1 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {title}
                  </h1>
                )}
              </div>

              {/* Right: Actions */}
              {headerActions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {headerActions}
                </div>
              )}
            </div>
          </header>
        )}

        {/* ============================================
            MAIN CONTENT
            - Responsive padding
            - Max-width: 1440px
            - Centered
            ============================================ */}
        <main className="flex-1 w-full">
          <div
            className="
              w-full
              min-w-0
              max-w-[1400px]
              mx-auto
              px-4
              sm:px-6
              lg:px-10
              py-10
            "
          >
            {children}
          </div>
        </main>

        {/* ============================================
            FOOTER (Static - NOT Fixed)
            - En altta, scroll ile birlikte
            - showFooter={false} ile gizlenebilir
            ============================================ */}
        {showFooter && (
          <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4">
            <div
              className="
                w-full
                max-w-[1400px]
                mx-auto
                px-4
                sm:px-6
                lg:px-10
              "
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div>
                  Beta Sürüm | Mercan Danışmanlık © 2025
                </div>
                <div>
                  v1.0.0
                </div>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
    </SidebarContext.Provider>
  );
}
