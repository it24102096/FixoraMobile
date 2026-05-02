import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  TextInput,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, LeaveRequest, LeaveStatus } from '../types';
import { leaveService } from '../services/leaveService';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaves'>;

const STATUS_FILTERS: { label: string; value: LeaveStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const statusColor = (status: LeaveStatus) => {
  if (status === 'approved') return '#4cde9a';
  if (status === 'rejected') return '#e94560';
  return '#f0a500';
};

const LeavesScreen: React.FC<Props> = ({ navigation }) => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveStatus | 'all'>('all');
  const [actionItem, setActionItem] = useState<LeaveRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await leaveService.getLeaves(
        filter === 'all' ? undefined : filter,
      );
      setLeaves(data);
    } catch {
      Alert.alert('Error', 'Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const openAction = (item: LeaveRequest) => {
    setActionItem(item);
    setAdminNote('');
  };

  const handleApprove = async () => {
    if (!actionItem) return;
    setProcessing(true);
    try {
      const updated = await leaveService.approveLeave(actionItem.id, adminNote);
      setLeaves(prev => prev.map(l => (l.id === updated.id ? updated : l)));
      setActionItem(null);
      Alert.alert('Approved ✅', `Leave approved for ${actionItem.technicianName}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to approve leave');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!actionItem) return;
    setProcessing(true);
    try {
      const updated = await leaveService.rejectLeave(actionItem.id, adminNote);
      setLeaves(prev => prev.map(l => (l.id === updated.id ? updated : l)));
      setActionItem(null);
      Alert.alert('Rejected', `Leave rejected for ${actionItem.technicianName}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reject leave');
    } finally {
      setProcessing(false);
    }
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => {
    const color = statusColor(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.techName}>{item.technicianName}</Text>
            <Text style={styles.dates}>
              {item.startDate}  →  {item.endDate}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.reason}>{item.reason}</Text>

        {item.adminNote ? (
          <Text style={styles.adminNote}>Note: {item.adminNote}</Text>
        ) : null}

        {item.status === 'pending' && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => openAction(item)}>
            <Text style={styles.actionBtnText}>Review →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Requests</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4cde9a" />
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No leave requests found.</Text>
            </View>
          }
          onRefresh={loadLeaves}
          refreshing={loading}
        />
      )}

      {/* Approve / Reject Modal */}
      <Modal
        visible={!!actionItem}
        transparent
        animationType="slide"
        onRequestClose={() => setActionItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Review Leave Request</Text>

            {actionItem && (
              <>
                <Text style={styles.modalTech}>{actionItem.technicianName}</Text>
                <Text style={styles.modalDates}>
                  {actionItem.startDate}  →  {actionItem.endDate}
                </Text>
                <Text style={styles.modalReason}>{actionItem.reason}</Text>
              </>
            )}

            <Text style={styles.modalLabel}>Admin Note (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder="Add a note for the technician..."
              placeholderTextColor="#555"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.rejectBtn, processing && { opacity: 0.6 }]}
                onPress={handleReject}
                disabled={processing}
              >
                <Text style={styles.modalBtnText}>✗  Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.approveBtn, processing && { opacity: 0.6 }]}
                onPress={handleApprove}
                disabled={processing}
              >
                {processing
                  ? <ActivityIndicator color="#071428" />
                  : <Text style={[styles.modalBtnText, { color: '#071428' }]}>✓  Approve</Text>}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setActionItem(null)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1b2a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
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

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#162032',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3050',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0d1b2a',
  },
  filterChipActive: { borderColor: '#4cde9a', backgroundColor: 'rgba(76,222,154,0.12)' },
  filterText: { color: '#777', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#4cde9a' },

  listContent: { padding: 16, paddingBottom: 40 },
  emptyText: { color: '#555', fontSize: 14 },

  card: {
    backgroundColor: '#162032',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e3050',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  techName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dates: { color: '#aab', fontSize: 12, marginTop: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  reason: { color: '#ccc', fontSize: 13, lineHeight: 18 },
  adminNote: {
    color: '#7eb8f7',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
  },
  actionBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(76,222,154,0.12)',
    borderWidth: 1,
    borderColor: '#4cde9a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  actionBtnText: { color: '#4cde9a', fontSize: 13, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#162032',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#1e3050',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  modalTech: { color: '#4cde9a', fontSize: 15, fontWeight: '700' },
  modalDates: { color: '#aab', fontSize: 13, marginTop: 4 },
  modalReason: { color: '#ccc', fontSize: 13, marginTop: 8, marginBottom: 16 },
  modalLabel: { color: '#aab', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  modalInput: {
    backgroundColor: '#0d1b2a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#223344',
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectBtn: { backgroundColor: 'rgba(233,69,96,0.15)', borderWidth: 1, borderColor: '#e94560' },
  approveBtn: { backgroundColor: '#4cde9a' },
  modalBtnText: { color: '#e94560', fontSize: 15, fontWeight: '700' },
  cancelModalBtn: { marginTop: 14, alignItems: 'center' },
  cancelModalText: { color: '#555', fontSize: 14 },
});

export default LeavesScreen;
