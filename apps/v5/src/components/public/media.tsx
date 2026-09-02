import { Image, type ImageContentFit, type ImageContentPosition, type ImageProps } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';
import { isArtboard, isCutout } from './media-cutouts';

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
  'flowsmartly-logo': require('../../../assets/images/v5w/flowsmartly-logo.png'),
  'flowsmartly-mark': require('../../../assets/images/v5w/flowsmartly-mark.png'),
  'listsmartly-local-listings': require('../../../assets/images/v5w/listsmartly-local-listings.webp'),

  /* people */
  'people/aisha-williams': require('../../../assets/images/v5w/people/aisha-williams.webp'),
  'people/alex-marshall': require('../../../assets/images/v5w/people/alex-marshall.webp'),
  'people/amanda-rodriguez': require('../../../assets/images/v5w/people/amanda-rodriguez.webp'),
  'people/arjun-patel': require('../../../assets/images/v5w/people/arjun-patel.webp'),
  'people/carlos-ramirez': require('../../../assets/images/v5w/people/carlos-ramirez.webp'),
  'people/daniel-kim': require('../../../assets/images/v5w/people/daniel-kim.webp'),
  'people/david-chen': require('../../../assets/images/v5w/people/david-chen.webp'),
  'people/jordan-lee': require('../../../assets/images/v5w/people/jordan-lee.webp'),
  'people/jean-yves-koffi': require('../../../assets/images/v5w/people/jean-yves-koffi.webp'),
  'people/lena-park': require('../../../assets/images/v5w/people/lena-park.webp'),
  'people/maya-chen': require('../../../assets/images/v5w/people/maya-chen.webp'),
  'people/maya-patel': require('../../../assets/images/v5w/people/maya-patel.webp'),
  'people/maya-thompson': require('../../../assets/images/v5w/people/maya-thompson.webp'),
  'people/megan-roberts': require('../../../assets/images/v5w/people/megan-roberts.webp'),
  'people/michael-reyes': require('../../../assets/images/v5w/people/michael-reyes.webp'),
  'people/priya-shah': require('../../../assets/images/v5w/people/priya-shah.webp'),
  'people/sarah-johnson': require('../../../assets/images/v5w/customer-sarah-johnson.webp'),

  /* products */
  'product/black-sneakers': require('../../../assets/images/v5w/product-black-sneakers.webp'),
  'product/canvas-tote': require('../../../assets/images/v5w/product-canvas-tote.webp'),
  'product/commuter-backpack': require('../../../assets/images/v5w/product-commuter-backpack.webp'),
  'product/navy-bottle': require('../../../assets/images/v5w/product-navy-bottle.webp'),

  /* scenes */
  'scenes/campaign-spring-model': require('../../../assets/images/v5w/scenes/campaign-spring-model.webp'),
  'scenes/careers-culture-1': require('../../../assets/images/v5w/scenes/careers-culture-1.webp'),
  'scenes/careers-culture-2': require('../../../assets/images/v5w/scenes/careers-culture-2.webp'),
  'scenes/careers-culture-3': require('../../../assets/images/v5w/scenes/careers-culture-3.webp'),
  'scenes/careers-team': require('../../../assets/images/v5w/scenes/careers-team.webp'),
  'scenes/campaign-spring-product': require('../../../assets/images/v5w/scenes/campaign-spring-product.webp'),
  'scenes/category-bedroom': require('../../../assets/images/v5w/scenes/category-bedroom.webp'),
  'scenes/category-decor': require('../../../assets/images/v5w/scenes/category-decor.webp'),
  'scenes/category-kitchen': require('../../../assets/images/v5w/scenes/category-kitchen.webp'),
  'scenes/category-living-room': require('../../../assets/images/v5w/scenes/category-living-room.webp'),
  'scenes/marketplace-collaboration': require('../../../assets/images/v5w/scenes/marketplace-collaboration.webp'),
  'scenes/post-apparel-flatlay': require('../../../assets/images/v5w/scenes/post-apparel-flatlay.webp'),
  'scenes/post-sneakers-lifestyle': require('../../../assets/images/v5w/scenes/post-sneakers-lifestyle.webp'),
  'scenes/post-sneakers-white': require('../../../assets/images/v5w/scenes/post-sneakers-white.webp'),
  'scenes/salon-interior': require('../../../assets/images/v5w/scenes/salon-interior.webp'),
  'scenes/storefront-hero': require('../../../assets/images/v5w/scenes/storefront-hero.webp'),
  'scenes/ugc-creator-1': require('../../../assets/images/v5w/scenes/ugc-creator-1.webp'),
  'scenes/ugc-creator-2': require('../../../assets/images/v5w/scenes/ugc-creator-2.webp'),
  'scenes/ugc-creator-3': require('../../../assets/images/v5w/scenes/ugc-creator-3.webp'),

  /* editorial — complete */
  'editorial/blog-ai-conversations': require('../../../assets/images/v5w/editorial/blog-ai-conversations.webp'),
  'editorial/blog-analytics': require('../../../assets/images/v5w/editorial/blog-analytics.webp'),
  'editorial/blog-omnichannel': require('../../../assets/images/v5w/editorial/blog-omnichannel.webp'),
  'editorial/guide-playbook-cover': require('../../../assets/images/v5w/editorial/guide-playbook-cover.webp'),
  'editorial/guide-playbook-spread': require('../../../assets/images/v5w/editorial/guide-playbook-spread.webp'),
  'editorial/resource-automation': require('../../../assets/images/v5w/editorial/resource-automation.webp'),
  'editorial/resource-deliverability': require('../../../assets/images/v5w/editorial/resource-deliverability.webp'),
  'editorial/resource-getting-started': require('../../../assets/images/v5w/editorial/resource-getting-started.webp'),
  'editorial/resource-storefront': require('../../../assets/images/v5w/editorial/resource-storefront.webp'),
  'editorial/blog-cart-recovery': require('../../../assets/images/v5w/editorial/blog-cart-recovery.webp'),
  'editorial/blog-local-growth': require('../../../assets/images/v5w/editorial/blog-local-growth.webp'),
  'editorial/blog-social-dms': require('../../../assets/images/v5w/editorial/blog-social-dms.webp'),
  'editorial/customer-story-1': require('../../../assets/images/v5w/editorial/customer-story-1.webp'),
  'editorial/customer-story-2': require('../../../assets/images/v5w/editorial/customer-story-2.webp'),
  'editorial/customer-story-3': require('../../../assets/images/v5w/editorial/customer-story-3.webp'),
  'editorial/press-kit': require('../../../assets/images/v5w/editorial/press-kit.webp'),
  'editorial/security-shield': require('../../../assets/images/v5w/editorial/security-shield.webp'),
  'editorial/template-library': require('../../../assets/images/v5w/editorial/template-library.webp'),

  /* video & voice studio — product ads, UGC, virtual try-on, voiceover */
  'video/ad-automotive': require('../../../assets/images/v5w/video/ad-automotive.webp'),
  'video/ad-fragrance': require('../../../assets/images/v5w/video/ad-fragrance.webp'),
  'video/ad-lifestyle': require('../../../assets/images/v5w/video/ad-lifestyle.webp'),
  'video/ad-sneaker': require('../../../assets/images/v5w/video/ad-sneaker.webp'),
  'video/ad-watch': require('../../../assets/images/v5w/video/ad-watch.webp'),
  'video/tryon-mirror': require('../../../assets/images/v5w/video/tryon-mirror.webp'),
  'video/tryon-runway': require('../../../assets/images/v5w/video/tryon-runway.webp'),
  'video/tryon-street': require('../../../assets/images/v5w/video/tryon-street.webp'),
  'video/tryon-wardrobe': require('../../../assets/images/v5w/video/tryon-wardrobe.webp'),
  'video/ugc-beauty': require('../../../assets/images/v5w/video/ugc-beauty.webp'),
  'video/ugc-review': require('../../../assets/images/v5w/video/ugc-review.webp'),
  'video/ugc-ringlight': require('../../../assets/images/v5w/video/ugc-ringlight.webp'),
  'video/ugc-testimonial': require('../../../assets/images/v5w/video/ugc-testimonial.webp'),
  'video/ugc-unboxing': require('../../../assets/images/v5w/video/ugc-unboxing.webp'),
  'video/voice-anchor': require('../../../assets/images/v5w/video/voice-anchor.webp'),
  'video/voice-audiobook': require('../../../assets/images/v5w/video/voice-audiobook.webp'),
  'video/voice-documentary': require('../../../assets/images/v5w/video/voice-documentary.webp'),
  'video/voice-explainer': require('../../../assets/images/v5w/video/voice-explainer.webp'),
  'video/voice-headphones': require('../../../assets/images/v5w/video/voice-headphones.webp'),
  'video/voice-meditation': require('../../../assets/images/v5w/video/voice-meditation.webp'),
  'video/voice-product-spot': require('../../../assets/images/v5w/video/voice-product-spot.webp'),
  'video/voice-studio': require('../../../assets/images/v5w/video/voice-studio.webp'),

};

export type MediaName = string;

export function hasMedia(name: MediaName): boolean {
  return REGISTRY[name] !== undefined;
}

/**
 * `alt` is the whole point of this module, so it is worth stating exactly what
 * "no alt" costs and why the plumbing below looks the way it does.
 *
 * **expo-image does not forward `alt`.** Its web renderer destructures both
 * `alt` and `accessibilityLabel`, then hands *only* `accessibilityLabel` to the
 * node that becomes the real `<img>` (`ExpoImage.web.tsx` — the `alt` alias
 * survives on the placeholder branch alone), and `ImageWrapper` renders
 * `alt={accessibilityLabel}`. So `<Image alt="…">` ships an `<img>` with **no
 * alt attribute at all**: invisible to a screen reader, unindexable, and
 * invalid HTML. Every image in this app therefore goes out through
 * `accessibilityLabel`, and that is what `ImageAsset` exists to guarantee.
 *
 * A missing attribute and an empty one are not the same thing. `alt=""` is a
 * statement — "skip me, the surrounding copy already says this" — and a screen
 * reader honours it. A missing `alt` leaves the reader to guess, and most read
 * the file name. Decorative art must therefore say `alt=""` out loud.
 */
type AltProp = {
  /**
   * Required. Describes the image for screen readers, crawlers and anyone with
   * images turned off.
   *
   * Pass `''` **only** for art that carries nothing the adjacent copy does not
   * already say — an avatar beside the person's printed name, a texture, a
   * glyph echoing a visible label. That renders an explicit empty `alt` plus
   * `aria-hidden`, which is how a decorative image is meant to be skipped.
   */
  alt: string;
};

/**
 * A `require()`d asset with an alt that cannot be forgotten.
 *
 * Use this instead of importing `Image` from `expo-image` directly. The type
 * makes `alt` mandatory, and the component routes it through the one prop
 * expo-image actually renders — which is the part that is easy to get wrong by
 * hand, because passing `alt` looks correct and silently does nothing.
 */
export type ImageAssetProps = Omit<ImageProps, 'alt' | 'accessibilityLabel' | 'aria-label'> &
  AltProp;

export function ImageAsset({ alt, ...rest }: ImageAssetProps) {
  const decorative = alt.trim() === '';
  return (
    <Image
      {...rest}
      // the only prop that reaches the DOM as `alt` — see the note above
      accessibilityLabel={alt}
      // `aria-hidden` lands on expo-image's wrapper view, which takes the
      // `<img>` out of the accessibility tree with it. Only ever set alongside
      // an empty alt, so the image is skipped rather than silently unlabelled.
      aria-hidden={decorative || undefined}
    />
  );
}

export type MediaProps = AltProp & {
  name: MediaName;
  /** sizing/spacing only — it is applied to both the image and the placeholder */
  style?: ImageStyle | ImageStyle[];
  contentFit?: ImageContentFit;
  /**
   * Where the crop is anchored when `cover` has to discard part of the image.
   * A portrait in a wide tile crops from the centre by default, which takes the
   * top of the subject's head off — `'top'` keeps the face.
   */
  contentPosition?: ImageContentPosition;
  /** rounded corners on both the image and the placeholder */
  radius?: number;
};

/**
 * Renders a registered image, or a branded gradient placeholder when the asset
 * has not been produced yet. The placeholder is deliberately abstract — it must
 * read as "art pending", never as a broken or fake photo.
 */
export function Media({ name, style, contentFit, contentPosition, alt, radius = 14 }: MediaProps) {
  const t = useTokens();
  const styles = useMemo(() => createStyles(t), [t]);
  const source = REGISTRY[name];
  const decorative = alt.trim() === '';
  /*
   * A cut-out illustration is never cropped. It has real transparency and
   * deliberate floating pieces — a stray sphere, a separate speech bubble —
   * and `cover` chops whichever of them sit near the frame, which reads as
   * torn artwork rather than as a crop. Photographs still default to `cover`,
   * because a photo *should* fill its frame.
   *
   * This is the default rather than a per-call-site fix because the registry
   * already knows which is which, and every place that forgot was rendering
   * clipped art: the resources article grid, most obviously.
   */
  const fit = contentFit ?? (isCutout(name) ? 'contain' : 'cover');

  if (source === undefined) {
    return (
      <View
        style={[styles.placeholder, { borderRadius: radius }, style as ViewStyle]}
        // The placeholder stands in for the missing art, so it inherits its
        // description — and its silence, when the art was decorative. The role
        // is what makes the label count: an `aria-label` on a plain div has no
        // element to name, and screen readers drop it.
        accessibilityRole={decorative ? undefined : 'image'}
        accessibilityLabel={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}>
        <LinearGradient
          colors={[hexToRgba(t.brand, 0.16), hexToRgba(t.violet, 0.14)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      </View>
    );
  }

  /*
   * An illustration whose art is painted into its backdrop — glass, a floor
   * shadow, a glow that fades into the plate. The matte cannot separate those,
   * so the asset keeps its backdrop and is *mounted* instead: a light plate in
   * every theme, inset, which reads as a deliberately framed picture rather
   * than as a lavender rectangle leaking onto a dark card.
   *
   * This lives here rather than only in `Artwork` because six pages render
   * these names through plain `Media`, and every one of them would otherwise
   * show the bare backdrop. The outer view takes the caller's style, so the
   * layout contract is unchanged.
   */
  if (isArtboard(name)) {
    return (
      <View style={[styles.artboard, { borderRadius: radius }, style as ViewStyle]}>
        <ImageAsset
          source={source}
          style={styles.artboardImage}
          contentFit="contain"
          transition={180}
          alt={alt}
        />
      </View>
    );
  }

  return (
    <ImageAsset
      source={source}
      style={[{ borderRadius: radius }, style]}
      contentFit={fit}
      contentPosition={contentPosition}
      transition={180}
      alt={alt}
    />
  );
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    // The mounted-picture plate. Light in every theme on purpose: the art it
    // frames was rendered on a light backdrop, and a dark frame around a light
    // picture is the same mismatch in reverse.
    artboard: {
      overflow: 'hidden',
      backgroundColor: '#f2f0fb',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
    },
    artboardImage: { width: '100%', height: '100%' },
    placeholder: {
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
  });
}
