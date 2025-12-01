# SnapFund Status Page

SnapFund 서비스 상태 페이지

## 기술 스택

- **Frontend**: Next.js 14 + TailwindCSS
- **Hosting**: Vercel
- **Data Store**: Upstash Redis
- **Monitoring**: GitHub Actions (5분 Cron)
- **Alerts**: Discord Webhook

## 모니터링 대상

| 서비스 | URL |
|--------|-----|
| API Server | https://api.snapfund.xyz/health |
| 메인 사이트 | https://snapfund.xyz |
| 대시보드 | https://dash.snapfund.xyz |
| 고객센터 | https://help.snapfund.xyz |
| 결제 시스템 | https://api.snapfund.xyz/api/payments/health |

## 설정

### 1. Upstash Redis 생성

1. https://upstash.com 접속
2. Redis 데이터베이스 생성
3. REST URL과 Token 복사

### 2. Vercel 배포

```bash
npm install
vercel
```

환경 변수 설정:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 3. GitHub Actions Secrets 설정

Repository Settings > Secrets > Actions:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `DISCORD_WEBHOOK_URL`

### 4. 커스텀 도메인 (Cloudflare)

DNS 레코드 추가:
```
Type: CNAME
Name: status
Target: cname.vercel-dns.com
```

## 개발

```bash
npm install
npm run dev
```

http://localhost:3000 접속

## API

- `GET /api/status` - 현재 상태
- `GET /api/history?days=90` - 가동률 히스토리
- `GET /api/incidents` - 인시던트 목록
