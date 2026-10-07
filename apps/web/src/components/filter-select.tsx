'use client';

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
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select
        className="filter-select__trigger"
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
