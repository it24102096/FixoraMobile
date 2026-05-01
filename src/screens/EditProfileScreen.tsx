import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, User } from '../types';
import { authService } from '../services/authService';
import { serviceService } from '../services/serviceService';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [availableServices, setAvailableServices] = useState<{ id: string; name: string }[]>([]);

  const loadProfile = useCallback(async () => {
    try {
      const currentUser = (await authService.getMe()) || (await authService.getCurrentUser());
      setUser(currentUser);
      setName(currentUser?.name || '');
      setEmail(currentUser?.email || '');
      setPhone(currentUser?.phone || '');
      setSpecializations(currentUser?.specializations || []);
    } catch {
      Alert.alert('Error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    serviceService.getServices().then((services) => {
      setAvailableServices(services.map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, []);

  // Refresh when returning from TechnicianAvailability screen
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleOpenTechnicianAvailability = () => {
    const routeName = 'TechnicianAvailability';
    const currentRouteNames = navigation.getState()?.routeNames || [];
    console.log('EditProfile current routeNames:', currentRouteNames);

    if (currentRouteNames.includes(routeName)) {
      navigation.navigate(routeName);
      return;
    }

    const parentNav = navigation.getParent();
    const parentRouteNames = parentNav?.getState()?.routeNames || [];
    console.log('EditProfile parent routeNames:', parentRouteNames);

    if (parentNav && parentRouteNames.includes(routeName)) {
      (parentNav as any).navigate(routeName);
      return;
    }

    try {
      navigation.dispatch(CommonActions.navigate({ name: routeName }));
    } catch (error) {
      console.error('TechnicianAvailability route not found in current navigator tree', {
        currentRouteNames,
        parentRouteNames,
        error,
      });
      Alert.alert(
        'Navigation Error',
        'Could not open availability screen. Please reload the app and try again.'
      );
    }
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name is required');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Required', 'Email is required');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Invalid', 'Please enter a valid email address');
      return;
    }

    setUpdating(true);
    try {
      const updated = await authService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        specializations,
      });
      setUser(updated);
      Alert.alert('Success ✅', 'Profile updated successfully!');
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Failed to update profile';
      Alert.alert('Error', errorMsg);
      console.error('Profile update error:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <View style={[styles.roleBadge, getRoleColor(user?.role)]}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'USER'}</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#555"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <DetailRow label="User ID" value={user?.id || 'N/A'} />
          <DetailRow label="Role" value={user?.role || 'N/A'} />
          <DetailRow label="Member Since" value={user?.id ? '2026' : 'N/A'} />
        </View>

        {/* Technician Availability Summary + Button */}
        {user?.role === 'technician' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏰ Availability</Text>

            {/* Working Hours */}
            <View style={styles.availRow}>
              <Text style={styles.availLabel}>Working Hours</Text>
              <Text style={styles.availValue}>
                {user?.workingHours
                  ? `${user.workingHours.startTime} — ${user.workingHours.endTime}`
                  : 'Not set'}
              </Text>
            </View>

            {/* Working Days */}
            <Text style={[styles.availLabel, { marginTop: 10 }]}>Working Days</Text>
            {user?.availableDates && user.availableDates.length > 0 ? (
              <View style={styles.dayChipRow}>
                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
                  .filter(d => user.availableDates!.includes(d))
                  .map(d => (
                    <View
                      key={d}
                      style={[
                        styles.dayChip,
                        ['saturday','sunday'].includes(d) && styles.dayChipWeekend,
                      ]}
                    >
                      <Text style={styles.dayChipText}>
                        {d.charAt(0).toUpperCase() + d.slice(1, 3)}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : (
              <Text style={styles.availNone}>No days set</Text>
            )}

            <TouchableOpacity
              style={styles.techAvailabilityBtn}
              onPress={handleOpenTechnicianAvailability}
            >
              <Text style={styles.techAvailabilityBtnText}>Edit Working Hours & Days →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Technician Service Specializations */}
        {user?.role === 'technician' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 My Services</Text>
            <Text style={styles.specializationHint}>
              Select the services you are able to perform:
            </Text>
            {availableServices.length === 0 ? (
              <Text style={styles.availNone}>No services available</Text>
            ) : (
              <View style={styles.dayChipRow}>
                {availableServices.map((service) => {
                  const selected = specializations.includes(service.name);
                  return (
                    <TouchableOpacity
                      key={service.id}
                      style={[
                        styles.serviceChip,
                        selected && styles.serviceChipSelected,
                      ]}
                      onPress={() => {
                        setSpecializations((prev) =>
                          selected
                            ? prev.filter((s) => s !== service.name)
                            : [...prev, service.name]
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.serviceChipText,
                          selected && styles.serviceChipTextSelected,
                        ]}
                      >
                        {service.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Update Button */}
        <TouchableOpacity
          style={styles.updateBtn}
          onPress={handleUpdateProfile}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.updateBtnText}>Update Profile</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const getRoleColor = (role?: string) => {
  switch (role) {
    case 'admin':
      return { backgroundColor: 'rgba(233, 69, 96, 0.2)', borderColor: '#e94560' };
    case 'technician':
      return { backgroundColor: 'rgba(76, 222, 154, 0.2)', borderColor: '#4cde9a' };
    case 'customer':
      return { backgroundColor: 'rgba(126, 184, 247, 0.2)', borderColor: '#7eb8f7' };
    default:
      return { backgroundColor: 'rgba(100, 100, 100, 0.2)', borderColor: '#666' };
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1b2a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#071428',
  },
  backBtn: { padding: 4 },
  backText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 16 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#162032',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e3050',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e94560',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  userName: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  roleBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  section: {
    backgroundColor: '#162032',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e3050',
  },
  sectionTitle: {
    color: '#4cde9a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: { color: '#aab', fontSize: 13, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#0d1b2a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#223344',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  detailValue: { fontSize: 13, color: '#ccc', fontWeight: '500' },
  availRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  availLabel: { color: '#888', fontSize: 13, fontWeight: '600' },
  availValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  availNone: { color: '#555', fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  dayChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  dayChip: {
    backgroundColor: 'rgba(76,222,154,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#4cde9a',
  },
  dayChipWeekend: {
    backgroundColor: 'rgba(126,184,247,0.15)',
    borderColor: '#7eb8f7',
  },
  dayChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  techAvailabilityBtn: {
    backgroundColor: 'rgba(76, 222, 154, 0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#4cde9a',
  },
  techAvailabilityBtnText: { color: '#4cde9a', fontSize: 14, fontWeight: '700' },
  specializationHint: { color: '#888', fontSize: 12, marginBottom: 10 },
  serviceChip: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  serviceChipSelected: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    borderColor: '#e94560',
  },
  serviceChipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  serviceChipTextSelected: { color: '#e94560' },
  updateBtn: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  updateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default EditProfileScreen;
