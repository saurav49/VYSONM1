type CreateUserInput = {
  email?: string;
  name?: string;
};

type User = {
  id: number;
  email: string;
  name: string | null;
  apiKey: string;
  tier: any;
  file: string | null;
  thumbnail: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export type { CreateUserInput, User };
