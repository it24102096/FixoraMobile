import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, SupportTicket, TicketPriority } from '../types';
import { supportService } from '../services/supportService';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;

type ScreenView = 'list' | 'detail' | 'create';

const SupportScreen: React.FC<Props> = ({ navigation }) => {
  const [view, setView] = useState<ScreenView>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [messageText, setMessageText] = useState('');

  // New ticket form
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await supportService.getTickets();
      setTickets(result.data);
    } catch {
      Alert.alert('Error', 'Failed to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleOpenTicket = async (ticket: SupportTicket) => {
    try {
      const full = await supportService.getTicketById(ticket.id);
      setSelectedTicket(full);
      setView('detail');
    } catch {
      Alert.alert('Error', 'Failed to load ticket details.');
    }
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) {
      Alert.alert('Error', 'Please fill in subject and description.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await supportService.createTicket({
        subject: newSubject.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });
      setTickets(prev => [created, ...prev]);
      setNewSubject('');
      setNewDescription('');
      setView('list');
    } catch {
      Alert.alert('Error', 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !messageText.trim()) return;
    setSubmitting(true);
    try {
      const msg = await supportService.sendMessage(
        selectedTicket.id,
        messageText.trim(),
      );
      setSelectedTicket(prev =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev,
      );
      setMessageText('');
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    Alert.alert('Close Ticket', 'Mark this ticket as closed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await supportService.closeTicket(selectedTicket.id);
            setSelectedTicket(updated);
            setTickets(prev =>
              prev.map(t => (t.id === updated.id ? updated : t)),
            );
          } catch {
            Alert.alert('Error', 'Failed to close ticket.');
          }
        },
      },
    ]);
  };

  // ─── Render: Ticket List ──────────────────────────────────────────────────

  const renderTicketList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <TouchableOpacity
          onPress={() => setView('create')}
          style={styles.newBtn}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ticketCard}
              onPress={() => handleOpenTicket(item)}
            >
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketSubject} numberOfLines={1}>
                  {item.subject}
                </Text>
                <View style={[styles.badge, ticketStatusColor(item.status)]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.ticketDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={styles.ticketMeta}>
                <View
                  style={[styles.priorityDot, priorityDotColor(item.priority)]}
                />
                <Text style={styles.ticketMetaText}>
                  {item.priority} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No tickets yet. Tap + New to create one.
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  // ─── Render: Ticket Detail ────────────────────────────────────────────────

  const renderTicketDetail = () => {
    if (!selectedTicket) return null;
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setView('list')}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Ticket
          </Text>
          {selectedTicket.status !== 'closed' ? (
            <TouchableOpacity
              onPress={handleCloseTicket}
              style={styles.closeTicketBtn}
            >
              <Text style={styles.closeTicketText}>Close</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.detailSubject}>{selectedTicket.subject}</Text>
          <Text style={styles.detailDesc}>{selectedTicket.description}</Text>

          <Text style={styles.messagesTitle}>Messages</Text>
          {selectedTicket.messages.length === 0 ? (
            <Text style={styles.emptyMessages}>No messages yet.</Text>
          ) : (
            selectedTicket.messages.map(msg => (
              <View key={msg.id} style={styles.messageBubble}>
                <Text style={styles.messageSender}>{msg.senderName}</Text>
                <Text style={styles.messageContent}>{msg.content}</Text>
                <Text style={styles.messageTime}>
                  {new Date(msg.sentAt).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        {selectedTicket.status !== 'closed' && (
          <View style={styles.replyBar}>
            <TextInput
              style={styles.replyInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (submitting || !messageText.trim()) && styles.sendBtnDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={submitting || !messageText.trim()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  };

  // ─── Render: Create Ticket ────────────────────────────────────────────────

  const renderCreateTicket = () => (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Ticket</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.createContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.formLabel}>Subject</Text>
        <TextInput
          style={styles.formInput}
          value={newSubject}
          onChangeText={setNewSubject}
          placeholder="Brief summary of your issue"
          placeholderTextColor="#666"
        />

        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          style={[styles.formInput, styles.textArea]}
          value={newDescription}
          onChangeText={setNewDescription}
          placeholder="Describe the issue in detail..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={5}
        />

        <Text style={styles.formLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {(['low', 'medium', 'high'] as TicketPriority[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityBtn,
                newPriority === p && styles.priorityBtnActive,
              ]}
              onPress={() => setNewPriority(p)}
            >
              <Text
                style={[
                  styles.priorityBtnText,
                  newPriority === p && styles.priorityBtnTextActive,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleCreateTicket}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Ticket</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (view === 'detail') return renderTicketDetail();
  if (view === 'create') return renderCreateTicket();
  return renderTicketList();
};

const ticketStatusColor = (status: string): object => {
  const map: Record<string, object> = {
    open: { backgroundColor: '#e94560' },
    in_progress: { backgroundColor: '#0f3460' },
    resolved: { backgroundColor: '#2d6a4f' },
    closed: { backgroundColor: '#555' },
  };
  return map[status] ?? { backgroundColor: '#444' };
};

const priorityDotColor = (priority: string): object => {
  const map: Record<string, object> = {
    low: { backgroundColor: '#2d6a4f' },
    medium: { backgroundColor: '#d4a017' },
    high: { backgroundColor: '#e94560' },
  };
  return map[priority] ?? { backgroundColor: '#444' };
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  newBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  listContent: { padding: 16, paddingBottom: 40 },
  ticketCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketSubject: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  ticketDesc: { fontSize: 13, color: '#aaa', marginBottom: 8 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center' },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  ticketMetaText: { fontSize: 12, color: '#777', textTransform: 'capitalize' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 60, fontSize: 15 },
  // Detail View
  detailScroll: { flex: 1 },
  detailScrollContent: { padding: 16, paddingBottom: 20 },
  detailSubject: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  detailDesc: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 20,
    lineHeight: 22,
  },
  messagesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e94560',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  emptyMessages: { color: '#666', fontSize: 14 },
  messageBubble: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  messageSender: { fontSize: 12, fontWeight: '700', color: '#e94560', marginBottom: 4 },
  messageContent: { fontSize: 14, color: '#ccc', lineHeight: 20 },
  messageTime: { fontSize: 11, color: '#666', marginTop: 6, textAlign: 'right' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#0f3460',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  closeTicketBtn: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: 60,
    alignItems: 'center',
  },
  closeTicketText: { color: '#aaa', fontSize: 13 },
  // Create View
  createContent: { padding: 16, paddingBottom: 40 },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ccc',
    marginBottom: 6,
    marginTop: 14,
  },
  formInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#1e4a80',
  },
  textArea: { textAlignVertical: 'top', minHeight: 100 },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#16213e',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e4a80',
  },
  priorityBtnActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  priorityBtnText: { color: '#aaa', fontWeight: '600', textTransform: 'capitalize' },
  priorityBtnTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: '#e94560',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

export default SupportScreen;
