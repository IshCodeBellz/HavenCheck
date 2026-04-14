import api from './api';
import { User } from '../types';

export const usersService = {
  async getUsers(): Promise<User[]> {
    const response = await api.get('/users');
    return response.data;
  },

  async getUserById(id: string): Promise<User> {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: 'CARER' | 'MANAGER' | 'ADMIN' | 'GUARDIAN';
  }): Promise<User> {
    const response = await api.post('/users', data);
    return response.data;
  },

  async updateUser(id: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    role?: 'CARER' | 'MANAGER' | 'ADMIN' | 'GUARDIAN';
    isActive?: boolean;
  }): Promise<User> {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  },
};

