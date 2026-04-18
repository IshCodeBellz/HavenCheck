'use client';

import { useState } from 'react';
import { apiV1 } from '@/lib/api-v1';

type User = { id: string; name: string; role: string };
type Client = { id: string; name: string };

export default function AdminGuardiansPage() {
  const [guardians, setGuardians] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    guardianUserId: '',
    clientId: '',
    readOnly: true,
    canViewVisits: true,
    canViewNotes: true,
    canViewIncidents: true,
  });
  const [message, setMessage] = useState('');

  const load = async () => {
    const [usersRes, clientsRes] = await Promise.all([
      apiV1.get('/admin/users'),
      apiV1.get('/admin/clients'),
    ]);
    setGuardians((usersRes.data as User[]).filter((u) => u.role === 'GUARDIAN'));
    setClients((clientsRes.data as Client[]).map((c) => ({ id: c.id, name: c.name })));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiV1.post('/guardian/invite', form);
    setMessage('Guardian linked to client with read-only feed permissions.');
  };

  return (
    <section className="rounded-lg border border-navy-100 bg-white p-6">
      <h2 className="text-xl font-semibold text-navy-900 mb-2">Invite guardian access</h2>
      <p className="text-sm text-navy-800/70 mb-4">Assign guardians to clients and configure read-only feed visibility.</p>
      <button type="button" onClick={load} className="mb-4 rounded border border-navy-200 px-3 py-2 text-sm">Load guardians & clients</button>
      {message ? <p className="text-sm text-green-700 mb-3">{message}</p> : null}
      <form onSubmit={submit} className="space-y-3 max-w-xl">
        <select className="w-full border rounded px-3 py-2" value={form.guardianUserId} onChange={(e) => setForm((s) => ({ ...s, guardianUserId: e.target.value }))} required>
          <option value="">Select guardian</option>
          {guardians.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="w-full border rounded px-3 py-2" value={form.clientId} onChange={(e) => setForm((s) => ({ ...s, clientId: e.target.value }))} required>
          <option value="">Select client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.readOnly} onChange={(e) => setForm((s) => ({ ...s, readOnly: e.target.checked }))} /> Read-only</label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.canViewVisits} onChange={(e) => setForm((s) => ({ ...s, canViewVisits: e.target.checked }))} /> Visits</label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.canViewNotes} onChange={(e) => setForm((s) => ({ ...s, canViewNotes: e.target.checked }))} /> Notes</label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.canViewIncidents} onChange={(e) => setForm((s) => ({ ...s, canViewIncidents: e.target.checked }))} /> Incidents</label>
        <button className="rounded bg-navy-600 text-white px-4 py-2">Save guardian assignment</button>
      </form>
    </section>
  );
}
