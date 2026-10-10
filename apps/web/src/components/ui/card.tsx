import * as React from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-panel/95 shadow-soft', className)} {...props} />;
}
