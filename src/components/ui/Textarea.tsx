import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
readonly label?: string | undefined;
readonly error?: string | undefined;
readonly fullWidth?: boolean | undefined;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
({ className = "", label, error, fullWidth = false, id, ...props }, ref) => {
const textareaId =
id ?? (label ? `textarea-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
const wrapperClasses = `input-wrapper flex flex-col gap-2 ${fullWidth ? "w-full" : "w-auto"}`;

return (
<div
className={wrapperClasses}
>
{label && (
<label className="label mb-0" htmlFor={textareaId}>
{label}
</label>
)}
<textarea
id={textareaId}
className={`input resize-y min-h-[100px] ${error ? "input-error" : ""} ${className}`}
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

Textarea.displayName = "Textarea";
