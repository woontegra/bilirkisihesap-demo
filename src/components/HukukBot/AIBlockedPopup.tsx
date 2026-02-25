import { X, ShieldAlert, AlertTriangle } from 'lucide-react';

interface AIBlockedPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function AIBlockedPopup({ open, onClose }: AIBlockedPopupProps) {
  if (!open) return null;

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
          {/* Decorative gradient - Orange/Red for warning */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-red-600 to-pink-600"></div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors z-10"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>

          {/* Content */}
          <div className="p-8 pt-6">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <ShieldAlert className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-3">
              Bu Soru Yanıtlanamaz
            </h2>

            {/* Description */}
            <div className="space-y-3 mb-8">
              <p className="text-center text-gray-600 dark:text-gray-300 leading-relaxed">
                Bu konu yapay zeka ile yanıtlanamayacak kadar hukuki risk içermektedir.
              </p>
              
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                <p className="text-sm text-orange-800 dark:text-orange-200 leading-relaxed">
                  <strong>⚠️ Güvenlik Uyarısı:</strong><br />
                  Yapay zeka kesin hukuki görüş veremez, mahkeme kararı tahmin edemez ve 
                  hukuki yönlendirme yapamaz. Bu konuda mutlaka bir avukata danışmalısınız.
                </p>
              </div>
            </div>

            {/* Button */}
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Anladım
            </button>

            {/* Info text */}
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
              💡 Genel bilgi soruları için farklı şekilde sorabilir veya bir avukata danışabilirsiniz
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

















