declare module "ioredis" {
  import { EventEmitter } from "node:events";

  export interface RedisOptions {
    lazyConnect?: boolean;
    connectTimeout?: number;
    enableOfflineQueue?: boolean;
    maxRetriesPerRequest?: number | null;
    commandTimeout?: number;
    enableReadyCheck?: boolean;
    retryStrategy?: (times: number) => number | false | null;
    [key: string]: unknown;
  }

  export interface Pipeline {
    exec(): Promise<[Error | null, unknown][] | null>;
    get(key: string): this;
    set(key: string, value: string, ...args: unknown[]): this;
    setex(key: string, seconds: number, value: string): this;
    del(...keys: string[]): this;
    hset(key: string, field: string, value: string): this;
    hdel(key: string, ...fields: string[]): this;
    [key: string]: unknown;
  }

  export default class Redis extends EventEmitter {
    constructor(port?: number, host?: string, options?: RedisOptions);
    constructor(path: string, options?: RedisOptions);
    constructor(options?: RedisOptions);

    status: string;

    ping(): Promise<string>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string | number, ...args: (string | number)[]): Promise<string | null>;
    setex(key: string, seconds: number, value: string): Promise<string>;
    del(...keys: (string | string[])[]): Promise<number>;
    ttl(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    incr(key: string): Promise<number>;
    incrby(key: string, increment: number): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    smembers(key: string): Promise<string[]>;
    sadd(key: string, ...members: string[]): Promise<number>;
    srem(key: string, ...members: string[]): Promise<number>;
    scard(key: string): Promise<number>;
    hset(key: string, field: string, value: string): Promise<number>;
    hdel(key: string, ...fields: string[]): Promise<number>;
    scan(cursor: string | number, ...args: unknown[]): Promise<[string, string[]]>;
    eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
    mget(...keys: string[]): Promise<(string | null)[]>;
    pipeline(): Pipeline;
    disconnect(reconnect?: boolean): void;
    quit(): Promise<"OK">;
  }
}
