import { View, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, Alert, TouchableOpacity, TextInput, Text, Animated, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emailExists, createUser, AUTH_USER_STORAGE_KEY } from '@/data/authData';
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

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  // Use blue accent colors matching the design
  const accentColor = colors.accent || '#3B82F6';
  const lightBlue = '#E0F2FE';
  const patternBlue = '#93C5FD';

  const handleSignUp = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword || !trimmedConfirmPassword) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    if (trimmedName.length < 2) {
      Alert.alert('Invalid Name', 'Please enter your full name (at least 2 characters)');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long');
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match. Please check and try again.');
      return;
    }

    if (emailExists(trimmedEmail)) {
      Alert.alert(
        'Email Already Registered',
        'This email is already registered. Would you like to sign in instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.replace('/login') },
        ]
      );
      return;
    }

    setIsLoading(true);

    try {
      // Use AuthService for actual backend registration and auto-login
      const response = await AuthService.signup(trimmedEmail, trimmedPassword, trimmedName);

      setIsLoading(false);

      if (response && response.user) {
        // Automatically redirect to home screen after successful signup
        router.replace('/(tabs)');

        // Brief notification
        setTimeout(() => {
          Alert.alert(
            'Welcome! 🎉',
            `Your account has been created, ${trimmedName}.`
          );
        }, 500);
      }
    } catch (error: any) {
      console.error('[SignUp] Failed to create account', error);
      setIsLoading(false);

      const errorMessage = error.details?.message || error.message || 'Unable to create account. Please check your connection and try again.';
      Alert.alert('Sign Up Failed', errorMessage);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

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
            <Text style={[styles.topAppTagline, { color: '#1E40AF' }]}>Create your account</Text>
          </FadeInView>
        </View>

        {/* Curved White Content Area */}
        <View style={[styles.whiteContent, { backgroundColor: '#FFFFFF' }]}>
          <FadeInView delay={200}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={handleBackToLogin}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Title with underline */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: '#1F2937' }]}>Sign up</Text>
              <View style={[styles.titleUnderline, { backgroundColor: accentColor }]} />
            </View>

            {/* Name Input */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: '#1F2937' }]}>Full Name</Text>
              <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#1F2937' }]}
                  placeholder="Jane Doe"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: '#1F2937' }]}>Email</Text>
              <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#1F2937' }]}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: '#1F2937' }]}>Password</Text>
              <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#1F2937' }]}
                  placeholder="Create password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="newPassword"
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
              <Text style={[styles.helperText, { color: '#6B7280' }]}>
                Must be at least 6 characters
              </Text>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: '#1F2937' }]}>Confirm Password</Text>
              <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#1F2937' }]}
                  placeholder="Repeat password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="newPassword"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Create Account Button */}
            <SlideInView direction="bottom" delay={300}>
              <AnimatedButton
                onPress={handleSignUp}
                disabled={isLoading}
                style={[styles.signUpButton, { backgroundColor: accentColor }]}
                hapticType="success"
              >
                <Text style={styles.signUpButtonText}>
                  {isLoading ? 'Creating account…' : 'Create account'}
                </Text>
              </AnimatedButton>
            </SlideInView>

            {/* Terms */}
            <View style={styles.termsContainer}>
              <Text style={[styles.termsText, { color: '#000000' }]}>
                By creating an account you agree to our{' '}
              </Text>
              <TouchableOpacity
                onPress={() => Alert.alert('Notice', 'Terms & Privacy flow to be implemented.')}
                activeOpacity={0.7}
              >
                <Text style={[styles.termsLink, { color: '#3B82F6' }]}>Terms & Privacy →</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={[styles.signInText, { color: '#000000' }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={handleBackToLogin} activeOpacity={0.7}>
                <Text style={[styles.signInLink, { color: '#3B82F6' }]}>Sign in</Text>
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
    paddingTop: isSmallScreen ? spacing.lg : spacing.xl,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    paddingBottom: isSmallScreen ? spacing.xxl * 1.5 : spacing.xxl * 2,
    minHeight: height * 0.7 + 50,
  },
  backButton: {
    marginBottom: spacing.lg,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  helperText: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  signUpButton: {
    width: '100%',
    paddingVertical: isSmallScreen ? spacing.sm + 4 : spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: isSmallScreen ? spacing.md : spacing.lg,
    marginBottom: spacing.md,
    minHeight: 50,
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
  },
  termsLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  signInText: {
    fontSize: 14,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
