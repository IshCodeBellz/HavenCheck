'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useRequireStaff } from '@/hooks/useRequireStaff';

interface Carer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
}

export default function EditCarerPage() {
  const staffOk = useRequireStaff();
  const router = useRouter();
  const params = useParams();
  const carerId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'CARER' as 'CARER' | 'MANAGER' | 'ADMIN' | 'GUARDIAN',
    isActive: true,
  });

  useEffect(() => {
    if (staffOk && carerId) loadCarer();
  }, [staffOk, carerId]);

  const loadCarer = async () => {
    try {
      const response = await api.get(`/users/${carerId}`);
      const carer: Carer = response.data;
      setFormData({
        name: carer.name,
        email: carer.email,
        phone: carer.phone || '',
        role: carer.role as 'CARER' | 'MANAGER' | 'ADMIN' | 'GUARDIAN',
        isActive: carer.isActive,
      });
    } catch (err: any) {
      setError('Failed to load carer');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive,
      };

      if (formData.phone) payload.phone = formData.phone;

      await api.patch(`/users/${carerId}`, payload);
      router.push('/carers');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update carer');
    } finally {
      setSaving(false);
    }
  };

  if (staffOk === null || staffOk === false) {
    return (
      <Layout>
        <p role="status" aria-live="polite" className="text-navy-800">
          {staffOk === false ? 'Redirecting…' : 'Checking access…'}
        </p>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <p role="status" aria-live="polite" className="text-navy-800">
          Loading…
        </p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div className="mb-6">
          <Link
            href="/carers"
            className="text-navy-600 hover:text-navy-800 mb-4 inline-block"
          >
            ← Back to Carers
          </Link>
          <h1 className="text-3xl font-bold text-navy-900">Edit Carer</h1>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-carer-name" className="block text-sm font-medium text-navy-800 mb-1">
                Name *
              </label>
              <input
                id="edit-carer-name"
                type="text"
                required
                aria-required="true"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-carer-email" className="block text-sm font-medium text-navy-800 mb-1">
                Email *
              </label>
              <input
                id="edit-carer-email"
                type="email"
                required
                aria-required="true"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-carer-phone" className="block text-sm font-medium text-navy-800 mb-1">
                Phone
              </label>
              <input
                id="edit-carer-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-carer-role" className="block text-sm font-medium text-navy-800 mb-1">
                Role *
              </label>
              <select
                id="edit-carer-role"
                required
                aria-required="true"
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as 'CARER' | 'MANAGER' | 'ADMIN' | 'GUARDIAN',
                  })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              >
                <option value="CARER">Carer</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
                <option value="GUARDIAN">Guardian</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center">
                <input
                  id="edit-carer-active"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="mr-2 h-4 w-4 rounded border-navy-200 text-navy-600 focus:ring-navy-600"
                />
                <label htmlFor="edit-carer-active" className="text-sm font-medium text-navy-800">
                  Active
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/carers"
              className="px-4 py-2 border border-navy-200 rounded-md text-navy-800 hover:bg-navy-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

