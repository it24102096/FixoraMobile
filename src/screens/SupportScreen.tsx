import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  RootStackParamList,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  User,
  FeedbackTag,
  FeedbackItem,
  EligibleFeedbackJob,
} from '../types';
import { supportService } from '../services/supportService';
import { authService } from '../services/authService';
import { feedbackService } from '../services/feedbackService';
import { jobService } from '../services/jobService';
import { Job } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;
type ScreenView = 'list' | 'detail' | 'create' | 'edit';
type TopTab = 'tickets' | 'feedback';
type TicketStatusFilter = 'all' | TicketStatus;

const FEEDBACK_TAGS: FeedbackTag[] = [
  'punctual',
  'professional',
  'skilled',
  'friendly',
  'clean',
  'overpriced',
  'late',
];

const getRefId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getRefName = (value: any, fallback = 'User'): string => {
  if (!value) return fallback;
  if (typeof value === 'string') return fallback;
  return value.name || fallback;
};

const SupportScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<TopTab>('tickets');
  const [view, setView] = useState<ScreenView>('list');

  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>('all');
  const [messageText, setMessageText] = useState('');

  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');
  const [newTechnicianName, setNewTechnicianName] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [ticketJobs, setTicketJobs] = useState<Job[]>([]);
  const [ticketJobId, setTicketJobId] = useState('');

  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TicketPriority>('medium');

  const [eligibleJobs, setEligibleJobs] = useState<EligibleFeedbackJob[]>([]);
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
  const [technicianFeedback, setTechnicianFeedback] = useState<FeedbackItem[]>([]);
  const [techAvgRating, setTechAvgRating] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<FeedbackTag[]>([]);

  const isAdmin = user?.role === 'admin';
  const isCustomer = user?.role === 'customer';
  const isTechnician = user?.role === 'technician';

  const loadTickets = useCallback(async () => {
    try {
      const result = await supportService.getTickets(
        1,
        50,
        statusFilter === 'all' ? undefined : statusFilter,
        searchText.trim() || undefined,
      );
      setTickets(result.data);
    } catch {
      Alert.alert('Error', 'Failed to load support tickets.');
    }
  }, [searchText, statusFilter]);

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      if (isAdmin) {
        const all = await feedbackService.getAllFeedback();
        setAllFeedback(all);
      } else if (isTechnician && user?.id) {
        const result = await feedbackService.getMyReceivedFeedback(user.id);
        setTechnicianFeedback(result.data);
        setTechAvgRating(result.averageRating);
      } else if (isCustomer) {
        const [eligible, mine] = await Promise.all([
          feedbackService.getEligibleJobs(),
          feedbackService.getMyFeedback(),
        ]);
        setEligibleJobs(eligible);
        setMyFeedback(mine);
        if (!selectedJobId && eligible.length > 0) {
          setSelectedJobId(eligible[0].id);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load feedback data.');
    } finally {
      setFeedbackLoading(false);
    }
  }, [isAdmin, isCustomer, isTechnician, user?.id, selectedJobId]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      if (currentUser?.role !== 'technician') {
        const ticketResult = await supportService.getTickets(1, 50);
        setTickets(ticketResult.data);
      } else {
        setActiveTab('feedback');
      }
    } catch {
      Alert.alert('Error', 'Failed to load support data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (activeTab === 'tickets') {
      const timer = setTimeout(() => {
        loadTickets();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [activeTab, loadTickets]);

  useEffect(() => {
    if (activeTab === 'feedback') {
      loadFeedback();
    }
  }, [activeTab, loadFeedback]);

  useEffect(() => {
    if (view === 'create' && isCustomer) {
      jobService.getJobs(1, 50).then((res) => setTicketJobs(res.data)).catch(() => {});
    }
  }, [view, isCustomer]);

  const handleOpenTicket = async (ticket: SupportTicket) => {
    try {
      const full = await supportService.getTicketById(ticket.id);
      setSelectedTicket(full);
      setView('detail');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to load ticket details.';
      Alert.alert('Error', message);
    }
  };

  const canEditSelectedTicket = useMemo(() => {
    if (!selectedTicket || !user) return false;
    if (selectedTicket.status === 'closed') return false;

    // Only the ticket creator (customer) can edit
    const ownerId = getRefId(selectedTicket.createdBy);
    return ownerId === user.id;
  }, [selectedTicket, user]);

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) {
      Alert.alert('Validation', 'Please fill in subject and description.');
      return;
    }

    setSubmitting(true);
    try {
      const extraInfo = [
        newTechnicianName.trim() ? `Technician: ${newTechnicianName.trim()}` : '',
        newServiceName.trim() ? `Service: ${newServiceName.trim()}` : '',
      ].filter(Boolean).join('\n');

      const fullDescription = extraInfo
        ? `${newDescription.trim()}\n\n${extraInfo}`
        : newDescription.trim();

      const created = await supportService.createTicket({
        subject: newSubject.trim(),
        description: fullDescription,
        priority: newPriority,
        ...(ticketJobId ? { jobId: ticketJobId } : {}),
      });
      setTickets((prev) => [created, ...prev]);
      setNewSubject('');
      setNewDescription('');
      setNewPriority('medium');
      setNewTechnicianName('');
      setNewServiceName('');
      setTicketJobId('');
      setView('list');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create ticket.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditView = () => {
    if (!selectedTicket) return;
    setEditSubject(selectedTicket.subject);
    setEditDescription(selectedTicket.description);
    setEditPriority(selectedTicket.priority);
    setView('edit');
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;
    if (!editSubject.trim() || !editDescription.trim()) {
      Alert.alert('Validation', 'Please fill in subject and description.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await supportService.updateTicket(selectedTicket.id, {
        subject: editSubject.trim(),
        description: editDescription.trim(),
        priority: editPriority,
      });

      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setView('detail');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to update ticket.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !messageText.trim()) return;

    setSubmitting(true);
    try {
      await supportService.sendMessage(selectedTicket.id, messageText.trim());
      const refreshed = await supportService.getTicketById(selectedTicket.id);
      setSelectedTicket(refreshed);
      setTickets((prev) => prev.map((t) => (t.id === refreshed.id ? refreshed : t)));
      setMessageText('');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to send message.';
      Alert.alert('Error', message);
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
            setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          } catch (error: any) {
            const message = error?.response?.data?.message || 'Failed to close ticket.';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!selectedTicket || !isAdmin) return;

    try {
      const updated = await supportService.updateTicketStatus(selectedTicket.id, status);
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to update ticket status.';
      Alert.alert('Error', message);
    }
  };

  const toggleTag = (tag: FeedbackTag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmitFeedback = async () => {
    if (!isCustomer) return;
    if (!selectedJobId) {
      Alert.alert('Validation', 'Please select a completed job.');
      return;
    }

    setSubmitting(true);
    try {
      await feedbackService.createFeedback({
        jobId: selectedJobId,
        rating,
        comment: feedbackComment.trim(),
        tags: selectedTags,
      });

      setFeedbackComment('');
      setSelectedTags([]);
      setRating(5);
      setSelectedJobId('');
      await loadFeedback();
      Alert.alert('Success', 'Feedback submitted successfully.');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to submit feedback.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderTopTabs = () => (
    <View style={styles.topTabsWrap}>
      {!isTechnician && (
        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'tickets' && styles.topTabBtnActive]}
          onPress={() => {
            setActiveTab('tickets');
            setView('list');
          }}
        >
          <Text style={[styles.topTabText, activeTab === 'tickets' && styles.topTabTextActive]}>Tickets</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.topTabBtn, activeTab === 'feedback' && styles.topTabBtnActive]}
        onPress={() => setActiveTab('feedback')}
      >
        <Text style={[styles.topTabText, activeTab === 'feedback' && styles.topTabTextActive]}>Feedback</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTicketList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support Center</Text>
        {!isAdmin && (
          <TouchableOpacity onPress={() => setView('create')} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        )}
        {isAdmin && <View style={styles.newBtn} />}
      </View>

      {renderTopTabs()}

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search tickets by subject or description"
          placeholderTextColor="#666"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollView}
        contentContainerStyle={styles.filterRow}
      >
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as TicketStatusFilter[]).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
              {status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.ticketCard} onPress={() => handleOpenTicket(item)}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketSubject} numberOfLines={1}>{item.subject}</Text>
                <View style={[styles.badge, ticketStatusColor(item.status)]}>
                  <Text style={styles.badgeText}>{item.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>
              <View style={styles.ticketMeta}>
                <View style={[styles.priorityDot, priorityDotColor(item.priority)]} />
                <Text style={styles.ticketMetaText}>
                  {item.priority} • {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No tickets found.</Text>}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderStatusControls = () => {
    if (!selectedTicket || !isAdmin) return null;

    return (
      <View style={styles.adminStatusWrap}>
        <Text style={styles.formLabel}>Admin Status Update</Text>
        <View style={styles.statusRow}>
          {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusBtn,
                selectedTicket.status === status && styles.statusBtnActive,
              ]}
              onPress={() => handleUpdateStatus(status)}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  selectedTicket.status === status && styles.statusBtnTextActive,
                ]}
              >
                {status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderTicketDetail = () => {
    if (!selectedTicket) return null;

    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ticket Detail</Text>
          <View style={styles.detailHeaderActions}>
            {canEditSelectedTicket && (
              <TouchableOpacity onPress={openEditView} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {selectedTicket.status !== 'closed' && (
              <TouchableOpacity onPress={handleCloseTicket} style={styles.closeTicketBtn}>
                <Text style={styles.closeTicketText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
          <Text style={styles.detailSubject}>{selectedTicket.subject}</Text>
          <Text style={styles.detailDesc}>{selectedTicket.description}</Text>
          <Text style={styles.ticketMetaText}>Created by: {getRefName(selectedTicket.createdBy, 'Customer')}</Text>
          {selectedTicket.assignedTo ? (
            <Text style={styles.ticketMetaText}>Assigned Technician: {getRefName(selectedTicket.assignedTo, 'Unassigned')}</Text>
          ) : null}
          {selectedTicket.jobId && typeof selectedTicket.jobId === 'object' ? (() => {
            const job = selectedTicket.jobId as any;
            const techName = typeof job.technicianId === 'object'
              ? job.technicianId?.name || null
              : job.technicianId || null;
            return (
              <View style={{ backgroundColor: '#1a2a3a', borderRadius: 8, padding: 12, marginTop: 10, marginBottom: 4 }}>
                <Text style={{ color: '#6b82a3', fontSize: 12, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Related Job</Text>
                {job.title ? <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 3 }}><Text style={{ color: '#6b82a3' }}>Job: </Text>{job.title}</Text> : null}
                {job.serviceName ? <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 3 }}><Text style={{ color: '#6b82a3' }}>Service: </Text>{job.serviceName}</Text> : null}
                <Text style={{ color: '#ccc', fontSize: 13 }}>
                  <Text style={{ color: '#6b82a3' }}>Technician: </Text>
                  {techName
                    ? techName
                    : <Text style={{ color: '#666' }}>Not yet assigned</Text>}
                </Text>
              </View>
            );
          })() : null}

          {renderStatusControls()}

          <Text style={styles.messagesTitle}>{isAdmin ? 'Conversation (Admin Response Enabled)' : 'Conversation'}</Text>
          {selectedTicket.messages.length === 0 ? (
            <Text style={styles.emptyMessages}>No messages yet.</Text>
          ) : (
            selectedTicket.messages.map((msg) => (
              <View key={msg.id} style={styles.messageBubble}>
                <Text style={styles.messageSender}>
                  {msg.senderName || getRefName(msg.senderId, 'User')}
                </Text>
                <Text style={styles.messageContent}>{msg.content}</Text>
                <Text style={styles.messageTime}>{new Date(msg.sentAt).toLocaleString()}</Text>
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
              placeholder={isAdmin ? 'Type admin response...' : 'Type a message...'}
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (submitting || !messageText.trim()) && styles.sendBtnDisabled]}
              onPress={handleSendMessage}
              disabled={submitting || !messageText.trim()}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  };

  const renderCreateTicket = () => {
    return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Ticket</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.formLabel}>Subject</Text>
        <TextInput
          style={styles.formInput}
          value={newSubject}
          onChangeText={setNewSubject}
          placeholder="Brief issue title"
          placeholderTextColor="#666"
        />

        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          style={[styles.formInput, styles.textArea]}
          value={newDescription}
          onChangeText={setNewDescription}
          placeholder="Describe the issue in detail"
          placeholderTextColor="#666"
          multiline
          numberOfLines={5}
        />

        <Text style={styles.formLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.priorityBtn, newPriority === p && styles.priorityBtnActive]}
              onPress={() => setNewPriority(p)}
            >
              <Text style={[styles.priorityBtnText, newPriority === p && styles.priorityBtnTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formLabel}>Technician Name</Text>
        <TextInput
          style={styles.formInput}
          value={newTechnicianName}
          onChangeText={setNewTechnicianName}
          placeholder="Enter technician name"
          placeholderTextColor="#666"
        />

        <Text style={styles.formLabel}>Service</Text>
        <TextInput
          style={styles.formInput}
          value={newServiceName}
          onChangeText={setNewServiceName}
          placeholder="Enter service (e.g. painting, plumbing)"
          placeholderTextColor="#666"
        />

        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleCreateTicket} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Ticket</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    );
  };

  const renderEditTicket = () => (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('detail')} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Ticket</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.formLabel}>Subject</Text>
        <TextInput
          style={styles.formInput}
          value={editSubject}
          onChangeText={setEditSubject}
          placeholder="Brief issue title"
          placeholderTextColor="#666"
        />

        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          style={[styles.formInput, styles.textArea]}
          value={editDescription}
          onChangeText={setEditDescription}
          placeholder="Describe the issue in detail"
          placeholderTextColor="#666"
          multiline
          numberOfLines={5}
        />

        <Text style={styles.formLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.priorityBtn, editPriority === p && styles.priorityBtnActive]}
              onPress={() => setEditPriority(p)}
            >
              <Text style={[styles.priorityBtnText, editPriority === p && styles.priorityBtnTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleUpdateTicket} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderRatingStars = () => (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((value) => (
        <TouchableOpacity key={value} onPress={() => setRating(value)}>
          <Text style={[styles.starText, value <= rating && styles.starTextActive]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFeedbackTab = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
        <View style={{ width: 60 }} />
      </View>

      {renderTopTabs()}

      {!isCustomer && !isAdmin && !isTechnician ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Feedback is not available for this account type.</Text>
        </View>
      ) : isTechnician ? (
        feedbackLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#e94560" />
          </View>
        ) : (
          <FlatList
            data={technicianFeedback}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>My Received Feedback ({technicianFeedback.length})</Text>
                {technicianFeedback.length > 0 && (
                  <Text style={{ color: '#e94560', fontSize: 15, fontWeight: '700', marginTop: 4 }}>
                    {'★'.repeat(Math.round(techAvgRating))}{'☆'.repeat(5 - Math.round(techAvgRating))}
                    {'  '}{techAvgRating.toFixed(1)} avg rating
                  </Text>
                )}
              </View>
            }
            ListEmptyComponent={
              <Text style={[styles.emptyText, { textAlign: 'center', marginTop: 40 }]}>No feedback received yet.</Text>
            }
            renderItem={({ item }) => {
              const customerName = typeof item.customerId === 'object'
                ? (item.customerId as any)?.name || 'Customer'
                : 'Customer';
              const jobTitle = typeof item.jobId === 'object'
                ? (item.jobId as any)?.title || ''
                : '';
              return (
                <View style={styles.feedbackCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.feedbackRating}>
                      {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                    </Text>
                    <Text style={styles.feedbackMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 2 }}>
                    <Text style={{ color: '#6b82a3' }}>From: </Text>{customerName}
                  </Text>
                  {jobTitle ? (
                    <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 4 }}>
                      <Text style={{ color: '#6b82a3' }}>Job: </Text>{jobTitle}
                    </Text>
                  ) : null}
                  {item.tags && item.tags.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {item.tags.map((tag) => (
                        <View key={tag} style={[styles.tagChip, { paddingVertical: 2, paddingHorizontal: 8 }]}>
                          <Text style={[styles.tagChipText, { fontSize: 11 }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {item.comment ? (
                    <Text style={styles.feedbackComment}>{item.comment}</Text>
                  ) : null}
                </View>
              );
            }}
          />
        )
      ) : isAdmin ? (
        feedbackLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#e94560" />
          </View>
        ) : (
          <FlatList
            data={allFeedback}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={[styles.sectionTitle, { paddingHorizontal: 16, paddingTop: 12 }]}>
                All Customer Feedback ({allFeedback.length})
              </Text>
            }
            ListEmptyComponent={
              <Text style={[styles.emptyText, { textAlign: 'center', marginTop: 40 }]}>No feedback submitted yet.</Text>
            }
            renderItem={({ item }) => {
              const customerName = typeof item.customerId === 'object'
                ? (item.customerId as any)?.name || 'Customer'
                : 'Customer';
              const techName = typeof item.technicianId === 'object'
                ? (item.technicianId as any)?.name || 'Technician'
                : 'Technician';
              const jobTitle = typeof item.jobId === 'object'
                ? (item.jobId as any)?.title || ''
                : '';
              return (
                <View style={styles.feedbackCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.feedbackRating}>
                      {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                    </Text>
                    <Text style={styles.feedbackMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 2 }}>
                    <Text style={{ color: '#6b82a3' }}>Customer: </Text>{customerName}
                  </Text>
                  <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 2 }}>
                    <Text style={{ color: '#6b82a3' }}>Technician: </Text>{techName}
                  </Text>
                  {jobTitle ? (
                    <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 4 }}>
                      <Text style={{ color: '#6b82a3' }}>Job: </Text>{jobTitle}
                    </Text>
                  ) : null}
                  {item.tags && item.tags.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {item.tags.map((tag) => (
                        <View key={tag} style={[styles.tagChip, { paddingVertical: 2, paddingHorizontal: 8 }]}>
                          <Text style={[styles.tagChipText, { fontSize: 11 }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {item.comment ? (
                    <Text style={styles.feedbackComment}>{item.comment}</Text>
                  ) : null}
                </View>
              );
            }}
          />
        )
      ) : feedbackLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.createContent}>
          <Text style={styles.sectionTitle}>Submit Feedback</Text>

          <Text style={styles.formLabel}>Completed Job</Text>
          {eligibleJobs.length === 0 ? (
            <Text style={styles.emptyMessages}>No completed jobs pending feedback.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobPickerRow}>
              {eligibleJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={[styles.jobChip, selectedJobId === job.id && styles.jobChipActive]}
                  onPress={() => setSelectedJobId(job.id)}
                >
                  <Text style={[styles.jobChipText, selectedJobId === job.id && styles.jobChipTextActive]} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text style={[styles.jobChipSub, selectedJobId === job.id && styles.jobChipSubActive]} numberOfLines={1}>
                    👨‍🔧 {job.technicianName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.formLabel}>Rating</Text>
          {renderRatingStars()}

          <Text style={styles.formLabel}>Tags (optional)</Text>
          <View style={styles.tagsWrap}>
            {FEEDBACK_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipActive]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagChipText, selectedTags.includes(tag) && styles.tagChipTextActive]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Comment</Text>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            value={feedbackComment}
            onChangeText={setFeedbackComment}
            placeholder="Share your experience"
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }, (!selectedJobId || eligibleJobs.length === 0) && styles.sendBtnDisabled]}
            onPress={handleSubmitFeedback}
            disabled={submitting || !selectedJobId || eligibleJobs.length === 0}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Feedback</Text>}
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My Feedback History</Text>
          {myFeedback.length === 0 ? (
            <Text style={styles.emptyMessages}>No feedback submitted yet.</Text>
          ) : (
            myFeedback.map((item) => (
              <View key={item.id} style={styles.feedbackCard}>
                <Text style={styles.feedbackRating}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</Text>
                {item.comment ? <Text style={styles.feedbackComment}>{item.comment}</Text> : null}
                <Text style={styles.feedbackMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );

  if (activeTab === 'feedback') return renderFeedbackTab();
  if (isTechnician) return renderFeedbackTab();
  if (view === 'detail') return renderTicketDetail();
  if (view === 'create') return renderCreateTicket();
  if (view === 'edit') return renderEditTicket();
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
  topTabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    gap: 10,
    justifyContent: 'center',
  },
  topTabBtn: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#284a73',
  },
  topTabBtnActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  topTabText: { color: '#8fa9c7', fontWeight: '700' },
  topTabTextActive: { color: '#fff' },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: '#0f3460',
    borderWidth: 1,
    borderColor: '#1e4a80',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  filterScrollView: { flexGrow: 0, height: 44 },
  filterRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#284a73',
    alignSelf: 'center',
  },
  filterChipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  filterChipText: {
    color: '#9bb0c8',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  filterChipTextActive: { color: '#fff' },
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
  ticketMetaText: { fontSize: 12, color: '#777', textTransform: 'capitalize', marginBottom: 4 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 60, fontSize: 15, paddingHorizontal: 20 },
  detailScroll: { flex: 1 },
  detailScrollContent: { padding: 16, paddingBottom: 20 },
  detailHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailSubject: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  detailDesc: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 10,
    lineHeight: 22,
  },
  adminStatusWrap: {
    marginTop: 10,
    marginBottom: 14,
    backgroundColor: '#132643',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f3f69',
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a5170',
    backgroundColor: '#1a2d4f',
  },
  statusBtnActive: {
    borderColor: '#e94560',
    backgroundColor: '#e94560',
  },
  statusBtnText: { color: '#a9b7c8', fontSize: 12, textTransform: 'capitalize', fontWeight: '600' },
  statusBtnTextActive: { color: '#fff' },
  messagesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e94560',
    marginBottom: 10,
    textTransform: 'uppercase',
    marginTop: 6,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  closeTicketText: { color: '#aaa', fontSize: 12 },
  editBtn: {
    borderWidth: 1,
    borderColor: '#4cde9a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  editBtnText: { color: '#4cde9a', fontSize: 12, fontWeight: '700' },
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  jobPickerRow: { gap: 8 },
  jobChip: {
    backgroundColor: '#16213e',
    borderColor: '#1e4a80',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 180,
  },
  jobChipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  jobChipText: { color: '#9db3cc', fontSize: 12 },
  jobChipTextActive: { color: '#fff', fontWeight: '700' },
  jobChipSub: { color: '#6a8aaa', fontSize: 10, marginTop: 2 },
  jobChipSubActive: { color: '#ffd0d8' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  starText: { fontSize: 28, color: '#4c5773' },
  starTextActive: { color: '#f7c948' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#345377',
    backgroundColor: '#16213e',
  },
  tagChipActive: {
    borderColor: '#4cde9a',
    backgroundColor: '#1f473c',
  },
  tagChipText: { color: '#9bb0c8', fontSize: 12 },
  tagChipTextActive: { color: '#4cde9a', fontWeight: '700' },
  feedbackCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e4a80',
    padding: 12,
    marginBottom: 10,
  },
  feedbackRating: { color: '#f7c948', fontSize: 16, marginBottom: 6 },
  feedbackComment: { color: '#cfd9e6', fontSize: 13, lineHeight: 19 },
  feedbackMeta: { color: '#7f8ea5', fontSize: 11, marginTop: 8 },
});

export default SupportScreen;
