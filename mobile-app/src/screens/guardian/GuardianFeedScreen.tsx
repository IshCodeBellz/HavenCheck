import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import { guardianService, GuardianFeedItem } from '../../services/guardian';
import { colors } from '../../theme/colors';

function severityBadge(sev: string): { bg: string; fg: string } {
  switch (sev) {
    case 'CRITICAL':
      return { bg: '#fee2e2', fg: '#991b1b' };
    case 'HIGH':
      return { bg: '#ffedd5', fg: '#9a3412' };
    case 'MEDIUM':
      return { bg: '#fef9c3', fg: '#854d0e' };
    default:
      return { bg: colors.surface, fg: colors.foreground };
  }
}

const VisitCard: React.FC<{ item: GuardianFeedItem }> = ({ item }) => {
  const v = item.visit;
  if (!v) return null;
  return (
    <View style={[styles.card, styles.cardVisit]}>
      <Text style={styles.kicker}>Visit</Text>
      <Text style={styles.title}>{item.headline}</Text>
      <Text style={styles.client}>{item.client.name}</Text>
      {item.subheadline ? <Text style={styles.subtitle}>{item.subheadline}</Text> : null}
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      <View style={styles.dl}>
        {v.durationMinutes != null ? (
          <View style={styles.dlRow}>
            <Text style={styles.dt}>Duration</Text>
            <Text style={styles.dd}>{v.durationMinutes} min</Text>
          </View>
        ) : null}
        {v.clockInTime ? (
          <View style={styles.dlRow}>
            <Text style={styles.dt}>Clock in</Text>
            <Text style={styles.dd}>{new Date(v.clockInTime).toLocaleString()}</Text>
          </View>
        ) : null}
        {v.clockOutTime ? (
          <View style={styles.dlRow}>
            <Text style={styles.dt}>Clock out</Text>
            <Text style={styles.dd}>{new Date(v.clockOutTime).toLocaleString()}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const NoteCard: React.FC<{ item: GuardianFeedItem }> = ({ item }) => {
  const n = item.note;
  if (!n) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Care note</Text>
      <Text style={styles.title}>{item.headline}</Text>
      <Text style={styles.client}>{item.client.name}</Text>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      <View style={styles.chips}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{n.type}</Text>
        </View>
        {n.priority === 'HIGH' ? (
          <View style={[styles.chip, styles.chipWarn]}>
            <Text style={[styles.chipText, styles.chipWarnText]}>High priority</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.noteBody}>{n.text}</Text>
    </View>
  );
};

const IncidentCard: React.FC<{ item: GuardianFeedItem }> = ({ item }) => {
  const i = item.incident;
  if (!i) return null;
  const sev = severityBadge(i.severity);
  return (
    <View style={[styles.card, styles.cardIncident]}>
      <Text style={styles.kickerIncident}>Incident</Text>
      <Text style={styles.title}>{item.headline}</Text>
      {item.subheadline ? <Text style={styles.subtitle}>{item.subheadline}</Text> : null}
      <Text style={styles.client}>{item.client.name}</Text>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: sev.bg }]}>
          <Text style={[styles.chipText, { color: sev.fg }]}>{i.severity}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{i.status}</Text>
        </View>
        {i.safeguardingFlag ? (
          <View style={[styles.chip, styles.chipDanger]}>
            <Text style={[styles.chipText, styles.chipDangerText]}>Safeguarding</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.dt}>Reported {new Date(i.reportedAt).toLocaleString()}</Text>
      {i.details ? <Text style={styles.noteBody}>{i.details}</Text> : <Text style={styles.muted}>No extra details.</Text>}
    </View>
  );
};

const FeedRow: React.FC<{ item: GuardianFeedItem }> = ({ item }) => {
  if (item.type === 'visit') return <VisitCard item={item} />;
  if (item.type === 'note') return <NoteCard item={item} />;
  if (item.type === 'incident') return <IncidentCard item={item} />;
  return null;
};

const GuardianFeedScreen: React.FC = () => {
  const [items, setItems] = useState<GuardianFeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [banner, setBanner] = useState<string | null>(null);
  const newestRef = useRef<string | null>(null);

  const clientFilters = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) {
      m.set(it.client.id, it.client.name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const load = useCallback(
    async (opts?: { since?: string; merge?: boolean }) => {
      try {
        setError(null);
        const data = await guardianService.getFeed(clientId, opts?.since);
        if (opts?.merge && opts.since) {
          setItems((prev) => {
            const seen = new Set(prev.map((p) => `${p.type}:${p.id}`));
            const incoming = data.filter((d) => !seen.has(`${d.type}:${d.id}`));
            if (incoming.length > 0) {
              setBanner(`${incoming.length} new update${incoming.length > 1 ? 's' : ''}`);
              setTimeout(() => setBanner(null), 5000);
            }
            return [...incoming, ...prev].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        } else {
          setItems(data);
          if (data[0]) newestRef.current = data[0].createdAt;
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Could not load guardian feed');
      }
    },
    [clientId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => {
      const since = newestRef.current;
      if (!since) return;
      void load({ since, merge: true });
    }, 45000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!items[0]) return;
    const top = items[0].createdAt;
    const cur = newestRef.current;
    if (!cur || new Date(top).getTime() > new Date(cur).getTime()) {
      newestRef.current = top;
    }
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted' || cancelled) return;
        const projectId = (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas
          ?.projectId;
        const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        if (!token.data || cancelled) return;
        await guardianService.registerDevice(token.data);
      } catch {
        /* optional — dev client without EAS project */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>Updates refresh every 45 seconds.</Text>
      {clientFilters.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Pressable
            onPress={() => setClientId(undefined)}
            style={[styles.filterChip, !clientId && styles.filterChipOn]}
          >
            <Text style={[styles.filterChipText, !clientId && styles.filterChipTextOn]}>All</Text>
          </Pressable>
          {clientFilters.map(([id, name]) => (
            <Pressable
              key={id}
              onPress={() => setClientId(id)}
              style={[styles.filterChip, clientId === id && styles.filterChipOn]}
            >
              <Text style={[styles.filterChipText, clientId === id && styles.filterChipTextOn]}>{name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          !error ? <Text style={styles.empty}>Nothing here yet. Pull to refresh.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <FeedRow item={item} />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hint: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 16, paddingTop: 8 },
  filterScroll: { maxHeight: 48, paddingHorizontal: 12, paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  filterChipOn: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  filterChipText: { fontSize: 13, color: colors.foreground },
  filterChipTextOn: { fontWeight: '700', color: colors.primary },
  row: { paddingHorizontal: 16, paddingBottom: 12 },
  banner: { marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac' },
  bannerText: { fontSize: 13, color: '#14532d', fontWeight: '600' },
  error: { color: '#b91c1c', marginHorizontal: 16, marginTop: 8 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40, paddingHorizontal: 24 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardVisit: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  cardIncident: { borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  kicker: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.6, marginBottom: 4 },
  kickerIncident: { fontSize: 11, fontWeight: '700', color: '#b91c1c', letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  client: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  dl: { marginTop: 10, gap: 6 },
  dlRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  dt: { fontSize: 12, color: colors.textMuted },
  dd: { fontSize: 13, fontWeight: '600', color: colors.foreground, flex: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipWarn: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  chipDanger: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  chipWarnText: { color: '#9a3412' },
  chipDangerText: { color: '#991b1b' },
  noteBody: { marginTop: 10, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  muted: { marginTop: 8, fontSize: 13, color: colors.textMuted },
});

export default GuardianFeedScreen;
