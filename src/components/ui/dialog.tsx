import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext, useEffect, useRef } from "react";

/* ==========================================================================
   Dialog Context
   ========================================================================== */
interface DialogContextType {
  isOpen: boolean;
  onClose: () => void;
  preventClose?: boolean;
}

const DialogContext = createContext<DialogContextType | null>(null);

function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error(
      "Os subcomponentes do Dialog devem ser usados dentro de <Dialog.Root>",
    );
  }
  return context;
}

/* ==========================================================================
   Dialog.Root
   ========================================================================== */
export interface DialogRootProps {
  isOpen: boolean;
  onClose: () => void;
  preventClose?: boolean;
  children: ReactNode;
}

export function DialogRoot({
  isOpen,
  onClose,
  preventClose = false,
  children,
}: DialogRootProps) {
  return (
    <DialogContext.Provider value={{ isOpen, onClose, preventClose }}>
      {children}
    </DialogContext.Provider>
  );
}

/* ==========================================================================
   Dialog.Content (Elemento nativo <dialog>)
   ========================================================================== */
export interface DialogContentProps extends ComponentProps<"dialog"> {}

export function DialogContent({
  className = "",
  children,
  ...props
}: DialogContentProps) {
  const { isOpen, onClose, preventClose } = useDialog();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement, Event>) => {
    if (preventClose) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    onClose();
  };

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && !preventClose) {
      onClose();
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: O fechamento via teclado é tratado nativamente pelo onCancel (ESC)
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleClick}
      className={`
        fixed inset-0 m-auto
        backdrop:bg-black/60 backdrop:backdrop-blur-sm
        bg-surface-2 text-text border border-border rounded-xl shadow-2xl
        p-0 max-w-md w-full overflow-hidden select-none outline-none
        open:animate-in open:fade-in open:zoom-in-95 duration-200
        ${className}
      `}
      {...props}
    >
      <div className="relative p-6">{children}</div>
    </dialog>
  );
}

/* ==========================================================================
   Dialog.Header
   ========================================================================== */
export interface DialogHeaderProps extends ComponentProps<"div"> {}

export function DialogHeader({
  className = "",
  children,
  ...props
}: DialogHeaderProps) {
  return (
    <div className={`mb-4 flex flex-col gap-1 pr-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

/* ==========================================================================
   Dialog.Title
   ========================================================================== */
export interface DialogTitleProps extends ComponentProps<"h2"> {}

export function DialogTitle({
  className = "",
  children,
  ...props
}: DialogTitleProps) {
  return (
    <h2
      className={`text-base font-semibold text-text flex items-center gap-2 ${className}`}
      {...props}
    >
      {children}
    </h2>
  );
}

/* ==========================================================================
   Dialog.Description
   ========================================================================== */
export interface DialogDescriptionProps extends ComponentProps<"p"> {}

export function DialogDescription({
  className = "",
  children,
  ...props
}: DialogDescriptionProps) {
  return (
    <p
      className={`text-xs text-text-muted leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

/* ==========================================================================
   Dialog.Close
   ========================================================================== */
export interface DialogCloseProps extends ComponentProps<"button"> {}

export function DialogClose({
  className = "",
  onClick,
  children,
  ...props
}: DialogCloseProps) {
  const { onClose, preventClose } = useDialog();

  if (preventClose) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        onClose();
        onClick?.(e);
      }}
      className={`
        absolute top-4 right-4 text-text-muted hover:text-text transition-colors
        p-1 rounded-md cursor-pointer hover:bg-surface-3 outline-none
        focus-visible:ring-1 focus-visible:ring-accent
        ${className}
      `}
      title="Fechar"
      {...props}
    >
      {children || <X size={18} />}
    </button>
  );
}

/* ==========================================================================
   Dialog.Footer
   ========================================================================== */
export interface DialogFooterProps extends ComponentProps<"div"> {}

export function DialogFooter({
  className = "",
  children,
  ...props
}: DialogFooterProps) {
  return (
    <div
      className={`mt-6 flex items-center justify-end gap-2 pt-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Namespaced Export (Compound Pattern)
   ========================================================================== */
export const Dialog = {
  Root: DialogRoot,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
  Footer: DialogFooter,
};
