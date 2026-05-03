import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { authService } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleResetPassword = async () => {
    setError('');
    setMessage('');

    if (!email.trim() || !newPassword || !confirmPassword) {
      setError('Please fill all fields.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(email.trim(), newPassword);
      setMessage('Password reset successful. You can now log in.');
      setTimeout(() => navigation.navigate('Login'), 900);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to reset password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Set a new password using your account email.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {message ? <Text style={styles.successText}>{message}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#4a658a"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="At least 8 characters"
              placeholderTextColor="#4a658a"
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity style={styles.showHideBtn} onPress={() => setShowNewPassword((prev) => !prev)}>
              <Text style={styles.showHideText}>{showNewPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Re-enter password"
              placeholderTextColor="#4a658a"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity style={styles.showHideBtn} onPress={() => setShowConfirmPassword((prev) => !prev)}>
              <Text style={styles.showHideText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, loading && styles.disabled]} onPress={handleResetPassword} disabled={loading}>
            {loading ? <ActivityIndicator color="#071428" /> : <Text style={styles.primaryBtnText}>Reset Password</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071428',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#0a1a35',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 232, 0.1)',
  },
  backText: {
    color: '#00d4e8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b82a3',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 18,
  },
  label: {
    color: '#bacbe0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0c2242',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#1d3b63',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  showHideBtn: {
    backgroundColor: '#0c2242',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#1d3b63',
  },
  showHideText: {
    color: '#00d4e8',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#00d4e8',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#071428',
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#ff7b7b',
    marginBottom: 10,
  },
  successText: {
    color: '#2ed573',
    marginBottom: 10,
  },
});

export default ForgotPasswordScreen;
