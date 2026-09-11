import type { ShortUrl } from '../shared/types';
import { compactUrl } from '../shared/utils';

export function UrlRow({
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
