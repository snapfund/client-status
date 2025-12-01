import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Redis Keys
export const KEYS = {
  CURRENT_STATUS: 'status:current',
  HISTORY: (date: string) => `status:history:${date}`,
  COMPONENT_HISTORY: (componentId: string, date: string) => `status:component:${componentId}:${date}`,
  FAIL_COUNT: (componentId: string) => `status:failcount:${componentId}`,
  INCIDENTS: 'incidents:active',
  INCIDENT: (id: string) => `incidents:${id}`,
};
