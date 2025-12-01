'use client';

import { StatusType } from '@/lib/types';

interface StatusBannerProps {
  status: StatusType;
}

const statusConfig = {
  operational: {
    label: '모든 시스템 정상 운영 중',
    bgColor: 'bg-green-500',
    icon: '✓',
  },
  degraded: {
    label: '일부 시스템 성능 저하',
    bgColor: 'bg-yellow-500',
    icon: '!',
  },
  partial: {
    label: '일부 시스템 장애 발생',
    bgColor: 'bg-orange-500',
    icon: '!',
  },
  major: {
    label: '주요 시스템 장애 발생',
    bgColor: 'bg-red-500',
    icon: '✕',
  },
};

export default function StatusBanner({ status }: StatusBannerProps) {
  const config = statusConfig[status];

  return (
    <div className={`${config.bgColor} rounded-lg p-6 text-white mb-8`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold w-8 h-8 flex items-center justify-center bg-white/20 rounded-full">
          {config.icon}
        </span>
        <span className="text-xl font-semibold">{config.label}</span>
      </div>
    </div>
  );
}
