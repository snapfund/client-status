import { NextRequest, NextResponse } from 'next/server';
import { redis, KEYS } from '@/lib/redis';
import { Incident } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status'); // 'active' | 'resolved' | null (all)

  try {
    const incidentIds = await redis.lrange(KEYS.INCIDENTS, 0, 50);
    const incidents: Incident[] = [];

    for (const id of incidentIds) {
      const incident = await redis.get<Incident>(KEYS.INCIDENT(id as string));
      if (incident) {
        // 상태 필터링
        if (status === 'active' && incident.status === 'resolved') continue;
        if (status === 'resolved' && incident.status !== 'resolved') continue;

        incidents.push(incident);
      }
    }

    // 최신순 정렬
    incidents.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ incidents });
  } catch (error) {
    console.error('Failed to fetch incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}
