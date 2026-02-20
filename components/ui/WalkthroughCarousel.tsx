// compact walkthrough carousel for create-league and similar flows
// ref: https://reactnativecomponents.com/components/walkthrough/fancy-carousel
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../Themed';
import { useAppTheme } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HORZ_PADDING = 4;

export type WalkthroughSlide = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
};

type Props = {
  slides: WalkthroughSlide[];
  cardWidth?: number;
  onLayout?: (width: number) => void;
  /** When set, cards are selectable and this id is highlighted */
  selectedId?: string | null;
  /** When set with selectedId, tapping a card calls this with the slide id */
  onSelect?: (id: string) => void;
};

export function WalkthroughCarousel({ slides, cardWidth: cardWidthProp, onLayout, selectedId, onSelect }: Props) {
  const t = useAppTheme();
  const isSelectable = onSelect != null;
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH - 2 * (t.spacing?.lg ?? 24));
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const cardWidth = cardWidthProp ?? Math.min(layoutWidth - HORZ_PADDING * 2, 260);
  const totalWidth = cardWidth + CARD_GAP;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: totalWidth,
      offset: totalWidth * index,
      index,
    }),
    [totalWidth]
  );

  const onContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) {
        setLayoutWidth(w);
        onLayout?.(w);
      }
    },
    [onLayout]
  );

  // update active index from scroll position for dot indicators
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / totalWidth);
    setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
  }, [slides.length, totalWidth]);

  if (!slides.length) return null;

  return (
    <View style={styles.wrapper} onLayout={onContainerLayout}>
      <FlatList
        ref={flatRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled={false}
        snapToInterval={totalWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: HORZ_PADDING }]}
        onScroll={onScroll}
        scrollEventThrottle={32}
        renderItem={({ item }) => {
          const selected = selectedId != null && item.id === selectedId;
          const cardStyle = [
            styles.card,
            {
              width: cardWidth,
              marginRight: CARD_GAP,
              backgroundColor: selected
                ? (t.scheme === 'dark' ? t.colors.tint + '25' : t.colors.tint + '15')
                : t.scheme === 'dark'
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? t.colors.tint : t.colors.borderStrong,
            },
          ];
          const content = (
            <>
              {item.icon ? (
                <Text style={styles.icon}>{item.icon}</Text>
              ) : null}
              <Text
                style={[styles.title, { color: selected ? t.colors.tint : t.colors.text }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {item.description ? (
                <Text style={[styles.description, { color: t.colors.mutedText }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </>
          );
          if (isSelectable) {
            return (
              <Pressable
                onPress={() => onSelect(item.id)}
                style={cardStyle}
                accessibilityRole="button"
                accessibilityState={{ selected: selected }}
              >
                {content}
              </Pressable>
            );
          }
          return <View style={cardStyle}>{content}</View>;
        }}
      />
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === activeIndex ? t.colors.tint : t.colors.borderStrong,
                opacity: i === activeIndex ? 1 : 0.5,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  listContent: {
    paddingVertical: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 72,
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
