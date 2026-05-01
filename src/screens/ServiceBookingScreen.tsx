import React, { useState } from 'react';
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
  Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, PaymentMethod } from '../types';
import { serviceService } from '../services/serviceService';
import { paymentService } from '../services/paymentService';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceBooking'>;

const PAYMENT_METHODS: { label: string; value: PaymentMethod; icon: string }[] = [
  { label: 'Card', value: 'card', icon: '💳' },
  { label: 'Bank Transfer', value: 'bank_transfer', icon: '🏦' },
];

interface CardDetails {
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
}

interface PaySlipFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

const ServiceBookingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { service } = route.params;

  // Booking form state
  const [address, setAddress] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [timeHour, setTimeHour] = useState('12');
  const [timeMinute, setTimeMinute] = useState('00');
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('AM');
  const [notes, setNotes] = useState('');

  // Convert AM/PM picker to 24-hr HH:MM string
  const get24HourTime = (): string => {
    let h = parseInt(timeHour, 10);
    const m = parseInt(timeMinute, 10);
    if (timeAmPm === 'AM') {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const MINUTES = ['00', '15', '30', '45'];

  // Payment state
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardNumber: '',
    cardholderName: '',
    expiryDate: '',
    cvv: '',
  });
  const [paySlip, setPaySlip] = useState<PaySlipFile | null>(null);
  const [bankNotice, setBankNotice] = useState('');

  const [step, setStep] = useState<'booking' | 'payment'>('booking');
  const [bookedPaymentId, setBookedPaymentId] = useState<string | null>(null);
  const [bookedJobId, setBookedJobId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ─── Booking Step ────────────────────────────────────────────────────────────

  const handleBookingNext = async () => {
    if (!address.trim()) {
      Alert.alert('Required', 'Please enter your service address.');
      return;
    }
    if (!scheduledDate.trim()) {
      Alert.alert('Required', 'Please enter the preferred date.');
      return;
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(scheduledDate)) {
      Alert.alert('Invalid Date', 'Enter date as YYYY-MM-DD (e.g. 2026-06-15)');
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${get24HourTime()}:00`);
    if (isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      Alert.alert('Invalid Date/Time', 'Please enter a future date and time.');
      return;
    }

    setBookingLoading(true);
    try {
      const result = await serviceService.bookService({
        serviceId: service.id,
        address: address.trim(),
        scheduledAt: scheduledAt.toISOString(),
        notes: notes.trim(),
      });
      setBookedJobId(result.job.id || result.job._id);
      setBookedPaymentId(result.payment.id || result.payment._id);
      setStep('payment');
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.response?.data?.message || 'Could not book service. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  // ─── Payment Step ────────────────────────────────────────────────────────────

  const handlePickSlip = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    if (!result.didCancel && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setPaySlip({
        uri: asset.uri!,
        name: asset.fileName || `slip_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize || 0,
      });
    }
  };

  const validateCard = (): string | null => {
    if (!cardDetails.cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) {
      return 'Card number must be 16 digits';
    }
    if (!cardDetails.cardholderName.trim()) return 'Cardholder name is required';
    if (!cardDetails.expiryDate.match(/^\d{2}\/\d{2}$/)) {
      return 'Expiry date must be MM/YY';
    }
    if (!cardDetails.cvv.match(/^\d{3}$/)) return 'CVV must be 3 digits';
    return null;
  };

  const handlePay = async () => {
    if (!bookedPaymentId) return;

    if (selectedMethod === 'card') {
      const err = validateCard();
      if (err) { Alert.alert('Validation Error', err); return; }
    }

    if (selectedMethod === 'bank_transfer') {
      if (!paySlip) {
        Alert.alert('Required', 'Please upload your bank transfer receipt.');
        return;
      }
      if (!bankNotice.trim()) {
        Alert.alert('Required', 'Please add a payment note / reference number.');
        return;
      }
    }

    setPaymentLoading(true);
    try {
      if (selectedMethod === 'bank_transfer' && paySlip) {
        await paymentService.processPayment(bookedPaymentId, selectedMethod, paySlip, bankNotice);
      } else {
        await paymentService.processPayment(bookedPaymentId, selectedMethod);
      }
      Alert.alert(
        'Booking Confirmed! 🎉',
        selectedMethod === 'bank_transfer'
          ? 'Your slip has been uploaded. Payment will be confirmed by admin.'
          : 'Payment successful! Your service is booked.',
        [{ text: 'Done', onPress: () => navigation.navigate('Services') }],
      );
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Could not process payment. Please try again.';
      Alert.alert('Payment Failed', errorMsg);
      console.error('Service booking payment error:', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─── UI ──────────────────────────────────────────────────────────────────────

  const tax = service.basePrice * 0.1;
  const total = service.basePrice + tax;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071428" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 'payment' ? setStep('booking') : navigation.goBack())}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'booking' ? 'Book Service' : 'Payment'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, step === 'booking' ? styles.stepActive : styles.stepDone]}>
          <Text style={styles.stepNum}>1</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, step === 'payment' ? styles.stepActive : styles.stepInactive]}>
          <Text style={styles.stepNum}>2</Text>
        </View>
      </View>
      <View style={styles.stepLabels}>
        <Text style={styles.stepLabel}>Booking Details</Text>
        <Text style={styles.stepLabel}>Payment</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Service Summary Card */}
        <View style={styles.serviceCard}>
          <Text style={styles.serviceIcon}>{service.icon || '🔧'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceCategory}>{service.category}</Text>
          </View>
          <Text style={styles.servicePrice}>${service.basePrice.toFixed(2)}</Text>
        </View>

        {/* ── STEP 1: Booking Form ── */}
        {step === 'booking' && (
          <View>
            <Text style={styles.sectionTitle}>Service Details</Text>

            <Text style={styles.label}>Service Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full address"
              placeholderTextColor="#555"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />

            <Text style={styles.label}>Preferred Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-06-15"
              placeholderTextColor="#555"
              value={scheduledDate}
              onChangeText={setScheduledDate}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <Text style={styles.label}>Preferred Time *</Text>
            <View style={styles.timePickerRow}>
              {/* Hour */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Hour</Text>
                <ScrollView
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {HOURS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.timeCell, timeHour === h && styles.timeCellActive]}
                      onPress={() => setTimeHour(h)}
                    >
                      <Text style={[styles.timeCellText, timeHour === h && styles.timeCellTextActive]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timeSep}>:</Text>

              {/* Minute */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Min</Text>
                <View style={styles.timeScroll}>
                  {MINUTES.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.timeCell, timeMinute === m && styles.timeCellActive]}
                      onPress={() => setTimeMinute(m)}
                    >
                      <Text style={[styles.timeCellText, timeMinute === m && styles.timeCellTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* AM / PM */}
              <View style={styles.amPmColumn}>
                <Text style={styles.timeColumnLabel}>Period</Text>
                <TouchableOpacity
                  style={[styles.amPmBtn, timeAmPm === 'AM' && styles.amPmBtnActive]}
                  onPress={() => setTimeAmPm('AM')}
                >
                  <Text style={[styles.amPmText, timeAmPm === 'AM' && styles.amPmTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.amPmBtn, timeAmPm === 'PM' && styles.amPmBtnActive]}
                  onPress={() => setTimeAmPm('PM')}
                >
                  <Text style={[styles.amPmText, timeAmPm === 'PM' && styles.amPmTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.timePreview}>Selected: {timeHour}:{timeMinute} {timeAmPm}</Text>

            <Text style={styles.label}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any special instructions or requests..."
              placeholderTextColor="#555"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            {/* Price Breakdown */}
            <View style={styles.priceBreakdown}>
              <Text style={styles.sectionTitle}>Price Breakdown</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{service.name}</Text>
                <Text style={styles.priceValue}>${service.basePrice.toFixed(2)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Tax (10%)</Text>
                <Text style={styles.priceValue}>${tax.toFixed(2)}</Text>
              </View>
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleBookingNext}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Continue to Payment →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Payment ── */}
        {step === 'payment' && (
          <View>
            <Text style={styles.sectionTitle}>Payment Method</Text>

            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.methodCard,
                    selectedMethod === m.value && styles.methodCardActive,
                  ]}
                  onPress={() => setSelectedMethod(m.value)}
                >
                  <Text style={styles.methodIcon}>{m.icon}</Text>
                  <Text style={[
                    styles.methodLabel,
                    selectedMethod === m.value && styles.methodLabelActive,
                  ]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Card Form */}
            {selectedMethod === 'card' && (
              <View>
                <Text style={styles.label}>Card Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  maxLength={19}
                  value={cardDetails.cardNumber}
                  onChangeText={v => {
                    const digits = v.replace(/\D/g, '').slice(0, 16);
                    const formatted = digits.replace(/(.{4})/g, '$1 ').trim();
                    setCardDetails({ ...cardDetails, cardNumber: formatted });
                  }}
                />
                <Text style={styles.label}>Cardholder Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Smith"
                  placeholderTextColor="#555"
                  value={cardDetails.cardholderName}
                  onChangeText={v => setCardDetails({ ...cardDetails, cardholderName: v })}
                />
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Expiry (MM/YY)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MM/YY"
                      placeholderTextColor="#555"
                      keyboardType="numeric"
                      maxLength={5}
                      value={cardDetails.expiryDate}
                      onChangeText={v => {
                        const digits = v.replace(/\D/g, '').slice(0, 4);
                        const formatted =
                          digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
                        setCardDetails({ ...cardDetails, expiryDate: formatted });
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>CVV</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="123"
                      placeholderTextColor="#555"
                      keyboardType="numeric"
                      maxLength={3}
                      secureTextEntry
                      value={cardDetails.cvv}
                      onChangeText={v =>
                        setCardDetails({ ...cardDetails, cvv: v.replace(/\D/g, '') })
                      }
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Bank Transfer Form */}
            {selectedMethod === 'bank_transfer' && (
              <View>
                <View style={styles.bankInfo}>
                  <Text style={styles.bankInfoTitle}>Bank Account Details</Text>
                  <Text style={styles.bankInfoRow}>Bank: Fixora National Bank</Text>
                  <Text style={styles.bankInfoRow}>Account No: 1234-5678-9000</Text>
                  <Text style={styles.bankInfoRow}>Account Name: Fixora Services Ltd</Text>
                  <Text style={styles.bankInfoRow}>
                    Amount: ${total.toFixed(2)} {service.currency}
                  </Text>
                </View>

                <Text style={styles.label}>Upload Payment Receipt / Slip *</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={handlePickSlip}>
                  <Text style={styles.uploadBtnText}>
                    {paySlip ? '✅ Slip Selected' : '📎 Choose Image'}
                  </Text>
                </TouchableOpacity>
                {paySlip && (
                  <Image source={{ uri: paySlip.uri }} style={styles.slipPreview} />
                )}

                <Text style={styles.label}>Payment Note / Reference Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. TXN-20260615-001"
                  placeholderTextColor="#555"
                  value={bankNotice}
                  onChangeText={setBankNotice}
                />
              </View>
            )}

            {/* Order Summary */}
            <View style={styles.priceBreakdown}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Service</Text>
                <Text style={styles.priceValue}>${service.basePrice.toFixed(2)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Tax (10%)</Text>
                <Text style={styles.priceValue}>${tax.toFixed(2)}</Text>
              </View>
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Due</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handlePay}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {selectedMethod === 'bank_transfer' ? 'Submit Slip & Confirm' : `Pay $${total.toFixed(2)}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1b2a' },
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 16,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActive: { backgroundColor: '#e94560' },
  stepDone: { backgroundColor: '#4cde9a' },
  stepInactive: { backgroundColor: '#333' },
  stepNum: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#333', marginHorizontal: 6 },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    marginTop: 4,
    marginBottom: 12,
  },
  stepLabel: { color: '#888', fontSize: 12 },
  scrollContent: { padding: 16 },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162032',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e3050',
    marginBottom: 18,
  },
  serviceIcon: { fontSize: 32, marginRight: 12 },
  serviceName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  serviceCategory: { color: '#7eb8f7', fontSize: 12, marginTop: 2 },
  servicePrice: { color: '#4cde9a', fontSize: 18, fontWeight: '800' },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  label: { color: '#aab', fontSize: 13, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#162032',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#223344',
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  priceBreakdown: {
    backgroundColor: '#162032',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1e3050',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: { color: '#aab', fontSize: 14 },
  priceValue: { color: '#ddd', fontSize: 14 },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#223344',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  totalValue: { color: '#4cde9a', fontSize: 18, fontWeight: '800' },
  primaryBtn: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  methodRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  methodCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#162032',
    borderWidth: 2,
    borderColor: '#223344',
  },
  methodCardActive: { borderColor: '#e94560', backgroundColor: '#2a1020' },
  methodIcon: { fontSize: 24, marginBottom: 4 },
  methodLabel: { color: '#aab', fontSize: 13, fontWeight: '600' },
  methodLabelActive: { color: '#e94560' },
  bankInfo: {
    backgroundColor: '#0f2535',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4cde9a',
  },
  bankInfoTitle: {
    color: '#4cde9a',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  bankInfoRow: { color: '#ccc', fontSize: 13, marginBottom: 4 },
  uploadBtn: {
    backgroundColor: '#162032',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4cde9a',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  uploadBtnText: { color: '#4cde9a', fontSize: 14, fontWeight: '600' },
  slipPreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  // ── Time Picker ──
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#162032',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#223344',
    padding: 12,
    marginTop: 4,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeColumnLabel: {
    color: '#7eb8f7',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeScroll: {
    maxHeight: 160,
    width: '100%',
  },
  timeCell: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    backgroundColor: '#1a2a3a',
  },
  timeCellActive: {
    backgroundColor: '#e94560',
  },
  timeCellText: {
    color: '#aab',
    fontSize: 16,
    fontWeight: '600',
  },
  timeCellTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  timeSep: {
    color: '#e94560',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 28,
    marginHorizontal: 4,
  },
  amPmColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginLeft: 8,
  },
  amPmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#1a2a3a',
    marginBottom: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  amPmBtnActive: {
    backgroundColor: '#0f3460',
    borderWidth: 2,
    borderColor: '#7eb8f7',
  },
  amPmText: { color: '#aab', fontSize: 14, fontWeight: '700' },
  amPmTextActive: { color: '#7eb8f7' },
  timePreview: {
    color: '#4cde9a',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default ServiceBookingScreen;
