import React, { JSX, useRef, useState } from 'react';
import {
  FlatList,
  FlatListProps,
  Image,
  ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SvgProps } from 'react-native-svg';
import { getKnotImage } from '../assets/referenceImages';
import { COLORS } from '../theme';

interface KnotStepCarouselProps {
  images: string[];
}

// Account for outer horizontal padding (14px each side) to fill the card width
const CARD_PADDING = 28;

const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

/**
 * KnotStepCarousel renders a horizontally swipeable carousel of knot diagrams.
 *
 * Each page shows one image — either a high-quality static WebP sourced from
 * Wikimedia Commons (preferred) or a fallback SVG component. Step indicator
 * dots below the carousel show the current position.
 *
 * If a key has no corresponding image in the asset registry, that entry is
 * skipped gracefully. If no images resolve, the carousel renders nothing.
 *
 * @param images - Array of referenceImages keys.
 * @returns {JSX.Element | null} The rendered carousel, or null if no images resolve.
 */
export default function KnotStepCarousel({
  images,
}: KnotStepCarouselProps): JSX.Element | null {
  const { width: screenWidth } = useWindowDimensions();
  const itemWidth = screenWidth - CARD_PADDING;
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<string>>(null);

  const onViewableItemsChanged = useRef<
    NonNullable<FlatListProps<string>['onViewableItemsChanged']>
  >(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  // Filter to only keys that have a matching image (WebP or SVG)
  const resolvedKeys = images.filter((key) => !!getKnotImage(key));
  const total = resolvedKeys.length;

  if (total === 0) return null;

  const renderItem = ({ item, index }: { item: string; index: number }) => {
    const source = getKnotImage(item);
    if (!source) return null;

    if (source.type === 'static') {
      return (
        <View style={[styles.slide, { width: itemWidth }]}>
          <Image
            source={source.value as ImageSourcePropType}
            style={[styles.staticImage, { width: itemWidth - 24 }]}
            resizeMode="contain"
            accessibilityLabel={`Knot diagram, image ${index + 1} of ${total}`}
          />
        </View>
      );
    }

    // SVG fallback
    const SvgComponent = source.value as React.FC<SvgProps>;
    return (
      <View style={[styles.slide, { width: itemWidth }]}>
        <SvgComponent
          width="100%"
          height={200}
          accessibilityLabel={`Knot diagram, image ${index + 1} of ${total}`}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={resolvedKeys}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_data, index) => ({
          length: itemWidth,
          offset: itemWidth * index,
          index,
        })}
        style={{ width: itemWidth }}
        accessibilityLabel="Knot diagram carousel"
      />
      {total > 1 && (
        <View style={styles.dotsRow} accessibilityLabel="Image indicators">
          {resolvedKeys.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, idx === activeIndex && styles.dotActive]}
              accessibilityLabel={`Image ${idx + 1}${idx === activeIndex ? ', current' : ''}`}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.BRAND,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: 'center',
    overflow: 'hidden',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticImage: {
    height: 220,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.BRAND,
    opacity: 0.35,
  },
  dotActive: {
    opacity: 1,
    width: 9,
    height: 9,
  },
});
