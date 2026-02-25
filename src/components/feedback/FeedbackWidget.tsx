import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedbackApi } from "@/utils/feedbackApi";
import { useToast } from "@/context/ToastContext";
import { Star, MessageCircle } from "lucide-react";

const CLOSED_TITLE = "Bir dakikan var mı?";
const CLOSED_SUBTITLE = "Programla ilgili fikrini duymak isteriz.";
const TEXTAREA_PLACEHOLDER = "Geliştirilmesini istediğiniz bir nokta varsa yazabilirsiniz";
const SUBMIT_LABEL = "Gönder";
const NOT_NOW_LABEL = "Şimdi değil";

type FeedbackWidgetProps = {
  visible: boolean;
  onDismiss: () => void;
  userId: number | null;
  isDemo: boolean;
  demoSessionId: string | null;
};

export function FeedbackWidget({
  visible,
  onDismiss,
  userId,
  isDemo,
  demoSessionId,
}: FeedbackWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { success: showSuccessToast } = useToast();

  useEffect(() => {
    if (visible) {
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setMounted(false);
  }, [visible]);

  const handleNotNow = () => {
    setExpanded(false);
    onDismiss();
  };

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    try {
      await submitFeedbackApi({
        rating,
        comment: comment.trim() || undefined,
        pageOrContext: window.location.pathname || undefined,
        demoSessionId: isDemo ? demoSessionId ?? undefined : undefined,
      });
      showSuccessToast("Teşekkürler 🙏");
      onDismiss();
      setExpanded(false);
    } catch {
      // Keep open on error
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[9997] flex flex-col items-end gap-0"
      style={{ width: "min(320px, calc(100vw - 2rem))" }}
      role="region"
      aria-label="Geri bildirim"
    >
      <div
        className={`w-full rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-[220ms] ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
        style={{
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Geri bildirim ver"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {CLOSED_TITLE}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {CLOSED_SUBTITLE}
              </p>
            </div>
          </button>
        ) : (
          <div className="p-4">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Puanınız
            </p>
            <div className="flex gap-0.5 mb-4" role="group" aria-label="1–5 yıldız">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                  aria-label={`${star} yıldız`}
                  aria-pressed={rating >= star}
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      rating >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300 dark:text-gray-600"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={TEXTAREA_PLACEHOLDER}
              rows={2}
              className="resize-none text-sm mb-4 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50"
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSubmit}
                disabled={rating < 1 || rating > 5 || submitting}
                className="w-full"
              >
                {submitting ? "Gönderiliyor…" : SUBMIT_LABEL}
              </Button>
              <button
                type="button"
                onClick={handleNotNow}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-0.5 self-center"
              >
                {NOT_NOW_LABEL}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
