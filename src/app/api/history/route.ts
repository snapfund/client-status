import { NextRequest, NextResponse } from 'next/server';
import { redis, KEYS } from '@/lib/redis';
import { DailyUptime } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '90');

  try {
    const history: DailyUptime[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const data = await redis.get<DailyUptime>(KEYS.HISTORY(dateStr));
      if (data) {
        history.push(data);
      } else {
        // 데이터 없으면 100% 가정
        history.push({
          date: dateStr,
          uptime: 100,
          checks: 0,
          failures: 0,
        });
      }
    }

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
