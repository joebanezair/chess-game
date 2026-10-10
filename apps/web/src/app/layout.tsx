import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crown — Play Checkers Online',
  description: 'Play live checkers against friends and new opponents. Make your move.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body>{children}</body></html>;
}
