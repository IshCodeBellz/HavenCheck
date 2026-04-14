'use client';

import { useEffect, useState } from 'react';
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

export default function CarersPage() {
  const staffOk = useRequireStaff();
  const [carers, setCarers] = useState<Carer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (staffOk) loadCarers();
  }, [staffOk]);

  const loadCarers = async () => {
    try {
      const response = await api.get('/users');
      setCarers(response.data);
    } catch (error) {
      console.error('Error loading carers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this carer? This action cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      // Note: Backend doesn't have delete endpoint for users, so we'll deactivate instead
      await api.patch(`/users/${id}`, { isActive: false });
      await loadCarers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to deactivate carer');
    } finally {
      setDeletingId(null);
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-navy-900">Carers</h1>
          <Link
            href="/carers/new"
            className="bg-navy-600 text-white px-4 py-2 rounded-md hover:bg-navy-700"
          >
            Add Carer
          </Link>
        </div>

        <div className="bg-white shadow overflow-x-auto sm:rounded-md">
          <table className="w-full min-w-[900px] divide-y divide-navy-100">
            <caption className="sr-only">Carers and staff accounts</caption>
            <thead className="bg-navy-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Phone
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-navy-800/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-navy-100">
              {carers.map((carer) => (
                <tr key={carer.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-navy-900">
                    {carer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {carer.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {carer.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-800/70">
                    {carer.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {carer.isActive ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-navy-100 text-navy-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-3">
                      <Link
                        href={`/carers/${carer.id}/edit`}
                        className="text-navy-600 hover:text-navy-800"
                        aria-label={`Edit carer ${carer.name}`}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(carer.id)}
                        disabled={deletingId === carer.id}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        aria-label={`Deactivate carer ${carer.name}`}
                      >
                        {deletingId === carer.id ? 'Deactivating...' : 'Deactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

