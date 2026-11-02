import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string | undefined;
  readonly error?: string | undefined;
  readonly fullWidth?: boolean | undefined;
  readonly rightElement?: React.ReactNode | undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, fullWidth = false, id, rightElement, ...props }, ref) => {
    const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
    const wrapperClasses = `input-wrapper flex flex-col gap-2 ${fullWidth ? "w-full" : "w-auto"}`;

    return (
      <div
        className={wrapperClasses}
      >
        {label && (
          <label className="label mb-0" htmlFor={inputId}>
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <input
            id={inputId}
            className={`input ${rightElement ? "pr-11" : ""} ${error ? "input-error" : ""} ${className}`}
            ref={ref}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-2.5 flex items-center justify-center z-10">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <span
            className="input-error-message text-xs mt-1 text-rose"
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
