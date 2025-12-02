import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { redis, KEYS } from '@/lib/redis';
import { StatusType, ComponentStatus, StatusData } from '@/lib/types';

// 모니터링 대상
const COMPONENTS = [
  {
    id: 'api',
    name: 'API Server',
    url: 'https://api.snapfund.xyz/api/health',
    expectJson: true,
    expectKey: 'status',
  },
  {
    id: 'web',
    name: '메인 사이트',
    url: 'https://snapfund.xyz',
    checkErrorPage: true,
  },
  {
    id: 'dashboard',
    name: '대시보드',
    url: 'https://dash.snapfund.xyz',
    checkErrorPage: true,
  },
  {
    id: 'help',
    name: '고객센터',
    url: 'https://help.snapfund.xyz',
    checkErrorPage: true,
  },
  {
    id: 'payment',
    name: '결제 시스템',
    url: 'https://api.snapfund.xyz/api/payments/health',
    expectJson: true,
    expectKey: 'status',
  },
];

// 에러 페이지 감지 패턴
const ERROR_PATTERNS = [
  '무언가 잘못되었어요',
  '나중에 다시 시도해 주세요',
  '페이지를 찾을 수 없',
  '문제가 발생했습니다',
  'something went wrong',
  'page not found',
  'internal server error',
  'text-[140px].*Oops',
];

// 연속 실패 횟수 기준
const FAIL_THRESHOLD = 3;

// 전체 상태 계산
function calculateOverallStatus(components: ComponentStatus[]): StatusType {
  const statuses = components.map(c => c.status);
  if (statuses.includes('major')) return 'major';
  if (statuses.includes('partial')) return 'partial';
  if (statuses.includes('degraded')) return 'degraded';
  return 'operational';
}

// 응답 본문 검증
async function validateResponse(component: typeof COMPONENTS[0], response: Response) {
  try {
    const text = await response.text();

    // 에러 페이지 패턴 감지 (Oops 페이지 등)
    if (component.checkErrorPage) {
      for (const pattern of ERROR_PATTERNS) {
        if (pattern.includes('.*')) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(text)) {
            return { valid: false, reason: '에러 페이지 감지' };
          }
        } else {
          if (text.includes(pattern)) {
            return { valid: false, reason: '에러 페이지 감지' };
          }
        }
      }
    }

    // JSON 응답 검증 (API용)
    if (component.expectJson) {
      try {
        const json = JSON.parse(text);
        if (component.expectKey && !(component.expectKey in json)) {
          return { valid: false, reason: `"${component.expectKey}" 키 없음` };
        }
      } catch {
        return { valid: false, reason: 'JSON 파싱 실패' };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: (error as Error).message };
  }
}

// 컴포넌트 체크
async function checkComponent(component: typeof COMPONENTS[0]): Promise<ComponentStatus & { error?: string }> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(component.url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SnapFund-HealthCheck/1.0',
      },
    });

    clearTimeout(timeout);
    const latency = Date.now() - startTime;

    // HTTP 상태 코드 확인
    if (response.status >= 500) {
      return {
        id: component.id,
        name: component.name,
        status: 'major',
        latency,
        error: `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      };
    }

    if (response.status >= 400) {
      return {
        id: component.id,
        name: component.name,
        status: 'partial',
        latency,
        error: `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      };
    }

    // 응답 본문 검증
    const validation = await validateResponse(component, response);
    if (!validation.valid) {
      return {
        id: component.id,
        name: component.name,
        status: 'partial',
        latency,
        error: validation.reason,
        checkedAt: new Date().toISOString(),
      };
    }

    // 응답 시간 체크
    const status: StatusType = latency >= 3000 ? 'degraded' : 'operational';

    return {
      id: component.id,
      name: component.name,
      status,
      latency,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id: component.id,
      name: component.name,
      status: 'major',
      latency: Date.now() - startTime,
      error: (error as Error).message,
      checkedAt: new Date().toISOString(),
    };
  }
}

// 상태 한글 변환
function getStatusLabel(status: StatusType): string {
  const labels: Record<StatusType, string> = {
    operational: '정상',
    degraded: '지연',
    partial: '부분 장애',
    major: '장애',
  };
  return labels[status] || status;
}

// Discord 알림 전송
async function sendDiscordAlert(
  type: 'down' | 'degraded' | 'recovered',
  component: ComponentStatus & { error?: string },
  prevStatus: StatusType,
  newStatus: StatusType
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const colors = {
    down: 0xff0000,
    degraded: 0xffaa00,
    recovered: 0x22c55e,
  };

  const emojis = {
    down: '🚨',
    degraded: '⚠️',
    recovered: '✅',
  };

  const descriptions = {
    down: `**${component.name}** 서비스에 장애가 발생했습니다.`,
    degraded: `**${component.name}** 서비스 응답이 지연되고 있습니다.`,
    recovered: `**${component.name}** 서비스가 정상 복구되었습니다.`,
  };

  const embed = {
    title: `${emojis[type]} ${type === 'down' ? '서비스 장애 발생' : type === 'degraded' ? '서비스 지연' : '서비스 복구'}`,
    description: descriptions[type],
    color: colors[type],
    fields: [
      { name: '📍 서비스', value: component.name, inline: true },
      { name: '📊 상태 변경', value: `${getStatusLabel(prevStatus)} → ${getStatusLabel(newStatus)}`, inline: true },
      { name: '⏱️ 응답시간', value: `${component.latency}ms`, inline: true },
    ],
    footer: { text: '🔗 status.snapfund.xyz' },
    timestamp: new Date().toISOString(),
  };

  if (component.error) {
    embed.fields.push({ name: '❌ 오류 내용', value: `\`${component.error}\``, inline: false });
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error('Failed to send Discord alert:', error);
  }
}

// 연속 실패 횟수 관리 및 상태 판정
async function updateFailCount(component: ComponentStatus & { error?: string }) {
  const key = KEYS.FAIL_COUNT(component.id);

  if (component.status === 'operational') {
    await redis.del(key);
    return { shouldAlert: false, confirmedStatus: 'operational' as StatusType };
  }

  const failCount = await redis.incr(key);
  await redis.expire(key, 3600);

  console.log(`  [FailCount] ${component.name}: ${failCount}/${FAIL_THRESHOLD}`);

  if (failCount >= FAIL_THRESHOLD) {
    return { shouldAlert: true, confirmedStatus: component.status };
  }

  return { shouldAlert: false, confirmedStatus: 'operational' as StatusType };
}

// 상태 변경 감지 및 알림
async function handleStatusChange(
  prevComponents: ComponentStatus[] | null,
  newComponents: (ComponentStatus & { error?: string })[]
) {
  for (const newComp of newComponents) {
    const prevComp = prevComponents?.find(c => c.id === newComp.id);
    const prevStatus = prevComp?.status || 'operational';

    const { shouldAlert, confirmedStatus } = await updateFailCount(newComp);
    newComp.status = confirmedStatus;

    if (prevStatus === confirmedStatus) continue;
    if (!shouldAlert && confirmedStatus !== 'operational') continue;

    console.log(`  [Alert] ${newComp.name}: ${prevStatus} → ${confirmedStatus}`);

    if ((confirmedStatus === 'major' || confirmedStatus === 'partial') && prevStatus === 'operational') {
      await sendDiscordAlert('down', newComp, prevStatus, confirmedStatus);
    } else if (confirmedStatus === 'degraded' && prevStatus === 'operational') {
      await sendDiscordAlert('degraded', newComp, prevStatus, confirmedStatus);
    } else if (confirmedStatus === 'operational' && prevStatus !== 'operational') {
      await sendDiscordAlert('recovered', newComp, prevStatus, confirmedStatus);
    }
  }
}

// 컴포넌트별 히스토리 업데이트
async function updateComponentHistory(component: ComponentStatus) {
  const today = new Date().toISOString().split('T')[0];
  const key = KEYS.COMPONENT_HISTORY(component.id, today);

  let history = await redis.get<{ date: string; checks: number; failures: number; uptime: number }>(key);

  if (!history) {
    history = { date: today, checks: 0, failures: 0, uptime: 100 };
  }

  history.checks += 1;
  if (component.status === 'major' || component.status === 'partial') {
    history.failures += 1;
  }
  history.uptime = ((history.checks - history.failures) / history.checks) * 100;

  await redis.set(key, history, { ex: 86400 * 100 });
}

// 전체 히스토리 업데이트
async function updateOverallHistory(components: ComponentStatus[]) {
  const today = new Date().toISOString().split('T')[0];
  const key = KEYS.HISTORY(today);

  let history = await redis.get<{ date: string; checks: number; failures: number; uptime: number }>(key);

  if (!history) {
    history = { date: today, checks: 0, failures: 0, uptime: 100 };
  }

  history.checks += 1;
  const hasFailure = components.some(c => c.status === 'major' || c.status === 'partial');
  if (hasFailure) {
    history.failures += 1;
  }
  history.uptime = ((history.checks - history.failures) / history.checks) * 100;

  await redis.set(key, history, { ex: 86400 * 100 });
}

// 헬스 체크 핸들러
async function handler(req: NextRequest) {
  console.log('Starting health check...');

  // 이전 상태 조회
  const prevData = await redis.get<StatusData>(KEYS.CURRENT_STATUS);

  // 모든 컴포넌트 체크
  const components = await Promise.all(COMPONENTS.map(checkComponent));

  // 전체 상태 계산
  const overall = calculateOverallStatus(components);

  // 현재 상태 데이터
  const statusData: StatusData = {
    overall,
    components,
    updatedAt: new Date().toISOString(),
  };

  // Redis에 저장
  await redis.set(KEYS.CURRENT_STATUS, statusData);

  // 상태 변경 감지 및 알림
  await handleStatusChange(prevData?.components || null, components);

  // 컴포넌트별 히스토리 업데이트
  for (const component of components) {
    await updateComponentHistory(component);
  }

  // 전체 히스토리 업데이트
  await updateOverallHistory(components);

  // 결과 출력
  console.log('Health check completed:');
  console.log(`Overall: ${overall}`);
  components.forEach(c => {
    console.log(`  ${c.name}: ${c.status} (${c.latency}ms)`);
  });

  return NextResponse.json({
    success: true,
    overall,
    components: components.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      latency: c.latency,
    })),
    checkedAt: new Date().toISOString(),
  });
}

// QStash 서명 검증 래퍼
export const POST = verifySignatureAppRouter(handler);

// 수동 테스트용 GET (개발환경)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST with QStash' }, { status: 405 });
  }
  return handler(req);
}
