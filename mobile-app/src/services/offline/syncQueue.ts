import api from '../api';
import { offlineStoreKeys, readJson, writeJson } from './localStore';
import { retryWithBackoff } from './retry';

export type OfflineQueueItem = {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
};

async function getQueue() {
  return readJson<OfflineQueueItem[]>(offlineStoreKeys.syncQueue, []);
}

async function setQueue(queue: OfflineQueueItem[]) {
  await writeJson(offlineStoreKeys.syncQueue, queue);
}

export const syncQueueService = {
  async enqueue(item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) {
    const queue = await getQueue();
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...item,
    });
    await setQueue(queue);
    return queue.length;
  },

  async pendingCount() {
    const queue = await getQueue();
    return queue.length;
  },

  async flush() {
    const queue = await getQueue();
    const remaining: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        await retryWithBackoff(async () => {
          await api.request({
            method: item.method,
            url: item.path,
            data: item.body,
          });
        });
      } catch {
        remaining.push(item);
      }
    }

    await setQueue(remaining);
    return { processed: queue.length, remaining: remaining.length };
  },
};
