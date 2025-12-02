import StatusBanner from '@/components/StatusBanner';
import ComponentList from '@/components/ComponentList';
import IncidentList from '@/components/IncidentList';
import { redis, KEYS } from '@/lib/redis';
import { StatusData, DailyUptime, Incident, COMPONENTS, StatusType } from '@/lib/types';

// 동적 렌더링 (캐시 없음)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HISTORY_DAYS = 90;

async function getAllData() {
  const defaultStatus: StatusData = {
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

  const componentHistory: { [componentId: string]: DailyUptime[] } = {};
  for (const component of COMPONENTS) {
    componentHistory[component.id] = [];
  }

  try {
    // 파이프라인으로 모든 데이터 한 번에 조회
    const pipeline = redis.pipeline();

    // 현재 상태
    pipeline.get(KEYS.CURRENT_STATUS);

    // 히스토리 키 준비
    const today = new Date();
    const historyKeyMap: { componentId: string }[] = [];

    for (const component of COMPONENTS) {
      for (let i = 0; i < HISTORY_DAYS; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        pipeline.get(KEYS.COMPONENT_HISTORY(component.id, dateStr));
        historyKeyMap.push({ componentId: component.id });
      }
    }

    // 인시던트 ID 목록
    pipeline.lrange(KEYS.INCIDENTS, 0, 10);

    // 파이프라인 실행 (단일 HTTP 요청)
    const results = await pipeline.exec();

    // 결과 파싱
    const statusData = (results[0] as StatusData) || defaultStatus;

    // 히스토리 파싱
    for (let i = 0; i < historyKeyMap.length; i++) {
      const data = results[1 + i] as DailyUptime | null;
      if (data) {
        componentHistory[historyKeyMap[i].componentId].push(data);
      }
    }

    // 인시던트 ID 파싱
    const incidentIds = results[1 + historyKeyMap.length] as string[] || [];

    // 인시던트 상세 조회
    let incidents: Incident[] = [];
    if (incidentIds.length > 0) {
      const incidentPipeline = redis.pipeline();
      for (const id of incidentIds) {
        incidentPipeline.get(KEYS.INCIDENT(id));
      }
      const incidentResults = await incidentPipeline.exec();
      incidents = incidentResults.filter((inc): inc is Incident => inc !== null);
    }

    return { statusData, componentHistory, incidents };
  } catch (error) {
    console.error('Failed to fetch data from Redis:', error);
    return { statusData: defaultStatus, componentHistory, incidents: [] };
  }
}

export default async function HomePage() {
  const { statusData, componentHistory, incidents } = await getAllData();

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
