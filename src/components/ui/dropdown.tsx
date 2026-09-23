import type { ComponentProps } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error(
      "Os subcomponentes do Dropdown devem ser usados dentro de <Dropdown.Root>",
    );
  }
  return context;
}

/* ==========================================================================
   Dropdown.Root
   ========================================================================== */
export interface DropdownRootProps extends ComponentProps<"div"> {}

export function DropdownRoot({
  className = "",
  children,
  ...props
}: DropdownRootProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, close }}>
      <div
        ref={containerRef}
        className={`relative inline-block ${className}`}
        {...props}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

/* ==========================================================================
   Dropdown.Trigger
   ========================================================================== */
export interface DropdownTriggerProps extends ComponentProps<"button"> {}

export function DropdownTrigger({
  className = "",
  onClick,
  onPointerDown,
  onDoubleClick,
  children,
  ...props
}: DropdownTriggerProps) {
  const { isOpen, setIsOpen } = useDropdown();

  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      onClick={(e) => {
        setIsOpen((prev) => !prev);
        onClick?.(e);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
      className={`cursor-pointer select-none inline-flex items-center bg-transparent border-none p-0 outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-md ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ==========================================================================
   Dropdown.Content
   ========================================================================== */
export interface DropdownContentProps extends ComponentProps<"div"> {
  align?: "left" | "right";
}

export function DropdownContent({
  align = "right",
  className = "",
  onPointerDown,
  onDoubleClick,
  children,
  ...props
}: DropdownContentProps) {
  const { isOpen } = useDropdown();

  if (!isOpen) return null;

  return (
    <div
      role="menu"
      tabIndex={-1}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
      className={`
        absolute top-full mt-1.5 z-50 min-w-[200px]
        bg-surface-2/95 backdrop-blur-md border border-border rounded-lg shadow-xl
        p-1 animate-in fade-in zoom-in-95 duration-150 select-none
        ${align === "right" ? "right-0" : "left-0"}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Dropdown.Item
   ========================================================================== */
export interface DropdownItemProps extends ComponentProps<"button"> {
  danger?: boolean;
}

export function DropdownItem({
  danger = false,
  className = "",
  disabled = false,
  onClick,
  children,
  ...props
}: DropdownItemProps) {
  const { close } = useDropdown();

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      data-danger={danger}
      onClick={(e) => {
        if (!disabled) {
          onClick?.(e);
          close();
        }
      }}
      className={`
        w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left
        transition-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed outline-none
        text-text/90 hover:bg-surface-3 hover:text-text
        data-[danger=true]:text-red-400 data-[danger=true]:hover:bg-red-950/40 data-[danger=true]:hover:text-red-300
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

/* ==========================================================================
   Dropdown.Icon
   ========================================================================== */
export interface DropdownIconProps extends ComponentProps<"span"> {}

export function DropdownIcon({
  className = "",
  children,
  ...props
}: DropdownIconProps) {
  return (
    <span className={`shrink-0 text-text-muted ${className}`} {...props}>
      {children}
    </span>
  );
}

/* ==========================================================================
   Dropdown.Separator
   ========================================================================== */
export interface DropdownSeparatorProps extends ComponentProps<"div"> {}

export function DropdownSeparator({
  className = "",
  ...props
}: DropdownSeparatorProps) {
  return (
    <div
      role="presentation"
      className={`h-px bg-border/60 my-1 mx-1 ${className}`}
      {...props}
    />
  );
}

/* ==========================================================================
   Dropdown.Label
   ========================================================================== */
export interface DropdownLabelProps extends ComponentProps<"div"> {}

export function DropdownLabel({
  className = "",
  children,
  ...props
}: DropdownLabelProps) {
  return (
    <div
      className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Namespaced Export (Compound Pattern)
   ========================================================================== */
export const Dropdown = {
  Root: DropdownRoot,
  Trigger: DropdownTrigger,
  Content: DropdownContent,
  Item: DropdownItem,
  Icon: DropdownIcon,
  Separator: DropdownSeparator,
  Label: DropdownLabel,
};
