import api from './api';

export type GuardianFeedItem = {
  id: string;
  type: 'visit' | 'note' | 'incident';
  createdAt: string;
  client: { id: string; name: string };
  headline: string;
  subheadline?: string;
  visit?: {
    id: string;
    status: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    clockInTime: string | null;
    clockOutTime: string | null;
    durationMinutes: number | null;
    carerName: string | null;
  };
  note?: { id: string; text: string; type: string; priority: string };
  incident?: {
    id: string;
    category: string;
    severity: string;
    status: string;
    safeguardingFlag: boolean;
    details: string | null;
    reportedAt: string;
  };
};

export const guardianService = {
  async getFeed(clientId?: string, since?: string): Promise<GuardianFeedItem[]> {
    const response = await api.get<GuardianFeedItem[]>('/guardian/feed', {
      params: {
        ...(clientId ? { clientId } : {}),
        ...(since ? { since } : {}),
      },
    });
    return response.data;
  },

  async registerDevice(expoPushToken: string): Promise<void> {
    await api.post('/guardian/device', { expoPushToken });
  },
};
