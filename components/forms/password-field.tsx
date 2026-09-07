"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utilities/cn";
import type { TextFieldProps } from "./text-field";

export const PasswordField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const fieldId = id ?? props.name;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            type={visible ? "text" : "password"}
            aria-invalid={Boolean(error)}
            aria-describedby={cn(errorId, hintId) || undefined}
            className={cn(
              "h-11 w-full rounded-md border bg-surface px-3 pr-11 text-sm text-text-primary placeholder:text-text-tertiary",
              "transition-[border-color,box-shadow,background-color] duration-200",
              "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error ? "border-danger focus-visible:border-danger focus-visible:ring-danger/20" : "border-border",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            disabled={props.disabled}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="touch-target absolute right-0 top-1/2 -translate-y-1/2 px-3 text-text-tertiary hover:text-text-secondary disabled:pointer-events-none disabled:opacity-50"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
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
PasswordField.displayName = "PasswordField";
