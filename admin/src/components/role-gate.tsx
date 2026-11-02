'use client';

import type { ReactNode } from 'react';
import { AccessDenied } from './ui';

export function BusinessRoleGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function BusinessAccessDenied() {
  return (
    <AccessDenied message="Learner, subscription and analytics data is available to super admins and analysts only." />
  );
}
