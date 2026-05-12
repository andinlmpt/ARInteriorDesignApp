import { View, StyleSheet, Dimensions, ScrollView, Pressable, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { AUTH_USER_STORAGE_KEY } from '@/data/authData';
import { AnimatedButton, AnimatedCard, FadeInView, SlideInView, ScaleInView } from '@/components/interactive';
import { getHorizontalPadding, isSmallScreen } from '@/utils/responsive';
import { Platform } from 'react-native';

const { width } = Dimensions.get('window');
// Responsive card width for 2x2 grid - accounting for padding and gaps
const getCardWidth = () => {
  const horizontalPadding = getHorizontalPadding(24); // Base padding from content
  const gap = 12; // Gap between cards (spacing.sm)
  const availableWidth = width - (horizontalPadding * 2);
  const cardWidth = (availableWidth - gap) / 2; // Two cards per row with gap
  // Ensure minimum width and reasonable maximum, floor to avoid decimal widths
  return Math.max(140, Math.min(180, Math.floor(cardWidth)));
};
const CARD_W = getCardWidth();
const CARD_GAP = 12; // Gap between cards

// Interactive button with scale + opacity
const Button = ({
  children,
  onPress,
  style,
  activeOpacity = 0.7,
  activeScale = 0.96,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  activeOpacity?: number;
  activeScale?: number;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: activeScale, useNativeDriver: true, speed: 50 }),
      Animated.timing(opacity, { toValue: activeOpacity, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={animateIn} onPressOut={animateOut}>
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors: t, isDark, toggleTheme, statusBarStyle } = useTheme();
  const [showTip, setShowTip] = useState(true);
  const [userName, setUserName] = useState<string>('User');


  useEffect(() => {
    AsyncStorage.getItem('hideTip').then(v => v === 'true' && setShowTip(false));

    // Load user name from storage
    const loadUserName = async () => {
      try {
        const userData = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (userData) {
          const user = JSON.parse(userData);
          setUserName(user.name || 'User');
        }
      } catch (error) {
        console.error('[Home] Failed to load user name:', error);
      }
    };
    loadUserName();
  }, []);

  const dismissTip = useCallback(async () => {
    setShowTip(false);
    await AsyncStorage.setItem('hideTip', 'true');
  }, []);

  const actions = [
    { icon: 'sparkles', label: 'AI Design', route: '/ai-design' as Href, color: t.purple },
    { icon: 'color-wand', label: 'Themes', route: '/theme-recommend' as Href, color: t.pink },
    { icon: 'scan', label: 'AR View', route: '/ar-furniture' as Href, color: t.accent },
    { icon: 'grid', label: '3D Layout', route: '/layout-3d' as Href, color: t.orange },
  ];

  const rooms = [
    { icon: 'tv', name: 'Living', count: 120 },
    { icon: 'bed', name: 'Bed', count: 85 },
    { icon: 'cafe', name: 'Kitchen', count: 65 },
    { icon: 'water', name: 'Bath', count: 40 },
  ];

  const projects = [
    { name: 'Modern Loft', time: '2d', progress: 85 },
    { name: 'Cozy Suite', time: '5d', progress: 60 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Header with Branding */}
          <View style={styles.header}>
            <FadeInView delay={100}>
              <View style={styles.brandingSection}>
                <View style={[styles.logoContainer, { backgroundColor: t.accent + '15' }]}>
                  <Ionicons name="cube" size={36} color={t.accent} />
                </View>
                <View style={styles.brandingText}>
                  <AppText variant="h2" weight="700" style={[styles.appName, { color: t.textPrimary }]}>
                    AR Interior Design
                  </AppText>
                  <AppText variant="caption" style={[styles.appTagline, { color: t.textSecondary }]}>
                    Design your space with AR
                  </AppText>
                </View>
                <View style={styles.headerActions}>
                  <Button onPress={toggleTheme} activeScale={0.9}>
                    <View style={[styles.headerBtn, { backgroundColor: t.surfacePrimary }]}>
                      <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={t.textSecondary} />
                    </View>
                  </Button>
                  <Button activeScale={0.9}>
                    <View style={[styles.headerBtn, { backgroundColor: t.surfacePrimary }]}>
                      <Ionicons name="notifications-outline" size={20} color={t.textSecondary} />
                      <View style={[styles.dot, { backgroundColor: t.accent }]} />
                    </View>
                  </Button>
                </View>
              </View>
            </FadeInView>
            <View style={styles.headerContentRow}>
              <View style={styles.headerTextContainer}>
                <AppText variant="body" style={[styles.greeting, { color: t.textSecondary }]}>
                  Welcome back
                </AppText>
                <AppText variant="h1" style={[styles.name, { color: t.textPrimary }]}>
                  {userName}
                </AppText>
              </View>
            </View>
          </View>

          {/* New Project */}
          <Button onPress={() => router.push('/create-project')} style={[styles.newProject, { backgroundColor: t.surfacePrimary }]}>
            <View style={[styles.newIcon, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="add" size={24} color={t.accent} />
            </View>
            <View style={styles.newText}>
              <AppText variant="subtitle" weight="600" style={[styles.newTitle, { color: t.textPrimary }]}>
                New Project
              </AppText>
              <AppText variant="body" style={[styles.newSub, { color: t.textSecondary }]}>
                Start designing your space
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
          </Button>

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <AppText variant="h2" weight="700" style={[styles.sectionTitle, { color: t.textPrimary }]}>
              Quick Actions
            </AppText>
            <View style={styles.actionsGrid} removeClippedSubviews={false}>
              {actions.map((a, index) => (
                <ScaleInView key={a.label} delay={index * 100}>
                  <AnimatedCard
                    onPress={() => router.push(a.route)}
                    style={[
                      styles.actionCard,
                      { backgroundColor: t.surfacePrimary },
                      index % 2 === 0 && styles.actionCardLeft, // Left column
                      index % 2 === 1 && styles.actionCardRight, // Right column
                    ]}
                    hapticFeedback={true}
                  >
                    <View style={[styles.actionIconContainer, { backgroundColor: a.color + '15' }]}>
                      <Ionicons name={a.icon as any} size={28} color={a.color} />
                    </View>
                    <AppText variant="body" weight="600" style={[styles.actionLabel, { color: t.textPrimary }]}>
                      {a.label}
                    </AppText>
                  </AnimatedCard>
                </ScaleInView>
              ))}
            </View>
          </View>

          {/* Rooms */}
          <View style={styles.sectionRow}>
            <AppText variant="h2" weight="700" style={[styles.sectionTitle, { color: t.textPrimary }]}>
              Rooms
            </AppText>
            <Button activeScale={0.95}>
              <AppText variant="body" weight="600" style={[styles.seeAll, { color: t.accent }]}>
                See all
              </AppText>
            </Button>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.roomsScroll}
            contentContainerStyle={styles.roomsScrollContent}
          >
            {rooms.map((r, i) => {
              const roomColors = [t.purple, t.pink, t.orange, t.accent];
              return (
                <SlideInView key={r.name} direction="right" delay={i * 100}>
                  <AnimatedCard style={[styles.roomCard, { backgroundColor: t.surfacePrimary }]} hapticFeedback={true}>
                    <View style={[styles.roomIconContainer, { backgroundColor: roomColors[i] + '15' }]}>
                      <Ionicons
                        name={r.icon as any}
                        size={24}
                        color={roomColors[i]}
                      />
                    </View>
                    <AppText variant="body" weight="600" style={[styles.roomName, { color: t.textPrimary }]}>
                      {r.name}
                    </AppText>
                    <AppText variant="caption" style={[styles.roomCount, { color: t.textSecondary }]}>
                      {r.count}+ items
                    </AppText>
                  </AnimatedCard>
                </SlideInView>
              );
            })}
          </ScrollView>

          {/* Recent Projects */}
          <View style={styles.sectionRow}>
            <AppText variant="h2" weight="700" style={[styles.sectionTitle, { color: t.textPrimary }]}>
              Recent Projects
            </AppText>
            <Button activeScale={0.95}>
              <AppText variant="body" weight="600" style={[styles.seeAll, { color: t.accent }]}>
                All
              </AppText>
            </Button>
          </View>
          <FadeInView delay={300}>
            <View style={[styles.projectsList, { backgroundColor: t.surfacePrimary }]}>
              {projects.map((p, i) => (
                <ScaleInView key={p.name} delay={i * 100}>
                  <AnimatedCard
                    style={[
                      styles.projectRow,
                      i < projects.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }
                    ]}
                    hapticFeedback={true}
                  >
                    <View style={[styles.projectIcon, { backgroundColor: t.surfaceSecondary }]}>
                      <Ionicons name="folder-outline" size={20} color={t.textSecondary} />
                    </View>
                    <View style={styles.projectInfo}>
                      <AppText variant="subtitle" weight="600" style={[styles.projectName, { color: t.textPrimary }]}>
                        {p.name}
                      </AppText>
                      <AppText variant="caption" style={[styles.projectTime, { color: t.textSecondary }]}>
                        {p.time} ago
                      </AppText>
                    </View>
                    <View style={styles.progressWrap}>
                      <View style={[styles.progressBg, { backgroundColor: t.surfaceSecondary }]}>
                        <View style={[styles.progressBar, { width: `${p.progress}%`, backgroundColor: t.accent }]} />
                      </View>
                      <AppText variant="caption" weight="600" style={[styles.progressText, { color: t.textSecondary }]}>
                        {p.progress}%
                      </AppText>
                    </View>
                  </AnimatedCard>
                </ScaleInView>
              ))}
            </View>
          </FadeInView>

          {/* Pro Tip - Dismissable */}
          {showTip && (
            <SlideInView direction="bottom" delay={400}>
              <View style={[styles.tip, { backgroundColor: t.surfacePrimary }]}>
                <View style={[styles.tipIconContainer, { backgroundColor: t.accentSoft }]}>
                  <Ionicons name="bulb-outline" size={22} color={t.accent} />
                </View>
                <View style={styles.tipText}>
                  <AppText variant="subtitle" weight="600" style={[styles.tipTitle, { color: t.textPrimary }]}>
                    Pro Tip
                  </AppText>
                  <AppText variant="body" style={[styles.tipDesc, { color: t.textSecondary }]}>
                    Use AR View for real-time preview of your designs
                  </AppText>
                </View>
                <AnimatedButton onPress={dismissTip} hapticType="light">
                  <View style={[styles.tipClose, { backgroundColor: t.surfaceSecondary }]}>
                    <Ionicons name="close" size={16} color={t.textSecondary} />
                  </View>
                </AnimatedButton>
              </View>
            </SlideInView>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingBottom: spacing.xxl * 3.5, // Extra padding for tab bar + safe area
    paddingTop: spacing.md,
  },

  // Header
  header: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  brandingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingText: {
    flex: 1,
  },
  appName: {
    fontSize: 20,
    letterSpacing: 0.3,
    marginBottom: spacing.xs / 2,
  },
  appTagline: {
    fontSize: 12,
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 28,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // New Project
  newProject: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
    minHeight: 80,
  },
  newIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newText: {
    flex: 1,
    gap: spacing.xs,
  },
  newTitle: {
    marginBottom: spacing.xs,
  },
  newSub: {
    fontSize: 13,
  },

  // Sections
  sectionTitle: {
    marginBottom: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  seeAll: {
    fontSize: 14,
  },

  // Quick Actions Section
  quickActionsSection: {
    marginBottom: spacing.xl,
    width: '100%',
  },

  // Actions Grid - 2x2 layout
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%',
    marginTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  actionCard: {
    width: CARD_W, // Use calculated width for consistent 2-column layout
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: 120,
  },
  actionCardLeft: {
    marginRight: CARD_GAP, // Add gap between left and right columns
  },
  actionCardRight: {
    marginRight: 0, // No right margin for right column
  },
  actionIconContainer: {
    marginBottom: spacing.sm,
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '100%',
  },

  // Rooms
  roomsScroll: {
    marginBottom: spacing.xl,
  },
  roomsScrollContent: {
    paddingRight: spacing.lg,
  },
  roomCard: {
    width: 100,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginRight: spacing.md,
    gap: spacing.sm,
    minHeight: 110,
  },
  roomIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  roomName: {
    fontSize: 14,
    textAlign: 'center',
  },
  roomCount: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Projects
  projectsList: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  projectIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  projectName: {
    marginBottom: spacing.xs,
  },
  projectTime: {
    fontSize: 12,
  },
  progressWrap: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    minWidth: 60,
  },
  progressBg: {
    width: 60,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
  },

  // Tip
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    gap: spacing.xs,
  },
  tipTitle: {
    marginBottom: spacing.xs,
  },
  tipDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  tipClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
