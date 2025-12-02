'use client';

import { ComponentStatus, DailyUptime } from '@/lib/types';
import StatusIndicator from './StatusIndicator';
import MiniUptimeChart from './MiniUptimeChart';

interface ComponentListProps {
  components: ComponentStatus[];
  history: { [componentId: string]: DailyUptime[] };
}

export default function ComponentList({ components, history }: ComponentListProps) {
  return (
    <div className="space-y-4">
      {components.map((component) => {
        const componentHistory = history[component.id] || [];
        const dataWithChecks = componentHistory.filter(d => d.checks > 0);
        const avgUptime = dataWithChecks.length > 0
          ? dataWithChecks.reduce((sum, d) => sum + d.uptime, 0) / dataWithChecks.length
          : null;

        return (
          <div
            key={component.id}
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900 dark:text-white">
                  {component.name}
                </span>
                {component.latency > 0 && (
                  <span className="text-xs text-gray-400">
                    {component.latency}ms
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {avgUptime !== null ? `${avgUptime.toFixed(2)}%` : '-'}
                </span>
                <StatusIndicator status={component.status} />
              </div>
            </div>

            {/* Mini Uptime Chart */}
            <MiniUptimeChart data={componentHistory} />
          </div>
        );
      })}
    </div>
  );
}
