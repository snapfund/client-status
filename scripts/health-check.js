require('dotenv').config();
const { Redis } = require('@upstash/redis');

// 환경 변수
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Redis 클라이언트
const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

// 모니터링 대상
const COMPONENTS = [
  {
    id: 'api',
    name: 'API Server',
    url: 'https://api.snapfund.xyz/health',
    expectJson: true,  // JSON 응답 기대
    expectKey: 'status', // 응답에 이 키가 있어야 함
  },
  {
    id: 'web',
    name: '메인 사이트',
    url: 'https://snapfund.xyz',
    expectText: 'SnapFund', // 응답에 이 텍스트가 포함되어야 함
  },
  {
    id: 'dashboard',
    name: '대시보드',
    url: 'https://dash.snapfund.xyz',
    expectText: 'SnapFund',
  },
  {
    id: 'help',
    name: '고객센터',
    url: 'https://help.snapfund.xyz',
    expectText: 'SnapFund',
  },
  {
    id: 'payment',
    name: '결제 시스템',
    url: 'https://api.snapfund.xyz/api/payments/health',
    expectJson: true,
    expectKey: 'status',
  },
];

// 에러 페이지 감지 패턴 (본문에서 검색)
const ERROR_PATTERNS = [
  '무언가 잘못되었어요',
  '나중에 다시 시도해 주세요',
  '페이지를 찾을 수 없',
  '문제가 발생했습니다',
  'something went wrong',
  'page not found',
  'internal server error',
  'text-[140px].*Oops',  // Oops 에러 페이지 특유의 패턴
];

// Redis Keys
const KEYS = {
  CURRENT_STATUS: 'status:current',
  HISTORY: (date) => `status:history:${date}`,
  COMPONENT_HISTORY: (componentId, date) => `status:component:${componentId}:${date}`,
  PREV_STATUS: 'status:previous',
};

// 전체 상태 계산
function calculateOverallStatus(components) {
  const statuses = components.map(c => c.status);
  if (statuses.includes('major')) return 'major';
  if (statuses.includes('partial')) return 'partial';
  if (statuses.includes('degraded')) return 'degraded';
  return 'operational';
}

// 응답 본문 검증
async function validateResponse(component, response) {
  try {
    const text = await response.text();

    // 에러 페이지 패턴 감지
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.includes('.*')) {
        // 정규식 패턴
        const regex = new RegExp(pattern, 'i');
        if (regex.test(text)) {
          return { valid: false, reason: '에러 페이지 감지' };
        }
      } else {
        // 단순 텍스트 매칭
        if (text.includes(pattern)) {
          return { valid: false, reason: `에러 페이지 감지: "${pattern}"` };
        }
      }
    }

    // JSON 응답 검증
    if (component.expectJson) {
      try {
        const json = JSON.parse(text);
        if (component.expectKey && !(component.expectKey in json)) {
          return { valid: false, reason: `응답에 "${component.expectKey}" 키 없음` };
        }
      } catch {
        return { valid: false, reason: 'JSON 파싱 실패' };
      }
    }

    // 특정 텍스트 포함 검증
    if (component.expectText && !text.includes(component.expectText)) {
      return { valid: false, reason: `"${component.expectText}" 텍스트 없음` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

// 컴포넌트 체크
async function checkComponent(component) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(component.url, {
      method: 'GET',
      signal: controller.signal,
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
        httpStatus: response.status,
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
        httpStatus: response.status,
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
        httpStatus: response.status,
        error: validation.reason,
        checkedAt: new Date().toISOString(),
      };
    }

    // 응답 시간 체크
    const status = latency >= 3000 ? 'degraded' : 'operational';

    return {
      id: component.id,
      name: component.name,
      status,
      latency,
      httpStatus: response.status,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id: component.id,
      name: component.name,
      status: 'major',
      latency: Date.now() - startTime,
      httpStatus: null,
      error: error.message,
      checkedAt: new Date().toISOString(),
    };
  }
}

// Discord 알림 전송
async function sendDiscordAlert(type, component, prevStatus, newStatus) {
  if (!DISCORD_WEBHOOK_URL) return;

  const colors = {
    down: 0xff0000,      // 빨강
    degraded: 0xffaa00,  // 주황
    recovered: 0x00ff00, // 초록
  };

  const titles = {
    down: `🔴 ${component.name} 장애 발생`,
    degraded: `🟡 ${component.name} 성능 저하`,
    recovered: `🟢 ${component.name} 복구 완료`,
  };

  const embed = {
    title: titles[type],
    color: colors[type],
    fields: [
      { name: '서비스', value: component.name, inline: true },
      { name: '상태', value: `${prevStatus} → ${newStatus}`, inline: true },
      { name: '응답시간', value: `${component.latency}ms`, inline: true },
    ],
    footer: { text: 'SnapFund Status' },
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error('Failed to send Discord alert:', error);
  }
}

// 상태 변경 감지 및 알림
async function handleStatusChange(prevComponents, newComponents) {
  for (const newComp of newComponents) {
    const prevComp = prevComponents?.find(c => c.id === newComp.id);
    const prevStatus = prevComp?.status || 'operational'; // 첫 실행시 operational로 간주
    const newStatus = newComp.status;

    // 상태가 동일하면 스킵
    if (prevStatus === newStatus) continue;

    console.log(`  [Alert] ${newComp.name}: ${prevStatus} → ${newStatus}`);

    // 장애 발생
    if ((newStatus === 'major' || newStatus === 'partial') && prevStatus === 'operational') {
      await sendDiscordAlert('down', newComp, prevStatus, newStatus);
    }
    // 성능 저하
    else if (newStatus === 'degraded' && prevStatus === 'operational') {
      await sendDiscordAlert('degraded', newComp, prevStatus, newStatus);
    }
    // 복구
    else if (newStatus === 'operational' && (prevStatus === 'major' || prevStatus === 'partial' || prevStatus === 'degraded')) {
      await sendDiscordAlert('recovered', newComp, prevStatus, newStatus);
    }
  }
}

// 컴포넌트별 히스토리 업데이트
async function updateComponentHistory(component) {
  const today = new Date().toISOString().split('T')[0];
  const key = KEYS.COMPONENT_HISTORY(component.id, today);

  let history = await redis.get(key);

  if (!history) {
    history = {
      date: today,
      checks: 0,
      failures: 0,
      uptime: 100,
    };
  }

  // 체크 횟수 증가
  history.checks += 1;

  // 장애가 있으면 failures 증가
  if (component.status === 'major' || component.status === 'partial') {
    history.failures += 1;
  }

  // 가동률 계산
  history.uptime = ((history.checks - history.failures) / history.checks) * 100;

  // 100일 TTL로 저장
  await redis.set(key, history, { ex: 86400 * 100 });
}

// 전체 히스토리 업데이트
async function updateOverallHistory(components) {
  const today = new Date().toISOString().split('T')[0];
  const key = KEYS.HISTORY(today);

  let history = await redis.get(key);

  if (!history) {
    history = {
      date: today,
      checks: 0,
      failures: 0,
      uptime: 100,
    };
  }

  // 체크 횟수 증가
  history.checks += 1;

  // 장애가 있으면 failures 증가
  const hasFailure = components.some(c => c.status === 'major' || c.status === 'partial');
  if (hasFailure) {
    history.failures += 1;
  }

  // 가동률 계산
  history.uptime = ((history.checks - history.failures) / history.checks) * 100;

  // 100일 TTL로 저장
  await redis.set(key, history, { ex: 86400 * 100 });
}

// 메인 함수
async function main() {
  console.log('Starting health check...');

  // 이전 상태 조회
  const prevData = await redis.get(KEYS.CURRENT_STATUS);

  // 모든 컴포넌트 체크
  const components = await Promise.all(COMPONENTS.map(checkComponent));

  // 전체 상태 계산
  const overall = calculateOverallStatus(components);

  // 현재 상태 데이터
  const statusData = {
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
}

main().catch(console.error);
