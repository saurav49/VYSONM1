type CreateShortCodeBody = {
  originalUrl?: string;
  expiryDate?: string;
  code?: string;
  password?: string;
};

type BatchCreateShortCodeBody = CreateShortCodeBody[];

type PatchShortCodeBody = {
  code?: string;
  expiryDate?: string;
  password?: string;
};

export type {
  BatchCreateShortCodeBody,
  CreateShortCodeBody,
  PatchShortCodeBody,
};
