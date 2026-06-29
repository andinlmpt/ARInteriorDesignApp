/**
 * Notification Service (Mocked for Expo Go compatibility)
 * Push notifications have been removed so the app runs cleanly in Expo Go.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_STORAGE_KEY = 'settings_notifications';

interface NotificationData {
  type?: string;
  roomName?: string;
  projectName?: string;
  [key: string]: unknown;
}

interface NotificationTrigger {
  seconds?: number;
  hour?: number;
  minute?: number;
  repeats?: boolean;
  type?: 'timeInterval' | 'date' | 'calendar';
  [key: string]: unknown;
}

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    console.log('[NotificationService] (Mock) requestPermissions called');
    return true;
  }

  static async isEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      return value === 'true';
    } catch (error) {
      return false;
    }
  }

  static async hasPermission(): Promise<boolean> {
    return true;
  }

  static async scheduleNotification(
    title: string,
    body: string,
    data?: NotificationData,
    trigger?: NotificationTrigger
  ): Promise<string | null> {
    console.log(`[NotificationService] (Mock) scheduleNotification: ${title} - ${body}`, data);
    return 'mock-notification-id';
  }

  static async sendDesignRecommendation(roomName?: string): Promise<void> {
    await this.scheduleNotification(
      'Design Recommendation',
      `New design ideas available for ${roomName || 'your room'}. Tap to explore!`,
      { type: 'design_recommendation', roomName },
      { seconds: 5 }
    );
  }

  static async sendProjectUpdate(projectName: string): Promise<void> {
    await this.scheduleNotification(
      'Project Update',
      `Your project "${projectName}" has been updated.`,
      { type: 'project_update', projectName },
      { seconds: 5 }
    );
  }

  static async scheduleDailyInspiration(): Promise<void> {
    console.log('[NotificationService] (Mock) scheduleDailyInspiration called');
  }

  static async cancelAllNotifications(): Promise<void> {
    console.log('[NotificationService] (Mock) cancelAllNotifications called');
  }

  static async cancelNotification(notificationId: string): Promise<void> {
    console.log(`[NotificationService] (Mock) cancelNotification called for ${notificationId}`);
  }

  static async getScheduledNotifications(): Promise<any[]> {
    return [];
  }

  static setupListeners(
    onNotificationReceived?: (notification: any) => void,
    onNotificationTapped?: (response: any) => void
  ): () => void {
    console.log('[NotificationService] (Mock) setupListeners called');
    return () => {};
  }
}

export default NotificationService;
