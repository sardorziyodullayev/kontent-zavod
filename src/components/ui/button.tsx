import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'primary' | 'dark' | 'ghost' | 'danger';
type Size = 'md' | 'sm' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  default: 'border border-line bg-surface hover:bg-surface-2',
  primary: 'border border-transparent bg-accent font-semibold text-accent-ink hover:brightness-95',
  dark: 'border border-transparent bg-pill font-semibold text-pill-ink hover:opacity-90',
  ghost: 'border border-transparent bg-transparent hover:bg-surface-2',
  danger: 'border border-transparent bg-transparent text-critical-text hover:bg-surface-2',
};
const sizes: Record<Size, string> = {
  md: 'h-10 gap-[7px] rounded-full px-4',
  sm: 'h-8 gap-1.5 rounded-full px-3 text-[13px]',
  icon: 'size-10 justify-center rounded-full',
  'icon-sm': 'size-8 justify-center rounded-full',
};

export const buttonClass = (variant: Variant = 'default', size: Size = 'md', className?: string) =>
  cn('inline-flex shrink-0 items-center font-medium whitespace-nowrap no-underline disabled:cursor-not-allowed disabled:opacity-45', variants[variant], sizes[size], className);

export function Button({ variant, size, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
