import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from './context/AuthContext';
import { router } from 'expo-router';

export default function Index() {
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/(auth)/login');
      } else if (userRole === 'admin') {
        router.replace('/(admin)');
      } else if (userRole === 'customer') {
        router.replace('/(customer)');
      }
    }
  }, [loading, user, userRole]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#4A90E2" />
    </View>
  );
}