import type { ReactNode } from 'react';

export function LeaderboardPanel({
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
