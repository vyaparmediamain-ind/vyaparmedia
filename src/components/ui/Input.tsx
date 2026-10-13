import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
readonly label?: string | undefined;
readonly error?: string | undefined;
readonly fullWidth?: boolean | undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
({ className = "", label, error, fullWidth = false, id, ...props }, ref) => {
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
<input
id={inputId}
className={`input ${error ? "input-error" : ""} ${className}`}
ref={ref}
{...props}
/>
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
