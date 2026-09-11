import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Platform, Image, Switch, LayoutAnimation } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/Text';
import { Screen } from '@/components/ui/Screen';
import { AppDialog, type AppDialogAction } from '@/components/ui/AppDialog';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii, shadows } from '@/components/ui/theme';
import { AUTH_USER_STORAGE_KEY } from '@/data/authData';
import { getHorizontalPadding, isSmallScreen } from '@/utils/responsive';
import { NotificationService } from '@/services/NotificationService';
import AuthService from '@/services/AuthService';

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type DialogState = {
  title: string;
  message?: string;
  actions: AppDialogAction[];
};

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, statusBarStyle, isDark, setDarkMode: setThemeDarkMode } = useTheme();
  const [userName, setUserName] = useState<string>('John Doe');
  const [userEmail, setUserEmail] = useState<string>('john.doe@example.com');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [metricUnits, setMetricUnits] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const closeDialog = () => setDialog(null);

  const showDialog = (title: string, message: string, actions?: AppDialogAction[]) => {
    setDialog({
      title,
      message,
      actions: actions ?? [
        { label: 'OK', tone: 'primary', onPress: closeDialog },
      ],
    });
  };

  const loadInitialData = async () => {
    try {
      const userData = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.name || 'User');
        setUserEmail(user.email || '');
        setProfilePicture(user.profilePicture || null);
      }

      const notifications = await AsyncStorage.getItem('settings_notifications');
      const notificationsOn = notifications !== null ? notifications === 'true' : true;

      if (notificationsOn) {
        const hasPermission = await NotificationService.hasPermission();
        setNotificationsEnabled(hasPermission);
      } else {
        setNotificationsEnabled(false);
      }

      const units = await AsyncStorage.getItem('settings_metricUnits');
      if (units !== null) setMetricUnits(units === 'true');

      const analytics = await AsyncStorage.getItem('settings_analytics');
      if (analytics !== null) setAnalyticsEnabled(analytics === 'true');
    } catch (error) {
      console.error('[Profile] Failed to load data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  const handleToggleSettings = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setSettingsExpanded(!settingsExpanded);
  };

  const handleToggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        const hasPermission = await NotificationService.requestPermissions();
        if (!hasPermission) {
          showDialog(
            'Permission needed',
            'Allow notifications to receive design tips and project updates.'
          );
          return;
        }
      } else {
        await NotificationService.cancelAllNotifications();
      }
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('settings_notifications', String(value));
    } catch (error) {
      console.error('[Profile] Notification error:', error);
    }
  };

  const handleToggleUnits = async (value: boolean) => {
    setMetricUnits(value);
    await AsyncStorage.setItem('settings_metricUnits', String(value));
  };

  const handleToggleDarkMode = async (value: boolean) => {
    await setThemeDarkMode(value);
  };

  const handleToggleAnalytics = async (value: boolean) => {
    setAnalyticsEnabled(value);
    await AsyncStorage.setItem('settings_analytics', String(value));
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const performLogout = async () => {
    closeDialog();
    try {
      await AuthService.logout();
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.replace('/login');
    } catch (error) {
      console.error('[Profile] Logout error:', error);
      try {
        await AsyncStorage.multiRemove([AUTH_USER_STORAGE_KEY]);
        router.replace('/login');
      } catch {
        showDialog('Something went wrong', 'Could not log out. Please restart the app.');
      }
    }
  };

  const handleLogout = () => {
    setDialog({
      title: 'Log out?',
      message: 'You’ll need to sign in again to access your projects and profile.',
      actions: [
        { label: 'Cancel', tone: 'ghost', onPress: closeDialog },
        { label: 'Log out', tone: 'danger', onPress: performLogout },
      ],
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surfaceSecondary }]} edges={['top']}>
        <Screen
          contentContainerStyle={[styles.screenContent, { paddingTop: spacing.md }]}
        >
          <View style={styles.header}>
            <AppText variant="h1" style={[styles.title, { color: colors.textPrimary }]}>
              Profile
            </AppText>
          </View>

          <View style={[styles.profileSection, { borderBottomColor: colors.border }]}>
            <View style={styles.avatarContainer}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={[styles.avatar, styles.avatarImage]} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <AppText variant="h2" style={styles.avatarText}>
                    {userName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AppText>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.editAvatarButton,
                  { backgroundColor: colors.accent, borderColor: colors.surfaceSecondary },
                ]}
                activeOpacity={0.7}
                onPress={handleEditProfile}
              >
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <AppText variant="h3" style={[styles.name, { color: colors.textPrimary }]}>
              {userName}
            </AppText>
            <AppText variant="body" color="textMuted" style={styles.email}>
              {userEmail}
            </AppText>
            <TouchableOpacity
              style={[
                styles.editButton,
                { borderColor: colors.accent, backgroundColor: hexToRgba(colors.accent, 0.08) },
              ]}
              activeOpacity={0.7}
              onPress={handleEditProfile}
            >
              <Ionicons name="create-outline" size={16} color={colors.accent} />
              <AppText variant="subtitle" style={[styles.editButtonText, { color: colors.accent }]}>
                Edit Profile
              </AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/projects')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: hexToRgba(colors.accent, 0.1) }]}>
                <Ionicons name="folder-outline" size={20} color={colors.accent} />
              </View>
              <AppText variant="body" style={[styles.menuText, { color: colors.textPrimary }]}>
                Projects
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/help-support')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: hexToRgba(colors.accent, 0.1) }]}>
                <Ionicons name="help-circle-outline" size={20} color={colors.accent} />
              </View>
              <AppText variant="body" style={[styles.menuText, { color: colors.textPrimary }]}>
                Help & Support
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
              <View style={[styles.menuIconContainer, { backgroundColor: hexToRgba('#E87722', 0.1) }]}>
                <Ionicons name="notifications-outline" size={20} color="#E87722" />
              </View>
              <View style={styles.menuTextBlock}>
                <AppText variant="body" style={[styles.menuText, { color: colors.textPrimary }]}>
                  Notifications
                </AppText>
                <AppText variant="caption" color="textMuted">
                  Design tips & project updates
                </AppText>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: colors.border, true: colors.accent + '80' }}
                thumbColor={notificationsEnabled ? colors.accent : colors.surfacePrimary}
              />
            </View>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/about-us')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: hexToRgba('#1E3A8A', 0.1) }]}>
                <Ionicons name="information-circle-outline" size={20} color="#1E3A8A" />
              </View>
              <AppText variant="body" style={[styles.menuText, { color: colors.textPrimary }]}>
                About Us
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={handleToggleSettings}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: hexToRgba(colors.textSecondary, 0.1) },
                ]}
              >
                <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
              </View>
              <AppText variant="body" style={[styles.menuText, { color: colors.textPrimary }]}>
                Settings
              </AppText>
              <Ionicons
                name={settingsExpanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {settingsExpanded && (
              <View style={styles.dropdownContainer}>
                <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.settingInfo}>
                    <AppText variant="subtitle" style={styles.settingLabel}>
                      Metric Units
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      Use meters instead of feet
                    </AppText>
                  </View>
                  <Switch
                    value={metricUnits}
                    onValueChange={handleToggleUnits}
                    trackColor={{ false: colors.border, true: colors.accent + '80' }}
                    thumbColor={metricUnits ? colors.accent : colors.surfacePrimary}
                  />
                </View>

                <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.settingInfo}>
                    <AppText variant="subtitle" style={styles.settingLabel}>
                      Dark Mode
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      Use dark theme
                    </AppText>
                  </View>
                  <Switch
                    value={isDark}
                    onValueChange={handleToggleDarkMode}
                    trackColor={{ false: colors.border, true: colors.accent + '80' }}
                    thumbColor={isDark ? colors.accent : colors.surfacePrimary}
                  />
                </View>

                <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.settingInfo}>
                    <AppText variant="subtitle" style={styles.settingLabel}>
                      Analytics
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      Help improve the app (anonymous)
                    </AppText>
                  </View>
                  <Switch
                    value={analyticsEnabled}
                    onValueChange={handleToggleAnalytics}
                    trackColor={{ false: colors.border, true: colors.accent + '80' }}
                    thumbColor={analyticsEnabled ? colors.accent : colors.surfacePrimary}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.menuItem, styles.logoutItem]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: hexToRgba(colors.danger, 0.1) }]}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              </View>
              <AppText variant="body" style={[styles.logoutText, { color: colors.danger }]}>
                Logout
              </AppText>
            </TouchableOpacity>
          </View>

          <AppText variant="caption" color="textMuted" style={styles.version}>
            Version 1.0.0
          </AppText>
        </Screen>
      </SafeAreaView>

      <AppDialog
        visible={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        actions={dialog?.actions}
        onRequestClose={closeDialog}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  screenContent: {
    paddingHorizontal: 0,
    paddingBottom: spacing.xxl * 2.5,
    gap: isSmallScreen ? spacing.lg : spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
    paddingTop: spacing.xs,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
  },
  title: { marginBottom: spacing.xs },
  profileSection: {
    alignItems: 'center',
    paddingBottom: spacing.xxl * 1.5,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    ...shadows.sm,
  },
  name: {
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  email: { marginBottom: spacing.lg },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: getHorizontalPadding(spacing.xl * 1.5),
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  editButtonText: { fontWeight: '600' },
  menuSection: { marginTop: spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    fontWeight: '500',
  },
  menuTextBlock: {
    flex: 1,
    gap: 2,
  },
  logoutItem: { borderBottomWidth: 0 },
  logoutText: {
    flex: 1,
    fontWeight: '500',
  },
  dropdownContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: getHorizontalPadding(spacing.xl) + spacing.xl,
    borderBottomWidth: 0.5,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  version: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
