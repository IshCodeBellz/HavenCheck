'use client';

import Link from 'next/link';

export default function AdminOverviewPage() {
  return (
    <div className="max-w-3xl space-y-4 text-navy-800">
      <p>
        Use the tabs above to work with admin-only resources. Operations call the same services as the legacy
        portal routes, but through{' '}
        <strong className="font-semibold text-navy-900">/api/v1/admin</strong> (admin role required).
      </p>
      <ul className="list-disc pl-5 space-y-2 text-sm">
        <li>
          <Link href="/admin/timesheets" className="text-navy-600 font-medium hover:underline">
            Timesheets
          </Link>{' '}
          — clocked-in visits with duration and per-carer totals.
        </li>
        <li>
          <Link href="/admin/clients" className="text-navy-600 font-medium hover:underline">
            Clients
          </Link>{' '}
          — list and soft-delete via v1 (edit profile still uses the main Clients area when needed).
        </li>
        <li>
          <Link href="/admin/carers" className="text-navy-600 font-medium hover:underline">
            Carers
          </Link>{' '}
          and{' '}
          <Link href="/admin/users" className="text-navy-600 font-medium hover:underline">
            Users
          </Link>{' '}
          — directory and v1 CRUD entry points.
        </li>
      </ul>
    </div>
  );
}
