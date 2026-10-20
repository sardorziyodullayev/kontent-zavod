// Radix Dialog asosidagi modal va o'ng tomondan chiqadigan panel (sheet).
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const overlay = 'fixed inset-0 z-50 bg-black/50';

export function Modal({ open, onClose, title, children, footer, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content aria-describedby={undefined} className={cn('fixed top-[8vh] left-1/2 z-50 max-h-[84vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-line bg-surface shadow-pop', className)}>
          <div className="flex items-center px-[22px] pt-[18px]">
            <D.Title className="font-display text-base font-semibold">{title}</D.Title>
            <D.Close asChild>
              <Button variant="ghost" size="icon" className="ml-auto" aria-label="Yopish"><X size={18} /></Button>
            </D.Close>
          </div>
          <div className="grid gap-3.5 px-[22px] py-[18px]">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-[22px] pt-3.5 pb-[18px]">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Sheet({ open, onClose, title, header, children }: { open: boolean; onClose: () => void; title: string; header: ReactNode; children: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content aria-describedby={undefined} className="fixed top-0 right-0 bottom-0 z-50 w-[min(720px,100vw)] overflow-y-auto border-l border-line bg-surface shadow-pop">
          <D.Title className="sr-only">{title}</D.Title>
          <div className="sticky top-0 z-10 grid gap-2.5 border-b border-line bg-surface px-4 pt-[18px] pb-3.5 sm:px-[22px]">{header}</div>
          <div className="px-4 pt-1.5 pb-10 sm:px-[22px]">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const SheetClose = D.Close;
