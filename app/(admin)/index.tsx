import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebase';

interface Order {
  id: string;
  userId: string;
  userEmail: string;
  serviceType: string;
  weight: number;
  pricePerKg: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  address: string;
  pickupDate: string;
  notes?: string;
  createdAt: string;
}

interface UserLoyalty {
  userId: string;
  userEmail: string;
  totalOrders: number;
  totalPoints: number;
  currentMilestone: number;
  milestonesReached: Milestone[];
}

interface Milestone {
  level: number;
  ordersRequired: number;
  discountPercentage: number;
  achievedAt: string;
  couponCode: string;
}

// Static coupon codes for each milestone (NOT random)
const STATIC_COUPONS = {
  1: { code: "LAUND5", discount: 5, ordersRequired: 25 },
  2: { code: "LAUND8", discount: 8, ordersRequired: 50 },
  3: { code: "LAUND10", discount: 10, ordersRequired: 75 },
  4: { code: "LAUND12", discount: 12, ordersRequired: 100 },
  5: { code: "LAUND15", discount: 15, ordersRequired: 150 },
  6: { code: "LAUND18", discount: 18, ordersRequired: 200 },
  7: { code: "LAUND20", discount: 20, ordersRequired: 250 },
};

const AdminDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [usersLoyalty, setUsersLoyalty] = useState<UserLoyalty[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    totalWeight: 0,
    todayRevenue: 0,
    todayWeight: 0,
    thisWeekRevenue: 0,
    thisWeekWeight: 0,
    totalPointsAwarded: 0,
    totalCouponsIssued: 0,
    totalCouponsRedeemed: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);

  // Milestone configuration with static coupon codes
  const milestones = [
    { level: 1, ordersRequired: 25, discount: 5, couponCode: "LAUND5" },
    { level: 2, ordersRequired: 50, discount: 8, couponCode: "LAUND8" },
    { level: 3, ordersRequired: 75, discount: 10, couponCode: "LAUND10" },
    { level: 4, ordersRequired: 100, discount: 12, couponCode: "LAUND12" },
    { level: 5, ordersRequired: 150, discount: 15, couponCode: "LAUND15" },
    { level: 6, ordersRequired: 200, discount: 18, couponCode: "LAUND18" },
    { level: 7, ordersRequired: 250, discount: 20, couponCode: "LAUND20" },
  ];

  useEffect(() => {
    fetchOrders();
    fetchLoyaltyData();
  }, []);

  // REMOVED generateCouponCode function - no longer needed

  const checkAndAwardMilestones = async (userId: string, userEmail: string, totalOrders: number) => {
    const userLoyaltyRef = doc(db, 'userLoyalty', userId);
    const userLoyaltyDoc = await getDoc(userLoyaltyRef);
    const currentData = userLoyaltyDoc.data() as UserLoyalty;
    const reachedMilestones: Milestone[] = [];

    for (const milestone of milestones) {
      const alreadyReached = currentData?.milestonesReached?.some(m => m.level === milestone.level);
      
      if (totalOrders >= milestone.ordersRequired && !alreadyReached) {
        // Use STATIC coupon code, not random generated
        const couponCode = milestone.couponCode;

        reachedMilestones.push({
          level: milestone.level,
          ordersRequired: milestone.ordersRequired,
          discountPercentage: milestone.discount,
          achievedAt: new Date().toISOString(),
          couponCode: couponCode,
        });

        // Alert admin about new milestone reached with static coupon
        Alert.alert(
          '🎉 Milestone Reached!',
          `User ${userEmail} has reached ${milestone.ordersRequired} orders!\n\n` +
          `🏆 Milestone ${milestone.level}: ${milestone.discount}% discount\n` +
          `🎫 Coupon Code: ${couponCode}\n` +
          `⚠️ One-time use per customer`,
          [{ text: 'OK' }]
        );
      }
    }

    if (reachedMilestones.length > 0) {
      await updateDoc(userLoyaltyRef, {
        milestonesReached: [...(currentData?.milestonesReached || []), ...reachedMilestones],
        currentMilestone: Math.max(...reachedMilestones.map(m => m.level), currentData?.currentMilestone || 0),
      });
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    Alert.alert(
      'Update Status',
      `Mark this order as ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const orderRef = doc(db, 'orders', orderId);
              const orderDoc = await getDoc(orderRef);
              const orderData = orderDoc.data() as Order;

              await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: new Date().toISOString(),
              });

              // Award loyalty points only when order is completed
              if (newStatus === 'completed' && orderData.status !== 'completed') {
                await awardLoyaltyPoints(orderData.userId, orderData.userEmail, orderId);
              }

              await fetchOrders();
              await fetchLoyaltyData();
              Alert.alert('Success', `Order marked as ${newStatus}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to update order');
            }
          },
        },
      ]
    );
  };

  const awardLoyaltyPoints = async (userId: string, userEmail: string, orderId: string) => {
    const POINTS_PER_ORDER = 5;
    const userLoyaltyRef = doc(db, 'userLoyalty', userId);
    const userLoyaltyDoc = await getDoc(userLoyaltyRef);

    if (userLoyaltyDoc.exists()) {
      const currentData = userLoyaltyDoc.data() as UserLoyalty;
      const newTotalPoints = currentData.totalPoints + POINTS_PER_ORDER;
      const newTotalOrders = currentData.totalOrders + 1;

      await updateDoc(userLoyaltyRef, {
        totalPoints: newTotalPoints,
        totalOrders: newTotalOrders,
        lastOrderDate: new Date().toISOString(),
      });

      // Check for milestones
      await checkAndAwardMilestones(userId, userEmail, newTotalOrders);
    } else {
      // Create new loyalty record
      await setDoc(userLoyaltyRef, {
        userId: userId,
        userEmail: userEmail,
        totalOrders: 1,
        totalPoints: POINTS_PER_ORDER,
        currentMilestone: 0,
        milestonesReached: [],
        createdAt: new Date().toISOString(),
      });
    }
  };

  const fetchLoyaltyData = async () => {
    try {
      const loyaltyQuery = query(collection(db, 'userLoyalty'), orderBy('totalPoints', 'desc'));
      const loyaltySnapshot = await getDocs(loyaltyQuery);
      const loyaltyList = loyaltySnapshot.docs.map(doc => ({
        ...doc.data(),
      })) as UserLoyalty[];
      
      setUsersLoyalty(loyaltyList);

      // Calculate loyalty stats
      const totalPoints = loyaltyList.reduce((sum, user) => sum + user.totalPoints, 0);
      
      // Count used coupons from usedCoupons collection
      const usedCouponsQuery = query(collection(db, 'usedCoupons'));
      const usedCouponsSnapshot = await getDocs(usedCouponsQuery);
      const totalCouponsRedeemed = usedCouponsSnapshot.size;
      
      // Count total milestones reached (each milestone counts as a coupon issued)
      const totalCouponsIssued = loyaltyList.reduce((sum, user) => sum + (user.milestonesReached?.length || 0), 0);
      
      setStats(prev => ({
        ...prev,
        totalPointsAwarded: totalPoints,
        totalCouponsIssued: totalCouponsIssued,
        totalCouponsRedeemed: totalCouponsRedeemed,
      }));
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersList = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      
      setOrders(ordersList);
      
      // Calculate stats
      const completedOrders = ordersList.filter(o => o.status === 'completed');
      const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
      const totalWeight = completedOrders.reduce((sum, order) => sum + order.weight, 0);
      
      // Today's stats
      const today = new Date().toDateString();
      const todayOrders = completedOrders.filter(order => 
        new Date(order.createdAt).toDateString() === today
      );
      const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
      const todayWeight = todayOrders.reduce((sum, order) => sum + order.weight, 0);
      
      // This week stats
      const todayDate = new Date();
      const startOfWeek = new Date(todayDate);
      startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());
      const weekOrders = completedOrders.filter(order => 
        new Date(order.createdAt) >= startOfWeek
      );
      const thisWeekRevenue = weekOrders.reduce((sum, order) => sum + order.total, 0);
      const thisWeekWeight = weekOrders.reduce((sum, order) => sum + order.weight, 0);
      
      setStats({
        totalOrders: ordersList.length,
        pendingOrders: ordersList.filter(o => o.status === 'pending').length,
        processingOrders: ordersList.filter(o => o.status === 'processing').length,
        completedOrders: completedOrders.length,
        cancelledOrders: ordersList.filter(o => o.status === 'cancelled').length,
        totalRevenue: totalRevenue,
        totalWeight: totalWeight,
        todayRevenue: todayRevenue,
        todayWeight: todayWeight,
        thisWeekRevenue: thisWeekRevenue,
        thisWeekWeight: thisWeekWeight,
        totalPointsAwarded: stats.totalPointsAwarded,
        totalCouponsIssued: stats.totalCouponsIssued,
        totalCouponsRedeemed: stats.totalCouponsRedeemed,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load orders');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    await fetchLoyaltyData();
    setRefreshing(false);
  };

  const getFilteredOrders = () => {
    if (selectedTab === 'all') return orders;
    return orders.filter(order => order.status === selectedTab);
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

  const getStatusBgColor = (status: string) => {
    switch(status) {
      case 'completed': return '#d4edda';
      case 'pending': return '#fff3cd';
      case 'processing': return '#cce5ff';
      case 'cancelled': return '#f8d7da';
      default: return '#e9ecef';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toFixed(2)}`;
  };

  const formatWeight = (weight: number) => {
    return `${weight.toFixed(1)} kg`;
  };

  const toggleExpand = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
    }
  };

  const LoyaltyModal = () => (
    <Modal
      visible={showLoyaltyModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowLoyaltyModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎖️ Loyalty Program</Text>
            <TouchableOpacity onPress={() => setShowLoyaltyModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Milestones Overview */}
            <View style={styles.milestonesSection}>
              <Text style={styles.modalSubtitle}>🏆 Milestone Rewards</Text>
              <View style={styles.milestonesGrid}>
                {milestones.map((milestone) => (
                  <View key={milestone.level} style={styles.milestoneCard}>
                    <Text style={styles.milestoneLevel}>Level {milestone.level}</Text>
                    <Text style={styles.milestoneRequirement}>
                      {milestone.ordersRequired} orders
                    </Text>
                    <View style={styles.milestoneDiscount}>
                      <Text style={styles.milestoneDiscountText}>
                        {milestone.discount}% OFF
                      </Text>
                    </View>
                    <Text style={styles.milestoneCouponCode}>
                      Code: {milestone.couponCode}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* User Rankings */}
            <View style={styles.rankingsSection}>
              <Text style={styles.modalSubtitle}>👥 Customer Rankings</Text>
              {usersLoyalty.map((user, index) => (
                <View key={user.userId} style={styles.rankingCard}>
                  <View style={styles.rankingHeader}>
                    <Text style={styles.rankingPosition}>#{index + 1}</Text>
                    <Text style={styles.rankingEmail}>{user.userEmail}</Text>
                  </View>
                  <View style={styles.rankingStats}>
                    <View style={styles.rankingStat}>
                      <Text style={styles.rankingStatValue}>{user.totalOrders}</Text>
                      <Text style={styles.rankingStatLabel}>Orders</Text>
                    </View>
                    <View style={styles.rankingStat}>
                      <Text style={styles.rankingStatValue}>{user.totalPoints}</Text>
                      <Text style={styles.rankingStatLabel}>Points</Text>
                    </View>
                    <View style={styles.rankingStat}>
                      <Text style={styles.rankingStatValue}>
                        {user.milestonesReached?.length || 0}
                      </Text>
                      <Text style={styles.rankingStatLabel}>Milestones</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity 
          style={styles.loyaltyButton}
          onPress={() => setShowLoyaltyModal(true)}
        >
          <Text style={styles.loyaltyButtonText}>🎖️</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Overview</Text>
        
        <View style={styles.mainStatsRow}>
          <View style={styles.mainStatCard}>
            <Text style={styles.mainStatValue}>{stats.totalOrders}</Text>
            <Text style={styles.mainStatLabel}>Total Orders</Text>
          </View>
        </View>

        <View style={styles.revenueSection}>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueTitle}>Revenue</Text>
            <Text style={styles.revenueAmount}>{formatCurrency(stats.totalRevenue)}</Text>
            <View style={styles.revenueBreakdown}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Today</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(stats.todayRevenue)}</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>This Week</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(stats.thisWeekRevenue)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.weightCard}>
            <Text style={styles.revenueTitle}>Total Weight</Text>
            <Text style={styles.revenueAmount}>{formatWeight(stats.totalWeight)}</Text>
            <View style={styles.revenueBreakdown}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Today</Text>
                <Text style={styles.breakdownValue}>{formatWeight(stats.todayWeight)}</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>This Week</Text>
                <Text style={styles.breakdownValue}>{formatWeight(stats.thisWeekWeight)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Loyalty Stats */}
        <View style={styles.loyaltyStatsSection}>
          <Text style={styles.subSectionTitle}>🎯 Loyalty Program Stats</Text>
          <View style={styles.loyaltyStatsGrid}>
            <View style={styles.loyaltyStatCard}>
              <Text style={styles.loyaltyStatValue}>{stats.totalPointsAwarded}</Text>
              <Text style={styles.loyaltyStatLabel}>Points Awarded</Text>
            </View>
            <View style={styles.loyaltyStatCard}>
              <Text style={styles.loyaltyStatValue}>{stats.totalCouponsIssued}</Text>
              <Text style={styles.loyaltyStatLabel}>Coupons Earned</Text>
            </View>
            <View style={styles.loyaltyStatCard}>
              <Text style={styles.loyaltyStatValue}>{stats.totalCouponsRedeemed}</Text>
              <Text style={styles.loyaltyStatLabel}>Coupons Used</Text>
            </View>
          </View>
        </View>

        {/* Status Stats Grid */}
        <Text style={styles.subSectionTitle}>Order Status</Text>
        <View style={styles.statusGrid}>
          <View style={[styles.statusCard, { backgroundColor: '#fff3cd' }]}>
            <Text style={styles.statusValue}>{stats.pendingOrders}</Text>
            <Text style={styles.statusLabel}>Pending</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: '#cce5ff' }]}>
            <Text style={styles.statusValue}>{stats.processingOrders}</Text>
            <Text style={styles.statusLabel}>Processing</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: '#d4edda' }]}>
            <Text style={styles.statusValue}>{stats.completedOrders}</Text>
            <Text style={styles.statusLabel}>Completed</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: '#f8d7da' }]}>
            <Text style={styles.statusValue}>{stats.cancelledOrders}</Text>
            <Text style={styles.statusLabel}>Cancelled</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabsContainer}>
            {['all', 'pending', 'processing', 'completed'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, selectedTab === tab && styles.activeTab]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
                  {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
                {selectedTab === tab && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Orders List */}
      <View style={styles.ordersSection}>
        <Text style={styles.sectionTitle}>
          {selectedTab === 'all' ? 'All Orders' : `${selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)} Orders`}
        </Text>
        
        {getFilteredOrders().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptyText}>No {selectedTab} orders at the moment</Text>
          </View>
        ) : (
          getFilteredOrders().map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <TouchableOpacity onPress={() => toggleExpand(order.id)}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
                    <Text style={styles.orderEmail}>{order.userEmail}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(order.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                      {order.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Service:</Text>
                    <Text style={styles.detailValue}>{order.serviceType}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Weight:</Text>
                    <Text style={styles.detailValue}>{order.weight} kg</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total:</Text>
                    <Text style={styles.detailValue}>{formatCurrency(order.total)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pickup:</Text>
                    <Text style={styles.detailValue}>{order.pickupDate}</Text>
                  </View>
                </View>

                {expandedOrder === order.id && (
                  <View style={styles.expandedContent}>
                    <View style={styles.addressSection}>
                      <Text style={styles.expandedLabel}>📍 Pickup Address</Text>
                      <Text style={styles.expandedText}>{order.address}</Text>
                    </View>
                    
                    {order.notes && order.notes.trim() !== '' && (
                      <View style={styles.notesSection}>
                        <Text style={styles.expandedLabel}>📝 Special Instructions</Text>
                        <Text style={styles.expandedText}>{order.notes}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <Text style={styles.orderDate}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </Text>
                  <Text style={styles.expandHint}>
                    {expandedOrder === order.id ? '▲ Tap to collapse' : '▼ Tap to expand'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <View style={styles.actionButtons}>
                  {order.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.processingBtn]}
                      onPress={() => updateOrderStatus(order.id, 'processing')}
                    >
                      <Text style={styles.actionBtnText}>Process</Text>
                    </TouchableOpacity>
                  )}
                  {order.status === 'processing' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.completeBtn]}
                      onPress={() => updateOrderStatus(order.id, 'completed')}
                    >
                      <Text style={styles.actionBtnText}>Complete</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelBtn]}
                    onPress={() => updateOrderStatus(order.id, 'cancelled')}
                  >
                    <Text style={styles.actionBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      <LoyaltyModal />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  loyaltyButton: {
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 20,
  },
  loyaltyButtonText: {
    fontSize: 24,
  },
  statsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
    marginTop: 8,
  },
  mainStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mainStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  mainStatValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  mainStatLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  revenueSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: '#007aff',
    borderRadius: 12,
    padding: 16,
  },
  weightCard: {
    flex: 1,
    backgroundColor: '#20c997',
    borderRadius: 12,
    padding: 16,
  },
  revenueTitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  revenueAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  revenueBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  breakdownLabel: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 2,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  loyaltyStatsSection: {
    marginBottom: 20,
  },
  loyaltyStatsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  loyaltyStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loyaltyStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007aff',
    marginBottom: 4,
  },
  loyaltyStatLabel: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    padding: 16,
  },
  statusValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  tabsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#e7f1ff',
  },
  tabText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007aff',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#007aff',
    borderRadius: 1,
  },
  ordersSection: {
    padding: 20,
    paddingTop: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
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
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212529',
  },
  orderEmail: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  detailValue: {
    fontSize: 12,
    color: '#212529',
    fontWeight: '500',
  },
  expandedContent: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  addressSection: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  notesSection: {
    padding: 12,
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 6,
  },
  expandedText: {
    fontSize: 13,
    color: '#212529',
    lineHeight: 18,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDate: {
    fontSize: 11,
    color: '#6c757d',
  },
  expandHint: {
    fontSize: 10,
    color: '#007aff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  processingBtn: {
    backgroundColor: '#007aff',
  },
  completeBtn: {
    backgroundColor: '#28a745',
  },
  cancelBtn: {
    backgroundColor: '#dc3545',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
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
  modalSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  milestonesSection: {
    marginBottom: 24,
  },
  milestonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  milestoneCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  milestoneLevel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007aff',
    marginBottom: 4,
  },
  milestoneRequirement: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 8,
  },
  milestoneDiscount: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  milestoneDiscountText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  milestoneCouponCode: {
    fontSize: 10,
    color: '#007aff',
    marginTop: 6,
    fontFamily: 'monospace',
  },
  rankingsSection: {
    marginBottom: 24,
  },
  rankingCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankingPosition: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007aff',
    marginRight: 12,
  },
  rankingEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
    flex: 1,
  },
  rankingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  rankingStat: {
    alignItems: 'center',
  },
  rankingStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  rankingStatLabel: {
    fontSize: 11,
    color: '#6c757d',
  },
  userCoupons: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
    marginTop: 8,
  },
  userCouponsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 8,
  },
  userCouponItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  userCouponCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#212529',
    fontFamily: 'monospace',
  },
  userCouponDiscount: {
    fontSize: 11,
    color: '#28a745',
    fontWeight: '600',
  },
});

export default AdminDashboard;