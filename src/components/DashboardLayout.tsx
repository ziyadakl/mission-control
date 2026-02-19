'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppSidebar } from './AppSidebar';

function DashboardContent() {
  const searchParams = useSearchParams();
  const activeWorkspace = searchParams.get('workspace');
  const activeView = searchParams.get('view') || (activeWorkspace ? null : 'overview');

  if (activeWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center text-mc-text-secondary">
        Workspace: {activeWorkspace} (coming in Task 2)
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center text-mc-text-secondary">
      Overview (coming in Task 3)
    </div>
  );
}

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex bg-mc-bg overflow-hidden">
      <Suspense fallback={null}>
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
      </Suspense>
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="text-4xl animate-pulse">🦞</div>
          </div>
        }>
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
