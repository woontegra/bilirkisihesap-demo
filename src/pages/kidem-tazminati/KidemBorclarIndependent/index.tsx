import React from "react";
import { ToastProvider, Toaster } from "@/context/ToastContext";
import NoteCard from "./NoteCard";
import { getVideoLink } from "@/config/videoLinks";
import { Youtube } from "lucide-react";

export default function KidemBorclarIndependent() {
  const videoLink = getVideoLink("kidem-borclar");

  return (
    <ToastProvider>
      <div>
        <div style={{ height: "4px", background: "#1E88E5" }} />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: "80px" }}>
            {/* Header */}
            <div className="mb-8 flex justify-end">
              {videoLink && (
                <button
                  onClick={() => window.open(videoLink, "_blank")}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-full font-medium text-sm text-red-600 bg-white border border-red-200 hover:border-red-300 transition-all"
                >
                  <Youtube className="w-4 h-4" />
                  Kullanım Videosu İzle
                </button>
              )}
            </div>

            {/* Ana Kart */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div id="kidem-print" className="p-8">
                <NoteCard />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </ToastProvider>
  );
}
