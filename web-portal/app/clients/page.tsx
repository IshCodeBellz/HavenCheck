'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useRequireStaff } from '@/hooks/useRequireStaff';

interface Client {
  id: string;
  name: string;
  address: string;
  active: boolean;
  contactName?: string;
  contactPhone?: string;
}

export default function ClientsPage() {
  const staffOk = useRequireStaff();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (staffOk) loadClients();
  }, [staffOk]);

  const loadClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/clients/${id}`);
      await loadClients();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete client');
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
          <h1 className="text-3xl font-bold text-navy-900">Clients</h1>
          <Link
            href="/clients/new"
            className="bg-navy-600 text-white px-4 py-2 rounded-md hover:bg-navy-700"
          >
            Add Client
          </Link>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-navy-100">
            {clients.map((client) => (
              <li key={client.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-navy-50">
                    <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className="flex-1">
                          <div className="text-sm font-medium text-navy-900">
                            {client.name}
                          </div>
                          <div className="text-sm text-navy-800/70">{client.address}</div>
                        </div>
                      </div>
                    <div className="ml-4 flex items-center space-x-2">
                        {client.active ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-navy-100 text-navy-800">
                            Inactive
                          </span>
                        )}
                      <Link
                        href={`/clients/${client.id}/edit`}
                        className="text-navy-600 hover:text-navy-800 text-sm font-medium"
                        aria-label={`Edit client ${client.name}`}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(client.id)}
                        disabled={deletingId === client.id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                        aria-label={`Delete client ${client.name}`}
                      >
                        {deletingId === client.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}

