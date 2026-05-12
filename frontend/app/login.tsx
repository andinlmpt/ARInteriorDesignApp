import { View, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity, TextInput, Text, Animated, Dimensions } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateLogin, AUTH_USER_STORAGE_KEY } from '@/data/authData';
import AuthService from '@/services/AuthService';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { AnimatedButton, FadeInView, SlideInView } from '@/components/interactive';
import { getHorizontalPadding, isSmallScreen, getResponsiveFontSize } from '@/utils/responsive';

const { width, height } = Dimensions.get('window');

// Animated abstract pattern component with moving gradients
const AbstractPattern = ({ style }: { style?: any }) => {
  const animatedValue1 = useRef(new Animated.Value(0)).current;
  const animatedValue2 = useRef(new Animated.Value(0)).current;
  const animatedValue3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create continuous looping animations
    const createAnimation = (value: Animated.Value, duration: number, delay: number = 0) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start all animations
    Animated.parallel([
      createAnimation(animatedValue1, 8000, 0),
      createAnimation(animatedValue2, 10000, 2000),
      createAnimation(animatedValue3, 12000, 4000),
    ]).start();
  }, []);

  const translateX1 = animatedValue1.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.3, width * 0.3],
  });

  const translateY1 = animatedValue1.interpolate({
    inputRange: [0, 1],
    outputRange: [-height * 0.1, height * 0.1],
  });

  const translateX2 = animatedValue2.interpolate({
    inputRange: [0, 1],
    outputRange: [width * 0.2, -width * 0.2],
  });

  const translateY2 = animatedValue2.interpolate({
    inputRange: [0, 1],
    outputRange: [height * 0.15, -height * 0.15],
  });

  const translateX3 = animatedValue3.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.25, width * 0.25],
  });

  const translateY3 = animatedValue3.interpolate({
    inputRange: [0, 1],
    outputRange: [height * 0.1, -height * 0.1],
  });

  const opacity1 = animatedValue1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.5, 0.3],
  });

  const opacity2 = animatedValue2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 0.4, 0.25],
  });

  const opacity3 = animatedValue3.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.2, 0.35, 0.2],
  });

  return (
    <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', overflow: 'hidden' }, style]}>
      {/* Base gradient */}
      <LinearGradient
        colors={['#93C5FD', '#60A5FA', '#3B82F6', '#E0F2FE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4 }}
      />

      {/* Animated gradient layers */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: width * 1.5,
          height: height * 0.6,
          transform: [{ translateX: translateX1 }, { translateY: translateY1 }],
          opacity: opacity1,
        }}
      >
        <LinearGradient
          colors={['#93C5FD', 'transparent', '#60A5FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: width }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: width * 1.3,
          height: height * 0.5,
          transform: [{ translateX: translateX2 }, { translateY: translateY2 }],
          opacity: opacity2,
        }}
      >
        <LinearGradient
          colors={['transparent', '#3B82F6', '#60A5FA', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: width }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          bottom: -80,
          left: -80,
          width: width * 1.4,
          height: height * 0.55,
          transform: [{ translateX: translateX3 }, { translateY: translateY3 }],
          opacity: opacity3,
        }}
      >
        <LinearGradient
          colors={['#E0F2FE', '#93C5FD', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: width }}
        />
      </Animated.View>
    </View>
  );
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  // Use blue accent colors matching the design
  const accentColor = colors.accent || '#3B82F6';
  const lightBlue = '#E0F2FE';
  const patternBlue = '#93C5FD';

  const handleLogin = useCallback(async () => {
    if (isLoading) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Use AuthService for actual backend authentication
      const response = await AuthService.login(trimmedEmail, trimmedPassword);

      if (response && response.user) {
        if (rememberMe) {
          await AsyncStorage.setItem('remember_email', trimmedEmail);
        }

        router.replace('/(tabs)');

        setTimeout(() => {
          Alert.alert('Welcome Back', `Hello ${response.user.name}, ready to design?`);
        }, 500);
      }
    } catch (error: any) {
      console.error('[Login] Failed to authenticate user', error);
      const errorMessage = error.details?.message || error.message || 'Unable to sign in. Please check your connection and try again.';
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [email, isLoading, password, router, rememberMe]);

  const handleSignUp = useCallback(() => {
    router.push('/signup');
  }, [router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: '#FFFFFF' }]}
    >
      <StatusBar style="dark" />

      {/* Abstract Pattern Background */}
      <AbstractPattern />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo and Branding */}
        <View style={styles.topBranding}>
          <FadeInView delay={100} style={{ alignItems: 'center', width: '100%' }}>
            <View style={[styles.logoContainer, { backgroundColor: '#FFFFFF' }]}>
              <Ionicons name="cube" size={48} color={accentColor} />
            </View>
            <Text style={[styles.topAppName, { color: '#1E3A8A' }]}>AR Interior Design</Text>
            <Text style={[styles.topAppTagline, { color: '#1E40AF' }]}>Design your space with AR</Text>
          </FadeInView>
        </View>

        {/* Curved White Content Area */}
        <View style={[styles.whiteContent, { backgroundColor: '#FFFFFF' }]}>
          <FadeInView delay={200}>

            {/* Title with underline */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: '#1F2937' }]}>Sign in</Text>
              <View style={[styles.titleUnderline, { backgroundColor: accentColor }]} />
            </View>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: '#1F2937' }]}>Email</Text>
              <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#1F2937' }]}
                  placeholder="demo@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCorrect={false}
                />
                <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: '#1F2937' }]}>Password</Text>
              <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#1F2937' }]}
                  placeholder="enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me & Forgot Password */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  rememberMe && { backgroundColor: accentColor, borderColor: accentColor }
                ]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={[styles.rememberMeText, { color: '#1F2937' }]}>Remember Me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Password Reset', 'Password reset functionality coming soon!');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.forgotPassword, { color: accentColor }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <SlideInView direction="bottom" delay={300}>
              <AnimatedButton
                onPress={handleLogin}
                disabled={isLoading}
                style={[styles.loginButton, { backgroundColor: accentColor }]}
                hapticType="success"
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Signing in...' : 'Login'}
                </Text>
              </AnimatedButton>
            </SlideInView>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={[styles.signUpText, { color: '#000000' }]}>
                Don&apos;t have an Account?{' '}
              </Text>
              <TouchableOpacity onPress={handleSignUp} activeOpacity={0.7}>
                <Text style={[styles.signUpLink, { color: '#3B82F6' }]}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topBranding: {
    height: height * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: getHorizontalPadding(spacing.md),
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  whiteContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: isSmallScreen ? spacing.xl : spacing.xxl,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    paddingBottom: isSmallScreen ? spacing.xxl * 1.5 : spacing.xxl * 2,
    minHeight: height * 0.7 + 50,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  topAppName: {
    fontSize: getResponsiveFontSize(isSmallScreen ? 24 : 28),
    fontWeight: '700',
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  topAppTagline: {
    fontSize: getResponsiveFontSize(isSmallScreen ? 14 : 16),
    fontWeight: '500',
    textAlign: 'center',
  },
  titleContainer: {
    marginBottom: isSmallScreen ? spacing.lg : spacing.xl,
  },
  title: {
    fontSize: getResponsiveFontSize(isSmallScreen ? 28 : 32),
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  titleUnderline: {
    height: 3,
    width: 60,
    borderRadius: 2,
  },
  inputWrapper: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    minHeight: isSmallScreen ? 44 : 48,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberMeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    width: '100%',
    paddingVertical: isSmallScreen ? spacing.sm + 4 : spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallScreen ? spacing.md : spacing.lg,
    minHeight: 50,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  signUpText: {
    fontSize: 14,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
