'use client';

import { WidgetCard } from './WidgetCard';

export function DashboardOverview() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Row 1 */}
        <WidgetCard title="Agent Health" accent="cyan" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 5</div>
        </WidgetCard>
        <WidgetCard title="Weather & Time" accent="yellow">
          <div className="text-mc-text-secondary text-sm">Coming in Task 4</div>
        </WidgetCard>
        <WidgetCard title="System Health" accent="green">
          <div className="text-mc-text-secondary text-sm">Coming in Task 5</div>
        </WidgetCard>

        {/* Row 2 */}
        <WidgetCard title="Needs Attention" accent="red" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 6</div>
        </WidgetCard>
        <WidgetCard title="Weekly Velocity" accent="blue" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 7</div>
        </WidgetCard>

        {/* Row 3 */}
        <WidgetCard title="Activity (24h)" accent="purple" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 6</div>
        </WidgetCard>
        <WidgetCard title="Token / Cost" accent="green">
          <div className="text-mc-text-secondary text-sm">Coming in Task 8</div>
        </WidgetCard>
        <WidgetCard title="Workspaces" accent="pink">
          <div className="text-mc-text-secondary text-sm">Coming in Task 8</div>
        </WidgetCard>
      </div>
    </div>
  );
}
