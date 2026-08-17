import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { PackageOpen, X } from "lucide-react";

// ---------- Button ----------

type ButtonVariant = "primary" | "secondary" | "danger" | "dangerGhost" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: "border border-[#146b52] bg-[#146b52] text-white shadow-[0_1px_2px_rgba(15,40,31,0.16)] hover:border-[#0f5944] hover:bg-[#0f5944] focus-visible:ring-[#146b52]",
  secondary: "border border-[#cbd3cd] bg-white text-[#34423b] hover:border-[#aab6ae] hover:bg-[#f3f5f3] focus-visible:ring-[#7d8b83]",
  danger: "border border-[#b74640] bg-[#b74640] text-white hover:border-[#983a35] hover:bg-[#983a35] focus-visible:ring-[#b74640]",
  dangerGhost: "border border-transparent text-[#a43f3a] hover:border-[#ead0ce] hover:bg-[#fbf2f1] focus-visible:ring-[#b74640]",
  ghost: "border border-transparent text-[#526159] hover:border-[#d7ded9] hover:bg-[#eef2ef] focus-visible:ring-[#7d8b83]",
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-3.5 text-sm",
  icon: "h-9 w-9 p-0",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[6px] font-semibold transition-[background-color,border-color,color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f7f5] disabled:cursor-not-allowed disabled:opacity-45 ${buttonVariantClasses[variant]} ${buttonSizeClasses[size]} ${className}`}
      {...props}
    />
  );
}

// ---------- Input / Select ----------

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-[6px] border border-[#cbd3cd] bg-white px-3 text-sm text-[#19231f] shadow-[inset_0_1px_1px_rgba(25,35,31,0.03)] placeholder:text-[#8a968f] focus:border-[#146b52] focus:outline-none focus:ring-2 focus:ring-[#146b52]/15 disabled:bg-[#eef1ee] ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`block h-10 rounded-[6px] border border-[#cbd3cd] bg-white px-3 text-sm text-[#19231f] shadow-[inset_0_1px_1px_rgba(25,35,31,0.03)] focus:border-[#146b52] focus:outline-none focus:ring-2 focus:ring-[#146b52]/15 disabled:bg-[#eef1ee] ${className}`}
      {...props}
    />
  );
}

// ---------- Field ----------

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#34423b]">
        {label}
        {required && <span className="ml-0.5 text-[#b74640]">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1.5 text-xs text-[#7a877f]">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-[#b74640]">{error}</p>}
    </div>
  );
}

// ---------- Modal ----------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[#19231f]/48 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className={`relative flex w-full ${maxWidth} max-h-[calc(100dvh-1rem)] flex-col rounded-t-[8px] border border-[#d7ded9] bg-white shadow-[0_24px_64px_rgba(16,30,24,0.22)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[8px]`}>
        <div className="flex min-h-14 items-center justify-between border-b border-[#d7ded9] px-4 sm:px-5">
          <h2 className="font-display text-[17px] font-semibold text-[#19231f]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[#6b7871] transition-colors hover:bg-[#eef2ef] hover:text-[#19231f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146b52]"
          >
            <X size={18} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
        <div className="scrollbar-subtle flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="flex min-h-16 items-center justify-end gap-2 border-t border-[#d7ded9] bg-[#fafbfa] px-4 sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Spinner / Badge / EmptyState ----------

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-[#146b52] ${className}`}
      role="status"
      aria-label="加载中"
    />
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "blue" | "green" | "amber" | "red" }) {
  const cls = {
    gray: "bg-[#eef1ee] text-[#536159] ring-[#cbd3cd]",
    blue: "bg-[#edf5f8] text-[#24658a] ring-[#b7d1df]",
    green: "bg-[#e9f4ef] text-[#146b52] ring-[#b5d6c8]",
    amber: "bg-[#fbf3e7] text-[#986020] ring-[#ead2ae]",
    red: "bg-[#fbefee] text-[#a43f3a] ring-[#e7c2bf]",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#d7ded9] bg-[#f5f7f5] text-[#7a877f]">
        <PackageOpen size={23} strokeWidth={1.6} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[#34423b]">{title}</p>
      {description && <p className="mt-1.5 max-w-xs text-sm text-[#7a877f]">{description}</p>}
    </div>
  );
}
