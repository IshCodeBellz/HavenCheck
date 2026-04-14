import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';

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

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [stats, setStats] = useState<DashboardStats>({
    activeCarers: 0,
    visitsInProgress: 0,
    visitsToday: 0,
    missedVisits: 0,
  });
  const [activeVisits, setActiveVisits] = useState<ActiveVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const visitsResponse = await api.get('/visits/today');
      const visits = visitsResponse.data;
      
      const inProgress = visits.filter((v: any) => v.status === 'IN_PROGRESS' || v.status === 'LATE');
      const missed = visits.filter((v: any) => v.status === 'MISSED');
      const activeCarers = new Set(inProgress.map((v: any) => v.carerId)).size;

      const visitsWithLocation = inProgress.filter((v: any) => v.client?.latitude && v.client?.longitude);

      setStats({
        activeCarers,
        visitsInProgress: inProgress.length,
        visitsToday: visits.length,
        missedVisits: missed.length,
      });

      setActiveVisits(visitsWithLocation);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    
    const interval = setInterval(() => {
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadStats]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LATE':
        return '#FF9500';
      case 'IN_PROGRESS':
        return colors.primary;
      default:
        return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard</Text>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeCarers}</Text>
            <Text style={styles.statLabel}>Active Carers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.visitsInProgress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.visitsToday}</Text>
            <Text style={styles.statLabel}>Visits Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#FF3B30' }]}>{stats.missedVisits}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
        </View>

        {/* Active Shifts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Shifts</Text>
            <TouchableOpacity onPress={loadStats}>
              <Text style={styles.refreshButton}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {activeVisits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active shifts at the moment</Text>
            </View>
          ) : (
            activeVisits.map((visit) => (
              <TouchableOpacity
                key={visit.id}
                style={styles.visitCard}
                onPress={() => {
                  (navigation as any).navigate('VisitDetail', { visitId: visit.id });
                }}
              >
                <View style={styles.visitHeader}>
                  <Text style={styles.visitCarerName}>{visit.carer.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(visit.status) }]}>
                    <Text style={styles.statusText}>{visit.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.visitClientName}>{visit.client.name}</Text>
                <Text style={styles.visitAddress}>{visit.client.address}</Text>
                {visit.scheduledStart && (
                  <Text style={styles.visitTime}>
                    Start: {format(new Date(visit.scheduledStart), 'MMM d, HH:mm')}
                  </Text>
                )}
                {visit.clockInTime && (
                  <Text style={styles.visitTime}>
                    Clocked In: {format(new Date(visit.clockInTime), 'HH:mm')}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  refreshButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  visitCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  visitCarerName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  visitClientName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 4,
  },
  visitAddress: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  visitTime: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default DashboardScreen;

