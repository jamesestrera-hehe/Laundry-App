import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';
import AppInput from '../components/AppInput';
import AppButton from '../components/Appbutton';
import { COLORS, SIZES } from '../constants/theme';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'customer'>('customer');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      await signIn(email, password);
      // Redirect based on selected role
      if (selectedRole === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(customer)');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Smart Laundry</Text>
          <Text style={styles.subtitle}>Welcome Back!</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.roleLabel}>Login as:</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[
                styles.roleOption,
                selectedRole === 'customer' && styles.roleOptionActive
              ]}
              onPress={() => setSelectedRole('customer')}
            >
              <Text style={[
                styles.roleText,
                selectedRole === 'customer' && styles.roleTextActive
              ]}>👤 Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleOption,
                selectedRole === 'admin' && styles.roleOptionActive
              ]}
              onPress={() => setSelectedRole('admin')}
            >
              <Text style={[
                styles.roleText,
                selectedRole === 'admin' && styles.roleTextActive
              ]}>👑 Admin</Text>
            </TouchableOpacity>
          </View>

          <AppInput 
            label="Email" 
            value={email} 
            onChangeText={setEmail} 
            placeholder="Enter your email" 
            keyboardType="email-address" 
            autoCapitalize="none"
          />
          
          <AppInput 
            label="Password" 
            value={password} 
            onChangeText={setPassword} 
            placeholder="Enter your password" 
            secureTextEntry 
          />
          
          <AppButton title="Login" onPress={handleLogin} loading={loading} />
          
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.linkContainer}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.link}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.xl,
  },
  header: {
    marginBottom: SIZES.xxxl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.sm,
  },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SIZES.lg,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  roleLabel: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: SIZES.sm,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: SIZES.md,
    marginBottom: SIZES.lg,
  },
  roleOption: {
    flex: 1,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  roleOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray,
  },
  roleTextActive: {
    color: COLORS.white,
  },
  linkContainer: {
    marginTop: SIZES.lg,
    alignItems: 'center',
  },
  linkText: {
    fontSize: SIZES.sm,
    color: COLORS.gray,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;