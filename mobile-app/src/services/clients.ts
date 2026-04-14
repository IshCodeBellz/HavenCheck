import api, { apiV1 } from './api';
import { Client } from '../types';

export const clientsService = {
  async getClients(): Promise<Client[]> {
    const response = await api.get('/clients');
    return response.data;
  },

  /** Active clients in the signed-in manager/admin organisation (v1). */
  async getManagerClients(): Promise<Client[]> {
    const response = await apiV1.get<Client[]>('/manager/clients');
    return response.data;
  },

  async getClientById(id: string): Promise<Client> {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  async createClient(data: {
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusMeters?: number;
    contactName?: string;
    contactPhone?: string;
    notes?: string;
  }): Promise<Client> {
    const response = await api.post('/clients', data);
    return response.data;
  },

  async updateClient(id: string, data: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusMeters?: number;
    contactName?: string;
    contactPhone?: string;
    notes?: string;
    active?: boolean;
  }): Promise<Client> {
    const response = await api.patch(`/clients/${id}`, data);
    return response.data;
  },
};

