import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import api from '../../services/api';
import { colors } from '../../theme/colors';

type InboxMessage = {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  thread: { id: string; subject: string | null };
};

const GuardianAlertsScreen: React.FC = () => {
  const [items, setItems] = useState<InboxMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<InboxMessage[]>('/carer/messages/inbox');
      setItems(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load care alerts');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Visit and incident notifications from your care team.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
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
          !error ? (
            <Text style={styles.empty}>No alerts yet. Pull to refresh.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.readAt ? styles.cardRead : styles.cardUnread]}>
            <Text style={styles.subject}>{item.thread.subject || 'Update'}</Text>
            <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  intro: { fontSize: 14, color: colors.textMuted, marginBottom: 12 },
  error: { color: '#b91c1c', marginBottom: 10 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardRead: { backgroundColor: colors.surface, borderColor: colors.border },
  cardUnread: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  subject: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  time: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  body: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
});

export default GuardianAlertsScreen;
