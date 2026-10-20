import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';
type Size = 'md' | 'sm' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  default: 'border border-line-2 bg-surface hover:bg-surface-2',
  primary: 'border border-transparent bg-accent font-semibold text-accent-ink hover:brightness-95',
  ghost: 'border border-transparent bg-transparent hover:bg-surface-2',
  danger: 'border border-transparent bg-transparent text-critical-text hover:bg-surface-2',
};
const sizes: Record<Size, string> = {
  md: 'h-9 gap-[7px] rounded-[10px] px-3.5',
  sm: 'h-[30px] gap-1.5 rounded-lg px-2.5 text-[13px]',
  icon: 'size-9 justify-center rounded-[10px]',
  'icon-sm': 'size-[30px] justify-center rounded-lg',
};

export const buttonClass = (variant: Variant = 'default', size: Size = 'md', className?: string) =>
  cn('inline-flex shrink-0 items-center font-medium whitespace-nowrap no-underline disabled:cursor-not-allowed disabled:opacity-45', variants[variant], sizes[size], className);

export function Button({ variant, size, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
