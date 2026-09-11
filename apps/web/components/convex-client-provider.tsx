'use client';

import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithAuth } from 'convex/react';
import { useAuth } from './auth-context';
import type { ReactNode } from 'react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error('Missing NEXT_PUBLIC_CONVEX_URL');
const convex = new ConvexReactClient(convexUrl);

function useConvexAuth() {
  const { isLoading, isAuthenticated, token } = useAuth();

  const fetchAccessToken = async () => token;

  return { isLoading, isAuthenticated, fetchAccessToken };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
