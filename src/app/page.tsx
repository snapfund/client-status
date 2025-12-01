import StatusBanner from '@/components/StatusBanner';
import ComponentList from '@/components/ComponentList';
import IncidentList from '@/components/IncidentList';
import { redis, KEYS } from '@/lib/redis';
import { StatusData, DailyUptime, Incident, COMPONENTS, StatusType } from '@/lib/types';

// 60초마다 재검증
export const revalidate = 60;

async function getStatusData(): Promise<StatusData> {
  try {
    const data = await redis.get<StatusData>(KEYS.CURRENT_STATUS);
    if (data) return data;
  } catch (error) {
    console.error('Failed to fetch status from Redis:', error);
  }

  // 기본값 반환
  return {
    overall: 'operational',
    components: COMPONENTS.map(c => ({
      id: c.id,
      name: c.name,
      status: 'operational' as StatusType,
      latency: 0,
      checkedAt: new Date().toISOString(),
    })),
    updatedAt: new Date().toISOString(),
  };
}

async function getComponentHistory(): Promise<{ [componentId: string]: DailyUptime[] }> {
  const history: { [componentId: string]: DailyUptime[] } = {};

  try {
    const today = new Date();

    for (const component of COMPONENTS) {
      history[component.id] = [];

      // 최근 90일 데이터 조회
      for (let i = 0; i < 90; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const data = await redis.get<DailyUptime>(KEYS.COMPONENT_HISTORY(component.id, dateStr));
        if (data) {
          history[component.id].push(data);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch component history from Redis:', error);
  }

  return history;
}

async function getIncidents(): Promise<Incident[]> {
  try {
    const incidentIds = await redis.lrange(KEYS.INCIDENTS, 0, 10);
    const incidents: Incident[] = [];

    for (const id of incidentIds) {
      const incident = await redis.get<Incident>(KEYS.INCIDENT(id as string));
      if (incident) {
        incidents.push(incident);
      }
    }

    return incidents;
  } catch (error) {
    console.error('Failed to fetch incidents from Redis:', error);
    return [];
  }
}

export default async function HomePage() {
  const [statusData, componentHistory, incidents] = await Promise.all([
    getStatusData(),
    getComponentHistory(),
    getIncidents(),
  ]);

  return (
    <div>
      <StatusBanner status={statusData.overall} />
      <ComponentList components={statusData.components} history={componentHistory} />
      <IncidentList incidents={incidents} />

      <div className="mt-8 text-center text-sm text-gray-400">
        마지막 업데이트: {new Date(statusData.updatedAt).toLocaleString('ko-KR')}
      </div>
    </div>
  );
}
