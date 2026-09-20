'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type Option = { label: string; value: string };

export function FilterSelect({
  label,
  name,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  name?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected =
    options.find((option) => option.value === value)?.label ?? options[0]?.label ?? 'Seleccionar';
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="filter-select" ref={ref}>
      {name && <input type="hidden" name={name} value={value} />}
      <span id={id}>{label}</span>
      <button
        type="button"
        className="filter-select__trigger"
        aria-labelledby={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        {selected}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className="filter-select__menu" role="listbox" aria-labelledby={id}>
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
