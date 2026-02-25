import React from 'react';
import { X } from 'lucide-react';

interface EklentiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (value: number) => void;
  title: string;
}

export default function EklentiModal({ isOpen, onClose, onApply, title }: EklentiModalProps) {
  const [value, setValue] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onApply(numValue);
      setValue('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:max-w-lg sm:w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mt-4">
              <label htmlFor="eklenti" className="block text-sm font-medium text-gray-700">
                Eklenecek Yüzde (%)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="eklenti"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Örn: 10"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Gireceğiniz yüzde, mevcut tutara eklenecektir.
              </p>
            </div>

            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="submit"
                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
              >
                Uygula
              </button>
              <button
                type="button"
                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                onClick={onClose}
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
