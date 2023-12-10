import * as detect from 'detect-port';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { Metadata } from 'nice-grpc';
import { main } from '@appstack-io/main';
import { ArangodbService, ArangodbUtils } from '@appstack-io/arangodb';

export function isE2E() {
  return process.env.E2E;
}

export async function runMain(opts: {
  publicMicroservicesModule?: any;
  privateMicroservicesModule?: any;
  publicHttpModule?: any;
  privateHttpModule?: any;
  workersModule?: any;
  pubsubModule?: any;
  otel?: boolean;
}) {
  await main(opts);
  await sleep(1000);
}

export async function login(ports: {
  httpInternal: number;
}): Promise<{ accessToken: string; userId: string }> {
  const input = {
    username: uuid(),
    password: uuid(),
  };
  const response = await axios.post(
    `http://localhost:${ports.httpInternal}/auth/local/login`,
    input,
  );
  return response.data;
}

export async function getMetadata(ports: {
  httpInternal: number;
}): Promise<Metadata> {
  const { accessToken } = await login(ports);
  const metadata = new Metadata();
  metadata.set('jwt', accessToken);
  return metadata;
}

const getPorts = async (): Promise<string[]> => {
  for (let i = 0; i < 50; i++) {
    const base = [
      await detect(Math.floor(2000 + Math.random() * 50000)),
      await detect(Math.floor(2000 + Math.random() * 50000)),
      await detect(Math.floor(2000 + Math.random() * 50000)),
      await detect(Math.floor(2000 + Math.random() * 50000)),
      await detect(Math.floor(2000 + Math.random() * 50000)),
      await detect(Math.floor(2000 + Math.random() * 50000)),
    ];
    const set = new Set(base);
    if (base.length === set.size) return base;
  }
  throw new Error('could not get free ports');
};

export async function usePorts() {
  const [a, b, c, d, e, f] = await getPorts();
  if (!isE2E()) {
    process.env.PROTO_PORT = a;
    process.env.PROTO_INTERNAL_PORT = b;
    process.env.HTTP_PORT = c;
    process.env.HTTP_INTERNAL_PORT = d;
    process.env.WORKERS_PORT = e;
    process.env.WS_PORT = f;
  }
  const ports = {
    proto: Number(process.env.PROTO_PORT || 0),
    protoInternal: Number(process.env.PROTO_INTERNAL_PORT || 0),
    http: Number(process.env.HTTP_PORT || 0),
    httpInternal: Number(process.env.HTTP_INTERNAL_PORT || 0),
    workers: Number(process.env.WORKERS_PORT || 0),
    ws: Number(process.env.WS_PORT || 0),
  };
  return ports;
}

export function useHost() {
  return isE2E() ? process.env.SERVICE_HOST : 'localhost';
}

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function retry(
  fn: () => Promise<void>,
  times: number,
  wait: number,
  cleanup?: () => Promise<void>,
) {
  return async () => {
    let error: Error;
    for (let i = 0; i < times; i++) {
      try {
        await fn();
        return;
      } catch (e) {
        error = e;
        if (cleanup) await cleanup();
        await sleep(wait);
      }
    }
    throw error;
  };
}

export async function getArangoDb() {
  const arangodb: ArangodbService = new ArangodbService(new ArangodbUtils());
  await arangodb.initDb();
  return arangodb.db;
}
