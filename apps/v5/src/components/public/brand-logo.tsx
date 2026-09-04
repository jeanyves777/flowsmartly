import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as simpleIcons from 'simple-icons';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { brandColor, hexToRgba } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * Real third-party marks — never a drawn approximation.
 *
 * Two sources, in order:
 *  1. `@expo/vector-icons/FontAwesome6` brand glyphs (already a dependency).
 *  2. `simple-icons` (CC0) for the marks FontAwesome does not carry.
 *
 * The icons are CC0; the trademarks remain their owners'. We only use them to
 * name the integration they refer to, which is nominative use — so the mark is
 * always the official one, never something we invented.
 *
 * If a brand is in neither set it must NOT be faked: `BrandLogo` falls back to
 * a neutral monogram tile so a missing mark is visibly a placeholder.
 */

type SimpleIcon = { title: string; hex: string; path: string };

const SIMPLE = simpleIcons as unknown as Record<string, SimpleIcon | undefined>;

/** brand key → FontAwesome6 glyph name, where one exists */
const FA_BRANDS: Record<string, string> = {
  instagram: 'instagram',
  facebook: 'facebook-f',
  tiktok: 'tiktok',
  linkedin: 'linkedin-in',
  youtube: 'youtube',
  google: 'google',
  whatsapp: 'whatsapp',
  apple: 'apple',
  wordpress: 'wordpress',
  shopify: 'shopify',
  stripe: 'stripe',
  slack: 'slack',
  salesforce: 'salesforce',
  microsoft: 'microsoft',
  dropbox: 'dropbox',
  amazon: 'amazon',
  github: 'github',
  x: 'x-twitter',
};

/** brand key → simple-icons export name, for what FontAwesome lacks */
const SI_BRANDS: Record<string, string> = {
  zendesk: 'siZendesk',
  zapier: 'siZapier',
  make: 'siMake',
  googleanalytics: 'siGoogleanalytics',
  mailchimp: 'siMailchimp',
  intercom: 'siIntercom',
  notion: 'siNotion',
  asana: 'siAsana',
  trello: 'siTrello',
  zoho: 'siZoho',
  airtable: 'siAirtable',
  googledrive: 'siGoogledrive',
  copilot: 'siGithubcopilot',
  githubcopilot: 'siGithubcopilot',
  gemini: 'siGooglegemini',
  googlegemini: 'siGooglegemini',
  perplexity: 'siPerplexity',
  claude: 'siClaude',
};

/**
 * Marks neither source carries. simple-icons removed several on trademark
 * request (Salesforce, Slack, LinkedIn — all still in FontAwesome) and never
 * carried others (ChatGPT, Bing, Klaviyo, Twilio, Pipedrive). Rather than draw
 * a look-alike, these render as a labelled monogram so the tile reads as a
 * brand we name rather than a broken image.
 */
const MONOGRAMS: Record<string, string> = {
  chatgpt: 'GPT',
  openai: 'AI',
  bing: 'B',
  klaviyo: 'K',
  twilio: 'Tw',
  pipedrive: 'P',
  sendgrid: 'SG',
  zendesk: 'Z',
  hubspot: 'H',
};

export type BrandLogoProps = {
  /** lowercase brand key, e.g. "zendesk" */
  name: string;
  size?: number;
  /** force a colour; defaults to the brand's own, corrected for dark themes */
  color?: string;
  /** render in the current text colour instead of the brand colour */
  monochrome?: boolean;
  label?: string;
};

export function BrandLogo({ name, size = 24, color, monochrome, label }: BrandLogoProps) {
  const t = useTokens();
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  const fa = FA_BRANDS[key];
  if (fa) {
    const tint = color ?? (monochrome ? t.text : brandColor(FA_TINTS[key] ?? t.text, t));
    return <FontAwesome6 name={fa as never} size={size} color={tint} accessibilityLabel={label ?? name} />;
  }

  const icon = SIMPLE[SI_BRANDS[key] ?? ''];
  if (icon) {
    const tint = color ?? (monochrome ? t.text : brandColor(`#${icon.hex}`, t));
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={label ?? icon.title}>
        <Path d={icon.path} fill={tint} />
      </Svg>
    );
  }

  // Unknown brand: a legible monogram, never an invented mark. A blank tile
  // reads as a broken image, which is worse than an honest placeholder.
  const initials = MONOGRAMS[key] ?? (label ?? name).slice(0, 2).toUpperCase();
  // A monogram is the brand's name, so it is text and obeys the 11px floor —
  // at the sizes this component is called with (11–30) the old ratio produced
  // 5–12px, and the tiles measured on the built site rendered 9px and 10px.
  //
  // The tile grows to fit rather than the type shrinking to fit: `minWidth` /
  // `minHeight` hold it at `size`, so the common cases are pixel-identical
  // (one or two letters measure 9–17px at 11px/800, which every tile from ~21
  // up already has room for) and only a genuinely tiny tile expands. That is
  // the honest trade: the old 14px tile "contained" GPT only because the 9px
  // text was already spilling 4px out of it.
  const fontSize = Math.max(11, Math.round(size * (initials.length > 2 ? 0.3 : 0.4)));
  return (
    <View
      accessibilityLabel={label ?? name}
      style={{
        minWidth: size,
        minHeight: size,
        paddingHorizontal: 2,
        borderRadius: Math.round(size * 0.24),
        backgroundColor: hexToRgba(color ?? t.text, 0.1),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        numberOfLines={1}
        style={{
          color: color ?? t.textMuted,
          fontSize,
          lineHeight: Math.round(fontSize * 1.25),
          fontWeight: '800',
        }}>
        {initials}
      </Text>
    </View>
  );
}

/** Official brand colours for the FontAwesome-backed marks. */
const FA_TINTS: Record<string, string> = {
  instagram: '#e1306c',
  facebook: '#1877f2',
  tiktok: '#111111',
  linkedin: '#0a66c2',
  youtube: '#ff0000',
  google: '#4285f4',
  whatsapp: '#25d366',
  apple: '#111111',
  wordpress: '#21759b',
  shopify: '#7ab55c',
  stripe: '#635bff',
  slack: '#4a154b',
  salesforce: '#00a1e0',
  microsoft: '#5e5e5e',
  dropbox: '#0061ff',
  amazon: '#ff9900',
  github: '#181717',
  x: '#111111',
};

/** Brands this component can render for real, for building integration strips. */
export const AVAILABLE_BRANDS = [...Object.keys(FA_BRANDS), ...Object.keys(SI_BRANDS)];
