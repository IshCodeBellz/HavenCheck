'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';
import { authService } from '@/lib/auth';

function apiMessage(err: unknown): string {
  const ax = err as { response?: { data?: { error?: string; message?: string } } };
  return (
    ax.response?.data?.message ||
    ax.response?.data?.error ||
    'Something went wrong. Please try again.'
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [organizationCode, setOrganizationCode] = useState<string | null>(null);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await authService.getCurrentUser();
      if (cancelled) return;
      if (!u) {
        router.replace('/login');
        return;
      }
      setUserId(u.id);
      setName(u.name);
      setEmail(u.email);
      setPhone(u.phone || '');
      setRole(u.role);
      setCompanyName(u.companyName ?? null);
      setOrganizationCode(u.organizationCode ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await api.patch(`/users/${userId}`, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      await authService.refreshSessionUser();
      setProfileMessage('Profile saved.');
    } catch (err: unknown) {
      setProfileMessage(null);
      setProfileError(apiMessage(err));
    } finally {
      setProfileSaving(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdSaving(true);
    setPwdError(null);
    setPwdMessage(null);
    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters.');
      setPwdSaving(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      setPwdSaving(false);
      return;
    }
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdMessage('Password updated.');
    } catch (err: unknown) {
      setPwdError(apiMessage(err));
    } finally {
      setPwdSaving(false);
    }
  };

  if (loading || !userId) {
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
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Account</h1>
        <p className="text-navy-800/90 mb-8 text-sm">
          Update the details you signed up with and keep your password secure.
        </p>

        {(companyName || organizationCode) && (
          <div className="mb-8 rounded-lg border border-navy-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-navy-900 mb-2">Organization</h2>
            <p className="text-sm text-navy-800">
              {companyName && <span className="block">{companyName}</span>}
              {organizationCode && (
                <span className="block text-navy-800/80">Code: {organizationCode}</span>
              )}
            </p>
          </div>
        )}

        <section className="mb-10 rounded-lg border border-navy-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Profile</h2>
          <p className="text-sm text-navy-800/85 mb-4">
            Role: <span className="font-medium text-navy-900">{role}</span> (contact an admin to change your role.)
          </p>
          {profileMessage && (
            <p
              role="status"
              className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              {profileMessage}
            </p>
          )}
          {profileError && (
            <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {profileError}
            </p>
          )}
          <form onSubmit={onSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="account-name" className="block text-sm font-medium text-navy-800 mb-1">
                Name
              </label>
              <input
                id="account-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div>
              <label htmlFor="account-email" className="block text-sm font-medium text-navy-800 mb-1">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div>
              <label htmlFor="account-phone" className="block text-sm font-medium text-navy-800 mb-1">
                Phone
              </label>
              <input
                id="account-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
              <p className="mt-1 text-xs text-navy-800/70">Leave blank to remove your phone number from your account.</p>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                aria-busy={profileSaving}
                className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50 text-sm font-medium"
              >
                {profileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-navy-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Password</h2>
          {pwdMessage && (
            <p
              role="status"
              className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              {pwdMessage}
            </p>
          )}
          {pwdError && (
            <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {pwdError}
            </p>
          )}
          <form onSubmit={onChangePassword} className="space-y-4">
            <div>
              <label htmlFor="account-current-password" className="block text-sm font-medium text-navy-800 mb-1">
                Current password
              </label>
              <input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div>
              <label htmlFor="account-new-password" className="block text-sm font-medium text-navy-800 mb-1">
                New password
              </label>
              <input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
              <p className="mt-1 text-xs text-navy-800/70">At least 8 characters.</p>
            </div>
            <div>
              <label htmlFor="account-confirm-password" className="block text-sm font-medium text-navy-800 mb-1">
                Confirm new password
              </label>
              <input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={pwdSaving}
                aria-busy={pwdSaving}
                className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50 text-sm font-medium"
              >
                {pwdSaving ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}
