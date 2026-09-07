import * as React from "react";
import { cn } from "@/lib/utilities/cn";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const fieldId = id ?? props.name;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(errorId, hintId) || undefined}
          className={cn(
            "h-11 rounded-md border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary",
            "transition-[border-color,box-shadow,background-color] duration-200",
            "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger focus-visible:border-danger focus-visible:ring-danger/20" : "border-border",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-body-sm text-text-secondary">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-body-sm text-danger animate-slide-up">
            {error}
          </p>
        )}
      </div>
    );
  }
);
TextField.displayName = "TextField";
