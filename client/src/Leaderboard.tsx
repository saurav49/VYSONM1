import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
const API_KEY =
  '93348c22d930a0b9f8091661b0930a34eb2dd19b2e713396cc85b2f2d7c7ee01';
type ShortUrl = {
  id?: number;
  originalUrl?: string;
  shortCode?: string;
  clicks?: number;
  createdAt?: string;
  lastAccessedAt?: string | null;
};

type ShortenCount = {
  originalUrl?: string;
  _count?: {
    originalUrl?: number;
  };
};

type LeaderboardPayload = {
  tenLatestUrlShortened?: ShortUrl[];
  tenMostPopularUrl?: ShortUrl[];
  tenMostShortenUrl?: ShortenCount[];
};

type ConnectionState = 'connecting' | 'live' | 'disconnected' | 'error';

const formatDate = (value?: string | null) => {
  if (!value) return 'No activity yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const compactUrl = (url?: string) => {
  if (!url) return 'Untitled destination';

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
};

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload>({});
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('connecting');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const socket = new WebSocket(
      `ws://localhost:3000/ws/leaderboard?apiKey=${API_KEY}`,
    );

    socket.onopen = () => {
      setConnectionState('live');
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.event === 'leaderboard_update') {
        setLeaderboard(message.data);
        setLastUpdatedAt(new Date());
      }
    };

    socket.onerror = () => {
      setConnectionState('error');
    };

    socket.onclose = () => {
      setConnectionState((state) =>
        state === 'error' ? 'error' : 'disconnected',
      );
    };

    return () => {
      socket.close();
    };
  }, []);

  const latest = leaderboard.tenLatestUrlShortened ?? [];
  const popular = leaderboard.tenMostPopularUrl ?? [];
  const repeated = leaderboard.tenMostShortenUrl ?? [];

  const totalClicks = useMemo(
    () => popular.reduce((sum, item) => sum + (item.clicks ?? 0), 0),
    [popular],
  );

  const topUrl = popular[0];

  return (
    <main className='leaderboard-shell'>
      <section className='leaderboard-hero'>
        <div>
          <p className='eyebrow'>Live analytics</p>
          <h1>Leaderboard</h1>
          <p className='leaderboard-copy'>
            Real-time URL performance, ranked by clicks, recency, and repeat
            shorten activity.
          </p>
        </div>

        <div className={`connection-pill ${connectionState}`}>
          <span aria-hidden='true' />
          {connectionState}
        </div>
      </section>

      <section className='metric-grid' aria-label='Leaderboard summary'>
        <article className='metric-card primary'>
          <span className='metric-label'>Top destination</span>
          <strong>{compactUrl(topUrl?.originalUrl)}</strong>
          <small>{topUrl?.clicks ?? 0} clicks</small>
        </article>
        <article className='metric-card'>
          <span className='metric-label'>Tracked clicks</span>
          <strong>{totalClicks.toLocaleString()}</strong>
          <small>from top ranked links</small>
        </article>
        <article className='metric-card'>
          <span className='metric-label'>Last update</span>
          <strong>
            {lastUpdatedAt
              ? formatDate(lastUpdatedAt.toISOString())
              : 'Waiting'}
          </strong>
          <small>via websocket</small>
        </article>
      </section>

      <section className='board-layout'>
        <LeaderboardPanel
          title='Most Popular'
          subtitle='Ranked by click volume'
          emptyText='No popular links yet.'
        >
          {popular.map((item, index) => (
            <UrlRow
              key={item.id ?? item.shortCode ?? `${item.originalUrl}-${index}`}
              item={item}
              rank={index + 1}
              accent={`${item.clicks ?? 0} clicks`}
            />
          ))}
        </LeaderboardPanel>

        <LeaderboardPanel
          title='Latest Shortens'
          subtitle='Newest links created'
          emptyText='No recent shortens yet.'
        >
          {latest.map((item, index) => (
            <UrlRow
              key={item.id ?? item.shortCode ?? `${item.originalUrl}-${index}`}
              item={item}
              rank={index + 1}
              accent={formatDate(item.createdAt)}
            />
          ))}
        </LeaderboardPanel>

        <LeaderboardPanel
          title='Repeated Destinations'
          subtitle='Original URLs shortened most often'
          emptyText='No repeated destinations yet.'
          wide
        >
          {repeated.map((item, index) => (
            <div
              className='leaderboard-row'
              key={`${item.originalUrl}-${index}`}
            >
              <div className='rank'>{index + 1}</div>
              <div className='row-main'>
                <strong>{compactUrl(item.originalUrl)}</strong>
                <span>{item.originalUrl}</span>
              </div>
              <div className='row-accent'>
                {item._count?.originalUrl ?? 0} shortens
              </div>
            </div>
          ))}
        </LeaderboardPanel>
      </section>
    </main>
  );
};

function LeaderboardPanel({
  title,
  subtitle,
  emptyText,
  wide,
  children,
}: {
  title: string;
  subtitle: string;
  emptyText: string;
  wide?: boolean;
  children: ReactNode[];
}) {
  return (
    <article className={`leaderboard-panel ${wide ? 'wide' : ''}`}>
      <header>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className='leaderboard-list'>
        {children.length > 0 ? (
          children
        ) : (
          <p className='empty-state'>{emptyText}</p>
        )}
      </div>
    </article>
  );
}

function UrlRow({
  item,
  rank,
  accent,
}: {
  item: ShortUrl;
  rank: number;
  accent: string;
}) {
  return (
    <div className='leaderboard-row'>
      <div className='rank'>{rank}</div>
      <div className='row-main'>
        <strong>{compactUrl(item.originalUrl)}</strong>
        <span>/{item.shortCode ?? 'pending-code'}</span>
      </div>
      <div className='row-accent'>{accent}</div>
    </div>
  );
}

export default Leaderboard;
