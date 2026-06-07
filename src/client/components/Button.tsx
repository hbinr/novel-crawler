import { type ButtonHTMLAttributes, type ReactNode } from "react";
import "./Button.css";

type Variant = "default" | "primary" | "ghost" | "danger" | "text";
type Size = "sm" | "md" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "default",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: Props) {
  const cls = [
    "btn",
    variant === "primary" && "btn-primary",
    variant === "ghost" && "btn-ghost",
    variant === "danger" && "btn-danger",
    variant === "text" && "btn-text",
    size === "sm" && "btn-sm",
    size === "icon" && "btn-icon",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}
