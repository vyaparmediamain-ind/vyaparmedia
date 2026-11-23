import { vi } from "vitest";

export interface MockModelDelegate {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
}

export function createModelDelegateMock(): MockModelDelegate {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({}),
    groupBy: vi.fn().mockResolvedValue([]),
  };
}

export interface MockPrismaClient {
  user: MockModelDelegate;
  brandProfile: MockModelDelegate;
  influencerProfile: MockModelDelegate;
  campaign: MockModelDelegate;
  deal: MockModelDelegate;
  transaction: MockModelDelegate;
  escrowAuditLog: MockModelDelegate;
  activityLog: MockModelDelegate;
  drsScoreSnapshot: MockModelDelegate;
  verificationDocument: MockModelDelegate;
  bankAccount: MockModelDelegate;
  indiaTaxCompliance: MockModelDelegate;
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $executeRaw: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

/**
 * Creates a type-safe mock of PrismaClient matching VyaparMedia schema delegates.
 */
export function createPrismaMock(): MockPrismaClient {
  const client: MockPrismaClient = {
    user: createModelDelegateMock(),
    brandProfile: createModelDelegateMock(),
    influencerProfile: createModelDelegateMock(),
    campaign: createModelDelegateMock(),
    deal: createModelDelegateMock(),
    transaction: createModelDelegateMock(),
    escrowAuditLog: createModelDelegateMock(),
    activityLog: createModelDelegateMock(),
    drsScoreSnapshot: createModelDelegateMock(),
    verificationDocument: createModelDelegateMock(),
    bankAccount: createModelDelegateMock(),
    indiaTaxCompliance: createModelDelegateMock(),
    $transaction: vi.fn().mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: MockPrismaClient) => unknown)(client);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    }),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  };

  return new Proxy(client, {
    get(target, prop: string) {
      if (prop in target) {
        return target[prop];
      }
      // Dynamically instantiate model delegates on access if not explicitly defined
      target[prop] = createModelDelegateMock();
      return target[prop];
    },
  });
}
