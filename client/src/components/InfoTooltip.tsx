import { useState, useRef, useEffect, useId } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

/**
 * Small inline info icon (ⓘ) that shows a tooltip on hover, focus, or tap.
 * Accessible: keyboard focus reveals tooltip; aria-label on trigger.
 */
export function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const tooltipId = useId();

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex items-center align-middle"
    >
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        style={{ width: 14, height: 14 }}
        aria-label="Info"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute z-[9999] left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 text-xs font-normal text-white bg-gray-900 dark:bg-gray-800 rounded shadow-lg whitespace-normal max-w-[280px] text-left pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}
