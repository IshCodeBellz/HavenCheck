'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRequireStaff } from '@/hooks/useRequireStaff';

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  client?: { name: string };
  items: Array<{ label: string; type: string }>;
  createdAt: string;
}

export default function ChecklistsPage() {
  const staffOk = useRequireStaff();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (staffOk) loadTemplates();
  }, [staffOk]);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/checklists/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-bold text-navy-900">Checklist Templates</h1>
          <Link
            href="/checklists/new"
            className="bg-navy-600 text-white px-4 py-2 rounded-md hover:bg-navy-700"
          >
            Create Template
          </Link>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {templates.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-navy-800/70">No checklist templates found</p>
              <Link
                href="/checklists/new"
                className="mt-4 inline-block text-navy-600 hover:text-navy-800"
              >
                Create your first template
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-navy-100">
              {templates.map((template) => (
                <li key={template.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-navy-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-navy-900">
                            {template.name}
                          </h3>
                          {template.client && (
                            <span className="ml-2 text-sm text-navy-800/70">
                              (for {template.client.name})
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="mt-1 text-sm text-navy-800/70">{template.description}</p>
                        )}
                        <div className="mt-2 flex items-center text-sm text-navy-800/70">
                          <span>{template.items.length} items</span>
                          <span className="mx-2">•</span>
                          <span>
                            Created {format(new Date(template.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Link
                          href={`/checklists/${template.id}/edit`}
                          className="text-sm text-navy-600 hover:text-navy-800 font-medium"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}

