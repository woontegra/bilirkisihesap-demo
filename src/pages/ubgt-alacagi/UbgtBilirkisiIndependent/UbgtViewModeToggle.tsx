import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface UbgtViewModeToggleProps {
  onUbgtOpenModal: () => void;
}

export default function UbgtViewModeToggle({
  onUbgtOpenModal,
}: UbgtViewModeToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onUbgtOpenModal}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      <FileText className="w-4 h-4" />
      Hesap Görünümü
    </Button>
  );
}
