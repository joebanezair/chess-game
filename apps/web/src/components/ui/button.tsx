import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-50',
  { variants: {
    variant: {
      default: 'bg-gold text-ink hover:bg-[#e9c587] shadow-sm',
      secondary: 'bg-[#293332] text-cream hover:bg-[#34413f] border border-[#3d4946]',
      outline: 'border border-[#57615a] text-cream hover:bg-white/5',
      ghost: 'text-muted hover:bg-white/5 hover:text-cream',
      danger: 'bg-red-900/30 text-red-300 border border-red-800/50 hover:bg-red-900/50',
    },
    size: { default: 'h-11 px-5 py-2', sm: 'h-9 px-3', lg: 'h-12 px-7', icon: 'h-10 w-10' },
  }, defaultVariants: { variant: 'default', size: 'default' } }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props }, ref,
) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
