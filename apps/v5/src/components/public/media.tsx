import { Image, type ImageContentFit } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * The image registry.
 *
 * `require()` is resolved statically by the bundler, so a path that does not
 * exist on disk is a build error, not a runtime miss. Every asset therefore has
 * to be listed here — and anything still outstanding is simply absent from the
 * map, which lets `<Media>` fall back to a branded placeholder instead of
 * breaking the build or, worse, shipping a broken image.
 *
 * When a missing asset lands, add one line here and it appears everywhere it is
 * referenced.
 */
const REGISTRY: Record<string, number> = {
  /* brand */
  'flowsmartly-logo': require('../../../assets/images/v5/flowsmartly-logo.png'),
  'flowsmartly-mark': require('../../../assets/images/v5/flowsmartly-mark.png'),
  'listsmartly-local-listings': require('../../../assets/images/v5/listsmartly-local-listings.png'),

  /* people */
  'people/aisha-williams': require('../../../assets/images/v5/people/aisha-williams.png'),
  'people/alex-marshall': require('../../../assets/images/v5/people/alex-marshall.png'),
  'people/amanda-rodriguez': require('../../../assets/images/v5/people/amanda-rodriguez.png'),
  'people/arjun-patel': require('../../../assets/images/v5/people/arjun-patel.png'),
  'people/carlos-ramirez': require('../../../assets/images/v5/people/carlos-ramirez.png'),
  'people/daniel-kim': require('../../../assets/images/v5/people/daniel-kim.png'),
  'people/david-chen': require('../../../assets/images/v5/people/david-chen.png'),
  'people/jordan-lee': require('../../../assets/images/v5/people/jordan-lee.png'),
  'people/lena-park': require('../../../assets/images/v5/people/lena-park.png'),
  'people/maya-chen': require('../../../assets/images/v5/people/maya-chen.png'),
  'people/maya-patel': require('../../../assets/images/v5/people/maya-patel.png'),
  'people/maya-thompson': require('../../../assets/images/v5/people/maya-thompson.png'),
  'people/megan-roberts': require('../../../assets/images/v5/people/megan-roberts.png'),
  'people/michael-reyes': require('../../../assets/images/v5/people/michael-reyes.png'),
  'people/priya-shah': require('../../../assets/images/v5/people/priya-shah.png'),
  'people/sarah-johnson': require('../../../assets/images/v5/customer-sarah-johnson.png'),

  /* products */
  'product/black-sneakers': require('../../../assets/images/v5/product-black-sneakers.png'),
  'product/canvas-tote': require('../../../assets/images/v5/product-canvas-tote.png'),
  'product/commuter-backpack': require('../../../assets/images/v5/product-commuter-backpack.png'),
  'product/navy-bottle': require('../../../assets/images/v5/product-navy-bottle.png'),

  /* scenes */
  'scenes/campaign-spring-model': require('../../../assets/images/v5/scenes/campaign-spring-model.png'),
  'scenes/careers-culture-1': require('../../../assets/images/v5/scenes/careers-culture-1.png'),
  'scenes/careers-culture-2': require('../../../assets/images/v5/scenes/careers-culture-2.png'),
  'scenes/careers-culture-3': require('../../../assets/images/v5/scenes/careers-culture-3.png'),
  'scenes/careers-team': require('../../../assets/images/v5/scenes/careers-team.png'),
  'scenes/campaign-spring-product': require('../../../assets/images/v5/scenes/campaign-spring-product.png'),
  'scenes/category-bedroom': require('../../../assets/images/v5/scenes/category-bedroom.png'),
  'scenes/category-decor': require('../../../assets/images/v5/scenes/category-decor.png'),
  'scenes/category-kitchen': require('../../../assets/images/v5/scenes/category-kitchen.png'),
  'scenes/category-living-room': require('../../../assets/images/v5/scenes/category-living-room.png'),
  'scenes/marketplace-collaboration': require('../../../assets/images/v5/scenes/marketplace-collaboration.png'),
  'scenes/post-apparel-flatlay': require('../../../assets/images/v5/scenes/post-apparel-flatlay.png'),
  'scenes/post-sneakers-lifestyle': require('../../../assets/images/v5/scenes/post-sneakers-lifestyle.png'),
  'scenes/post-sneakers-white': require('../../../assets/images/v5/scenes/post-sneakers-white.png'),
  'scenes/salon-interior': require('../../../assets/images/v5/scenes/salon-interior.png'),
  'scenes/storefront-hero': require('../../../assets/images/v5/scenes/storefront-hero.png'),
  'scenes/ugc-creator-1': require('../../../assets/images/v5/scenes/ugc-creator-1.png'),
  'scenes/ugc-creator-2': require('../../../assets/images/v5/scenes/ugc-creator-2.png'),
  'scenes/ugc-creator-3': require('../../../assets/images/v5/scenes/ugc-creator-3.png'),

  /* editorial — complete */
  'editorial/blog-ai-conversations': require('../../../assets/images/v5/editorial/blog-ai-conversations.png'),
  'editorial/blog-analytics': require('../../../assets/images/v5/editorial/blog-analytics.png'),
  'editorial/blog-omnichannel': require('../../../assets/images/v5/editorial/blog-omnichannel.png'),
  'editorial/guide-playbook-cover': require('../../../assets/images/v5/editorial/guide-playbook-cover.png'),
  'editorial/guide-playbook-spread': require('../../../assets/images/v5/editorial/guide-playbook-spread.png'),
  'editorial/resource-automation': require('../../../assets/images/v5/editorial/resource-automation.png'),
  'editorial/resource-deliverability': require('../../../assets/images/v5/editorial/resource-deliverability.png'),
  'editorial/resource-getting-started': require('../../../assets/images/v5/editorial/resource-getting-started.png'),
  'editorial/resource-storefront': require('../../../assets/images/v5/editorial/resource-storefront.png'),
  'editorial/blog-cart-recovery': require('../../../assets/images/v5/editorial/blog-cart-recovery.png'),
  'editorial/blog-local-growth': require('../../../assets/images/v5/editorial/blog-local-growth.png'),
  'editorial/blog-social-dms': require('../../../assets/images/v5/editorial/blog-social-dms.png'),
  'editorial/customer-story-1': require('../../../assets/images/v5/editorial/customer-story-1.png'),
  'editorial/customer-story-2': require('../../../assets/images/v5/editorial/customer-story-2.png'),
  'editorial/customer-story-3': require('../../../assets/images/v5/editorial/customer-story-3.png'),
  'editorial/press-kit': require('../../../assets/images/v5/editorial/press-kit.png'),
  'editorial/security-shield': require('../../../assets/images/v5/editorial/security-shield.png'),
  'editorial/template-library': require('../../../assets/images/v5/editorial/template-library.png'),
};

export type MediaName = string;

export function hasMedia(name: MediaName): boolean {
  return REGISTRY[name] !== undefined;
}

export type MediaProps = {
  name: MediaName;
  /** sizing/spacing only — it is applied to both the image and the placeholder */
  style?: ImageStyle | ImageStyle[];
  contentFit?: ImageContentFit;
  /** describes the image for screen readers */
  alt: string;
  /** rounded corners on both the image and the placeholder */
  radius?: number;
};

/**
 * Renders a registered image, or a branded gradient placeholder when the asset
 * has not been produced yet. The placeholder is deliberately abstract — it must
 * read as "art pending", never as a broken or fake photo.
 */
export function Media({ name, style, contentFit = 'cover', alt, radius = 14 }: MediaProps) {
  const t = useTokens();
  const styles = useMemo(() => createStyles(t), [t]);
  const source = REGISTRY[name];

  if (source === undefined) {
    return (
      <View style={[styles.placeholder, { borderRadius: radius }, style as ViewStyle]} accessibilityLabel={alt}>
        <LinearGradient
          colors={[hexToRgba(t.brand, 0.16), hexToRgba(t.violet, 0.14)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[{ borderRadius: radius }, style]}
      contentFit={contentFit}
      transition={180}
      accessibilityLabel={alt}
    />
  );
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    placeholder: {
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
  });
}
