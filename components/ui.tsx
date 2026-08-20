import React from "react";

export type UIButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost" | "link";
export type UIButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<UIButtonVariant, string> = {
  primary: "ui-button-primary",
  secondary: "ui-button-secondary",
  accent: "ui-button-accent",
  danger: "ui-button-danger",
  ghost: "ui-button-ghost",
  link: "ui-button-link",
};

const buttonSizes: Record<UIButtonSize, string> = {
  sm: "ui-button-sm",
  md: "ui-button-md",
  lg: "ui-button-lg",
  icon: "ui-button-icon",
};

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UIButtonVariant;
  size?: UIButtonSize;
  loading?: boolean;
}>(({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cx("ui-button", buttonVariants[variant], buttonSizes[size], className)}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && <span className="ui-button-spinner" aria-hidden="true" />}
    {children}
  </button>
));
Button.displayName = "Button";

export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: Exclude<UIButtonVariant, "link">;
}>(({ className, label, variant = "ghost", ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant={variant}
    size="icon"
    className={className}
    aria-label={label}
    {...props}
  />
));
IconButton.displayName = "IconButton";

export const Badge = ({ className, tone = "neutral", children }: {
  className?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) => (
  <span className={cx("ui-badge", `ui-badge-${tone}`, className)}>{children}</span>
);

export const Field = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
}>(({ className, id, label, error, ...props }, ref) => (
  <label className="ui-field" htmlFor={id}>
    {label && <span className="ui-field-label">{label}</span>}
    <input ref={ref} id={id} className={cx("ui-input", error && "ui-input-error", className)} aria-invalid={Boolean(error)} {...props} />
    {error && <span className="ui-field-error" role="alert">{error}</span>}
  </label>
));
Field.displayName = "Field";