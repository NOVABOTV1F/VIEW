import type { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mt-4 rounded-card border border-line bg-bg p-4 shadow-card", className)}>{children}</section>;
}

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className,
  id,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "ghost" | "outline";
  type?: "button" | "submit";
  className?: string;
  id?: string;
}) {
  const look = {
    primary: "bg-pink-dark text-bg shadow-card",
    danger: "bg-bad text-bg",
    ghost: "bg-pink-light text-pink-dark",
    outline: "border border-pink bg-bg text-pink-dark",
  }[variant];
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-45",
        look,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Switch({
  on,
  label,
  disabled,
  onClick,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("relative h-7 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-pink" : "bg-line")}
    >
      <span className={cn("absolute top-1 size-5 rounded-full bg-bg shadow-card transition-transform", on ? "left-5" : "left-1")} />
    </button>
  );
}

export const controlClass =
  "w-full rounded-control border border-line bg-bg px-3 py-2.5 text-sm outline-none disabled:opacity-50";
