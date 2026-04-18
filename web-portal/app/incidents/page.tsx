'use client';

import { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

type Incident = {
  id: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  safeguardingFlag: boolean;
  status: string;
  details?: string | null;
  client: { id: string; name: string };
  createdAt: string;
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [form, setForm] = useState({ clientId: '', category: '', severity: 'LOW', safeguardingFlag: false, details: '' });
  const [coords, setCoords] = useState<Array<{ x: number; y: number; zone?: string }>>([]);

  const load = async () => {
    const res = await api.get('/incidents');
    setIncidents(res.data);
  };

  const bySeverity = useMemo(() => {
    return incidents.reduce<Record<string, number>>((acc, i) => {
      acc[i.severity] = (acc[i.severity] ?? 0) + 1;
      return acc;
    }, {});
  }, [incidents]);

  const createIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/incidents', form);
    setForm({ clientId: '', category: '', severity: 'LOW', safeguardingFlag: false, details: '' });
    await load();
  };

  const createBodyMap = async () => {
    if (!form.clientId || coords.length === 0) return;
    await api.post('/incidents/body-maps', {
      clientId: form.clientId,
      coordinates: coords,
      notes: `Captured ${coords.length} markers from interactive body map`,
      images: [],
    });
    setCoords([]);
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-navy-900 mb-4">Incident workflows</h1>
      <div className="mb-6 grid grid-cols-2 gap-2 max-w-md text-sm">
        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => (
          <div key={sev} className="rounded border border-navy-100 bg-white p-3">
            <div className="text-navy-800/70">{sev}</div>
            <div className="text-xl font-semibold text-navy-900">{bySeverity[sev] ?? 0}</div>
          </div>
        ))}
      </div>

      <form onSubmit={createIncident} className="space-y-3 rounded-lg border border-navy-100 bg-white p-4 mb-6">
        <input className="w-full border rounded px-3 py-2" placeholder="Client ID" value={form.clientId} onChange={(e) => setForm((s) => ({ ...s, clientId: e.target.value }))} />
        <input className="w-full border rounded px-3 py-2" placeholder="Category (fall, medication...)" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} />
        <select className="w-full border rounded px-3 py-2" value={form.severity} onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value }))}>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={form.safeguardingFlag} onChange={(e) => setForm((s) => ({ ...s, safeguardingFlag: e.target.checked }))} />
          Safeguarding flag
        </label>
        <textarea className="w-full border rounded px-3 py-2" rows={3} placeholder="Details" value={form.details} onChange={(e) => setForm((s) => ({ ...s, details: e.target.value }))} />
        <button className="rounded bg-navy-600 text-white px-4 py-2">Create incident</button>
      </form>

      <div className="rounded-lg border border-navy-100 bg-white p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Interactive body map</h2>
        <p className="text-sm text-navy-800/70 mb-3">Click the silhouette to add body markers (coordinates, notes, images-ready).</p>
        <div
          className="relative h-72 w-40 mx-auto rounded-full bg-navy-50 border border-navy-200 cursor-crosshair"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = Number(((e.clientX - rect.left) / rect.width).toFixed(3));
            const y = Number(((e.clientY - rect.top) / rect.height).toFixed(3));
            setCoords((v) => [...v, { x, y }]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = 0.5;
              const y = 0.5;
              if (rect.width > 0 && rect.height > 0) {
                setCoords((v) => [...v, { x, y }]);
              }
            }
          }}
        >
          {coords.map((p, i) => (
            <span key={`${p.x}-${p.y}-${i}`} className="absolute h-3 w-3 rounded-full bg-red-500" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%, -50%)' }} />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={load} className="rounded border border-navy-200 px-3 py-2 text-sm">Refresh incidents</button>
          <button type="button" onClick={createBodyMap} className="rounded bg-navy-100 text-navy-900 px-3 py-2 text-sm">Save body map entry</button>
          <button type="button" onClick={() => setCoords([])} className="rounded border border-navy-200 px-3 py-2 text-sm">Clear</button>
        </div>
      </div>

      <div className="space-y-2">
        {incidents.map((i) => (
          <div key={i.id} className="rounded border border-navy-100 bg-white p-3">
            <div className="text-sm font-semibold">{i.category} · {i.severity} · {i.status}</div>
            <div className="text-xs text-navy-800/70">Client: {i.client?.name ?? '—'}</div>
            {i.details ? <p className="text-sm mt-1">{i.details}</p> : null}
          </div>
        ))}
      </div>
    </Layout>
  );
}
