import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from 'react';

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & { variant?: 'primary' | 'secondary' | 'danger'; };
export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  return <button className={`tm-button tm-button--${variant} ${className}`} {...props}>{children}</button>;
}
export function IconButton({ label, className = '', children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & { label: string }) {
  return <button className={`tm-icon-button ${className}`} aria-label={label} {...props}>{children}</button>;
}
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`tm-input ${className}`} {...props} />;
}
export function Select({ className = '', children, ...props }: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>) {
  return <select className={`tm-select ${className}`} {...props}>{children}</select>;
}
export function StatusBadge({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'success' | 'warning' | 'danger'; }>) {
  return <span className={`tm-badge tm-badge--${tone}`}>{children}</span>;
}
export function EmptyState({ title, children }: PropsWithChildren<{ title: string }>) {
  return <section className="tm-state" aria-live="polite"><h2>{title}</h2><p>{children}</p></section>;
}
export function ErrorState({ title, children }: PropsWithChildren<{ title: string }>) {
  return <section className="tm-state tm-state--error" role="alert"><h2>{title}</h2><p>{children}</p></section>;
}
export function Skeleton({ label = 'Cargando contenido' }: { label?: string }) {
  return <div className="tm-skeleton" aria-label={label} role="status" />;
}
export function Logo() { return <span className="tm-logo" aria-label="TaskManager">TM</span>; }
