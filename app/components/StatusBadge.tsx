import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return { color: COLORS.warning, text: 'Pending' };
      case 'processing':
        return { color: COLORS.primary, text: 'Processing' };
      case 'completed':
        return { color: COLORS.success, text: 'Completed' };
      case 'cancelled':
        return { color: COLORS.danger, text: 'Cancelled' };
      default:
        return { color: COLORS.gray, text: 'Unknown' };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.badge, { backgroundColor: `${config.color}20` }]}>
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: SIZES.xs,
    fontWeight: '600',
  },
});

export default StatusBadge;