import type { Metadata } from 'next';
import { AdminAuthProvider } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SmartMe Admin',
    template: '%s · SmartMe Admin',
  },
  description: 'Content operations and learner insights for the SmartMe learning platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
