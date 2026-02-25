import Layout from "@/components/Layout";
import { getVideoLink } from "@/config/videoLinks";
import { Button } from "@/components/ui/button";
import { Youtube } from "lucide-react";

export default function BasinIsIndependent() {
  const videoLink = getVideoLink("fazla-basin-is");

  return (
    <Layout 
      title="Basın İşçileri Fazla Mesai"
      description="Basın İşçileri Fazla Mesai Hesaplama"
      rightSlot={videoLink ? (
        <Button
          onClick={() => window.open(videoLink, "_blank")}
          variant="outline"
          size="sm"
          className="gap-2 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400"
        >
          <Youtube className="h-4 w-4" />
          Kullanım Videosu İzle
        </Button>
      ) : undefined}
    >
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-8 max-w-2xl mx-auto px-4">
          {/* Animated Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full border-4 border-white dark:border-gray-900 flex items-center justify-center">
                <span className="text-xl">✨</span>
              </div>
            </div>
          </div>

          {/* Title with Gradient */}
          <div className="w-full space-y-6">
            <h1 className="text-6xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
              ÇOK YAKINDA
            </h1>
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"></div>
          </div>

          {/* Description */}
          <div className="space-y-4 text-gray-600 dark:text-gray-400">
            <p className="text-lg font-medium">
              🚀 Bu sayfa üzerinde yoğun çalışmalarımız devam ediyor.
            </p>
            <p className="text-base">
              💎 En kısa sürede muhteşem özelliklerle hizmetinize sunulacaktır.
            </p>
          </div>

          {/* Status Badge */}
          <div className="pt-6">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full border-2 border-blue-200 dark:border-blue-700">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Geliştirme Aşamasında
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
