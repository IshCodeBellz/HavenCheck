'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Layout from '@/components/Layout';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';

type AdminTab = { href: string; label: string; exact?: boolean };

const links: AdminTab[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/timesheets', label: 'Timesheets' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/carers', label: 'Carers' },
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/guardians', label: 'Guardians' },
  { href: '/admin/care-plans', label: 'Care Plans' },
  { href: '/admin/risk-assessments', label: 'Risk' },
  { href: '/admin/mar', label: 'MAR' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/payroll', label: 'Payroll' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/schedules', label: 'Schedules' },
  { href: '/admin/visits', label: 'Visits' },
];

function tabActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ok = useRequireAdmin();

  if (ok === null || ok === false) {
    return (
      <Layout>
        <p role="status" aria-live="polite" className="text-navy-800">
          {ok === false ? 'Redirecting…' : 'Checking access…'}
        </p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-navy-900">Admin console</h1>
        <p className="text-sm text-navy-800/70 mt-1">
          Authenticated API v1 endpoints under <code className="text-xs bg-navy-100 px-1 rounded">/api/v1/admin</code>
        </p>
      </div>
      <nav
        className="flex flex-wrap gap-2 border-b border-navy-100 pb-3 mb-8"
        aria-label="Admin console sections"
      >
        {links.map(({ href, label, exact }) => {
          const active = tabActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2 ${
                active
                  ? 'bg-navy-600 text-white shadow-sm'
                  : 'bg-navy-50 text-navy-800 hover:bg-navy-100'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </Layout>
  );
}
