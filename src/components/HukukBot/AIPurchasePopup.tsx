import { X, ShoppingBag, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AIPurchasePopupProps {
  open: boolean;
  onClose: () => void;
}

export default function AIPurchasePopup({ open, onClose }: AIPurchasePopupProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const handlePurchase = () => {
    onClose();
    navigate('/profile/ai-packages');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md mx-4 animate-scaleIn">
        <div className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl shadow-2xl overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600"></div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>

          {/* Content */}
          <div className="p-8 pt-6">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                  <AlertCircle className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-xs">⚠️</span>
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-3">
              Soru Hakkınız Tükenmiştir
            </h2>

            {/* Description */}
            <p className="text-center text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              AI Hukuk Asistanını kullanmaya devam etmek için soru paketi satın almanız gerekiyor. 
              Farklı paket seçeneklerimizle ihtiyacınıza uygun olanı seçebilirsiniz.
            </p>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={handlePurchase}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
              >
                <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Paketleri Gör
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-4 px-6 rounded-xl transition-all duration-300"
              >
                Kapat
              </button>
            </div>

            {/* Info text */}
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
              💡 Paketler satın aldıktan sonra hemen kullanmaya başlayabilirsiniz
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </>
  );
}

















