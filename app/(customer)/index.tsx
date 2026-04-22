import { router } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';

interface Order {
  id: string;
  serviceName: string;
  weight: number;
  total: number;
  status: string;
  createdAt: string;
  pickupDate: string;
  serviceType?: string;
  address?: string;
}

interface Coupon {
  code: string;
  discountPercentage: number;
  milestoneLevel: number;
  issuedAt: string;
  expiresAt: string;
}

interface Milestone {
  level: number;
  ordersRequired: number;
  discountPercentage: number;
  achievedAt: string;
  couponCode?: string;
}

interface UserLoyalty {
  userId: string;
  userEmail: string;
  totalOrders: number;
  totalPoints: number;
  currentMilestone: number;
  milestonesReached: Milestone[];
  lastOrderDate?: string;
  createdAt: string;
}

// Pre-defined coupon codes for each milestone
const MILESTONE_COUPONS = {
  1: { code: "LAUND5", discount: 5, ordersRequired: 25 },
  2: { code: "LAUND8", discount: 8, ordersRequired: 50 },
  3: { code: "LAUND10", discount: 10, ordersRequired: 75 },
  4: { code: "LAUND12", discount: 12, ordersRequired: 100 },
  5: { code: "LAUND15", discount: 15, ordersRequired: 150 },
  6: { code: "LAUND18", discount: 18, ordersRequired: 200 },
  7: { code: "LAUND20", discount: 20, ordersRequired: 250 },
};

export default function CustomerHome() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userLoyalty, setUserLoyalty] = useState<UserLoyalty | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingLoyalty, setLoadingLoyalty] = useState(true);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [usedCoupons, setUsedCoupons] = useState<Set<string>>(new Set());

  const milestones = [
    { level: 1, ordersRequired: 25, discount: 5 },
    { level: 2, ordersRequired: 50, discount: 8 },
    { level: 3, ordersRequired: 75, discount: 10 },
    { level: 4, ordersRequired: 100, discount: 12 },
    { level: 5, ordersRequired: 150, discount: 15 },
    { level: 6, ordersRequired: 200, discount: 18 },
    { level: 7, ordersRequired: 250, discount: 20 },
  ];

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    await Promise.all([
      fetchOrders(),
      fetchLoyaltyData(),
      fetchAvailableCoupons(),
    ]);
  };

  const fetchLoyaltyData = async () => {
    if (!user?.uid) return;
    
    try {
      const loyaltyRef = doc(db, 'userLoyalty', user.uid);
      const loyaltyDoc = await getDoc(loyaltyRef);
      
      if (loyaltyDoc.exists()) {
        const data = loyaltyDoc.data() as UserLoyalty;
        setUserLoyalty(data);
      } else {
        // Create initial loyalty record - using setDoc for new document
        const initialData: UserLoyalty = {
          userId: user.uid,
          userEmail: user.email || '',
          totalOrders: 0,
          totalPoints: 0,
          currentMilestone: 0,
          milestonesReached: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(loyaltyRef, initialData);
        setUserLoyalty(initialData);
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    } finally {
      setLoadingLoyalty(false);
    }
  };

  const fetchAvailableCoupons = async () => {
    if (!user?.uid) return;
    
    try {
      // First, get user's loyalty data to see which milestones they've reached
      const loyaltyRef = doc(db, 'userLoyalty', user.uid);
      const loyaltyDoc = await getDoc(loyaltyRef);
      
      if (!loyaltyDoc.exists()) {
        setAvailableCoupons([]);
        return;
      }
      
      const userData = loyaltyDoc.data() as UserLoyalty;
      const reachedMilestones = userData.milestonesReached || [];
      
      // Get used coupons for this user from usedCoupons collection
      const usedCouponsQuery = query(
        collection(db, 'usedCoupons'),
        where('userId', '==', user.uid)
      );
      const usedCouponsSnapshot = await getDocs(usedCouponsQuery);
      const usedCouponSet = new Set(
        usedCouponsSnapshot.docs.map(doc => doc.data().couponCode)
      );
      setUsedCoupons(usedCouponSet);
      
      // Generate available coupons from reached milestones that haven't been used yet
      const now = new Date();
      const couponsList: Coupon[] = reachedMilestones
        .filter(milestone => {
          // Check if coupon exists for this milestone and hasn't been used
          const coupon = MILESTONE_COUPONS[milestone.level as keyof typeof MILESTONE_COUPONS];
          return coupon && !usedCouponSet.has(coupon.code);
        })
        .map(milestone => {
          const coupon = MILESTONE_COUPONS[milestone.level as keyof typeof MILESTONE_COUPONS];
          // Coupon expires 90 days after milestone was achieved
          const expiryDate = new Date(milestone.achievedAt);
          expiryDate.setDate(expiryDate.getDate() + 90);
          
          return {
            code: coupon.code,
            discountPercentage: coupon.discount,
            milestoneLevel: milestone.level,
            issuedAt: milestone.achievedAt,
            expiresAt: expiryDate.toISOString(),
          };
        })
        // Filter out expired coupons
        .filter(coupon => new Date(coupon.expiresAt) > now);
      
      setAvailableCoupons(couponsList);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      setAvailableCoupons([]);
    }
  };

  const fetchOrders = async () => {
    if (!user?.uid) return;
    
    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersList = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      setOrders(ordersList);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  }, []);

  const handleCopyCode = (code: string) => {
    Alert.alert('Success', `Coupon code ${code} copied to clipboard!`);
  };

  const getPointsProgress = () => {
    if (!userLoyalty) return 0;
    const nextMilestone = milestones.find(m => m.ordersRequired > userLoyalty.totalOrders);
    if (!nextMilestone) return 100;
    
    const previousMilestone = milestones.filter(m => m.ordersRequired <= userLoyalty.totalOrders).pop();
    const previousOrders = previousMilestone?.ordersRequired || 0;
    const ordersNeeded = nextMilestone.ordersRequired - previousOrders;
    const ordersProgress = userLoyalty.totalOrders - previousOrders;
    
    return (ordersProgress / ordersNeeded) * 100;
  };

  const getNextMilestoneInfo = () => {
    if (!userLoyalty) return { ordersNeeded: 25, discount: 5, ordersRequired: 25 };
    const nextMilestone = milestones.find(m => m.ordersRequired > userLoyalty.totalOrders);
    if (!nextMilestone) return null;
    
    const ordersNeeded = nextMilestone.ordersRequired - userLoyalty.totalOrders;
    return {
      ordersNeeded,
      discount: nextMilestone.discount,
      ordersRequired: nextMilestone.ordersRequired,
    };
  };

  const getCurrentMilestoneInfo = () => {
    if (!userLoyalty) return null;
    const currentMilestone = milestones.filter(m => m.ordersRequired <= userLoyalty.totalOrders).pop();
    return currentMilestone;
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return '#28a745';
      case 'pending': return '#ffc107';
      case 'processing': return '#007aff';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatExpiryDate = (expiresAt: string) => {
    const date = new Date(expiresAt);
    return date.toLocaleDateString();
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const today = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return daysLeft <= 7 && daysLeft > 0;
  };

  const nextMilestone = getNextMilestoneInfo();
  const currentMilestone = getCurrentMilestoneInfo();

  const CouponsModal = () => (
    <Modal
      visible={showCouponsModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCouponsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎫 My Coupons</Text>
            <TouchableOpacity onPress={() => setShowCouponsModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {availableCoupons.length === 0 ? (
              <View style={styles.emptyCouponsContainer}>
                <Text style={styles.emptyCouponsIcon}>🎟️</Text>
                <Text style={styles.emptyCouponsTitle}>No Coupons Available</Text>
                <Text style={styles.emptyCouponsText}>
                  Complete more orders to unlock discount coupons!
                </Text>
                {nextMilestone && (
                  <Text style={styles.emptyCouponsHint}>
                    🎯 {nextMilestone.ordersNeeded} more orders to unlock {nextMilestone.discount}% OFF
                  </Text>
                )}
              </View>
            ) : (
              availableCoupons.map((coupon) => (
                <View key={coupon.code} style={styles.couponCard}>
                  <View style={styles.couponHeader}>
                    <View style={styles.couponBadge}>
                      <Text style={styles.couponBadgeText}>
                        {coupon.discountPercentage}% OFF
                      </Text>
                    </View>
                    {isExpiringSoon(coupon.expiresAt) && (
                      <View style={styles.expiringBadge}>
                        <Text style={styles.expiringText}>Expiring Soon!</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.couponCode}>{coupon.code}</Text>
                  
                  <View style={styles.couponDetails}>
                    <View style={styles.couponDetail}>
                      <Text style={styles.couponDetailLabel}>Milestone</Text>
                      <Text style={styles.couponDetailValue}>Level {coupon.milestoneLevel}</Text>
                    </View>
                    <View style={styles.couponDivider} />
                    <View style={styles.couponDetail}>
                      <Text style={styles.couponDetailLabel}>Expires</Text>
                      <Text style={[
                        styles.couponDetailValue,
                        isExpiringSoon(coupon.expiresAt) && styles.expiringText
                      ]}>
                        {formatExpiryDate(coupon.expiresAt)}
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.useCouponButton}
                    onPress={() => {
                      handleCopyCode(coupon.code);
                      setShowCouponsModal(false);
                    }}
                  >
                    <Text style={styles.useCouponButtonText}>Copy Code</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Loyalty Points Card */}
      <TouchableOpacity 
        style={styles.pointsCard}
        onPress={() => setShowCouponsModal(true)}
        activeOpacity={0.9}
      >
        <View style={styles.pointsHeader}>
          <View>
            <Text style={styles.pointsTitle}>My Loyalty Points</Text>
            <Text style={styles.pointsSubtitle}>
              {userLoyalty?.totalOrders || 0} orders completed
            </Text>
          </View>
          <View style={styles.pointsValueContainer}>
            <Text style={styles.pointsValue}>{userLoyalty?.totalPoints || 0}</Text>
            <Text style={styles.pointsLabel}>points</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${getPointsProgress()}%` }]} />
          </View>
          
          {nextMilestone ? (
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {nextMilestone.ordersNeeded} more orders to reach {nextMilestone.ordersRequired} orders
              </Text>
              <View style={styles.nextRewardBadge}>
                <Text style={styles.nextRewardText}>
                  Next: {nextMilestone.discount}% OFF
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.maxLevelContainer}>
              <Text style={styles.maxLevelText}>🏆 Max Level Achieved! 20% OFF on all future orders</Text>
            </View>
          )}
        </View>

        {currentMilestone && (
          <View style={styles.currentMilestoneBadge}>
            <Text style={styles.currentMilestoneText}>
              Current Tier: {currentMilestone.discount}% OFF
            </Text>
          </View>
        )}

        {availableCoupons.length > 0 && (
          <View style={styles.couponAlert}>
            <Text style={styles.couponAlertText}>
              🎉 You have {availableCoupons.length} coupon{availableCoupons.length > 1 ? 's' : ''} available!
            </Text>
          </View>
        )}

        <Text style={styles.tapHint}>👆 Tap to view your coupons</Text>
      </TouchableOpacity>

      {/* Milestones Progress */}
      <View style={styles.milestonesSection}>
        <Text style={styles.sectionTitle}>🏆 Milestone Rewards</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.milestonesScroll}>
          {milestones.map((milestone) => {
            const isReached = userLoyalty && userLoyalty.totalOrders >= milestone.ordersRequired;
            const isNext = nextMilestone?.ordersRequired === milestone.ordersRequired;
            const coupon = MILESTONE_COUPONS[milestone.level as keyof typeof MILESTONE_COUPONS];
            const isCouponUsed = usedCoupons.has(coupon.code);
            
            return (
              <View 
                key={milestone.level} 
                style={[
                  styles.milestoneCard,
                  isReached && styles.milestoneReached,
                  isNext && styles.milestoneNext,
                  isReached && isCouponUsed && styles.milestoneUsed,
                ]}
              >
                <Text style={[
                  styles.milestoneLevel,
                  isReached && styles.milestoneReachedText,
                ]}>
                  Level {milestone.level}
                </Text>
                <Text style={styles.milestoneRequirement}>
                  {milestone.ordersRequired} orders
                </Text>
                <View style={styles.milestoneDiscountBadge}>
                  <Text style={styles.milestoneDiscountText}>
                    {milestone.discount}% OFF
                  </Text>
                </View>
                {isReached && !isCouponUsed && (
                  <Text style={styles.milestoneCheckmark}>✓</Text>
                )}
                {isReached && isCouponUsed && (
                  <Text style={styles.milestoneUsedText}>Used</Text>
                )}
                {isNext && !isReached && (
                  <Text style={styles.milestoneNextIndicator}>Next</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Order History Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {orders.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/(customer)/orders')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {loadingOrders ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptyText}>Your orders will appear here</Text>
            <TouchableOpacity 
              style={styles.orderNowButton}
              onPress={() => router.push('/(customer)/new-order')}
            >
              <Text style={styles.orderNowButtonText}>Place Your First Order</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.slice(0, 3).map((order) => (
            <TouchableOpacity 
              key={order.id} 
              style={styles.orderCard}
              onPress={() => router.push(`/(customer)/order-details?id=${order.id}`)}
            >
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderService}>{order.serviceName || order.serviceType}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                </View>
                <View style={[styles.orderStatus, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                  <Text style={[styles.orderStatusText, { color: getStatusColor(order.status) }]}>
                    {getStatusText(order.status)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.orderDetails}>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Weight:</Text>
                  <Text style={styles.orderDetailValue}>{order.weight} kg</Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Total:</Text>
                  <Text style={styles.orderDetailValue}>₱{order.total.toFixed(2)}</Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Pickup:</Text>
                  <Text style={styles.orderDetailValue}>{order.pickupDate}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Special Offers Section - Dynamic from earned coupons */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Special Offers</Text>
          {availableCoupons.length > 0 && (
            <TouchableOpacity onPress={() => setShowCouponsModal(true)}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {availableCoupons.length > 0 ? (
          availableCoupons.slice(0, 2).map((coupon) => (
            <View key={coupon.code} style={styles.promoCard}>
              <View style={styles.promoHeader}>
                <View>
                  <Text style={styles.promoTitle}>
                    Milestone {coupon.milestoneLevel} Reward
                  </Text>
                  <Text style={styles.promoDescription}>
                    Congratulations on reaching Level {coupon.milestoneLevel}!
                  </Text>
                </View>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{coupon.discountPercentage}% OFF</Text>
                </View>
              </View>
              
              <View style={styles.promoFooter}>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Your Coupon:</Text>
                  <TouchableOpacity 
                    style={styles.codeBox}
                    onPress={() => handleCopyCode(coupon.code)}
                  >
                    <Text style={styles.codeText}>{coupon.code}</Text>
                    <Text style={styles.copyButton}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.expiryNote}>
                  Expires: {formatExpiryDate(coupon.expiresAt)}
                </Text>
                <Text style={styles.oneTimeNote}>
                  ⚠️ One-time use only
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <View>
                <Text style={styles.promoTitle}>Complete More Orders!</Text>
                <Text style={styles.promoDescription}>
                  Reach milestones to unlock discount coupons
                </Text>
              </View>
              <View style={[styles.discountBadge, styles.comingSoonBadge]}>
                <Text style={styles.discountText}>Locked</Text>
              </View>
            </View>
            <View style={styles.promoFooter}>
              <Text style={styles.milestoneHint}>
                🎯 Next milestone: {nextMilestone?.ordersNeeded || 25} more orders for {nextMilestone?.discount || 5}% OFF
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Referral Section */}
      <View style={styles.referralCard}>
        <Text style={styles.referralTitle}>Invite Friends, Earn Rewards</Text>
        <Text style={styles.referralDescription}>
          Share your code and get 50 points for each friend who places their first order!
        </Text>
        
        <View style={styles.referralCodeContainer}>
          <Text style={styles.referralCode}>
            {user?.email?.split('@')[0]?.toUpperCase() || 'USER'}2024
          </Text>
          <TouchableOpacity style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share Code</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.referralBonus}>
          Your friends also get 15% off their first order!
        </Text>
      </View>

      <CouponsModal />
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  pointsCard: {
    backgroundColor: '#007aff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pointsTitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  pointsSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
  },
  pointsValueContainer: {
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  pointsLabel: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.9,
  },
  nextRewardBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  nextRewardText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  maxLevelContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  maxLevelText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  currentMilestoneBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  currentMilestoneText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  couponAlert: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  couponAlertText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  tapHint: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.6,
    marginTop: 8,
    textAlign: 'center',
  },
  milestonesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  milestonesScroll: {
    flexDirection: 'row',
  },
  milestoneCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  milestoneReached: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  milestoneNext: {
    borderColor: '#007aff',
    backgroundColor: '#e7f1ff',
  },
  milestoneUsed: {
    backgroundColor: '#e9ecef',
    borderColor: '#6c757d',
    opacity: 0.6,
  },
  milestoneLevel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6c757d',
    marginBottom: 4,
  },
  milestoneReachedText: {
    color: '#28a745',
  },
  milestoneRequirement: {
    fontSize: 11,
    color: '#6c757d',
    marginBottom: 6,
  },
  milestoneDiscountBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  milestoneDiscountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  milestoneCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 16,
    color: '#28a745',
    fontWeight: 'bold',
  },
  milestoneUsedText: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 10,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  milestoneNextIndicator: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#007aff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAll: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
  },
  orderNowButton: {
    marginTop: 16,
    backgroundColor: '#007aff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  orderNowButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  orderStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderDetailLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  orderDetailValue: {
    fontSize: 12,
    color: '#212529',
    fontWeight: '500',
  },
  promoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  promoDescription: {
    fontSize: 13,
    color: '#6c757d',
  },
  discountBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comingSoonBadge: {
    backgroundColor: '#6c757d',
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  promoFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  codeLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 8,
  },
  codeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007aff',
  },
  copyButton: {
    fontSize: 12,
    color: '#007aff',
    fontWeight: '500',
  },
  expiryNote: {
    fontSize: 11,
    color: '#dc3545',
    marginBottom: 4,
  },
  oneTimeNote: {
    fontSize: 10,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  milestoneHint: {
    fontSize: 12,
    color: '#007aff',
    textAlign: 'center',
  },
  referralCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
    marginBottom: 20,
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  referralDescription: {
    fontSize: 13,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
  },
  referralCodeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  referralCode: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007aff',
  },
  shareButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  referralBonus: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  modalClose: {
    fontSize: 24,
    color: '#6c757d',
  },
  modalBody: {
    padding: 20,
  },
  emptyCouponsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCouponsIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyCouponsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  emptyCouponsText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  emptyCouponsHint: {
    fontSize: 12,
    color: '#007aff',
    marginTop: 12,
    textAlign: 'center',
  },
  couponCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  couponBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  couponBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  expiringBadge: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiringText: {
    color: '#856404',
    fontSize: 10,
    fontWeight: '600',
  },
  couponCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007aff',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  couponDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e9ecef',
  },
  couponDetail: {
    alignItems: 'center',
  },
  couponDetailLabel: {
    fontSize: 11,
    color: '#6c757d',
    marginBottom: 4,
  },
  couponDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212529',
  },
  couponDivider: {
    width: 1,
    backgroundColor: '#e9ecef',
  },
  useCouponButton: {
    backgroundColor: '#007aff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  useCouponButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});