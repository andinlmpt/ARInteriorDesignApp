if (selection.step === 'results' && uiWithResults.resultsData) {
    const {
      topTheme,
      alternativeThemes,
      materials,
      decorItems,
      moodScore,
      styleScore,
      roomScore,
      confidenceValue,
      totalAnalyzed,
      processingTimeSeconds,
    } = uiWithResults.resultsData;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        {ui.isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📥 Offline Mode</Text>
          </View>
        )}

        <View style={[styles.header, { backgroundColor: colors.surfacePrimary, borderBottomColor: colors.border }]}>
          <AnimatedButton onPress={selection.resetSelection} hapticType="light">
            <Text style={[styles.backButton, { color: colors.accent }]}>← Start Over</Text>
          </AnimatedButton>
          <FadeInView delay={100}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Your Themes</Text>
          </FadeInView>
          <AnimatedButton
            style={[styles.headerButton, { backgroundColor: colors.surfaceSecondary }, uiWithResults.comparisonMode && { backgroundColor: colors.success }]}
            onPress={() => uiWithResults.setComparisonMode(!uiWithResults.comparisonMode)}
            hapticType="light"
          >
            <Text style={styles.headerButtonText}>👑</Text>
          </AnimatedButton>
        </View>

        {/* Breadcrumb Navigation */}
        <View style={[styles.breadcrumbContainer, { backgroundColor: colors.surfacePrimary }]}>
          <AnimatedButton style={styles.breadcrumbItem} onPress={() => { selection.setStep('room'); selection.resetSelection(); }} hapticType="light">
            <Text style={styles.breadcrumbText}>Room</Text>
          </AnimatedButton>
          <Text style={styles.breadcrumbSeparator}>→</Text>
          <AnimatedButton style={styles.breadcrumbItem} onPress={() => selection.setStep('mood')} hapticType="light">
            <Text style={styles.breadcrumbText}>Mood</Text>
          </AnimatedButton>
          <Text style={styles.breadcrumbSeparator}>→</Text>
          <AnimatedButton style={styles.breadcrumbItem} onPress={() => selection.setStep('style')} hapticType="light">
            <Text style={styles.breadcrumbText}>Style</Text>
          </AnimatedButton>
          <Text style={styles.breadcrumbSeparator}>→</Text>
          <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>Results</Text>
        </View>

        {recommendations.error && (
          <View style={[
            styles.errorBanner,
            recommendations.error.includes('offline') || recommendations.error.includes('backend')
              ? styles.infoBanner
              : null
          ]}>
            <Text style={styles.errorText}>{recommendations.error}</Text>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={uiWithResults.refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
          }
        >
          <View style={styles.content}>
            {/* User Selections Summary */}
            {selection.selectedRoom && selection.selectedMood && selection.selectedStyle && (
              <View style={[styles.userChoicesCard, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
                <Text style={[styles.userChoicesTitle, { color: colors.textSecondary }]}>Your Selections</Text>
                <View style={styles.userChoicesRow}>
                  <View style={[styles.userChoiceBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={styles.userChoiceEmoji}>{ROOM_EMOJIS[selection.selectedRoom]}</Text>
                    <Text style={[styles.userChoiceText, { color: colors.textPrimary }]}>{selection.selectedRoom}</Text>
                  </View>
                  <Text style={[styles.userChoiceArrow, { color: colors.textMuted }]}>→</Text>
                  <View style={[styles.userChoiceBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={styles.userChoiceEmoji}>{MOOD_EMOJIS[selection.selectedMood]}</Text>
                    <Text style={[styles.userChoiceText, { color: colors.textPrimary }]}>{selection.selectedMood}</Text>
                  </View>
                  <Text style={[styles.userChoiceArrow, { color: colors.textMuted }]}>→</Text>
                  <View style={[styles.userChoiceBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={styles.userChoiceEmoji}>{STYLE_EMOJIS[selection.selectedStyle]}</Text>
                    <Text style={[styles.userChoiceText, { color: colors.textPrimary }]}>{selection.selectedStyle}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Stats Dashboard */}
            {uiWithResults.showThemeStats && (
              <View style={styles.statsDashboard}>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>🎯</Text>
                    <Text style={styles.statValue}>{confidenceValue}%</Text>
                    <Text style={styles.statLabel}>Match</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>😊</Text>
                    <Text style={styles.statValue}>{Math.round(moodScore)}</Text>
                    <Text style={styles.statLabel}>Mood</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>🎨</Text>
                    <Text style={styles.statValue}>{Math.round(styleScore)}</Text>
                    <Text style={styles.statLabel}>Style</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>🏠</Text>
                    <Text style={styles.statValue}>{Math.round(roomScore)}</Text>
                    <Text style={styles.statLabel}>Room</Text>
                  </View>
                </View>
                <Text style={styles.statsInfo}>✅ Analyzed {totalAnalyzed} themes in {processingTimeSeconds}s</Text>
              </View>
            )}

            {/* Top Theme Card */}
            <View style={[styles.topThemeCard, { backgroundColor: colors.surfacePrimary, borderColor: colors.accent }]}>
              <View style={styles.bestBadge}>
                <Text style={[styles.bestBadgeText, { color: colors.textPrimary }]}>⭐ BEST MATCH</Text>
              </View>

              <Text style={[styles.topThemeTitle, { color: colors.textPrimary }]}>{topTheme?.name ?? 'Unknown Theme'}</Text>
              <Text style={[styles.topThemeDescription, { color: colors.textSecondary }]}>{topTheme?.description ?? 'No description'}</Text>

              <View style={[styles.confidenceContainer, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.confidenceLabel, { color: colors.textPrimary }]}>Match Confidence</Text>
                <Text style={[styles.confidenceValue, { color: colors.accent }]}>{confidenceValue}%</Text>
              </View>

              {/* Color Palette */}
              <View style={styles.colorPaletteSection}>
                <Text style={styles.sectionLabel}>Color Palette</Text>
                <View style={styles.colorPalette}>
                  {colorPaletteMemoized.map((color, idx) => (
                    <ScaleInView key={`${color}-${idx}`} delay={idx * 50}>
                      <AnimatedButton
                        style={[styles.colorSwatch, { backgroundColor: color }]}
                        onPress={() => uiWithResults.copyColorToClipboard(color)}
                        accessibilityLabel={`Color swatch ${idx + 1}: ${color}`}
                        accessibilityRole="button"
                        accessibilityHint="Double tap to copy color code to clipboard"
                        hapticType="light"
                      >
                        <View />
                      </AnimatedButton>
                    </ScaleInView>
                  ))}
                </View>
              </View>

              {/* Materials */}
              {materials.length > 0 && (
                <View style={styles.materialSection}>
                  <Text style={styles.sectionLabel}>Materials</Text>
                  <Text style={styles.materialText}>{materials.join(', ')}</Text>
                </View>
              )}

              {/* Decor Items */}
              {decorItems.length > 0 && (
                <View style={styles.decorSection}>
                  <Text style={styles.sectionLabel}>Decor Items</Text>
                  <Text style={styles.decorText}>{decorItems.slice(0, CONFIG.MAX_DECOR_ITEMS_DISPLAY).join(', ')}</Text>
                </View>
              )}

              {/* Generated Image */}
              {imageGeneration.generatedImages.has(topTheme.id) && (
                <View style={styles.generatedImageContainer}>
                  <Image
                    source={{ uri: imageGeneration.generatedImages.get(topTheme.id)?.imageUrl }}
                    style={styles.generatedImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Actions */}
              <View style={styles.themeActions} accessibilityRole="toolbar">
                <AnimatedButton
                  style={[styles.likeButton, likes.likedThemes.has(topTheme.id) && styles.likeButtonActive]}
                  onPress={() => likes.handleLikeTheme(topTheme.id, topTheme)}
                  accessibilityLabel={likes.likedThemes.has(topTheme.id) ? 'Unlike theme' : 'Like theme'}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to like or unlike this theme"
                  hapticType="light"
                >
                  <Text style={styles.likeButtonText}>
                    {likes.likedThemes.has(topTheme.id) ? '❤️' : '🤍'}
                  </Text>
                </AnimatedButton>

                <AnimatedButton
                  style={[styles.generateImageButton, imageGeneration.isGeneratingImage === topTheme.id && styles.buttonDisabled]}
                  onPress={() => imageGeneration.handleGenerateImage(topTheme)}
                  disabled={imageGeneration.isGeneratingImage === topTheme.id}
                  accessibilityLabel="Generate image"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: imageGeneration.isGeneratingImage === topTheme.id }}
                  accessibilityHint="Double tap to generate an image preview for this theme"
                  hapticType="medium"
                >
                  {imageGeneration.isGeneratingImage === topTheme.id ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.generateImageButtonText}>🖼️ Generate Image</Text>
                  )}
                </AnimatedButton>

                <AnimatedButton
                  style={styles.applyButton}
                  onPress={() => handleApplyTheme(topTheme)}
                  accessibilityLabel="Apply theme to design"
                  accessibilityRole="button"
                  accessibilityHint="Double tap to apply this theme to your design project"
                  hapticType="success"
                >
                  <Text style={styles.applyButtonText}>✨ Apply Theme</Text>
                </AnimatedButton>
              </View>
            </View>

            {/* Custom Design Input Section */}
            <View style={[styles.customDesignSection, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>✨ Create Your Own Design</Text>
              <Text style={[styles.customDesignSubtitle, { color: colors.textSecondary }]}>
                Type your design idea and we'll generate a picture for you!
              </Text>
              <TextInput
                style={[styles.customDesignInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="E.g., A cozy living room with a fireplace, modern furniture, and warm lighting..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={imageGeneration.customDesignText}
                onChangeText={imageGeneration.setCustomDesignText}
                accessibilityLabel="Custom design description input"
                accessibilityHint="Type your design idea here"
              />
              <AnimatedButton
                style={[
                  styles.generateCustomImageButton,
                  { backgroundColor: colors.accent },
                  (imageGeneration.isGeneratingCustomImage || !imageGeneration.customDesignText?.trim()) && styles.buttonDisabled
                ]}
                onPress={() => imageGeneration.handleGenerateCustomDesign()}
                disabled={imageGeneration.isGeneratingCustomImage || !imageGeneration.customDesignText?.trim()}
                accessibilityLabel="Generate image from custom design"
                accessibilityRole="button"
                accessibilityState={{ disabled: imageGeneration.isGeneratingCustomImage || !imageGeneration.customDesignText?.trim() }}
                hapticType="medium"
              >
                {imageGeneration.isGeneratingCustomImage ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.generateCustomImageButtonText}>Generating...</Text>
                  </>
                ) : (
                  <Text style={styles.generateCustomImageButtonText}>🎨 Generate Image</Text>
                )}
              </AnimatedButton>

              {/* Display generated custom image */}
              {imageGeneration.customDesignImage && (
                <View style={styles.customImageContainer}>
                  <Image
                    source={{ uri: imageGeneration.customDesignImage }}
                    style={styles.customGeneratedImage}
                    resizeMode="cover"
                    accessibilityLabel="Generated image from your custom design"
                  />
                  <TouchableOpacity
                    style={styles.removeCustomImageButton}
                    onPress={() => imageGeneration.clearCustomDesignImage()}
                    accessibilityLabel="Remove custom design image"
                    accessibilityRole="button"
                  >
                    <Text style={styles.removeCustomImageButtonText}>✕</Text>
                  </TouchableOpacity>
                  {imageGeneration.customDesignAttribution && (
                    <View style={styles.attributionContainer}>
                      <Text style={styles.attributionText}>
                        Photo by {imageGeneration.customDesignAttribution.photographer || 'Unknown'} on{' '}
                        {imageGeneration.customDesignAttribution.source || 'Pexels'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Alternative Themes */}
            {alternativeThemes.length > 0 && (
              <View style={styles.alternativesSection} accessibilityLabel="Alternative theme recommendations">
                <Text style={styles.sectionTitle}>Alternative Themes</Text>
                <FlatList
                  horizontal
                  data={alternativeThemes}
                  keyExtractor={(item, index) => `${item.id}-${index}`}
                  renderItem={({ item }) => (
                    <AlternativeThemeCard
                      theme={item}
                      comparisonMode={uiWithResults.comparisonMode}
                      isSelected={uiWithResults.selectedThemesForComparison.includes(item.id)}
                      onPress={() => handleApplyTheme(item)}
                      onToggleComparison={() => {
                        const current = uiWithResults.selectedThemesForComparison;
                        if (current.includes(item.id)) {
                          uiWithResults.setSelectedThemesForComparison(current.filter(id => id !== item.id));
                        } else {
                          uiWithResults.setSelectedThemesForComparison([...current, item.id]);
                        }
                      }}
                    />
                  )}
                  showsHorizontalScrollIndicator={false}
                  getItemLayout={(_, index) => ({
                    length: ALTERNATIVE_THEME_ITEM_HEIGHT,
                    offset: ALTERNATIVE_THEME_ITEM_HEIGHT * index,
                    index,
                  })}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                  initialNumToRender={3}
                  accessibilityLabel="Alternative theme recommendations"
                />
              </View>
            )}

            {/* History Section */}
            {filteredHistory.length > 0 && (
              <View style={styles.historySection}>
                <View style={styles.historyHeader}>
                  <Text style={styles.sectionTitle}>Recent Themes</Text>
                  <TouchableOpacity
                    style={styles.historyFilterButton}
                    onPress={() => uiWithResults.setShowHistoryFilters(!uiWithResults.showHistoryFilters)}
                  >
                    <Text style={styles.historyFilterButtonText}>🔍 Filter</Text>
                  </TouchableOpacity>
                </View>

                {uiWithResults.showHistoryFilters && (
                  <View style={styles.historyFilters}>
                    <TextInput
                      style={styles.historySearchInput}
                      placeholder="Search themes..."
                      value={uiWithResults.searchQuery}
                      onChangeText={uiWithResults.setSearchQuery}
                    />
                    <View style={styles.historySortRow}>
                      <Text style={styles.historySortLabel}>Sort:</Text>
                      {(['date', 'confidence', 'likes'] as const).map(sort => (
                        <TouchableOpacity
                          key={sort}
                          style={[styles.historySortChip, uiWithResults.historySortBy === sort && styles.historySortChipActive]}
                          onPress={() => uiWithResults.setHistorySortBy(sort)}
                        >
                          <Text style={styles.historySortChipText}>{sort}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filteredHistory.map((theme, idx) => (
                    <TouchableOpacity
                      key={`${theme.topTheme.id}-${idx}`}
                      style={[
                        styles.historyCard,
                        likes.likedThemes.has(theme.topTheme.id) && styles.historyCardLiked,
                      ]}
                      onPress={() => {
                        recommendations.setRecommendationOutput(theme);
                        selection.setStep('results');
                      }}
                    >
                      <Text style={styles.historyCardTitle}>{theme.topTheme.name}</Text>
                      <Text style={styles.historyCardConfidence}>
                        {getConfidencePercentage(theme.topTheme.confidence)}% match
                      </Text>
                      <View style={styles.historyCardColors}>
                        {getArrayValue(theme.topTheme.colorPalette).slice(0, 3).map((color, cidx) => (
                          <View
                            key={`${color}-${cidx}`}
                            style={[styles.historyColorDot, { backgroundColor: color as string }]}
                          />
                        ))}
                      </View>
                      {likes.likedThemes.has(theme.topTheme.id) && (
                        <Text style={styles.historyLikedBadge}>❤️</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Actions */}
            <SlideInView direction="bottom" delay={200}>
              <View style={styles.resultActions}>
                <AnimatedButton style={styles.retakeButton} onPress={selection.resetSelection} hapticType="medium">
                  <Text style={styles.retakeButtonText}>🔁 Try Different Mood</Text>
                </AnimatedButton>
                <AnimatedButton
                  style={styles.collectionsButton}
                  onPress={() => collections.setShowCollectionsModal(true)}
                  hapticType="light"
                >
                  <Text style={styles.collectionsButtonText}>📁 My Collections</Text>
                </AnimatedButton>
              </View>
            </SlideInView>
          </View>
        </ScrollView>

        {/* Collections Modal */}
        <Modal
          visible={collections.showCollectionsModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Collections</Text>
              <TouchableOpacity onPress={() => collections.setShowCollectionsModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {collections.collections.map(collection => (
                <View key={collection.id} style={styles.collectionCard}>
                  <Text style={styles.collectionName}>{collection.name}</Text>
                  <Text style={styles.collectionCount}>{collection.themes.length} themes</Text>
                  <View style={styles.collectionActions}>
                    <TouchableOpacity
                      onPress={() => collections.addThemeToCollection(topTheme, collection.id)}
                    >
                      <Text style={styles.collectionActionText}>+ Add Current</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => collections.exportCollectionAsPDF(collection)}>
                      <Text style={styles.collectionActionText}>📤 Export</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => collections.deleteCollection(collection.id)}>
                      <Text style={[styles.collectionActionText, styles.deleteText]}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={styles.createCollectionButton}
                onPress={() => collections.setShowCreateCollectionModal(true)}
              >
                <Text style={styles.createCollectionButtonText}>+ Create New Collection</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Create Collection Modal */}
        <Modal
          visible={collections.showCreateCollectionModal}
          animationType="fade"
          transparent
        >
          <View style={styles.createModalOverlay}>
            <View style={styles.createModalContent}>
              <Text style={styles.createModalTitle}>New Collection</Text>
              <TextInput
                style={styles.createModalInput}
                placeholder="Collection name"
                value={collections.newCollectionName}
                onChangeText={collections.setNewCollectionName}
              />
              <TextInput
                style={[styles.createModalInput, styles.createModalInputMultiline]}
                placeholder="Description (optional)"
                value={collections.newCollectionDescription}
                onChangeText={collections.setNewCollectionDescription}
                multiline
              />
              <View style={styles.createModalActions}>
                <TouchableOpacity
                  style={styles.createModalCancel}
                  onPress={() => router.push('/')}
                >
                  <Text style={styles.createModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createModalConfirm}
                  onPress={collections.createCollection}
                  disabled={collections.isSavingCollection}
                >
                  {collections.isSavingCollection ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createModalConfirmText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  