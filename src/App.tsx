import { useEffect } from "react";
import { migrateScopedStorageKeysOnce } from "@/utils/storageKey";
import StandartIndependent from "@/pages/fazla-mesai/StandartIndependent";
import { Toaster } from "@/context/ToastContext";

function App() {
  // Set document title for the demo page
  useEffect(() => {
    document.title = "Bilirkişi Hesaplama | Standart Fazla Mesai";
  }, []);

  useEffect(() => {
    migrateScopedStorageKeysOnce([
      "wizardData",
      "kidem_autosave_fallback",
      "fm_page_state_v1",
    ]);
  }, []);

  // DEMO: Force light mode - ensure "dark" is never applied (no toggle, no detection)
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        boxSizing: "border-box",
        overflowX: "hidden",
        maxWidth: "100vw",
        position: "relative",
      }}
    >
      <div
        className="min-h-screen overflow-x-hidden max-w-full"
        style={{ boxSizing: "border-box" }}
      >
        <div
          className="w-full min-w-0 p-0"
          style={{ boxSizing: "border-box", minHeight: "100vh" }}
        >
          <div className="w-full max-w-[1400px] mx-auto">
            <StandartIndependent />
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
