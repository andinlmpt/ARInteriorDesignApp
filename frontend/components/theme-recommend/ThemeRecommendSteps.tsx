import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { AnimatedButton, FadeInView, SlideInView } from '@/components/interactive';
import { OptionCard, BudgetSelector } from '@/components/theme-recommend';
import { ROOM_TYPES, ROOM_EMOJIS, DESIGN_MOODS, MOOD_EMOJIS, DESIGN_STYLES, STYLE_EMOJIS } from '@/config/themeRecommend.config';
import { styles } from '@/app/theme-recommend.styles';

export function ThemeRecommendSteps({
  selection,
  uiWithResults,
  recommendations,
  ui,
  colors,
  statusBarStyle,
  handleBudgetSelect,
  router
}: any) {
  // =========================================================================
  // SELECTION STEPS (Room, Mood, Style, Budget)
  // =========================================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      {ui.isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📥 Offline Mode</Text>
        </View>
      )}

      <View style={[styles.header, { backgroundColor: colors.surfacePrimary, borderBottomColor: colors.border }]}>
        <AnimatedButton onPress={() => router.push('/')} hapticType="light">
          <Text style={[styles.backButton, { color: colors.accent }]}>← Back</Text>
        </AnimatedButton>
        <FadeInView delay={100}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Theme Finder</Text>
        </FadeInView>
        <AnimatedButton onPress={() => uiWithResults.setShowTutorial(true)} hapticType="light">
          <Text style={styles.helpButton}>❓</Text>
        </AnimatedButton>
      </View>

      {/* Progress Indicator */}
      <View style={[styles.progressContainer, { backgroundColor: colors.surfacePrimary }]}>
        {['room', 'mood', 'style', 'budget'].map((s, idx) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              { backgroundColor: colors.border },
              selection.step === s && { backgroundColor: colors.accent },
              ['room', 'mood', 'style', 'budget'].indexOf(selection.step) > idx && { backgroundColor: colors.success },
            ]}
          />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.content}>
          {/* ROOM SELECTION */}
          {selection.step === 'room' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select Your Room</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>What space are you designing?</Text>
              <View style={styles.optionsGrid}>
                {ROOM_TYPES.map(room => (
                  <OptionCard
                    key={room}
                    value={room}
                    emoji={ROOM_EMOJIS[room]}
                    label={room}
                    isSelected={selection.selectedRoom === room}
                    hasFeedback={selection.selectionFeedback?.type === 'room' && selection.selectionFeedback?.value === room}
                    onPress={() => selection.handleRoomSelect(room)}
                    accessibilityLabel={`Select ${room}`}
                  />
                ))}
              </View>
            </View>
          )}

          {/* MOOD SELECTION */}
          {selection.step === 'mood' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select Your Mood</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>What atmosphere do you want?</Text>
              <View style={styles.optionsGrid}>
                {DESIGN_MOODS.map(mood => (
                  <OptionCard
                    key={mood}
                    value={mood}
                    emoji={MOOD_EMOJIS[mood]}
                    label={mood}
                    isSelected={selection.selectedMood === mood}
                    hasFeedback={selection.selectionFeedback?.type === 'mood' && selection.selectionFeedback?.value === mood}
                    onPress={() => selection.handleMoodSelect(mood)}
                    accessibilityLabel={`Select ${mood} mood`}
                  />
                ))}
              </View>
              <AnimatedButton style={styles.backStepButton} onPress={() => selection.setStep('room')} hapticType="light">
                <Text style={[styles.backStepButtonText, { color: colors.accent }]}>← Change Room</Text>
              </AnimatedButton>
            </View>
          )}

          {/* STYLE SELECTION */}
          {selection.step === 'style' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select Your Style</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>What design style do you prefer?</Text>
              <View style={styles.optionsGrid}>
                {DESIGN_STYLES.map(style => (
                  <OptionCard
                    key={style}
                    value={style}
                    emoji={STYLE_EMOJIS[style]}
                    label={style}
                    isSelected={selection.selectedStyle === style}
                    hasFeedback={selection.selectionFeedback?.type === 'style' && selection.selectionFeedback?.value === style}
                    onPress={() => selection.handleStyleSelect(style)}
                    accessibilityLabel={`Select ${style} style`}
                  />
                ))}
              </View>
              <AnimatedButton style={styles.backStepButton} onPress={() => selection.setStep('mood')} hapticType="light">
                <Text style={[styles.backStepButtonText, { color: colors.accent }]}>← Change Mood</Text>
              </AnimatedButton>
            </View>
          )}

          {/* BUDGET SELECTION */}
          {selection.step === 'budget' && (
            <View style={styles.stepContainer}>
              <BudgetSelector
                selectedBudget={selection.selectedBudget}
                onSelect={handleBudgetSelect}
                disabled={recommendations.isGenerating}
              />
              <AnimatedButton style={styles.backStepButton} onPress={() => selection.setStep('style')} hapticType="light">
                <Text style={[styles.backStepButtonText, { color: colors.accent }]}>← Change Style</Text>
              </AnimatedButton>
            </View>
          )}

          {/* WELCOME STATE */}
          {selection.step === 'welcome' && (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeEmoji}>🎨</Text>
              <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>Find Your Perfect Theme</Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                Answer a few questions about your room, mood, and style preferences to get personalized theme recommendations.
              </Text>
              <SlideInView direction="bottom" delay={300}>
                <AnimatedButton
                  style={[styles.startButton, { backgroundColor: colors.accent }]}
                  onPress={() => selection.setStep('room')}
                  hapticType="success"
                >
                  <Text style={styles.startButtonText}>Get Started</Text>
                </AnimatedButton>
              </SlideInView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Tutorial Modal */}
      {uiWithResults.showTutorial && (
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialModal}>
            <View style={styles.tutorialHeader}>
              <Text style={styles.tutorialTitle}>
                {uiWithResults.getTutorialSteps()[uiWithResults.tutorialStep]?.emoji}{' '}
                {uiWithResults.getTutorialSteps()[uiWithResults.tutorialStep]?.title}
              </Text>
              <TouchableOpacity onPress={() => uiWithResults.setShowTutorial(false)}>
                <Text style={styles.tutorialCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tutorialDescription}>
              {uiWithResults.getTutorialSteps()[uiWithResults.tutorialStep]?.description}
            </Text>
            <View style={styles.tutorialProgress}>
              {uiWithResults.getTutorialSteps().map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tutorialDot,
                    idx === uiWithResults.tutorialStep && styles.tutorialDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.tutorialButtons}>
              {uiWithResults.tutorialStep > 0 && (
                <TouchableOpacity
                  style={styles.tutorialNavButton}
                  onPress={() => uiWithResults.setTutorialStep(uiWithResults.tutorialStep - 1)}
                >
                  <Text style={styles.tutorialNavText}>← Previous</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.tutorialNavButton, styles.tutorialNavButtonPrimary]}
                onPress={() => {
                  if (uiWithResults.tutorialStep < uiWithResults.getTutorialSteps().length - 1) {
                    uiWithResults.setTutorialStep(uiWithResults.tutorialStep + 1);
                  } else {
                    uiWithResults.setShowTutorial(false);
                  }
                }}
              >
                <Text style={styles.tutorialNavText}>
                  {uiWithResults.tutorialStep === uiWithResults.getTutorialSteps().length - 1 ? 'Done' : 'Next →'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );

}
