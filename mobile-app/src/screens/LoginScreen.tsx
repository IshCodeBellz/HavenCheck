import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const HAVEN_CHECK_LOGO = require('../../assets/logo/logoclose.png');

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !organizationCode || !password) {
      Alert.alert('Error', 'Please enter email, organization code, and password');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), organizationCode.trim().toUpperCase(), password);
    } catch (error: any) {
      const errorCode = error?.response?.data?.error;
      const errorMessage = error?.response?.data?.message;
      const apiMessage =
        errorCode === 'ORGANIZATION_ACCESS_DENIED'
          ? 'Organization code does not match this account.'
          : errorCode === 'UNAUTHORIZED'
            ? 'Invalid email or password.'
            : errorMessage || errorCode;
      const fallbackMessage = error?.request
        ? 'Unable to reach the server. Check your API URL and network.'
        : 'Invalid credentials';
      Alert.alert('Login Failed', apiMessage || fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Image source={HAVEN_CHECK_LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandSubtitle}>Sign in to manage visits, schedules, and your team.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@company.com"
              placeholderTextColor={colors.navy300}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={styles.fieldLabel}>Organization code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HFL"
              placeholderTextColor={colors.navy300}
              value={organizationCode}
              onChangeText={setOrganizationCode}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
            />
            <Text style={styles.orgHint}>Use your company code (demo account: HFL).</Text>

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter password"
                placeholderTextColor={colors.navy300}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.passwordToggle}
                activeOpacity={0.8}
              >
                <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy800,
  },
  glowTop: {
    position: 'absolute',
    top: -140,
    left: -120,
    width: 300,
    height: 300,
    borderRadius: 160,
    backgroundColor: 'rgba(72, 187, 255, 0.18)',
  },
  glowBottom: {
    position: 'absolute',
    right: -110,
    bottom: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(29, 78, 216, 0.2)',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  brandBlock: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  logo: {
    alignSelf: 'center',
    width: 290,
    height: 120,
    marginBottom: -8,
  },
  brandSubtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#D9E6F7',
  },
  orgHint: {
    marginTop: -8,
    marginBottom: 14,
    fontSize: 12,
    color: colors.textSecondary,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#0B1E35',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy700,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.navy50,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.navy200,
    color: colors.foreground,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navy200,
    marginBottom: 16,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.foreground,
  },
  passwordToggle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  passwordToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default LoginScreen;

