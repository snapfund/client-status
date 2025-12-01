import { NextResponse } from 'next/server';
import { redis, KEYS } from '@/lib/redis';
import { StatusData, COMPONENTS, StatusType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await redis.get<StatusData>(KEYS.CURRENT_STATUS);

    if (data) {
      return NextResponse.json(data);
    }

    // 기본값 반환
    const defaultData: StatusData = {
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

    return NextResponse.json(defaultData);
  } catch (error) {
    console.error('Failed to fetch status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
