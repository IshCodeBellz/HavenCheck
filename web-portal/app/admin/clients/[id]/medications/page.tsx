'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiV1 } from '@/lib/api-v1';

type MedicationSchedule = {
  id: string;
  timeOfDay: string;
  daysOfWeek: string[];
  active: boolean;
};

type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  isPrn: boolean;
  currentStock: number | null;
  reorderThreshold: number | null;
  active: boolean;
  schedules: MedicationSchedule[];
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

const dayLabels: Record<string, string> = {
  '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
};

export default function AdminClientMedicationPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isPrn, setIsPrn] = useState(false);
  const [currentStock, setCurrentStock] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('');

  const [scheduleMedicationId, setScheduleMedicationId] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const days = useMemo(
    () => [
      { value: '0', label: 'Sun' },
      { value: '1', label: 'Mon' },
      { value: '2', label: 'Tue' },
      { value: '3', label: 'Wed' },
      { value: '4', label: 'Thu' },
      { value: '5', label: 'Fri' },
      { value: '6', label: 'Sat' },
    ],
    []
  );

  const loadMedications = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiV1.get<Medication[]>(`/admin/clients/${clientId}/medications`);
      setMedications(res.data);
      if (res.data.length > 0 && !scheduleMedicationId) {
        setScheduleMedicationId(res.data[0].id);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load medications'));
    } finally {
      setLoading(false);
    }
  }, [clientId, scheduleMedicationId]);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  const submitMedication = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiV1.post(`/admin/clients/${clientId}/medications`, {
        name,
        dosage: dosage || undefined,
        instructions: instructions || undefined,
        isPrn,
        currentStock: currentStock ? Number(currentStock) : undefined,
        reorderThreshold: reorderThreshold ? Number(reorderThreshold) : undefined,
      });
      setName('');
      setDosage('');
      setInstructions('');
      setIsPrn(false);
      setCurrentStock('');
      setReorderThreshold('');
      await loadMedications();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to create medication'));
    } finally {
      setSaving(false);
    }
  };

  const submitSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!scheduleMedicationId) return;
    setSaving(true);
    setError(null);
    try {
      await apiV1.post(`/admin/medications/${scheduleMedicationId}/schedules`, {
        timeOfDay,
        daysOfWeek: selectedDays.map((d) => Number(d)),
      });
      setSelectedDays([]);
      await loadMedications();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to create schedule'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href={`/admin/clients/${clientId}`} className="text-sm text-navy-600 hover:underline">
        ← Back to client
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-navy-900">Medication setup (eMAR)</h2>
        <p className="text-sm text-navy-800/70 mt-1">Create client medications and daily schedules for carer recording.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submitMedication} className="rounded-xl border border-navy-100 bg-white p-4 space-y-3">
        <h3 className="font-medium text-navy-900">Add medication</h3>
        <input className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" placeholder="Medication name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" placeholder="Dosage (optional)" value={dosage} onChange={(e) => setDosage(e.target.value)} />
        <textarea className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" placeholder="Instructions (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" placeholder="Current stock (optional)" type="number" min={0} value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
          <input className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" placeholder="Reorder threshold (optional)" type="number" min={0} value={reorderThreshold} onChange={(e) => setReorderThreshold(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-800">
          <input type="checkbox" checked={isPrn} onChange={(e) => setIsPrn(e.target.checked)} />
          PRN medication
        </label>
        <button disabled={saving} className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60">
          Save medication
        </button>
      </form>

      <form onSubmit={submitSchedule} className="rounded-xl border border-navy-100 bg-white p-4 space-y-3">
        <h3 className="font-medium text-navy-900">Add schedule</h3>
        <select
          className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
          value={scheduleMedicationId}
          onChange={(e) => setScheduleMedicationId(e.target.value)}
          required
        >
          <option value="">Select medication</option>
          {medications.map((med) => (
            <option key={med.id} value={med.id}>
              {med.name}
            </option>
          ))}
        </select>
        <input type="time" className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} required />
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() =>
                setSelectedDays((prev) =>
                  prev.includes(d.value) ? prev.filter((v) => v !== d.value) : [...prev, d.value]
                )
              }
              className={`rounded-full border px-3 py-1 text-xs ${
                selectedDays.includes(d.value)
                  ? 'border-navy-700 bg-navy-700 text-white'
                  : 'border-navy-200 bg-white text-navy-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button disabled={saving || !scheduleMedicationId} className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60">
          Save schedule
        </button>
      </form>

      <section className="rounded-xl border border-navy-100 bg-white p-4">
        <h3 className="font-medium text-navy-900 mb-3">Configured medications</h3>
        {loading ? (
          <p className="text-sm text-navy-700">Loading…</p>
        ) : medications.length === 0 ? (
          <p className="text-sm text-navy-700">No medications configured yet.</p>
        ) : (
          <div className="space-y-4">
            {medications.map((med) => (
              <div key={med.id} className="rounded-lg border border-navy-100 p-3">
                <p className="font-medium text-navy-900">{med.name}</p>
                {!!med.dosage && <p className="text-sm text-navy-800">Dose: {med.dosage}</p>}
                {!!med.instructions && <p className="text-sm text-navy-800">Instructions: {med.instructions}</p>}
                <p className="text-xs text-navy-700 mt-1">{med.isPrn ? 'PRN' : 'Scheduled'}</p>
                {(med.currentStock !== null || med.reorderThreshold !== null) && (
                  <p className="text-xs text-navy-700 mt-1">
                    Stock: {med.currentStock ?? '—'} | Reorder at: {med.reorderThreshold ?? '—'}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {med.schedules.map((schedule) => (
                    <span key={schedule.id} className="rounded-full bg-navy-50 px-2 py-1 text-xs text-navy-700">
                      {schedule.timeOfDay} {schedule.daysOfWeek.map((d) => dayLabels[d] ?? d).join(', ')}
                    </span>
                  ))}
                  {med.schedules.length === 0 && (
                    <span className="text-xs text-navy-600">No schedules yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
