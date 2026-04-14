'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiV1 } from '@/lib/api-v1';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface JoinRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requestedRole: string;
  status: string;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  manager: { id: string; name: string; email: string };
  members: Array<{ id: string; user: { id: string; name: string; email: string; role: string } }>;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, requestsRes, teamsRes] = await Promise.all([
        apiV1.get<AdminUser[]>('/admin/users'),
        apiV1.get<JoinRequest[]>('/admin/join-requests'),
        apiV1.get<Team[]>('/admin/teams'),
      ]);
      setUsers(usersRes.data);
      setJoinRequests(requestsRes.data);
      setTeams(teamsRes.data);
    } catch {
      setUsers([]);
      setJoinRequests([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    await apiV1.post(`/admin/join-requests/${id}/approve`, {});
    await load();
  };

  const reject = async (id: string) => {
    await apiV1.post(`/admin/join-requests/${id}/reject`, {});
    await load();
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTeam(true);
    try {
      await apiV1.post('/admin/teams', { name: newTeamName, managerId, memberIds });
      setNewTeamName('');
      setManagerId('');
      setMemberIds([]);
      await load();
    } finally {
      setSavingTeam(false);
    }
  };

  const managers = users.filter((u) => u.role === 'MANAGER' && u.isActive);
  const carers = users.filter((u) => u.role === 'CARER' && u.isActive);

  if (loading) return <p className="text-navy-800">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold text-navy-900">Users (v1)</h2>
        <Link href="/carers/new" className="text-sm font-medium text-navy-600 hover:underline">
          Create user (portal) →
        </Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-navy-50 text-left text-navy-800">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-navy-50/50">
                <td className="px-3 py-2 font-medium text-navy-900">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.isActive ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  {u.role === 'CARER' ? (
                    <Link href={`/carers/${u.id}/edit`} className="text-navy-600 font-medium hover:underline">
                      Edit
                    </Link>
                  ) : (
                    <span className="text-navy-800/50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-navy-900">Pending organisation requests</h3>
        {joinRequests.length === 0 ? (
          <p className="mt-2 text-sm text-navy-700">No pending requests.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {joinRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-navy-100 p-3 text-sm">
                <p className="font-medium text-navy-900">{request.requesterName} ({request.requesterEmail})</p>
                <div className="mt-2 flex gap-2">
                  <button className="rounded-md bg-navy-700 px-3 py-1 text-white" onClick={() => approve(request.id)}>
                    Approve
                  </button>
                  <button className="rounded-md border border-navy-300 px-3 py-1 text-navy-800" onClick={() => reject(request.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-navy-900">Teams</h3>
        <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={createTeam}>
          <input
            className="rounded-lg border border-navy-200 px-3 py-2"
            placeholder="Team name"
            required
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <select className="rounded-lg border border-navy-200 px-3 py-2" required value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Select manager</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.name}</option>
            ))}
          </select>
          <button disabled={savingTeam} className="rounded-lg bg-navy-700 px-3 py-2 text-white">
            {savingTeam ? 'Saving…' : 'Create team'}
          </button>
          <div className="md:col-span-3">
            <p className="mb-2 text-sm text-navy-700">Select carers</p>
            <div className="grid gap-2 md:grid-cols-3">
              {carers.map((carer) => (
                <label key={carer.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(carer.id)}
                    onChange={(e) => {
                      setMemberIds((prev) =>
                        e.target.checked ? [...prev, carer.id] : prev.filter((id) => id !== carer.id)
                      );
                    }}
                  />
                  {carer.name}
                </label>
              ))}
            </div>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="rounded-xl border border-navy-100 p-3">
              <p className="font-medium text-navy-900">{team.name}</p>
              <p className="text-sm text-navy-700">Manager: {team.manager.name}</p>
              <p className="text-sm text-navy-700">
                Members: {team.members.map((member) => member.user.name).join(', ') || 'No carers assigned'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
