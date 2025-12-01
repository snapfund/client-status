'use client';

import { Incident } from '@/lib/types';

interface IncidentListProps {
  incidents: Incident[];
}

const statusLabels = {
  investigating: '조사 중',
  identified: '원인 파악',
  monitoring: '모니터링 중',
  resolved: '해결됨',
};

const severityColors = {
  minor: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  major: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  critical: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

export default function IncidentList({ incidents }: IncidentListProps) {
  if (incidents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mt-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          최근 인시던트
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          현재 진행 중인 인시던트가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mt-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
        인시던트
      </h2>
      <div className="space-y-4">
        {incidents.map((incident) => (
          <div
            key={incident.id}
            className={`p-4 rounded-lg ${severityColors[incident.severity]}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{incident.title}</h3>
                <p className="text-sm mt-1 opacity-80">
                  {statusLabels[incident.status]}
                </p>
              </div>
              <span className="text-xs opacity-70">
                {new Date(incident.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>

            {incident.updates.length > 0 && (
              <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
                {incident.updates.slice(0, 3).map((update, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="opacity-70">
                      {new Date(update.time).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="ml-2">{update.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
