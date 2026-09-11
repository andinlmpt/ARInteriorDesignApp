import { View, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthService from '@/services/AuthService';
import { AUTH_USER_STORAGE_KEY } from '@/data/authData';
import * as FileSystem from 'expo-file-system/legacy';
import { callApi } from '@/services/apiClient';
import { colors, radii, shadows, spacing } from '@/components/ui/theme';
import { AppText } from '@/components/ui/Text';
import { AppDialog, type AppDialogAction } from '@/components/ui/AppDialog';
import { BackIcon, CameraIcon } from '@/components/ui/Icons';
import { launchImageLibrary, launchCamera, requestMediaLibraryPermissions, requestCameraPermissions } from '@/utils/imagePicker';

type DialogState = {
  title: string;
  message?: string;
  actions: AppDialogAction[];
};

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const closeDialog = () => setDialog(null);

  const showDialog = (title: string, message: string, actions?: AppDialogAction[]) => {
    setDialog({
      title,
      message,
      actions: actions ?? [{ label: 'OK', tone: 'primary', onPress: closeDialog }],
    });
  };

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (userData) {
          const user = JSON.parse(userData);
          setName(user.name || '');
          setEmail(user.email || '');
          setProfilePicture(user.profilePicture || null);
        }
      } catch (error) {
        console.warn('[EditProfile] Failed to load user data:', error);
      }
    };
    loadUserData();
  }, []);

  const requestPermissions = async () => {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) {
      showDialog(
        'Permission needed',
        'Allow photo access to set your profile picture.'
      );
      return false;
    }
    return true;
  };

  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('[EditProfile] Error converting image to base64:', error);
      throw error;
    }
  };

  const pickImage = async () => {
    closeDialog();
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await launchImageLibrary({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Error picking image:', error);
      showDialog('Couldn’t pick image', 'Please try again.');
    }
  };

  const takePhoto = async () => {
    closeDialog();
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      showDialog(
        'Permission needed',
        'Allow camera access to take a profile photo.'
      );
      return;
    }

    try {
      const result = await launchCamera({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Error taking photo:', error);
      showDialog('Couldn’t take photo', 'Please try again.');
    }
  };

  const showImagePickerOptions = () => {
    setDialog({
      title: 'Change photo',
      message: 'Choose how you’d like to update your profile picture.',
      actions: [
        { label: 'Take photo', tone: 'primary', onPress: takePhoto },
        { label: 'Choose from library', tone: 'secondary', onPress: pickImage },
        ...(profilePicture
          ? [{
              label: 'Remove photo',
              tone: 'danger' as const,
              onPress: () => {
                setProfilePicture(null);
                closeDialog();
              },
            }]
          : []),
        { label: 'Cancel', tone: 'ghost', onPress: closeDialog },
      ],
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showDialog('Name required', 'Please enter your name before saving.');
      return;
    }

    setSaving(true);
    try {
      const userData = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (!userData) {
        showDialog('Session expired', 'Please sign in again.');
        return;
      }

      const user = JSON.parse(userData);
      const userId = user.id;

      if (!userId) {
        showDialog('Session expired', 'Please sign in again.');
        return;
      }

      let profilePictureBase64: string | null = null;
      if (profilePicture) {
        if (profilePicture.startsWith('data:image/')) {
          profilePictureBase64 = profilePicture;
        } else if (Platform.OS === 'web') {
          profilePictureBase64 = profilePicture;
        } else {
          try {
            profilePictureBase64 = await convertImageToBase64(profilePicture);
          } catch (error) {
            console.error('[EditProfile] Failed to convert image:', error);
            showDialog('Couldn’t process image', 'Please try another photo.');
            setSaving(false);
            return;
          }
        }
      }

      try {
        const response = await callApi<{ success: boolean; data: { user: any } }>(
          `/users/${userId}`,
          {
            method: 'PUT',
            body: {
              name: name.trim(),
              profilePicture: profilePictureBase64,
            },
          }
        );

        if (response.success && response.data?.user) {
          const updatedUser = {
            ...user,
            name: response.data.user.name || name.trim(),
            email: response.data.user.email || user.email,
            profilePicture: response.data.user.profilePicture || profilePictureBase64,
          };
          await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updatedUser));
          await AuthService.cacheProfilePicture(userId, updatedUser.profilePicture ?? null);

          setDialog({
            title: 'Profile updated',
            message: 'Your changes have been saved.',
            actions: [
              {
                label: 'Done',
                tone: 'primary',
                onPress: () => {
                  closeDialog();
                  router.back();
                },
              },
            ],
          });
        } else {
          throw new Error('Update failed');
        }
      } catch (apiError: any) {
        console.error('[EditProfile] API error:', apiError);
        const updatedUser = {
          ...user,
          name: name.trim(),
          email: email.trim() || user.email,
          profilePicture: profilePictureBase64,
        };
        await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updatedUser));
        await AuthService.cacheProfilePicture(userId, profilePictureBase64);
        setDialog({
          title: 'Saved on this device',
          message: 'Could not sync with the server. Check your connection — your photo is kept locally for now.',
          actions: [
            {
              label: 'OK',
              tone: 'primary',
              onPress: () => {
                closeDialog();
                router.back();
              },
            },
          ],
        });
      }
    } catch (error) {
      console.error('[EditProfile] Failed to save profile:', error);
      showDialog('Couldn’t save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon size={20} color={colors.accent} />
          <AppText variant="subtitle" color="accent" style={styles.backButtonText}>
            Back
          </AppText>
        </TouchableOpacity>
        <AppText variant="h3" color="textPrimary" style={styles.title}>
          Edit Profile
        </AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={showImagePickerOptions}
            activeOpacity={0.8}
          >
            {profilePicture ? (
              <Image 
                source={{ uri: profilePicture }} 
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <AppText variant="h2" color="surfacePrimary" style={styles.avatarText}>
                  {name 
                    ? name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : 'U'}
                </AppText>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <CameraIcon size={20} color={colors.surfacePrimary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={showImagePickerOptions} style={styles.changePhotoButton}>
            <AppText variant="label" color="accent" style={styles.changePhotoText}>
              Change Photo
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <AppText variant="label" color="textPrimary" style={styles.label}>
              Name
            </AppText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <AppText variant="label" color="textPrimary" style={styles.label}>
              Email
            </AppText>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={email}
              editable={false}
              placeholder="Email cannot be changed"
              placeholderTextColor="#999"
            />
            <AppText variant="caption" color="textMuted" style={styles.helperText}>
              Email cannot be modified
            </AppText>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AppText variant="subtitle" color="surfacePrimary" style={styles.saveButtonText}>
              Save Changes
            </AppText>
          )}
        </TouchableOpacity>
      </ScrollView>

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? spacing.xxxl : spacing.xxl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 60,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    ...shadows.lg,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '700',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surfacePrimary,
  },
  changePhotoButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  changePhotoText: {
    fontSize: 14,
  },
  formSection: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePrimary,
  },
  inputDisabled: {
    backgroundColor: colors.surfaceSecondary,
    color: colors.textMuted,
  },
  helperText: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    ...shadows.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
