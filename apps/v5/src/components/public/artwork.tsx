import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';
import { isCutout } from './media-cutouts';
import { Media } from './media';

/**
 * An illustration, presented as artwork rather than dropped in as a rectangle.
 *
 * The 3D illustrations were rendered on a flat lavender plate. Used as plain
 * images they filled a hard-edged box with a backdrop that belonged to the
 * artwork's own render, not to this page — which read as a pasted-in stock
 * image in the light theme and as a glaring light block in grey and dark.
 *
 * The backdrop is now removed at build time (`scripts/cutouts.py`), so the
 * subject has real transparency and this component supplies the surface it sits
 * on: a themed plate, generous padding, and `contain` so nothing is ever
 * cropped. Photographs are passed straight through — a photo *should* fill its
 * frame, and putting one on a plate would be the same mistake in reverse.
 */
export function Artwork({
  name,
  alt,
  style,
  height,
  radius = 16,
  /** 'plate' (default) tints the surface; 'bare' places the cutout on nothing. */
  surface = 'plate',
  /** how much of the plate the art may occupy — smaller reads more deliberate */
  inset = 18,
}: {
  name: string;
  alt: string;
  style?: ViewStyle | ViewStyle[];
  height?: number;
  radius?: number;
  surface?: 'plate' | 'bare';
  inset?: number;
}) {
  const t = useTokens();
  const styles = useMemo(() => createStyles(t), [t]);
  const cutout = isCutout(name);

  // A photograph, or art we have not cut out yet: fill the frame as before.
  if (!cutout) {
    return (
      <Media
        name={name}
        alt={alt}
        radius={radius}
        style={[height ? { height } : null, style] as never}
      />
    );
  }

  return (
    <View style={[styles.plate, { borderRadius: radius, padding: inset }, height ? { height } : null, style]}>
      {surface === 'plate' ? (
        <LinearGradient
          colors={[hexToRgba(t.brand, t.mode === 'light' ? 0.1 : 0.15), hexToRgba(t.violet, t.mode === 'light' ? 0.09 : 0.13)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <Media name={name} alt={alt} contentFit="contain" radius={0} style={styles.art as never} />
    </View>
  );
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    plate: {
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Fills whatever the plate leaves after its padding, and `contain` inside
    // Media keeps the aspect ratio — so the subject is never cropped and never
    // stretched, whatever shape the caller gives the plate.
    art: { width: '100%', height: '100%' },
  });
}
