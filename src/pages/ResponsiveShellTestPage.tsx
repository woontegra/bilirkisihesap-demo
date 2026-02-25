/**
 * ResponsiveShell V2 Test Sayfası
 * 
 * Test edilecek özellikler:
 * ✅ Hamburger menu (mobile/tablet)
 * ✅ Sidebar overlay (<1024px)
 * ✅ Sidebar fixed (≥1024px)
 * ✅ Header sticky
 * ✅ Footer static
 * ✅ Content responsive padding
 * ✅ No horizontal scroll
 */

import ResponsiveShell from "@/components/layout/ResponsiveShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavLink } from "react-router-dom";
import UserMenu from "@/components/layout/UserMenu";
import { useAuth } from "@/context/AuthContext";
import { Moon, Sun, Bell } from "lucide-react";

// Mock Sidebar Content
function TestSidebar() {
  return (
    <div className="p-4 space-y-4">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Test Sidebar
      </div>
      <nav className="space-y-2">
        <NavLink
          to="#"
          className="block px-3 py-2 rounded-md text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
        >
          Dashboard
        </NavLink>
        <NavLink
          to="#"
          className="block px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          Kıdem Tazminatı
        </NavLink>
        <NavLink
          to="#"
          className="block px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          İhbar Tazminatı
        </NavLink>
        <NavLink
          to="#"
          className="block px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          Fazla Mesai
        </NavLink>
        <NavLink
          to="#"
          className="block px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          UBGT Alacağı
        </NavLink>
      </nav>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Sidebar scroll test için daha fazla içerik
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="py-2 text-xs text-gray-400">
            Test Item {i}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResponsiveShellTestPage() {
  const { user, logout } = useAuth();
  
  return (
    <ResponsiveShell
      title="ResponsiveShell V2 Test"
      sidebarContent={<TestSidebar />}
      headerActions={
        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle */}
          <button
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            <Sun className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          
          {/* Notifications */}
          <button
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          
          {/* User Menu */}
          <UserMenu user={user} logout={logout} />
        </div>
      }
    >
      {/* Breakpoint Indicator */}
      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30">
        <CardHeader>
          <CardTitle>📱 Breakpoint Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="block sm:hidden p-3 bg-orange-100 dark:bg-orange-900/30 rounded-md">
              <div className="font-bold text-orange-700 dark:text-orange-400">
                📱 XS: &lt;640px
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                Hamburger: ✅ Görünür | Sidebar: Overlay
              </div>
            </div>
            
            <div className="hidden sm:block md:hidden p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-md">
              <div className="font-bold text-yellow-700 dark:text-yellow-400">
                📱 SM: 640px-768px
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                Hamburger: ✅ Görünür | Sidebar: Overlay
              </div>
            </div>
            
            <div className="hidden md:block lg:hidden p-3 bg-amber-100 dark:bg-amber-900/30 rounded-md">
              <div className="font-bold text-amber-700 dark:text-amber-400">
                💻 MD: 768px-1024px
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-300 mt-1">
                Hamburger: ✅ Görünür | Sidebar: Overlay
              </div>
            </div>
            
            <div className="hidden lg:block xl:hidden p-3 bg-green-100 dark:bg-green-900/30 rounded-md">
              <div className="font-bold text-green-700 dark:text-green-400">
                🖥️ LG: 1024px-1280px
              </div>
              <div className="text-sm text-green-600 dark:text-green-300 mt-1">
                Hamburger: ❌ Gizli | Sidebar: Fixed Offset
              </div>
            </div>
            
            <div className="hidden xl:block 2xl:hidden p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                🖥️ XL: 1280px-1536px
              </div>
              <div className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">
                Hamburger: ❌ Gizli | Sidebar: Fixed Offset
              </div>
            </div>
            
            <div className="hidden 2xl:block p-3 bg-teal-100 dark:bg-teal-900/30 rounded-md">
              <div className="font-bold text-teal-700 dark:text-teal-400">
                🖥️ 2XL: ≥1536px
              </div>
              <div className="text-sm text-teal-600 dark:text-teal-300 mt-1">
                Hamburger: ❌ Gizli | Sidebar: Fixed Offset
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-sm">
            <div className="font-semibold mb-2">Test Talimatları:</div>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>1. Tarayıcı genişliğini değiştir</li>
              <li>2. Hamburger butonu &lt;1024px'de görünmeli</li>
              <li>3. Hamburger tıkla → Sidebar overlay açılmalı</li>
              <li>4. Backdrop tıkla → Sidebar kapanmalı</li>
              <li>5. ≥1024px'de sidebar otomatik görünmeli</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Grid Test */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🔲 Grid Responsive Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-gray-50 dark:bg-gray-800">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Card {i}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Mobile: Full width
                    <br />
                    Desktop: 1/3 width
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form Test */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📝 Form Responsive Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">İsim</label>
              <Input placeholder="Adınız" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Soyisim</label>
              <Input placeholder="Soyadınız" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input type="email" placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Telefon</label>
              <Input type="tel" placeholder="+90 555 123 4567" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2/3 - 1/3 Layout Test */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>📄 Main Content (2/3)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Bu alan desktop'ta 2/3 genişlikte, mobilde full-width.
              </p>
              <div className="space-y-4">
                <Input placeholder="Test Input 1" />
                <Input placeholder="Test Input 2" />
                <Input placeholder="Test Input 3" />
                <div className="flex gap-2">
                  <Button>Kaydet</Button>
                  <Button variant="outline">İptal</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>📌 Sidebar (1/3)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Bu alan desktop'ta 1/3 genişlikte, mobilde full-width.
              </p>
              <div className="space-y-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-sm">Not 1</div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-sm">Not 2</div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-sm">Not 3</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Test Checklist */}
      <Card className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle>✅ Test Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test1" />
              <label htmlFor="test1" className="text-sm">
                <strong>Hamburger Menu:</strong> &lt;1024px'de görünür, ≥1024px'de gizli
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test2" />
              <label htmlFor="test2" className="text-sm">
                <strong>Sidebar Overlay:</strong> Hamburger tıklandığında açılıyor
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test3" />
              <label htmlFor="test3" className="text-sm">
                <strong>Backdrop:</strong> Tıklandığında sidebar kapanıyor
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test4" />
              <label htmlFor="test4" className="text-sm">
                <strong>ESC Key:</strong> Sidebar kapanıyor
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test5" />
              <label htmlFor="test5" className="text-sm">
                <strong>Sidebar Fixed:</strong> ≥1024px'de sidebar otomatik görünür
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test6" />
              <label htmlFor="test6" className="text-sm">
                <strong>Header:</strong> Sticky, her ekranda düzgün
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test7" />
              <label htmlFor="test7" className="text-sm">
                <strong>Content:</strong> Max-width 1440px, centered (≥1024px)
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test8" />
              <label htmlFor="test8" className="text-sm">
                <strong>Footer:</strong> En altta, static (fixed değil)
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test9" />
              <label htmlFor="test9" className="text-sm">
                <strong>Horizontal Scroll:</strong> YOK (hiçbir ekranda)
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" id="test10" />
              <label htmlFor="test10" className="text-sm">
                <strong>Grid:</strong> Mobilde tek kolon, desktop'ta çoklu kolon
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extra Content for Footer Scroll Test */}
      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-sm text-gray-600 dark:text-gray-400">
        <p className="font-semibold mb-2">Footer Scroll Testi:</p>
        <p>Sayfayı aşağı kaydırın. Footer en altta static olmalı (fixed olmamalı).</p>
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3 bg-white dark:bg-gray-700 rounded">
              Extra content {i} - Footer scroll test için
            </div>
          ))}
        </div>
      </div>
    </ResponsiveShell>
  );
}
