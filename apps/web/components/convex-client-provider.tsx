'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import type { ReactNode } from 'react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error('Missing NEXT_PUBLIC_CONVEX_URL');
const convex = new ConvexReactClient(convexUrl);

function ConvexWithClerk({ children }: { children: ReactNode }) {
  return <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ClerkProvider><ConvexWithClerk>{children}</ConvexWithClerk></ClerkProvider>;
}
