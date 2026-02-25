import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeviceLimitExceededModalProps {
  open: boolean;
}

export default function DeviceLimitExceededModal({ open }: DeviceLimitExceededModalProps) {
  const navigate = useNavigate();

  // Prevent ESC key from closing
  useEffect(() => {
    if (open) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [open]);

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("current_user");
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("licenseValid");
    localStorage.removeItem("professionalLicenseKey");
    localStorage.removeItem("licenseExpiry");
    localStorage.removeItem("deviceUUID");
    
    // Navigate to login
    navigate("/login");
  };

  const handleClose = () => {
    // Close program - in browser, this means closing the tab/window
    // In a desktop app, this would close the application
    if (window.confirm("Programı kapatmak istediğinize emin misiniz?")) {
      window.close();
      // If window.close() doesn't work (some browsers block it), try:
      // window.location.href = "about:blank";
    }
  };

  return (
    <Dialog open={open} modal={true}>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with ESC
          e.preventDefault();
        }}
        hideCloseButton={true}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Cihaz Limiti Aşıldı
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            Bu lisans başka bir cihazda aktif.
            <br />
            Aynı anda yalnızca tek cihazda kullanılabilir.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 py-6 text-lg"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Çıkış Yap
          </Button>
          
          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 py-6 text-lg"
          >
            <X className="w-5 h-5 mr-2" />
            Programı Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
