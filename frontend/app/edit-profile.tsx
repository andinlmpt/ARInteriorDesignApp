import { View, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthService from '@/services/AuthService';
import { AUTH_USER_STORAGE_KEY } from '@/data/authData';
import { callApi } from '@/services/apiClient';
import { colors, radii, shadows, spacing } from '@/components/ui/theme';
import { AppText } from '@/components/ui/Text';
import { AppDialog, type AppDialogAction } from '@/components/ui/AppDialog';
import { PhotoPickerSheet } from '@/components/ui/PhotoPickerSheet';
import { BackIcon, CameraIcon } from '@/components/ui/Icons';
import { launchImageLibrary, launchCamera, requestMediaLibraryPermissions, requestCameraPermissions } from '@/utils/imagePicker';
import {
  reclaimProfilePictureStorage,
  removeLocalProfilePicture,
  saveProfilePictureLocally,
  toProfilePictureDataUrl,
} from '@/utils/profilePictureStorage';

type DialogState = {
  title: string;
  message?: string;
  actions: AppDialogAction[];
};

/** Keep picks small so base64 uploads stay under AsyncStorage / API limits. */
const PICKER_QUALITY = 0.45;

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);

  const closeDialog = () => setDialog(null);
  const closePhotoSheet = () => setPhotoSheetVisible(false);

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
        // Migrate any bloated base64 photos out of SQLite before edits.
        await reclaimProfilePictureStorage();

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

  const pickImage = async () => {
    closePhotoSheet();
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await launchImageLibrary({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: PICKER_QUALITY,
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
    closePhotoSheet();
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
        quality: PICKER_QUALITY,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Error taking photo:', error);
      showDialog('Couldn’t take photo', 'Please try again.');
    }
  };

  const removePhoto = () => {
    setProfilePicture(null);
    closePhotoSheet();
  };

  const showImagePickerOptions = () => {
    setPhotoSheetVisible(true);
  };

  const persistLocalUser = async (
    user: Record<string, unknown>,
    userId: string,
    updates: { name: string; email?: string; profilePicture: string | null }
  ) => {
    let localPicture = updates.profilePicture;
    if (localPicture) {
      localPicture = await saveProfilePictureLocally(userId, localPicture);
    } else {
      await removeLocalProfilePicture(userId);
    }

    const updatedUser = {
      ...user,
      name: updates.name,
      email: updates.email || user.email,
      profilePicture: localPicture,
    };

    const write = async () => {
      await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updatedUser));
      await AuthService.cacheProfilePicture(userId, localPicture);
    };

    try {
      await write();
    } catch (storageError) {
      const message = storageError instanceof Error ? storageError.message : String(storageError);
      if (/SQLITE_FULL|disk is full|database or disk is full/i.test(message)) {
        await reclaimProfilePictureStorage(userId);
        await write();
      } else {
        throw storageError;
      }
    }

    return updatedUser;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showDialog('Name required', 'Please enter your name before saving.');
      return;
    }

    setSaving(true);
    try {
      // Free space from any old base64 blobs before writing again.
      await reclaimProfilePictureStorage();

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

      let profilePictureForApi: string | null = null;
      if (profilePicture) {
        try {
          profilePictureForApi = await toProfilePictureDataUrl(profilePicture);
        } catch (error) {
          console.error('[EditProfile] Failed to convert image:', error);
          showDialog(
            'Couldn’t process image',
            error instanceof Error ? error.message : 'Please try another photo.'
          );
          setSaving(false);
          return;
        }
      }

      try {
        const response = await callApi<{ success: boolean; data: { user: any } }>(
          `/users/${userId}`,
          {
            method: 'PUT',
            body: {
              name: name.trim(),
              profilePicture: profilePictureForApi,
            },
          }
        );

        if (response.success && response.data?.user) {
          const serverPicture =
            response.data.user.profilePicture || profilePictureForApi || profilePicture;
          await persistLocalUser(user, userId, {
            name: response.data.user.name || name.trim(),
            email: response.data.user.email || user.email,
            profilePicture: serverPicture ?? null,
          });

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
        await persistLocalUser(user, userId, {
          name: name.trim(),
          email: email.trim() || user.email,
          profilePicture: profilePictureForApi || profilePicture,
        });
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
      const message = error instanceof Error ? error.message : String(error);
      if (/SQLITE_FULL|disk is full|database or disk is full/i.test(message)) {
        await reclaimProfilePictureStorage();
        showDialog(
          'Storage was full',
          'Cleared old cached photos. Please try saving again with a smaller picture.'
        );
      } else {
        showDialog('Couldn’t save', 'Please try again.');
      }
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

      <PhotoPickerSheet
        visible={photoSheetVisible}
        hasPhoto={!!profilePicture}
        onClose={closePhotoSheet}
        onTakePhoto={takePhoto}
        onChooseLibrary={pickImage}
        onRemovePhoto={removePhoto}
      />

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
