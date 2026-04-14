'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useRequireStaff } from '@/hooks/useRequireStaff';
import AddressAutocompleteTextarea from '@/components/AddressAutocompleteTextarea';
import ClientProfileForm from '@/components/client-profile/ClientProfileForm';
import type { ClientProfile } from '@/lib/clientProfile';
import { sanitizeProfileForApi } from '@/lib/clientProfile';

const ClientLocationPicker = dynamic(() => import('@/components/ClientLocationPicker'), {
  ssr: false,
});

export default function NewClientPage() {
  const staffOk = useRequireStaff();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    geofenceRadiusMeters: '100',
    contactName: '',
    contactPhone: '',
    notes: '',
  });
  const [profileDraft, setProfileDraft] = useState<ClientProfile>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        address: formData.address,
        profile: sanitizeProfileForApi(profileDraft),
      };

      if (formData.latitude) payload.latitude = parseFloat(formData.latitude);
      if (formData.longitude) payload.longitude = parseFloat(formData.longitude);
      if (formData.geofenceRadiusMeters)
        payload.geofenceRadiusMeters = parseInt(formData.geofenceRadiusMeters);
      if (formData.contactName) payload.contactName = formData.contactName;
      if (formData.contactPhone) payload.contactPhone = formData.contactPhone;
      if (formData.notes) payload.notes = formData.notes;

      await api.post('/clients', payload);
      router.push('/clients');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create client');
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
            href="/clients"
            className="text-navy-600 hover:text-navy-800 mb-4 inline-block"
          >
            ← Back to Clients
          </Link>
          <h1 className="text-3xl font-bold text-navy-900">New Client</h1>
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
              <label htmlFor="new-client-name" className="block text-sm font-medium text-navy-800 mb-1">
                Name *
              </label>
              <input
                id="new-client-name"
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
              <label htmlFor="new-client-address" className="block text-sm font-medium text-navy-800 mb-1">
                Address *
              </label>
              <p className="text-xs text-navy-600 mb-1">
                Suggestions appear as you type—choose one to set the address and map pin. You can
                adjust the pin on the map below.
              </p>
              <AddressAutocompleteTextarea
                id="new-client-address"
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
              <label htmlFor="new-client-latitude" className="block text-sm font-medium text-navy-800 mb-1">
                Latitude
              </label>
              <input
                id="new-client-latitude"
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
              <label htmlFor="new-client-longitude" className="block text-sm font-medium text-navy-800 mb-1">
                Longitude
              </label>
              <input
                id="new-client-longitude"
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
              <label htmlFor="new-client-geofence" className="block text-sm font-medium text-navy-800 mb-1">
                Geofence Radius (meters)
              </label>
              <input
                id="new-client-geofence"
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
              <label htmlFor="new-client-contact-name" className="block text-sm font-medium text-navy-800 mb-1">
                Contact Name
              </label>
              <input
                id="new-client-contact-name"
                type="text"
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div>
              <label htmlFor="new-client-contact-phone" className="block text-sm font-medium text-navy-800 mb-1">
                Contact Phone
              </label>
              <input
                id="new-client-contact-phone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="new-client-notes" className="block text-sm font-medium text-navy-800 mb-1">
                Notes
              </label>
              <textarea
                id="new-client-notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={4}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-navy-100">
            <h2 className="text-lg font-semibold text-navy-900 mb-1">Extended care profile</h2>
            <p className="text-sm text-navy-700 mb-4">Optional — you can complete this now or edit the client later.</p>
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
              disabled={loading}
              aria-busy={loading}
              className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

