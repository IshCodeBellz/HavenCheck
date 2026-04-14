'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';
import { authService } from '@/lib/auth';
import { isCarerLikeRole } from '@/lib/roles';
import { format } from 'date-fns';
import Link from 'next/link';

// Dynamically import Map component to avoid SSR issues
const Map = dynamic(() => import('@/components/Map'), { ssr: false });

interface DashboardStats {
  activeCarers: number;
  visitsInProgress: number;
  visitsToday: number;
  missedVisits: number;
}

interface ActiveVisit {
  id: string;
  status: string;
  client: {
    id: string;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  carer: {
    id: string;
    name: string;
  };
  scheduledStart?: string;
  scheduledEnd?: string;
  clockInTime?: string;
}

export default function DashboardPage() {
  const [viewerIsCarer, setViewerIsCarer] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    activeCarers: 0,
    visitsInProgress: 0,
    visitsToday: 0,
    missedVisits: 0,
  });
  const [activeVisits, setActiveVisits] = useState<ActiveVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const visitsInProgressHref = '/visits?quickFilter=today&status=IN_PROGRESS';
  const visitsTodayHref = '/visits?quickFilter=today';
  const missedVisitsHref = '/visits?quickFilter=today&status=MISSED';

  useEffect(() => {
    authService.getCurrentUser().then((u) => setViewerIsCarer(isCarerLikeRole(u?.role)));
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [visitsResponse] = await Promise.all([
        api.get('/visits/today'),
      ]);

      const visits = visitsResponse.data;
      // Include both IN_PROGRESS and LATE as active visits (both are in progress, LATE just indicates lateness)
      const inProgress = visits.filter((v: any) => v.status === 'IN_PROGRESS' || v.status === 'LATE');
      const missed = visits.filter((v: any) => v.status === 'MISSED');
      const activeCarers = new Set(inProgress.map((v: any) => v.carerId)).size;

      // Filter active visits that have location data and include status
      const visitsWithLocation = inProgress
        .filter((v: any) => v.client?.latitude && v.client?.longitude)
        .map((v: any) => ({
          ...v,
          status: v.status,
        }));

      setStats({
        activeCarers,
        visitsInProgress: inProgress.length,
        visitsToday: visits.length,
        missedVisits: missed.length,
      });

      setActiveVisits(visitsWithLocation);
      // Reset to first page when data changes
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadStats]);

  // Pagination logic
  const totalPages = Math.ceil(activeVisits.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVisits = activeVisits.slice(startIndex, endIndex);

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
        <h1 className="text-3xl font-bold text-navy-900 mb-6">
          {viewerIsCarer ? 'My day' : 'Dashboard'}
        </h1>

        <div
          className={`grid grid-cols-1 gap-5 mb-8 ${viewerIsCarer ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}
        >
          {!viewerIsCarer && (
            <div
              className="bg-white overflow-hidden rounded-2xl border border-navy-100 shadow-md transition-shadow duration-200 hover:shadow-lg"
              role="region"
              aria-label={`${stats.activeCarers} active carers`}
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="shrink-0">
                    <div className="text-2xl font-bold text-navy-900" aria-hidden="true">
                      {stats.activeCarers}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-navy-800/70">Active Carers</div>
              </div>
            </div>
          )}

          <Link
            href={visitsInProgressHref}
            className="group bg-white overflow-hidden rounded-2xl border border-navy-100 border-l-4 border-l-accent-400 shadow-md block cursor-pointer transition-all duration-200 hover:shadow-xl hover:border-navy-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
            role="region"
            aria-label={`${stats.visitsInProgress} visits in progress`}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <div className="text-2xl font-bold text-navy-600" aria-hidden="true">
                    {stats.visitsInProgress}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-sm text-navy-800/70">
                {viewerIsCarer ? 'My visits in progress' : 'Visits In Progress'}
              </div>
              <div className="mt-3 text-sm font-medium text-navy-600 group-hover:text-navy-700">View visits</div>
            </div>
          </Link>

          <Link
            href={visitsTodayHref}
            className="group bg-white overflow-hidden rounded-2xl border border-navy-100 shadow-md block cursor-pointer transition-all duration-200 hover:shadow-xl hover:border-navy-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
            role="region"
            aria-label={`${stats.visitsToday} visits today`}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <div className="text-2xl font-bold text-navy-900" aria-hidden="true">
                    {stats.visitsToday}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-sm text-navy-800/70">
                {viewerIsCarer ? 'My visits today' : 'Visits Today'}
              </div>
              <div className="mt-3 text-sm font-medium text-navy-600 group-hover:text-navy-700">View visits</div>
            </div>
          </Link>

          <Link
            href={missedVisitsHref}
            className="group bg-white overflow-hidden rounded-2xl border border-navy-100 shadow-md block cursor-pointer transition-all duration-200 hover:shadow-xl hover:border-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
            role="region"
            aria-label={`${stats.missedVisits} missed visits`}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <div className="text-2xl font-bold text-red-600" aria-hidden="true">
                    {stats.missedVisits}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-sm text-navy-800/70">
                {viewerIsCarer ? 'My missed visits' : 'Missed Visits'}
              </div>
              <div className="mt-3 text-sm font-medium text-navy-600 group-hover:text-navy-700">View visits</div>
            </div>
          </Link>
        </div>

        {/* Active Shifts Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-navy-900">
              {viewerIsCarer ? 'My active visits' : 'Active Shifts'}
            </h2>
            <button
              type="button"
              onClick={loadStats}
              className="cursor-pointer px-4 py-2.5 bg-navy-600 text-white rounded-xl text-sm font-medium shadow-md transition-all duration-200 hover:bg-navy-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
              aria-label="Refresh active shifts and dashboard statistics"
            >
              Refresh
            </button>
          </div>
          
          {activeVisits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-navy-100 shadow-md p-8 text-center">
              <p className="text-navy-800/70">No active shifts at the moment</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {currentVisits.map((visit) => (
                  <div key={visit.id} className="bg-white rounded-2xl border border-navy-100 shadow-md overflow-hidden transition-shadow duration-200 hover:shadow-lg">
                    <div className="h-80 lg:h-96">
                      {visit.client.latitude && visit.client.longitude ? (
                        <Map
                          latitude={visit.client.latitude}
                          longitude={visit.client.longitude}
                          clientName={visit.client.name}
                          address={visit.client.address}
                          height="100%"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center bg-navy-100 text-navy-800/70">
                          No location data
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-navy-900 mb-2">
                        {visit.carer.name}
                      </h3>
                      <p className="text-sm text-navy-800/80 mb-1">{visit.client.address}</p>
                      <div className="flex items-center text-sm mb-3">
                        <span className="font-medium text-navy-800 w-24">Client:</span>
                        <span className="text-navy-900 font-medium">{visit.client.name}</span>
                      </div>
                      
                      <div className="space-y-2">
                        {visit.scheduledStart && (
                          <div className="flex items-center text-sm">
                            <span className="font-medium text-navy-800 w-24">Start:</span>
                            <span className="text-navy-900">
                              {format(new Date(visit.scheduledStart), 'MMM d, HH:mm')}
                            </span>
                          </div>
                        )}
                        
                        {visit.scheduledEnd && (
                          <div className="flex items-center text-sm">
                            <span className="font-medium text-navy-800 w-24">Finish:</span>
                            <span className="text-navy-900">
                              {format(new Date(visit.scheduledEnd), 'MMM d, HH:mm')}
                            </span>
                          </div>
                        )}
                        
                        {visit.clockInTime && (
                          <div className="flex items-center text-sm">
                            <span className="font-medium text-navy-800 w-24">Clocked In:</span>
                            <span className={`font-medium ${visit.status === 'LATE' ? 'text-amber-600' : 'text-green-600'}`}>
                              {format(new Date(visit.clockInTime), 'HH:mm')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <Link
                          href={`/visits/${visit.id}`}
                          className="inline-flex cursor-pointer items-center px-3 py-2 rounded-xl bg-navy-600 text-white shadow-sm transition-all duration-200 hover:bg-navy-700 hover:shadow-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
                        >
                          {viewerIsCarer && !visit.clockInTime ? 'Clock in' : 'View visit'}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-6 flex items-center justify-center space-x-2" aria-label="Active shifts pages">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-navy-200 rounded-md text-navy-800 hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600"
                    aria-label="Previous page of active shifts"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-navy-800">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-navy-200 rounded-md text-navy-800 hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600"
                    aria-label="Next page of active shifts"
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

