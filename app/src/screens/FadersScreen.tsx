import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDmxStore } from '../store/dmxStore';
import { Fader } from '../components/Fader';
import { PageIndicator } from '../components/PageIndicator';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { colors, typography } from '../utils/theme';
import { t } from '../utils/i18n';

interface PageData {
  index: number;
  startChannel: number;
  count: number;
}

export function FadersScreen() {
  const channels = useDmxStore((s) => s.channels);
  const settings = useDmxStore((s) => s.settings);
  const connection = useDmxStore((s) => s.connection);
  const setChannel = useDmxStore((s) => s.setChannel);
  const blackout = useDmxStore((s) => s.blackout);
  const fullOnIndices = useDmxStore((s) => s.fullOnIndices);
  const updateSetting = useDmxStore((s) => s.updateSetting);
  const highlightedChannels = useDmxStore((s) => s.highlightedChannels);
  const channelToFixture = useDmxStore((s) => s.channelToFixture);

  const { fadersPerPage, lang, showPercent } = settings;
  const perPage = Math.max(4, Math.min(64, fadersPerPage));
  const totalPages = Math.ceil(512 / perPage);

  const pages = useMemo<PageData[]>(() => {
    const out: PageData[] = [];
    for (let i = 0; i < totalPages; i++) {
      const start = i * perPage + 1;
      const count = Math.min(perPage, 512 - i * perPage);
      out.push({ index: i, startChannel: start, count });
    }
    return out;
  }, [perPage, totalPages]);

  const [page, setPage] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const listRef = useRef<FlatList<PageData>>(null);
  const windowWidth = Dimensions.get('window').width;

  const goPage = (next: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, next));
    if (clamped === page) return;
    setPage(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    Haptics.selectionAsync().catch(() => {});
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setPage(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const handleBlackout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    blackout();
  };

  const handleFullPage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const data = pages[page];
    if (!data) return;
    const indices: number[] = [];
    for (let i = 0; i < data.count; i++) {
      indices.push(data.startChannel - 1 + i);
    }
    fullOnIndices(indices);
  };

  const highlightSet = useMemo(() => new Set(highlightedChannels), [highlightedChannels]);

  const renderPage = ({ item }: { item: PageData }) => {
    const faders: React.ReactNode[] = [];
    for (let i = 0; i < item.count; i++) {
      const ch = item.startChannel + i;
      const idx = ch - 1;
      const resolved = channelToFixture.get(ch);
      faders.push(
        <Fader
          key={ch}
          channel={ch}
          value={channels[idx]}
          highlighted={highlightSet.has(ch)}
          showPercent={showPercent}
          onChange={(v) => setChannel(idx, v)}
          fixtureName={resolved?.fixtureName}
          paramType={resolved?.parameter.type}
          paramLabel={resolved?.parameter.name}
        />,
      );
    }
    return (
      <View style={[styles.page, { width: windowWidth, height: listHeight }]}>
        <View style={styles.fadersRow}>{faders}</View>
      </View>
    );
  };

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        // measure total screen height then subtract header (~54) + pageIndicator (~54) + actionRow (~72)
        const h = e.nativeEvent.layout.height;
        setListHeight(Math.max(100, h - 54 - 54 - 72));
      }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t(lang, 'faders')}</Text>
        <Pressable
          onPress={() => updateSetting('showPercent', !showPercent)}
          style={({ pressed }) => [styles.toggleBtn, pressed && styles.toggleBtnPressed]}
        >
          <Text style={styles.toggleLabel}>
            {showPercent ? t(lang, 'showAsBytes') : t(lang, 'showAsPercent')}
          </Text>
        </Pressable>
        <ConnectionStatus state={connection} lang={lang} />
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        style={[styles.list, listHeight > 0 && { height: listHeight }]}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => `page-${p.index}`}
        renderItem={renderPage}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: windowWidth,
          offset: windowWidth * index,
          index,
        })}
        contentContainerStyle={{ flexGrow: 1 }}
        initialNumToRender={2}
        windowSize={3}
        removeClippedSubviews
      />

      <PageIndicator
        page={page + 1}
        total={totalPages}
        lang={lang}
        onPrev={() => goPage(page - 1)}
        onNext={() => goPage(page + 1)}
      />

      <View style={styles.actionRow}>
        <Pressable
          onPress={handleFullPage}
          style={({ pressed }) => [styles.fullBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.fullLabel}>{t(lang, 'full')}</Text>
        </Pressable>
        <Pressable
          onPress={handleBlackout}
          style={({ pressed }) => [styles.blackoutBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.blackoutLabel}>{t(lang, 'blackout')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnPressed: {
    opacity: 0.8,
  },
  toggleLabel: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.text,
  },
  list: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  fadersRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  fullBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  fullLabel: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  blackoutBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  blackoutLabel: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
