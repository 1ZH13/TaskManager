import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Button({ children, className = '', ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={`tm-button ${className}`} {...props}>{children}</button>;
}

export function Logo() { return <span className="tm-logo" aria-label="TaskManager">TM</span>; }
