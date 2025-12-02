export type StatusType = 'operational' | 'degraded' | 'partial' | 'major' | 'unknown';

export interface ComponentStatus {
  id: string;
  name: string;
  status: StatusType;
  latency: number;
  checkedAt: string;
}

export interface StatusData {
  overall: StatusType;
  components: ComponentStatus[];
  updatedAt: string;
}

export interface DailyUptime {
  date: string;
  uptime: number;
  checks: number;
  failures: number;
}

export interface ComponentHistory {
  [componentId: string]: DailyUptime[];
}

export interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  components: string[];
  createdAt: string;
  resolvedAt?: string;
  updates: IncidentUpdate[];
}

export interface IncidentUpdate {
  message: string;
  status: string;
  time: string;
}

export const COMPONENTS = [
  { id: 'api', name: 'API Server', url: 'https://api.snapfund.xyz/api/health' },
  { id: 'web', name: '메인 사이트', url: 'https://snapfund.xyz' },
  { id: 'dashboard', name: '대시보드', url: 'https://dash.snapfund.xyz' },
  { id: 'help', name: '고객센터', url: 'https://help.snapfund.xyz' },
  { id: 'payment', name: '결제 시스템', url: 'https://api.snapfund.xyz/api/payments/health' },
] as const;
