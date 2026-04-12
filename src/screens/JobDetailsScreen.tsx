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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Job, JobStatus } from '../types';
import { jobService } from '../services/jobService';

type Props = NativeStackScreenProps<RootStackParamList, 'JobDetails'>;

const JobDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadJob = useCallback(async () => {
    try {
      const data = await jobService.getJobById(jobId);
      setJob(data);
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
          <TouchableOpacity
            style={styles.linkBtn}
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
});

export default JobDetailsScreen;
