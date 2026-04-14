'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useRequireStaff } from '@/hooks/useRequireStaff';
import AddressAutocompleteTextarea from '@/components/AddressAutocompleteTextarea';
import type { AxiosError } from 'axios';
import ClientProfileForm from '@/components/client-profile/ClientProfileForm';
import type { ClientProfile } from '@/lib/clientProfile';
import { parseClientProfile, sanitizeProfileForApi } from '@/lib/clientProfile';

const ClientLocationPicker = dynamic(() => import('@/components/ClientLocationPicker'), {
  ssr: false,
});

interface Client {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  active: boolean;
  profile?: unknown;
}

interface ClientDocument {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: 'CARE_PLAN' | 'CONSENT' | 'MEDICATION' | 'RISK_ASSESSMENT' | 'OTHER';
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
    role: string;
  };
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export default function EditClientPage() {
  const staffOk = useRequireStaff();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentCategory, setDocumentCategory] = useState<ClientDocument['category']>('OTHER');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    geofenceRadiusMeters: '',
    contactName: '',
    contactPhone: '',
    notes: '',
    active: true,
  });
  const [profileDraft, setProfileDraft] = useState<ClientProfile>({});

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    const apiErr = err as AxiosError<ApiErrorPayload>;
    return apiErr.response?.data?.message || apiErr.response?.data?.error || fallback;
  };

  const loadClient = useCallback(async () => {
    try {
      const response = await api.get(`/clients/${clientId}`);
      const client: Client = response.data;
      setFormData({
        name: client.name,
        address: client.address,
        latitude: client.latitude?.toString() || '',
        longitude: client.longitude?.toString() || '',
        geofenceRadiusMeters:
          client.geofenceRadiusMeters != null && client.geofenceRadiusMeters >= 1
            ? String(client.geofenceRadiusMeters)
            : '100',
        contactName: client.contactName || '',
        contactPhone: client.contactPhone || '',
        notes: client.notes || '',
        active: client.active,
      });
      setProfileDraft(parseClientProfile(client.profile));
    } catch {
      setError('Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const loadDocuments = useCallback(async () => {
    try {
      setDocumentsError(null);
      const response = await api.get(`/clients/${clientId}/documents`);
      setDocuments(response.data);
    } catch {
      setDocumentsError('Failed to load client documents');
    } finally {
      setLoadingDocuments(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (staffOk && clientId) loadClient();
  }, [staffOk, clientId, loadClient]);

  useEffect(() => {
    if (staffOk && clientId) loadDocuments();
  }, [staffOk, clientId, loadDocuments]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const categoryLabel = (category: ClientDocument['category']) => {
    switch (category) {
      case 'CARE_PLAN':
        return 'Care Plan';
      case 'CONSENT':
        return 'Consent';
      case 'MEDICATION':
        return 'Medication';
      case 'RISK_ASSESSMENT':
        return 'Risk Assessment';
      default:
        return 'Other';
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    setUploadingDocument(true);
    setDocumentsError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', documentCategory);
      await api.post(`/clients/${clientId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadDocuments();
    } catch (err: unknown) {
      setDocumentsError(getApiErrorMessage(err, 'Failed to upload document'));
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      setDocumentsError(null);
      await api.delete(`/clients/${clientId}/documents/${documentId}`);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (err: unknown) {
      setDocumentsError(getApiErrorMessage(err, 'Failed to delete document'));
    }
  };

  const handleDownloadDocument = async (documentId: string, originalName: string) => {
    try {
      setDocumentsError(null);
      const response = await api.get(`/clients/${clientId}/documents/${documentId}/download`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = originalName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      setDocumentsError(getApiErrorMessage(err, 'Failed to download document'));
    }
  };

  const handlePreviewDocument = async (documentId: string) => {
    try {
      setDocumentsError(null);
      const response = await api.get(`/clients/${clientId}/documents/${documentId}/preview`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30_000);
    } catch (err: unknown) {
      setDocumentsError(getApiErrorMessage(err, 'Failed to preview document'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        address: formData.address,
        active: formData.active,
      };

      if (formData.latitude) payload.latitude = parseFloat(formData.latitude);
      if (formData.longitude) payload.longitude = parseFloat(formData.longitude);
      if (formData.geofenceRadiusMeters)
        payload.geofenceRadiusMeters = parseInt(formData.geofenceRadiusMeters);
      if (formData.contactName) payload.contactName = formData.contactName;
      if (formData.contactPhone) payload.contactPhone = formData.contactPhone;
      if (formData.notes) payload.notes = formData.notes;

      payload.profile = sanitizeProfileForApi(profileDraft);

      await api.patch(`/clients/${clientId}`, payload);
      router.push('/clients');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update client'));
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
            href="/clients"
            className="text-navy-600 hover:text-navy-800 mb-4 inline-block"
          >
            ← Back to Clients
          </Link>
          <h1 className="text-3xl font-bold text-navy-900">Edit Client</h1>
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
            <div className="sm:col-span-2">
              <label htmlFor="edit-client-name" className="block text-sm font-medium text-navy-800 mb-1">
                Name *
              </label>
              <input
                id="edit-client-name"
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

            <div className="sm:col-span-2">
              <label htmlFor="edit-client-address" className="block text-sm font-medium text-navy-800 mb-1">
                Address *
              </label>
              <p className="text-xs text-navy-600 mb-1">
                Suggestions appear as you type—choose one to set the address and map pin. You can
                adjust the pin on the map below.
              </p>
              <AddressAutocompleteTextarea
                id="edit-client-address"
                required
                aria-required="true"
                value={formData.address}
                onChange={(address) => setFormData((f) => ({ ...f, address }))}
                onPickResult={(hit) =>
                  setFormData((f) => ({
                    ...f,
                    address: hit.displayName,
                    latitude: hit.lat.toFixed(7),
                    longitude: hit.lon.toFixed(7),
                    geofenceRadiusMeters:
                      f.geofenceRadiusMeters.trim() && parseInt(f.geofenceRadiusMeters, 10) >= 1
                        ? f.geofenceRadiusMeters
                        : '100',
                  }))
                }
                rows={3}
                placeholder="Street, town, postcode…"
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div className="sm:col-span-2">
              <span className="block text-sm font-medium text-navy-800 mb-1">Location for clock-in</span>
              <ClientLocationPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                address={formData.address}
                geofenceRadiusMeters={formData.geofenceRadiusMeters}
                onChange={(patch) => setFormData((f) => ({ ...f, ...patch }))}
              />
            </div>

            <div>
              <label htmlFor="edit-client-latitude" className="block text-sm font-medium text-navy-800 mb-1">
                Latitude
              </label>
              <input
                id="edit-client-latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-client-longitude" className="block text-sm font-medium text-navy-800 mb-1">
                Longitude
              </label>
              <input
                id="edit-client-longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-client-geofence" className="block text-sm font-medium text-navy-800 mb-1">
                Geofence Radius (meters)
              </label>
              <input
                id="edit-client-geofence"
                type="number"
                min="1"
                value={formData.geofenceRadiusMeters}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    geofenceRadiusMeters: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-client-contact-name" className="block text-sm font-medium text-navy-800 mb-1">
                Contact Name
              </label>
              <input
                id="edit-client-contact-name"
                type="text"
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="edit-client-contact-phone" className="block text-sm font-medium text-navy-800 mb-1">
                Contact Phone
              </label>
              <input
                id="edit-client-contact-phone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="edit-client-notes" className="block text-sm font-medium text-navy-800 mb-1">
                Notes
              </label>
              <textarea
                id="edit-client-notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={4}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center">
                <input
                  id="edit-client-active"
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className="mr-2 h-4 w-4 rounded border-navy-200 text-navy-600 focus:ring-navy-600"
                />
                <label htmlFor="edit-client-active" className="text-sm font-medium text-navy-800">
                  Active
                </label>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-navy-100">
            <h2 className="text-lg font-semibold text-navy-900 mb-1">Extended care profile</h2>
            <p className="text-sm text-navy-700 mb-4">
              Clinical, safeguarding, and background details (shown on the admin client record).
            </p>
            <ClientProfileForm value={profileDraft} onChange={setProfileDraft} />
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/clients"
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

        <section className="mt-6 bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-navy-900">Client Documents</h2>
            <label className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 cursor-pointer disabled:opacity-50">
              <input
                type="file"
                className="hidden"
                onChange={handleUploadDocument}
                disabled={uploadingDocument}
              />
              {uploadingDocument ? 'Uploading...' : 'Upload Document'}
            </label>
          </div>
          <div className="mb-4">
            <label htmlFor="document-category" className="block text-sm font-medium text-navy-800 mb-1">
              Category
            </label>
            <select
              id="document-category"
              value={documentCategory}
              onChange={(e) => setDocumentCategory(e.target.value as ClientDocument['category'])}
              className="max-w-xs w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
            >
              <option value="CARE_PLAN">Care Plan</option>
              <option value="CONSENT">Consent</option>
              <option value="MEDICATION">Medication</option>
              <option value="RISK_ASSESSMENT">Risk Assessment</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <p className="text-sm text-navy-700 mb-4">
            Accepted types: PDF, PNG, JPG, WEBP, TXT. Maximum size: 10MB.
          </p>

          {documentsError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4"
            >
              {documentsError}
            </div>
          )}

          {loadingDocuments ? (
            <p className="text-navy-800">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="text-navy-700">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900 truncate">{doc.originalName}</p>
                    <p className="text-xs text-navy-600">
                      {formatBytes(doc.sizeBytes)} • {categoryLabel(doc.category)} • Uploaded by{' '}
                      {doc.uploadedBy?.name || 'Unknown'} ({doc.uploadedBy?.role || 'Unknown'}) •{' '}
                      {new Date(doc.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreviewDocument(doc.id)}
                      className="px-3 py-1.5 text-sm border border-navy-200 rounded-md text-navy-800 hover:bg-navy-50"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(doc.id, doc.originalName)}
                      className="px-3 py-1.5 text-sm border border-navy-200 rounded-md text-navy-800 hover:bg-navy-50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="px-3 py-1.5 text-sm border border-red-200 rounded-md text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}

