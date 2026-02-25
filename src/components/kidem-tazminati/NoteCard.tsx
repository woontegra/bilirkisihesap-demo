import React from 'react';
import { cn } from '@/lib/utils';

interface NoteCardProps {
  title: string;
  content: string;
  className?: string;
}

export default function NoteCard({ title, content, className = '' }: NoteCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 p-4 md:p-6 shadow-sm hover:shadow-md transition-all duration-200",
        className
      )}
    >
      <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h4>
      <p className="text-sm text-gray-900 dark:text-gray-100">{content}</p>
    </div>
  );
}
