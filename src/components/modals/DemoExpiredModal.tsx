import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ShoppingCart, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DemoExpiredModalProps {
  open: boolean;
}

export default function DemoExpiredModal({ open }: DemoExpiredModalProps) {
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

  const handlePurchase = () => {
    window.open("https://bilirkisihesap.com/satin-al", "_blank");
  };

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_user");
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("licenseValid");
    localStorage.removeItem("professionalLicenseKey");
    localStorage.removeItem("licenseExpiry");
    
    // Navigate to login
    navigate("/login");
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
        {/* Prevent close button from showing */}
        <style>{`
          [data-radix-dialog-content] button[aria-label="Close"] {
            display: none !important;
          }
        `}</style>
        
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Demo Süreniz Dolmuştur
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            Demo süreniz sona ermiştir. Devam etmek için lisans satın almanız gerekmektedir.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={handlePurchase}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-6 text-lg"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Satın Al
          </Button>
          
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 py-6 text-lg"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
