import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  ipAddress: string;
};

const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return requestContextStore.run(context, callback);
}

export function getRequestContext() {
  return requestContextStore.getStore();
}
