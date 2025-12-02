import StatusBanner from '@/components/StatusBanner';
import ComponentList from '@/components/ComponentList';
import IncidentList from '@/components/IncidentList';
import { redis, KEYS } from '@/lib/redis';
import { StatusData, DailyUptime, Incident, COMPONENTS, StatusType } from '@/lib/types';

// 동적 렌더링 강제 (Upstash Redis가 no-store fetch 사용)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const HISTORY_DAYS = 30; // 90일 -> 30일로 축소

  // 초기화
  for (const component of COMPONENTS) {
    history[component.id] = [];
  }

  try {
    const today = new Date();
    const keys: string[] = [];
    const keyMap: { componentId: string }[] = [];

    // 모든 키를 한 번에 준비
    for (const component of COMPONENTS) {
      for (let i = 0; i < HISTORY_DAYS; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        keys.push(KEYS.COMPONENT_HISTORY(component.id, dateStr));
        keyMap.push({ componentId: component.id });
      }
    }

    // mget으로 한 번에 조회
    const results = await redis.mget<(DailyUptime | null)[]>(...keys);

    // 결과 매핑
    results.forEach((data, index) => {
      if (data) {
        history[keyMap[index].componentId].push(data);
      }
    });
  } catch (error) {
    console.error('Failed to fetch component history from Redis:', error);
  }

  return history;
}

async function getIncidents(): Promise<Incident[]> {
  try {
    const incidentIds = await redis.lrange(KEYS.INCIDENTS, 0, 10);
    if (!incidentIds || incidentIds.length === 0) return [];

    // mget으로 한 번에 조회 (순차 조회 대신)
    const keys = incidentIds.map(id => KEYS.INCIDENT(id as string));
    const results = await redis.mget<(Incident | null)[]>(...keys);

    return results.filter((incident): incident is Incident => incident !== null);
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
