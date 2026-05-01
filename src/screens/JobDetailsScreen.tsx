import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Job, JobStatus } from '../types';
import { jobService } from '../services/jobService';
import { authService } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'JobDetails'>;

interface Technician {
  _id: string;
  name: string;
  email: string;
  phone: string;
  specializations?: string[];
}

const JobDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTechnicianModal, setShowTechnicianModal] = useState(false);
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [assigningTech, setAssigningTech] = useState(false);

  const loadJob = useCallback(async () => {
    try {
      const [data, user] = await Promise.all([
        jobService.getJobById(jobId),
        authService.getCurrentUser(),
      ]);
      setJob(data);
      setIsAdmin((user as any)?.role === 'admin');
    } catch {
      Alert.alert('Error', 'Failed to load job details.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleStatusUpdate = async (newStatus: JobStatus) => {
    if (!job) return;
    Alert.alert(
      'Update Status',
      `Change status to "${newStatus.replace('_', ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            try {
              const updated = await jobService.updateJobStatus(jobId, newStatus);
              setJob(updated);
            } catch {
              Alert.alert('Error', 'Failed to update status.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const handleCreatePayment = () => {
    navigation.navigate('Payment', { jobId });
  };

  const handleScheduleAppointment = () => {
    navigation.navigate('Appointment', { jobId });
  };

  const handleAssignTechnician = async () => {
    if (!job) return;
    setLoadingTechs(true);
    try {
      const techs = await jobService.getAvailableTechnicians(
        job.scheduledAt,
        job.estimatedDuration,
        job.serviceName || job.title,
      );
      setAvailableTechnicians(techs);
      setShowTechnicianModal(true);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load available technicians.';
      Alert.alert('Error', errorMsg);
      console.error('Technician fetch error:', err);
    } finally {
      setLoadingTechs(false);
    }
  };

  const handleSelectTechnician = async (tech: Technician) => {
    if (!job) return;
    setAssigningTech(true);
    try {
      const updated = await jobService.assignTechnician(jobId, tech._id);
      setJob(updated);
      setShowTechnicianModal(false);
      Alert.alert('Success ✅', `Technician ${tech.name} assigned! Appointment created.`);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to assign technician.';
      Alert.alert('Error', errorMsg);
      console.error('Assignment error:', err);
    } finally {
      setAssigningTech(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Job not found.</Text>
      </View>
    );
  }

  const nextStatuses = getNextStatuses(job.status);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Job Details
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title & Status */}
        <View style={styles.titleRow}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <View style={[styles.statusBadge, statusColor(job.status)]}>
            <Text style={styles.statusText}>
              {job.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={[styles.priorityBadge, priorityColor(job.priority)]}>
          <Text style={styles.priorityText}>
            {job.priority.toUpperCase()} PRIORITY
          </Text>
        </View>

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Customer" value={job.customerName} />
          <DetailRow label="Address" value={job.address} />
          <DetailRow
            label="Scheduled"
            value={new Date(job.scheduledAt).toLocaleString()}
          />
          <DetailRow
            label="Est. Duration"
            value={`${job.estimatedDuration} minutes`}
          />
          {job.technicianName && (
            <DetailRow label="Technician" value={job.technicianName} />
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        {/* Notes */}
        {job.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.description}>{job.notes}</Text>
          </View>
        ) : null}

        {/* Status Actions */}
        {nextStatuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.actionsRow}>
              {nextStatuses.map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.actionBtn,
                    updating && styles.actionBtnDisabled,
                  ]}
                  onPress={() => handleStatusUpdate(status)}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnText}>
                      Mark as {status.replace('_', ' ')}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.linkBtn, styles.linkBtnAdmin]}
              onPress={handleAssignTechnician}
              disabled={loadingTechs || assigningTech}
            >
              <Text style={styles.linkBtnText}>
                {loadingTechs || assigningTech ? '⏳ Loading...' : '👨‍🔧 Assign Technician'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.linkBtn, isAdmin && { marginTop: 10 }]}
            onPress={handleScheduleAppointment}
          >
            <Text style={styles.linkBtnText}>📅 Schedule Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkBtn, { marginTop: 10 }]}
            onPress={handleCreatePayment}
          >
            <Text style={styles.linkBtnText}>💳 View / Create Invoice</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Technician Picker Modal */}
      <Modal visible={showTechnicianModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTechnicianModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.modalTitle}>Assign Technician</Text>
                {job?.serviceName ? (
                  <Text style={styles.modalSubtitle}>{job.serviceName} specialists only</Text>
                ) : null}
              </View>
              <View style={{ width: 24 }} />
            </View>

            {availableTechnicians.length === 0 ? (
              <View style={styles.emptyTechs}>
                <Text style={styles.emptyTechsText}>
                  {job?.serviceName
                    ? `No available technicians specializing in "${job.serviceName}".`
                    : 'No available technicians for this time slot.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableTechnicians}
                keyExtractor={t => t._id}
                renderItem={({ item: tech }) => (
                  <TouchableOpacity
                    style={styles.techItem}
                    onPress={() => handleSelectTechnician(tech)}
                    disabled={assigningTech}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.techName}>{tech.name}</Text>
                      <Text style={styles.techContact}>{tech.email}</Text>
                      <Text style={styles.techContact}>{tech.phone}</Text>
                                         {tech.specializations && tech.specializations.length > 0 && (
                                           <Text style={styles.techSpecializations}>
                                             🔧 {tech.specializations.join(', ')}
                                           </Text>
                                         )}
                    </View>
                    <Text style={styles.techSelect}>→</Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.techList}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const getNextStatuses = (current: JobStatus): JobStatus[] => {
  const transitions: Record<JobStatus, JobStatus[]> = {
    pending: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };
  return transitions[current];
};

const statusColor = (status: JobStatus): object => {
  const map: Record<JobStatus, object> = {
    pending: { backgroundColor: '#d4a017' },
    in_progress: { backgroundColor: '#0f3460' },
    completed: { backgroundColor: '#2d6a4f' },
    cancelled: { backgroundColor: '#555' },
  };
  return map[status];
};

const priorityColor = (priority: string): object => {
  const map: Record<string, object> = {
    low: { backgroundColor: 'rgba(45,106,79,0.3)', borderColor: '#2d6a4f' },
    medium: { backgroundColor: 'rgba(212,160,23,0.3)', borderColor: '#d4a017' },
    high: {
      backgroundColor: 'rgba(193,68,14,0.3)',
      borderColor: '#c1440e',
    },
    urgent: {
      backgroundColor: 'rgba(233,69,96,0.3)',
      borderColor: '#e94560',
    },
  };
  return map[priority] ?? { backgroundColor: 'rgba(68,68,68,0.3)', borderColor: '#444' };
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centered: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#aaa', fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#16213e',
  },
  backBtn: { width: 60 },
  backText: { color: '#e94560', fontSize: 15, fontWeight: '600' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    marginBottom: 16,
  },
  priorityText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e94560',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  detailValue: { fontSize: 13, color: '#ccc', flex: 1, textAlign: 'right' },
  description: { fontSize: 14, color: '#bbb', lineHeight: 22 },
  actionsRow: { gap: 10 },
  actionBtn: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  linkBtn: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1e4a80',
  },
  linkBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  linkBtnAdmin: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0d1b2a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2a3a',
  },
  modalClose: { fontSize: 24, color: '#e94560', fontWeight: '700' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    modalSubtitle: { color: '#e94560', fontSize: 12, fontWeight: '600', marginTop: 2 },
  techList: { padding: 12 },
    techSpecializations: { color: '#4cde9a', fontSize: 11, marginTop: 3, fontWeight: '500' },
  emptyTechs: { alignItems: 'center', paddingVertical: 40 },
  emptyTechsText: { color: '#888', fontSize: 14 },
  techItem: {
    backgroundColor: '#162032',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e3050',
    flexDirection: 'row',
    alignItems: 'center',
  },
  techName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  techContact: { color: '#7eb8f7', fontSize: 12, marginBottom: 2 },
  techSelect: { color: '#4cde9a', fontSize: 18, fontWeight: '800' },
});

export default JobDetailsScreen;
