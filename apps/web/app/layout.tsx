import type { Metadata } from 'next';
import './globals.css';
import { ConvexClientProvider } from '../components/convex-client-provider';
import { AuthProvider } from '../components/auth-context';

export const metadata: Metadata = {
  title: 'Secure Chama Portal',
  description: 'Secure invited access to a Chama management platform.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-KE">
      <body>
        <ConvexClientProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
