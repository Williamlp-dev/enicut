import type { ComponentProps } from "react";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "danger" | "icon" | "ghost" | "play";
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  // Uses global .btn-press for asymmetric tactile response:
  // - 80ms on click press
  // - 160ms cubic-bezier(0.23, 1, 0.32, 1) on release
  const isCustomPosition =
    className.includes("absolute") || className.includes("fixed");
  const baseStyles = `btn-press ${isCustomPosition ? "" : "relative "}inline-flex items-center justify-center font-medium select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none outline-none focus-visible:ring-1 focus-visible:ring-accent`;

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
      "px-4 py-2 rounded-lg bg-accent text-surface font-semibold shadow-sm hover:bg-accent-hover active:bg-accent-hover",
    secondary:
      "px-4 py-2 rounded-lg bg-surface-2 text-text hover:bg-surface-3 border border-border/80 shadow-xs",
    danger:
      "px-3 py-1.5 rounded-lg bg-danger/15 text-danger hover:bg-danger hover:text-white border border-danger/30 shadow-xs",
    icon: "w-8 h-8 rounded-lg bg-transparent text-text-muted hover:text-accent hover:bg-surface-3/50",
    ghost:
      "px-2.5 py-1.5 rounded-lg bg-transparent text-text-muted hover:text-text hover:bg-surface-3/40",
    play: "w-10 h-10 rounded-full bg-surface-2/70 border-2 border-accent text-accent hover:bg-accent-dim shadow-sm",
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
