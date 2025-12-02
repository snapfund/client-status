import { StatusType } from '@/lib/types';

interface StatusIndicatorProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

const statusColors: Record<string, string> = {
  operational: 'bg-green-500',
  degraded: 'bg-yellow-500',
  partial: 'bg-orange-500',
  major: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const statusLabels: Record<string, string> = {
  operational: '정상',
  degraded: '지연',
  partial: '장애',
  major: '장애',
  unknown: '확인 중',
};

export default function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  const color = statusColors[status] || statusColors.unknown;
  const label = statusLabels[status] || statusLabels.unknown;

  return (
    <div className="flex items-center gap-2">
      <span className={`${color} ${sizeClass} rounded-full`} />
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {label}
      </span>
    </div>
  );
}
