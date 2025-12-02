'use client';

import { DailyUptime } from '@/lib/types';

interface MiniUptimeChartProps {
  data: DailyUptime[];
  days?: number;
}

function getUptimeColor(uptime: number, checks: number): string {
  if (checks === 0) return 'bg-gray-300 dark:bg-gray-700';
  if (uptime >= 99.9) return 'bg-green-500';
  if (uptime >= 99) return 'bg-green-400';
  if (uptime >= 95) return 'bg-yellow-500';
  if (uptime >= 90) return 'bg-orange-500';
  return 'bg-red-500';
}

function getStatusLabel(uptime: number, checks: number): string {
  if (checks === 0) return '데이터 없음';
  if (uptime >= 99.9) return '정상';
  if (uptime >= 99) return '양호';
  if (uptime >= 95) return '저하';
  if (uptime >= 90) return '불안정';
  return '장애';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

export default function MiniUptimeChart({ data, days = 90 }: MiniUptimeChartProps) {
  // 90일 데이터 준비
  const chartData: DailyUptime[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const existing = data.find(d => d.date === dateStr);
    chartData.push(existing || { date: dateStr, uptime: 100, checks: 0, failures: 0 });
  }

  return (
    <div className="flex gap-[2px] h-8">
      {chartData.map((day) => (
        <div
          key={day.date}
          className={`flex-1 ${getUptimeColor(day.uptime, day.checks)} rounded-sm cursor-pointer hover:opacity-80 transition-opacity group relative`}
        >
          {/* Tooltip */}
          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 whitespace-nowrap min-w-[160px]">
              {/* 날짜 */}
              <div className="font-semibold text-sm mb-2 pb-2 border-b border-gray-700">
                {formatDate(day.date)}
              </div>

              {/* 상태 */}
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-400">상태</span>
                <span className={`font-medium ${
                  day.checks === 0 ? 'text-gray-400' :
                  day.uptime >= 99.9 ? 'text-green-400' :
                  day.uptime >= 95 ? 'text-yellow-400' :
                  day.uptime >= 90 ? 'text-orange-400' :
                  'text-red-400'
                }`}>
                  {getStatusLabel(day.uptime, day.checks)}
                </span>
              </div>

              {/* 가동률 */}
              {day.checks > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400">가동률</span>
                  <span className="font-medium">{day.uptime.toFixed(2)}%</span>
                </div>
              )}

              {/* 체크 횟수 */}
              {day.checks > 0 && (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400">체크 횟수</span>
                    <span>{day.checks}회</span>
                  </div>

                  {/* 장애 횟수 */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">장애 횟수</span>
                    <span className={day.failures > 0 ? 'text-red-400' : ''}>
                      {day.failures}회
                    </span>
                  </div>
                </>
              )}

              {day.checks === 0 && (
                <div className="text-gray-500 text-center mt-1">
                  모니터링 데이터 없음
                </div>
              )}

              {/* 화살표 */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                <div className="border-8 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
