import api from './api';
import { Schedule } from '../types';

export const schedulesService = {
  async getWeeklyRota(carerId?: string, weekStart?: string): Promise<{
    weekStart: string;
    schedules: Record<string, Schedule[]>;
  }> {
    const params: any = {};
    if (carerId) params.carerId = carerId;
    if (weekStart) params.weekStart = weekStart;
    
    const response = await api.get('/schedules/weekly', { params });
    return response.data;
  },

  async getSchedules(params?: {
    startDate?: string;
    endDate?: string;
    carerId?: string;
    clientId?: string;
  }): Promise<Schedule[]> {
    const response = await api.get('/schedules', { params });
    return response.data;
  },

  async createSchedule(data: {
    clientId: string;
    carerId: string;
    startTime: string;
    endTime: string;
  }): Promise<Schedule> {
    const response = await api.post('/schedules', data);
    return response.data;
  },

  async deleteSchedule(id: string): Promise<void> {
    await api.delete(`/schedules/${id}`);
  },
};

