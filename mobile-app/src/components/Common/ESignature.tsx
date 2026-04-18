import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';

type ESignatureProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export const ESignature: React.FC<ESignatureProps> = ({ label = 'E-signature', value, onChange, required }) => {
  const encoded = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return `signed://typed/${encodeURIComponent(trimmed)}`;
  }, [value]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required ? '(required)' : ''}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Type full name as signature"
        value={value}
        onChangeText={onChange}
      />
      {encoded ? <Text style={styles.preview}>Captured: {encoded}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  label: { fontSize: 14, color: colors.textMuted, marginBottom: 8, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 6,
  },
  preview: { fontSize: 12, color: colors.textSecondary },
});
