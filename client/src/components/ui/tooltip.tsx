import { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  const arrowClasses = {
    top: 'after:content-[""] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-800',
    bottom: 'after:content-[""] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-b-gray-900 dark:after:border-b-gray-800',
    left: 'after:content-[""] after:absolute after:left-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-l-gray-900 dark:after:border-l-gray-800',
    right: 'after:content-[""] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-r-gray-900 dark:after:border-r-gray-800',
  };

  return (
    <span className="relative inline-flex items-center group/tooltip">
      {children}
      <span
        className={`
          absolute z-[9999] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-gray-800 rounded shadow-lg
          pointer-events-none invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 
          transition-all duration-200 ease-in-out
          whitespace-normal max-w-[280px] text-center
          ${sideClasses[side]}
          ${arrowClasses[side]}
        `}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}

