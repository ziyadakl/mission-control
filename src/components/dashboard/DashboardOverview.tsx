'use client';

import { WidgetCard } from './WidgetCard';
import { WeatherWidget } from './WeatherWidget';
import { AgentHealthWidget } from './AgentHealthWidget';
import { SystemHealthWidget } from './SystemHealthWidget';
import { NeedsAttentionWidget } from './NeedsAttentionWidget';
import { ActivitySummaryWidget } from './ActivitySummaryWidget';
import { VelocityWidget } from './VelocityWidget';
import { CostWidget } from './CostWidget';
import { WorkspacesWidget } from './WorkspacesWidget';

export function DashboardOverview() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Row 1 */}
        <WidgetCard title="Agent Health" accent="cyan" className="lg:col-span-2">
          <AgentHealthWidget />
        </WidgetCard>
        <WidgetCard title="Weather & Time" accent="yellow">
          <WeatherWidget />
        </WidgetCard>
        <WidgetCard title="System Health" accent="green">
          <SystemHealthWidget />
        </WidgetCard>

        {/* Row 2 */}
        <WidgetCard title="Needs Attention" accent="red" className="lg:col-span-2">
          <NeedsAttentionWidget />
        </WidgetCard>
        <WidgetCard title="Weekly Velocity" accent="blue" className="lg:col-span-2">
          <VelocityWidget />
        </WidgetCard>

        {/* Row 3 */}
        <WidgetCard title="Activity (24h)" accent="purple" className="lg:col-span-2">
          <ActivitySummaryWidget />
        </WidgetCard>
        <WidgetCard title="Token / Cost" accent="green">
          <CostWidget />
        </WidgetCard>
        <WidgetCard title="Workspaces" accent="pink">
          <WorkspacesWidget />
        </WidgetCard>
      </div>
    </div>
  );
}
