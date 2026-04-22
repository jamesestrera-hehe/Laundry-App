import { router } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppButton from '../components/Appbutton';
import { COLORS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';

interface Service {
  id: string;
  name: string;
  pricePerKg: number;
  description: string;
  deliveryTime: string;
  category: string;
  active: boolean;
}

interface Coupon {
  code: string;
  discountPercentage: number;
  milestoneLevel: number;
}

// Pre-defined coupon codes for each milestone
const MILESTONE_COUPONS: { [key: string]: Coupon } = {
  "LAUND5": { code: "LAUND5", discountPercentage: 5, milestoneLevel: 1 },
  "LAUND8": { code: "LAUND8", discountPercentage: 8, milestoneLevel: 2 },
  "LAUND10": { code: "LAUND10", discountPercentage: 10, milestoneLevel: 3 },
  "LAUND12": { code: "LAUND12", discountPercentage: 12, milestoneLevel: 4 },
  "LAUND15": { code: "LAUND15", discountPercentage: 15, milestoneLevel: 5 },
  "LAUND18": { code: "LAUND18", discountPercentage: 18, milestoneLevel: 6 },
  "LAUND20": { code: "LAUND20", discountPercentage: 20, milestoneLevel: 7 },
};

const RequestScreen = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [weight, setWeight] = useState('');
  const [address, setAddress] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Generate next 7 days for calendar
  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setPickupDate(formatDate(date));
    setShowCalendar(false);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return formatDate(date);
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const servicesQuery = query(collection(db, 'services'), where('active', '==', true));
      const servicesSnapshot = await getDocs(servicesQuery);
      const servicesList = servicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Service[];
      setServices(servicesList);
      if (servicesList.length > 0) {
        setSelectedService(servicesList[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const calculateSubtotal = () => {
    if (!selectedService || !weight) return 0;
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) return 0;
    return selectedService.pricePerKg * weightNum;
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    if (!appliedCoupon) return 0;
    return subtotal * (appliedCoupon.discountPercentage / 100);
  };

  const calculateDeliveryFee = () => {
    const subtotal = calculateSubtotal();
    return subtotal > 0 ? 50 : 0;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const deliveryFee = calculateDeliveryFee();
    const discount = calculateDiscount();
    return subtotal + deliveryFee - discount;
  };

  const validateCoupon = async (code: string) => {
    if (!user?.uid) {
      setCouponError('Please login to use coupons');
      return false;
    }

    const coupon = MILESTONE_COUPONS[code.toUpperCase()];
    if (!coupon) {
      setCouponError('Invalid coupon code');
      return false;
    }

    // Check if user has earned this coupon
    try {
      const loyaltyRef = doc(db, 'userLoyalty', user.uid);
      const loyaltyDoc = await getDoc(loyaltyRef);
      
      if (!loyaltyDoc.exists()) {
        setCouponError("You haven't earned this coupon yet");
        return false;
      }

      const userLoyalty = loyaltyDoc.data();
      const milestonesReached = userLoyalty.milestonesReached || [];
      
      // Check if user reached the required milestone
      const hasMilestone = milestonesReached.some(
        (m: any) => m.level === coupon.milestoneLevel
      );
      
      if (!hasMilestone) {
        const ordersRequired = coupon.milestoneLevel === 1 ? 25 : coupon.milestoneLevel * 25;
        setCouponError(`Complete ${ordersRequired} orders to unlock this coupon`);
        return false;
      }

      // Check if coupon has already been used
      const usedCouponsQuery = query(
        collection(db, 'usedCoupons'),
        where('userId', '==', user.uid),
        where('couponCode', '==', code.toUpperCase())
      );
      const usedCouponsSnapshot = await getDocs(usedCouponsQuery);
      
      if (!usedCouponsSnapshot.empty) {
        setCouponError('You have already used this coupon');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError('Error validating coupon');
      return false;
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setApplyingCoupon(true);
    setCouponError('');
    
    const isValid = await validateCoupon(couponCode);
    
    if (isValid) {
      const coupon = MILESTONE_COUPONS[couponCode.toUpperCase()];
      setAppliedCoupon(coupon);
      Alert.alert('Success', `${coupon.discountPercentage}% discount applied!`);
      setCouponCode('');
    }
    
    setApplyingCoupon(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  const markCouponAsUsed = async (orderId: string) => {
    if (!appliedCoupon || !user?.uid) return;
    
    try {
      await addDoc(collection(db, 'usedCoupons'), {
        userId: user.uid,
        couponCode: appliedCoupon.code,
        milestoneLevel: appliedCoupon.milestoneLevel,
        usedAt: new Date().toISOString(),
        orderId: orderId,
        discountAmount: calculateDiscount(),
        originalTotal: calculateSubtotal() + calculateDeliveryFee(),
      });
    } catch (error) {
      console.error('Error marking coupon as used:', error);
    }
  };

  const validateForm = () => {
    if (!selectedService) {
      Alert.alert('Error', 'Please select a service');
      return false;
    }

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum < 1) {
      Alert.alert('Error', 'Weight must be at least 1 kg');
      return false;
    }

    if (weightNum > 50) {
      Alert.alert('Error', 'Maximum weight is 50 kg');
      return false;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Please enter your address');
      return false;
    }

    if (!pickupDate) {
      Alert.alert('Error', 'Please select pickup date');
      return false;
    }

    return true;
  };

  const handleProceedToPayment = () => {
    if (validateForm()) {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSelection = (method: string) => {
    setSelectedPayment(method);
    if (method === 'GCash') {
      setShowQRModal(true);
    } else {
      setShowPaymentModal(false);
      handleSubmitOrder();
    }
  };

  const handleSubmitOrder = async () => {
    if (!selectedPayment) {
      Alert.alert('Error', 'Please select payment method');
      return;
    }

    setSubmitting(true);
    try {
      const weightNum = parseFloat(weight);
      const subtotal = calculateSubtotal();
      const deliveryFee = calculateDeliveryFee();
      const discount = calculateDiscount();
      const total = calculateTotal();

      const orderData = {
        userId: user?.uid,
        userEmail: user?.email,
        serviceId: selectedService!.id,
        serviceName: selectedService!.name,
        pricePerKg: selectedService!.pricePerKg,
        weight: weightNum,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        discount: discount,
        discountPercentage: appliedCoupon?.discountPercentage || 0,
        couponCode: appliedCoupon?.code || null,
        total: total,
        address: address.trim(),
        pickupDate: pickupDate,
        notes: notes.trim(),
        paymentMethod: selectedPayment,
        paymentStatus: selectedPayment === 'GCash' ? 'pending_qr' : 'pending',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Mark coupon as used if applied
      if (appliedCoupon) {
        await markCouponAsUsed(docRef.id);
      }
      
      setShowPaymentModal(false);
      setShowQRModal(false);
      
      const discountMessage = appliedCoupon 
        ? `\n\nDiscount Applied: ${appliedCoupon.discountPercentage}% OFF\nYou saved: ₱${discount.toFixed(2)}`
        : '';
      
      const paymentMessage = selectedPayment === 'GCash' 
        ? '\n\n📱 Please complete the payment via GCash using the QR code shown.'
        : '';
      
      Alert.alert(
        'Order Placed!',
        `Your order has been placed successfully!\n\nPayment Method: ${selectedPayment}\nOriginal Total: ₱{(subtotal + deliveryFee).toFixed(2)}\nFinal Total: ₱${total.toFixed(2)}${discountMessage}${paymentMessage}\n\nYou can pay upon pickup.`,
        [{ text: 'OK', onPress: () => router.push('/(customer)') }]
      );
      
      // Reset form
      setWeight('');
      setAddress('');
      setPickupDate('');
      setNotes('');
      setSelectedPayment('');
      setSelectedDate(new Date());
      setAppliedCoupon(null);
      setCouponCode('');
    } catch (error) {
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₱${price}/kg`;
  };

  const QRModal = () => (
    <Modal
      visible={showQRModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        setShowQRModal(false);
        setSelectedPayment('');
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.qrModalContent}>
          <Text style={styles.qrModalTitle}>📱 GCash Payment</Text>
          
          <View style={styles.qrContainer}>
            <Image 
              source={require('../../assets/qr.jpg')}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>
          
          <View style={styles.qrInstructions}>
            <Text style={styles.qrInstructionTitle}>How to pay:</Text>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionBullet}>1.</Text>
              <Text style={styles.instructionText}>Open GCash app on your phone</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionBullet}>2.</Text>
              <Text style={styles.instructionText}>Tap "Scan QR Code"</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionBullet}>3.</Text>
              <Text style={styles.instructionText}>Scan the QR code above</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionBullet}>4.</Text>
              <Text style={styles.instructionText}>Enter the exact amount: ₱{calculateTotal().toFixed(2)}</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionBullet}>5.</Text>
              <Text style={styles.instructionText}>Complete the payment</Text>
            </View>
          </View>
          
          <View style={styles.saveQRContainer}>
            <Text style={styles.saveQRText}>💡 Save this QR code for future reference</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.qrConfirmButton}
            onPress={() => {
              setShowQRModal(false);
              handleSubmitOrder();
            }}
          >
            <Text style={styles.qrConfirmButtonText}>I have saved the QR code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.qrCancelButton}
            onPress={() => {
              setShowQRModal(false);
              setSelectedPayment('');
            }}
          >
            <Text style={styles.qrCancelButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Order</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Service Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Select Service</Text>
        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No services available</Text>
          </View>
        ) : (
          <View style={styles.servicesGrid}>
            {services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.serviceCard,
                  selectedService?.id === service.id && styles.serviceCardSelected,
                ]}
                onPress={() => setSelectedService(service)}
              >
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  {selectedService?.id === service.id && (
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.servicePrice}>{formatPrice(service.pricePerKg)}</Text>
                
                <Text style={styles.serviceDesc} numberOfLines={2}>
                  {service.description}
                </Text>
                
                <View style={styles.serviceFooter}>
                  <Text style={styles.deliveryTime}>Delivery: {service.deliveryTime}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Weight Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Weight (kg)</Text>
        <View style={styles.weightWrapper}>
          <TextInput
            style={styles.weightInput}
            placeholder="Enter weight"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            placeholderTextColor={COLORS.gray}
          />
          <Text style={styles.weightUnit}>kg</Text>
        </View>
        <Text style={styles.hint}>Minimum 1 kg • Maximum 50 kg</Text>
      </View>

      {/* Pickup Date - Calendar */}
      <View style={styles.section}>
        <Text style={styles.label}>Pickup Date</Text>
        <TouchableOpacity 
          style={styles.datePickerButton} 
          onPress={() => setShowCalendar(true)}
        >
          <Text style={[styles.datePickerText, !pickupDate && styles.placeholderText]}>
            {pickupDate || 'Select pickup date'}
          </Text>
          <Text style={styles.dropdownIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Address */}
      <View style={styles.section}>
        <Text style={styles.label}>Pickup Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter your complete address"
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={3}
          placeholderTextColor={COLORS.gray}
        />
      </View>

      {/* Coupon Section - Nicer Design */}
      <View style={styles.section}>
        <Text style={styles.label}>🎫 Coupon Code</Text>
        {!appliedCoupon ? (
          <View>
            <View style={styles.couponWrapper}>
              <View style={styles.couponInputWrapper}>
                <Text style={styles.couponIcon}>🏷️</Text>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChangeText={(text) => {
                    setCouponCode(text.toUpperCase());
                    setCouponError('');
                  }}
                  placeholderTextColor={COLORS.gray}
                  autoCapitalize="characters"
                />
              </View>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={handleApplyCoupon}
                disabled={applyingCoupon}
              >
                <Text style={styles.applyButtonText}>
                  {applyingCoupon ? '...' : 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>
            {couponError ? (
              <View style={styles.couponErrorContainer}>
                <Text style={styles.couponErrorIcon}>⚠️</Text>
                <Text style={styles.couponError}>{couponError}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.appliedCouponCard}>
            <View style={styles.appliedCouponIconContainer}>
              <Text style={styles.appliedCouponIcon}>🎉</Text>
            </View>
            <View style={styles.appliedCouponInfo}>
              <Text style={styles.appliedCouponCode}>{appliedCoupon.code}</Text>
              <Text style={styles.appliedCouponDiscount}>
                {appliedCoupon.discountPercentage}% OFF Applied
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.removeCouponButton}
              onPress={handleRemoveCoupon}
            >
              <Text style={styles.removeCouponText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Notes (Optional) */}
      <View style={styles.section}>
        <Text style={styles.label}>Notes <Text style={styles.optional}>(Optional)</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any special requests?"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          placeholderTextColor={COLORS.gray}
        />
      </View>

      {/* Order Summary */}
      {selectedService && weight && parseFloat(weight) >= 1 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {selectedService.name} ({weight} kg × ₱{selectedService.pricePerKg})
            </Text>
            <Text style={styles.summaryValue}>
              ₱{calculateSubtotal().toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₱{calculateDeliveryFee().toFixed(2)}</Text>
          </View>

          {appliedCoupon && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Discount ({appliedCoupon.discountPercentage}% OFF)
              </Text>
              <Text style={styles.discountValue}>
                -₱{calculateDiscount().toFixed(2)}
              </Text>
            </View>
          )}
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₱{calculateTotal().toFixed(2)}</Text>
          </View>

          {appliedCoupon && (
            <Text style={styles.savingsText}>
              ✨ You saved ₱{calculateDiscount().toFixed(2)} with {appliedCoupon.code}
            </Text>
          )}
        </View>
      )}

      {/* Submit Button */}
      <AppButton
        title="Proceed to Payment"
        onPress={handleProceedToPayment}
        style={styles.submitButton}
      />

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Pickup Date</Text>
            
            <View style={styles.calendarDays}>
              {getNext7Days().map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCard,
                    selectedDate.toDateString() === date.toDateString() && styles.dayCardSelected
                  ]}
                  onPress={() => handleDateSelect(date)}
                >
                  <Text style={[
                    styles.dayName,
                    selectedDate.toDateString() === date.toDateString() && styles.dayNameSelected
                  ]}>
                    {getDateLabel(date)}
                  </Text>
                  <Text style={[
                    styles.dayDate,
                    selectedDate.toDateString() === date.toDateString() && styles.dayDateSelected
                  ]}>
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowCalendar(false)}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowPaymentModal(false);
          setSelectedPayment('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            
            <TouchableOpacity
              style={[
                styles.paymentOption,
                selectedPayment === 'Cash on Pickup' && styles.paymentOptionSelected
              ]}
              onPress={() => handlePaymentSelection('Cash on Pickup')}
            >
              <Text style={styles.paymentIcon}>💵</Text>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>Cash on Pickup</Text>
                <Text style={styles.paymentDesc}>Pay when we pick up your laundry</Text>
              </View>
              {selectedPayment === 'Cash on Pickup' && (
                <View style={styles.radioSelected}>
                  <View style={styles.radioDot} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                selectedPayment === 'GCash' && styles.paymentOptionSelected
              ]}
              onPress={() => handlePaymentSelection('GCash')}
            >
              <Text style={styles.paymentIcon}>📱</Text>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>GCash</Text>
                <Text style={styles.paymentDesc}>Pay via GCash (QR code)</Text>
              </View>
              {selectedPayment === 'GCash' && (
                <View style={styles.radioSelected}>
                  <View style={styles.radioDot} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                selectedPayment === 'Bank Transfer' && styles.paymentOptionSelected
              ]}
              onPress={() => handlePaymentSelection('Bank Transfer')}
            >
              <Text style={styles.paymentIcon}>🏦</Text>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>Bank Transfer</Text>
                <Text style={styles.paymentDesc}>Pay via bank transfer</Text>
              </View>
              {selectedPayment === 'Bank Transfer' && (
                <View style={styles.radioSelected}>
                  <View style={styles.radioDot} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.paymentTotal}>
              <Text style={styles.paymentTotalLabel}>Total Amount:</Text>
              <Text style={styles.paymentTotalValue}>₱{calculateTotal().toFixed(2)}</Text>
            </View>

            {appliedCoupon && (
              <View style={styles.paymentSavings}>
                <Text style={styles.paymentSavingsText}>
                  ✨ {appliedCoupon.discountPercentage}% discount applied
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.cancelPaymentButton}
              onPress={() => {
                setShowPaymentModal(false);
                setSelectedPayment('');
              }}
            >
              <Text style={styles.cancelPaymentText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <QRModal />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background || '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray || '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: COLORS.white || '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 28,
    color: COLORS.primary || '#007aff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black || '#000',
  },
  placeholder: {
    width: 40,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black || '#000',
    marginBottom: 8,
  },
  optional: {
    fontSize: 12,
    fontWeight: 'normal',
    color: COLORS.gray || '#666',
  },
  hint: {
    fontSize: 12,
    color: COLORS.gray || '#666',
    marginTop: 6,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    backgroundColor: COLORS.white || '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    width: '48%',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  serviceCardSelected: {
    borderColor: COLORS.primary || '#007aff',
    backgroundColor: `${COLORS.primary}08`,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black || '#000',
    flex: 1,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary || '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: COLORS.white || '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  servicePrice: {
    fontSize: 14,
    color: COLORS.primary || '#007aff',
    fontWeight: '600',
    marginBottom: 8,
  },
  serviceDesc: {
    fontSize: 12,
    color: COLORS.gray || '#666',
    lineHeight: 16,
    marginBottom: 8,
  },
  serviceFooter: {
    marginTop: 4,
  },
  deliveryTime: {
    fontSize: 11,
    color: COLORS.gray || '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: COLORS.white || '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray || '#666',
  },
  weightWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    backgroundColor: COLORS.white || '#fff',
  },
  weightInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  weightUnit: {
    paddingRight: 14,
    fontSize: 14,
    color: COLORS.gray || '#666',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    backgroundColor: COLORS.white || '#fff',
    padding: 14,
  },
  datePickerText: {
    fontSize: 16,
    color: COLORS.black || '#000',
  },
  placeholderText: {
    color: COLORS.gray || '#999',
  },
  dropdownIcon: {
    fontSize: 14,
    color: COLORS.primary || '#007aff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: COLORS.white || '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  couponWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  couponInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    backgroundColor: COLORS.white || '#fff',
    paddingHorizontal: 12,
  },
  couponIcon: {
    fontSize: 18,
    marginRight: 8,
    color: COLORS.gray,
  },
  couponInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 8,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  applyButton: {
    backgroundColor: COLORS.primary || '#007aff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  applyButtonText: {
    color: COLORS.white || '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  couponErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8d7da',
    borderRadius: 8,
  },
  couponErrorIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  couponError: {
    flex: 1,
    fontSize: 12,
    color: '#dc3545',
  },
  appliedCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#28a745',
    borderRadius: 12,
    padding: 12,
  },
  appliedCouponIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appliedCouponIcon: {
    fontSize: 20,
  },
  appliedCouponInfo: {
    flex: 1,
  },
  appliedCouponCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
    fontFamily: 'monospace',
  },
  appliedCouponDiscount: {
    fontSize: 12,
    color: '#28a745',
    marginTop: 2,
  },
  removeCouponButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  removeCouponText: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '600',
  },
  summary: {
    backgroundColor: COLORS.white || '#fff',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black || '#000',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.gray || '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.black || '#000',
  },
  discountValue: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black || '#000',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary || '#007aff',
  },
  savingsText: {
    fontSize: 11,
    color: '#28a745',
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  submitButton: {
    margin: 20,
    marginTop: 24,
    marginBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 20,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayCard: {
    width: '30%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 8,
  },
  dayCardSelected: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  dayName: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  dayNameSelected: {
    color: '#fff',
  },
  dayDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  dayDateSelected: {
    color: '#fff',
  },
  closeModalButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#6c757d',
    fontWeight: '600',
  },
  paymentModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentOptionSelected: {
    borderColor: '#007aff',
    backgroundColor: '#e7f1ff',
  },
  paymentIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  paymentDesc: {
    fontSize: 12,
    color: '#6c757d',
  },
  radioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007aff',
  },
  paymentTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  paymentTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  paymentTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007aff',
  },
  paymentSavings: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#d4edda',
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentSavingsText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
  },
  cancelPaymentButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelPaymentText: {
    color: '#6c757d',
    fontWeight: '600',
    fontSize: 16,
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '85%',
  },
  qrModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 20,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    marginBottom: 20,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  qrInstructions: {
    marginBottom: 20,
  },
  qrInstructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  instructionBullet: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '600',
    width: 25,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  saveQRContainer: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  saveQRText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  qrConfirmButton: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  qrConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrCancelButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  qrCancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RequestScreen;