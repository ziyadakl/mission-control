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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-w-7xl mx-auto">
        <WidgetCard title="Agents" className="lg:col-span-2">
          <AgentHealthWidget />
        </WidgetCard>
        <WidgetCard title="Weather">
          <WeatherWidget />
        </WidgetCard>
        <WidgetCard title="System">
          <SystemHealthWidget />
        </WidgetCard>

        <WidgetCard title="Attention" className="lg:col-span-2">
          <NeedsAttentionWidget />
        </WidgetCard>
        <WidgetCard title="Velocity" className="lg:col-span-2">
          <VelocityWidget />
        </WidgetCard>

        <WidgetCard title="Activity" className="lg:col-span-2">
          <ActivitySummaryWidget />
        </WidgetCard>
        <WidgetCard title="Cost">
          <CostWidget />
        </WidgetCard>
        <WidgetCard title="Workspaces">
          <WorkspacesWidget />
        </WidgetCard>
      </div>
    </div>
  );
}
