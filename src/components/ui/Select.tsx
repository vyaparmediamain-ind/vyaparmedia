"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  readonly label?: string;
  readonly error?: string;
  readonly fullWidth?: boolean;
  readonly options?: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className = "",
      label,
      error,
      fullWidth = false,
      id,
      options,
      children,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const selectId =
      id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
    const wrapperClasses = `input-wrapper flex flex-col gap-2 ${fullWidth ? "w-full" : "w-auto"}`;

    const [isOpen, setIsOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState<string>(() => {
      if (value !== undefined) return String(value);
      if (defaultValue !== undefined) return String(defaultValue);
      return "";
    });

    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const nativeSelectRef = useRef<HTMLSelectElement>(null);

    // Sync ref
    React.useImperativeHandle(ref, () => nativeSelectRef.current!);

    // Update selectedValue if controlled value changes
    useEffect(() => {
      if (value !== undefined) {
        setSelectedValue(String(value));
      }
    }, [value]);

    const parsedOptions = React.useMemo(() => {
      if (options) {
        return options.map((opt) => ({
          value: opt.value,
          label: opt.label,
          disabled: !!opt.disabled,
        }));
      }
      const opts: Array<{ value: string; label: string; disabled: boolean }> = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === "option") {
          const p = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
          opts.push({
            value: p.value ?? "",
            label: typeof p.children === "string" ? p.children : String(p.value ?? ""),
            disabled: !!p.disabled,
          });
        }
      });
      return opts;
    }, [options, children]);

    const activeValue = selectedValue || (parsedOptions[0] ? parsedOptions[0].value : "");
    const activeOption = parsedOptions.find((opt) => opt.value === activeValue);
    const triggerLabel = activeOption ? activeOption.label : "Select option...";

    const handleSelectOption = (optionValue: string) => {
      setSelectedValue(optionValue);
      setIsOpen(false);

      if (nativeSelectRef.current) {
        nativeSelectRef.current.value = optionValue;

        // Dispatch a native change event so React Hook Form/listeners detect it
        const event = new Event("change", { bubbles: true });
        nativeSelectRef.current.dispatchEvent(event);

        if (onChange) {
          const synthEvent = {
            target: nativeSelectRef.current,
            currentTarget: nativeSelectRef.current,
            type: "change",
            preventDefault: () => {},
            stopPropagation: () => {},
          } as unknown as React.ChangeEvent<HTMLSelectElement>;
          onChange(synthEvent);
        }
      }
    };

    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const updateDropdownPosition = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: "fixed",
          top: `${rect.bottom}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: 999999,
        });
      }
    };

    useEffect(() => {
      if (isOpen) {
        updateDropdownPosition();
        window.addEventListener("scroll", updateDropdownPosition, true);
        window.addEventListener("resize", updateDropdownPosition);
      }
      return () => {
        window.removeEventListener("scroll", updateDropdownPosition, true);
        window.removeEventListener("resize", updateDropdownPosition);
      };
    }, [isOpen]);

    useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        if (
          isOpen &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [isOpen]);

    return (
      <div className={wrapperClasses}>
        {label && (
          <label className="label mb-0" htmlFor={selectId}>
            {label}
          </label>
        )}
        
        {/* Trigger Button */}
        <button
          type="button"
          ref={triggerRef}
          onClick={() => !props.disabled && setIsOpen(!isOpen)}
          className={`input flex items-center justify-between cursor-pointer text-left select-trigger ${
            error ? "input-error" : ""
          } ${props.disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
          disabled={props.disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          id={selectId ? `${selectId}-trigger` : undefined}
        >
          <span className="truncate">{triggerLabel}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Hidden native select for form libraries and compatibility */}
        <select
          ref={nativeSelectRef}
          id={selectId}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
          value={activeValue}
          onChange={(e) => {
            setSelectedValue(e.target.value);
            onChange?.(e);
          }}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        {/* Portal-rendered custom dropdown menu */}
        {isOpen && typeof document !== "undefined" && createPortal(
          <div
            ref={dropdownRef}
            className="select-portal-dropdown card p-1 bg-gradient-secondary animate-fade-in"
            style={dropdownStyle}
            role="listbox"
          >
            <div className="select-portal-options-container max-h-60 overflow-y-auto">
              {parsedOptions.map((opt) => {
                const isSelected = opt.value === activeValue;
                let optionClass = "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]";
                if (isSelected) {
                  optionClass = "bg-[var(--color-primary)] text-white font-medium";
                } else if (opt.disabled) {
                  optionClass = "opacity-40 cursor-not-allowed";
                }

                return (
                  <div
                    key={opt.value}
                    onClick={() => !opt.disabled && handleSelectOption(opt.value)}
                    onKeyDown={(e) => {
                      if (!opt.disabled && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        handleSelectOption(opt.value);
                      }
                    }}
                    className={`select-portal-option p-2.5 px-4 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between ${optionClass}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    tabIndex={opt.disabled ? -1 : 0}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}

        {error && (
          <span className="input-error-message text-xs mt-1 text-rose">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
