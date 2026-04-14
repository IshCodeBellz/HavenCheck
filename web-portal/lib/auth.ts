import { api } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string | null;
  organizationCode?: string | null;
  role: 'CARER' | 'MANAGER' | 'ADMIN' | 'GUARDIAN';
  isActive: boolean;
  emailVerified?: boolean;
}

export interface LoginCredentials {
  email: string;
  organizationCode: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  companyName: string;
  organizationCode: string;
  email: string;
  password: string;
}

export interface CreateOrganizationPayload {
  companyName: string;
  organizationCode: string;
}

export const authService = {
  async createOrganization(payload: CreateOrganizationPayload) {
    const response = await api.post('/auth/organizations', payload);
    return response.data as { id: string; name: string; code: string };
  },

  async register(payload: RegisterPayload) {
    const response = await api.post('/auth/register', payload);
    const { token, user, requiresApproval, requiresEmailVerification, message } = response.data;

    if (token && user && typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
    }

    return {
      token,
      user,
      requiresApproval: !!requiresApproval,
      requiresEmailVerification: !!requiresEmailVerification,
      message,
    };
  },

  async verifyEmail(token: string) {
    await api.post('/auth/verify-email', { token });
  },

  async resendVerificationEmail(email: string) {
    const response = await api.post('/auth/resend-verification', { email: email.trim() });
    return response.data as { message: string };
  },

  async login(credentials: LoginCredentials) {
    const response = await api.post('/auth/login', credentials);
    const { token, user } = response.data;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
    
    return { token, user };
  },

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      return null;
    }
  },

  getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  persistUser(user: User) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('haven-user-updated'));
  },

  async refreshSessionUser(): Promise<User | null> {
    const u = await this.getCurrentUser();
    if (u) this.persistUser(u);
    return u;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('authToken');
  },
};

