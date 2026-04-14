import api from './api';
import { Visit } from '../types';

export const visitsService = {
  async getTodayVisits(): Promise<Visit[]> {
    const response = await api.get('/visits/today');
    return response.data;
  },

  async getVisits(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<Visit[]> {
    const response = await api.get('/visits', { params });
    return response.data;
  },

  async getVisitById(id: string): Promise<Visit> {
    const response = await api.get(`/visits/${id}`);
    return response.data;
  },

  async clockIn(visitId: string, latitude: number, longitude: number, lateClockInReason?: string): Promise<Visit> {
    const response = await api.post(`/visits/${visitId}/clock-in`, {
      latitude,
      longitude,
      lateClockInReason,
    });
    return response.data;
  },

  async clockOut(visitId: string, latitude: number, longitude: number): Promise<Visit> {
    const response = await api.post(`/visits/${visitId}/clock-out`, {
      latitude,
      longitude,
    });
    return response.data;
  },
};

