import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { visitsService } from '../../services/visits';
import type { VisitCarePlanSnapshot } from '../../types';
import { colors } from '../../theme/colors';

const CarePlanSummaryScreen: React.FC = () => {
  const route = useRoute();
  const { visitId } = route.params as { visitId: string };

  const [data, setData] = useState<VisitCarePlanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await visitsService.getVisitCarePlan(visitId);
      setData(snap);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setError(msg || 'Could not load care plan');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = data?.carePlan;
  const version = plan?.currentVersion;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.centered} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !plan || !version ? (
          <Text style={styles.muted}>No active structured care plan for {data?.client.name ?? 'this client'}.</Text>
        ) : (
          <>
            <Text style={styles.title}>Care plan</Text>
            <Text style={styles.subtitle}>
              {data?.client.name} · Version {version.version}
              {plan.reviewDate ? ` · Review ${new Date(plan.reviewDate).toLocaleDateString()}` : ''}
            </Text>
            {version.summary ? <Text style={styles.summary}>{version.summary}</Text> : null}
            {version.sections.map((section) => (
              <View key={section.id} style={styles.sectionCard}>
                <Text style={styles.sectionType}>{section.sectionType}</Text>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32 },
  centered: { marginTop: 48 },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.textMuted },
  summary: { marginTop: 12, fontSize: 15, color: colors.foreground, lineHeight: 22 },
  sectionCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionType: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  sectionTitle: { marginTop: 4, fontSize: 17, fontWeight: '600', color: colors.foreground },
  sectionBody: { marginTop: 8, fontSize: 15, color: colors.foreground, lineHeight: 22 },
  muted: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  error: { fontSize: 15, color: '#b91c1c' },
});

export default CarePlanSummaryScreen;
