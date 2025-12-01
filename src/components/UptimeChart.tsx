'use client';

import { DailyUptime } from '@/lib/types';

interface UptimeChartProps {
  data: DailyUptime[];
  days?: number;
}

function getUptimeColor(uptime: number): string {
  if (uptime >= 99.9) return 'bg-green-500';
  if (uptime >= 99) return 'bg-green-400';
  if (uptime >= 95) return 'bg-yellow-500';
  if (uptime >= 90) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function UptimeChart({ data, days = 90 }: UptimeChartProps) {
  // 90일 데이터 준비 (데이터 없으면 100%로 가정)
  const chartData: DailyUptime[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const existing = data.find(d => d.date === dateStr);
    chartData.push(existing || { date: dateStr, uptime: 100, checks: 0, failures: 0 });
  }

  // 전체 평균 계산
  const avgUptime = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.uptime, 0) / chartData.length
    : 100;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {days}일 가동률
        </h2>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {avgUptime.toFixed(2)}%
        </span>
      </div>

      <div className="flex gap-[2px] h-8">
        {chartData.map((day, index) => (
          <div
            key={day.date}
            className={`flex-1 ${getUptimeColor(day.uptime)} rounded-sm cursor-pointer hover:opacity-80 transition-opacity group relative`}
            title={`${day.date}: ${day.uptime.toFixed(2)}%`}
          >
            {/* Tooltip */}
            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
              {day.date}: {day.uptime.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{days}일 전</span>
        <span>오늘</span>
      </div>
    </div>
  );
}
