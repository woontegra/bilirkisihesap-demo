import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { AccidentWizardProvider } from "@/context/AccidentWizardContext";
import { AuthProvider } from "@/context/AuthContext";
import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import { ToastProvider } from "@/context/ToastContext";
import { CaseProvider } from "@/contexts/CaseContext";
import { setupGlobalErrorHandler } from "@/utils/errorLogger";

// Canlıda (production) console.log / debug / info'yu kapat; sadece lokalde görünsün
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// Initialize global error handler
setupGlobalErrorHandler();

// DEMO: Force light mode - no dark theme, no localStorage/system detection
document.documentElement.classList.remove("dark");

// Ensure tenant_id is set to 1 if not exists (tenant 1 is always admin)
if (!localStorage.getItem("tenant_id")) {
  localStorage.setItem("tenant_id", "1");
}

const client = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <KaydetProvider>
            <CaseProvider>
              <AccidentWizardProvider>
                <App />
              </AccidentWizardProvider>
            </CaseProvider>
          </KaydetProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
