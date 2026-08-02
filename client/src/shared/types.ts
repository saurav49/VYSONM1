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

export type { ShortUrl, ShortenCount, LeaderboardPayload, ConnectionState };
