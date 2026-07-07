import { useEffect, useMemo, useState } from 'react';
// import { io } from 'socket.io-client';
import type { ConnectionState, LeaderboardPayload } from './shared/types';
import { compactUrl, formatDate } from './shared/utils';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { UrlRow } from './components/UrlRow';

// const API_KEY =
//   '93348c22d930a0b9f8091661b0930a34eb2dd19b2e713396cc85b2f2d7c7ee01';
// const SOCKET_URL = 'http://localhost:3000';
const SSE_URL = 'http://localhost:3000/api/v1/leaderboard/events';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload>({});
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('connecting');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // PART 1 : WEBSOCKET
  // useEffect(() => {
  //   const socket = new WebSocket(
  //     `ws://localhost:3000/ws/leaderboard?apiKey=${API_KEY}`,
  //   );

  //   socket.onopen = () => {
  //     setConnectionState('live');
  //   };

  //   socket.onmessage = (event) => {
  //     const message = JSON.parse(event.data);

  //     if (message.event === 'leaderboard_update') {
  //       setLeaderboard(message.data);
  //       setLastUpdatedAt(new Date());
  //     }
  //   };

  //   socket.onerror = () => {
  //     setConnectionState('error');
  //   };

  //   socket.onclose = () => {
  //     setConnectionState((state) =>
  //       state === 'error' ? 'error' : 'disconnected',
  //     );
  //   };

  //   return () => {
  //     socket.close();
  //   };
  // }, []);

  // PART 2 : SOCKET IO
  // useEffect(() => {
  //   const socket = io(SOCKET_URL, {
  //     auth: {
  //       apiKey: API_KEY,
  //     },
  //   });

  //   socket.on('connect', () => {
  //     setConnectionState('live');
  //     socket.emit('getLeaderboard');
  //   });

  //   socket.on('leaderboard_update', (data) => {
  //     setLeaderboard(data);
  //     setLastUpdatedAt(new Date());
  //   });

  //   socket.on('disconnect', () => {
  //     setConnectionState('disconnected');
  //   });

  //   socket.on('connect_error', () => {
  //     setConnectionState('error');
  //   });

  //   return () => {
  //     socket.disconnect();
  //   };
  // }, []);

  // PART 3 : SSE
  useEffect(() => {
    const source = new EventSource(SSE_URL);

    source.addEventListener('open', () => {
      setConnectionState('live');
    });
    source.addEventListener('leaderboard_update', (event) => {
      const data = JSON.parse(event.data);
      setLeaderboard(data);
      setLastUpdatedAt(new Date());
    });

    source.addEventListener('error', () => {
      setConnectionState('error');
    });
    return () => {
      source.close();
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

export default Leaderboard;
