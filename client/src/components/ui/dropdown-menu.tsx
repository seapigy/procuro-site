import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

interface DropdownMenuProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  onClose?: () => void;
}

export function DropdownMenu({ children, trigger, onClose }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label="More options"
      >
        {trigger || <MoreVertical className="h-4 w-4" />}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-background shadow-lg z-50 py-1" style={{ opacity: 1 }}>
          {React.Children.map(children, (child, index) => {
            if (React.isValidElement(child)) {
              const originalOnClick = (child.props as any).onClick;
              return React.cloneElement(child as React.ReactElement<any>, {
                key: child.key || `menu-item-${index}`,
                onClick: () => {
                  originalOnClick?.();
                  handleClose();
                }
              });
            }
            return child;
          })}
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  title?: string;
}

export function DropdownMenuItem({ 
  children, 
  onClick, 
  className = '',
  variant = 'default',
  disabled = false,
  title
}: DropdownMenuItemProps) {
  const baseClasses = 'w-full text-left px-4 py-2 text-sm transition-colors';
  const cursorClass = disabled ? 'cursor-not-allowed' : 'cursor-pointer';
  const variantClasses = disabled
    ? 'text-gray-400 dark:text-gray-500 opacity-50'
    : variant === 'destructive' 
      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
      : 'hover:bg-accent hover:text-accent-foreground';

  return (
    <div
      onClick={() => {
        if (!disabled) {
          onClick?.();
        }
      }}
      className={`${baseClasses} ${cursorClass} ${variantClasses} ${className}`}
      title={title}
    >
      {children}
    </div>
  );
}

