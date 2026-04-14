'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useRequireStaff } from '@/hooks/useRequireStaff';

interface Client {
  id: string;
  name: string;
}

interface ChecklistItem {
  label: string;
  type: 'BOOLEAN' | 'TEXT' | 'NUMBER' | 'SELECT';
  required: boolean;
  optionsJson?: string;
}

export default function NewChecklistPage() {
  const staffOk = useRequireStaff();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientId: '',
  });
  const [items, setItems] = useState<ChecklistItem[]>([
    { label: '', type: 'BOOLEAN', required: false },
  ]);

  useEffect(() => {
    if (staffOk) loadClients();
  }, [staffOk]);

  const loadClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data.filter((c: any) => c.active));
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { label: '', type: 'BOOLEAN', required: false }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ChecklistItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate items
      const validItems = items.filter((item) => item.label.trim().length > 0);
      if (validItems.length === 0) {
        setError('At least one checklist item is required');
        setLoading(false);
        return;
      }

      // Process SELECT items - convert options string to JSON
      const processedItems = validItems.map((item) => {
        if (item.type === 'SELECT' && item.optionsJson) {
          // Validate options JSON format
          try {
            const options = item.optionsJson.split(',').map((opt) => opt.trim());
            return {
              ...item,
              optionsJson: JSON.stringify(options),
            };
          } catch (err) {
            throw new Error(`Invalid options format for "${item.label}". Use comma-separated values.`);
          }
        }
        return item;
      });

      const payload: any = {
        name: formData.name,
        description: formData.description || undefined,
        items: processedItems,
      };

      if (formData.clientId) {
        payload.clientId = formData.clientId;
      }

      await api.post('/checklists/templates', payload);
      router.push('/checklists');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create checklist template');
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

  return (
    <Layout>
      <div>
        <div className="mb-6">
          <Link
            href="/checklists"
            className="text-navy-600 hover:text-navy-800 mb-4 inline-block"
          >
            ← Back to Checklists
          </Link>
          <h1 className="text-3xl font-bold text-navy-900">New Checklist Template</h1>
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
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label htmlFor="checklist-template-name" className="block text-sm font-medium text-navy-800 mb-1">
                Template Name *
              </label>
              <input
                id="checklist-template-name"
                type="text"
                required
                aria-required="true"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
                placeholder="e.g., Daily Care Checklist"
              />
            </div>

            <div>
              <label htmlFor="checklist-template-description" className="block text-sm font-medium text-navy-800 mb-1">
                Description
              </label>
              <textarea
                id="checklist-template-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
                placeholder="Optional description"
              />
            </div>

            <div>
              <label htmlFor="checklist-template-client" className="block text-sm font-medium text-navy-800 mb-1">
                Client (Optional)
              </label>
              <select
                id="checklist-template-client"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              >
                <option value="">All Clients (General Template)</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <p id="checklist-items-heading" className="block text-sm font-medium text-navy-800">
                  Checklist Items *
                </p>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-navy-600 hover:text-navy-800 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded-sm"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-4" role="group" aria-labelledby="checklist-items-heading">
                {items.map((item, index) => (
                  <fieldset key={index} className="border rounded-lg p-4 border-navy-100">
                    <legend className="text-sm font-medium text-navy-800 px-1">
                      Item {index + 1}
                    </legend>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2">
                      <div className="sm:col-span-2">
                        <label htmlFor={`checklist-item-${index}-label`} className="block text-xs font-medium text-navy-800 mb-1">
                          Item Label *
                        </label>
                        <input
                          id={`checklist-item-${index}-label`}
                          type="text"
                          value={item.label}
                          onChange={(e) => updateItem(index, 'label', e.target.value)}
                          className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-sm text-navy-900"
                          placeholder="e.g., Medication given"
                        />
                      </div>

                      <div>
                        <label htmlFor={`checklist-item-${index}-type`} className="block text-xs font-medium text-navy-800 mb-1">
                          Type *
                        </label>
                        <select
                          id={`checklist-item-${index}-type`}
                          value={item.type}
                          onChange={(e) =>
                            updateItem(index, 'type', e.target.value as ChecklistItem['type'])
                          }
                          className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-sm text-navy-900"
                        >
                          <option value="BOOLEAN">Yes/No</option>
                          <option value="TEXT">Text</option>
                          <option value="NUMBER">Number</option>
                          <option value="SELECT">Select (Dropdown)</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <div className="flex items-center">
                          <input
                            id={`checklist-item-${index}-required`}
                            type="checkbox"
                            checked={item.required}
                            onChange={(e) => updateItem(index, 'required', e.target.checked)}
                            className="mr-2 h-4 w-4 rounded border-navy-200 text-navy-600 focus:ring-navy-600"
                          />
                          <label htmlFor={`checklist-item-${index}-required`} className="text-sm text-navy-800">
                            Required
                          </label>
                        </div>
                      </div>

                      {item.type === 'SELECT' && (
                        <div className="sm:col-span-2">
                          <label htmlFor={`checklist-item-${index}-options`} className="block text-xs font-medium text-navy-800 mb-1">
                            Options (comma-separated) *
                          </label>
                          <input
                            id={`checklist-item-${index}-options`}
                            type="text"
                            value={item.optionsJson || ''}
                            onChange={(e) => updateItem(index, 'optionsJson', e.target.value)}
                            className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-sm text-navy-900"
                            placeholder="e.g., Option 1, Option 2, Option 3"
                          />
                        </div>
                      )}

                      <div className="sm:col-span-2 flex justify-end">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-sm text-red-600 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-sm"
                            aria-label={`Remove checklist item ${index + 1}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/checklists"
              className="px-4 py-2 border border-navy-200 rounded-md text-navy-800 hover:bg-navy-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

