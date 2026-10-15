import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Band,
  ButtonRow,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useTypeScale,
} from '@/components/public/ui';
import { contactHref, goToRegister } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

const PREVIEWS = [
  {
    key: 'product',
    label: 'Product film',
    media: 'video/ad-fragrance',
    alt: 'Editorial product-film still featuring a fragrance bottle with warm, sculpted light',
    note: 'A product-led visual direction',
  },
  {
    key: 'campaign',
    label: 'Campaign',
    media: 'video/ad-automotive',
    alt: 'Editorial campaign still of a car on a coastal road at sunset',
    note: 'A cinematic campaign direction',
  },
  {
    key: 'social',
    label: 'Social',
    media: 'video/ugc-beauty',
    alt: 'Creator-style social video still framed for a vertical feed',
    note: 'A creator-led social direction',
  },
  {
    key: 'voice',
    label: 'Voiceover',
    media: 'video/voice-studio',
    alt: 'Voice recording studio scene with a microphone and audio workstation',
    note: 'A voice and narration direction',
  },
] as const;

const WORKFLOW = [
  {
    number: '01',
    title: 'Bring the brief',
    body: 'Start with the product, audience and message you want to communicate. Keep the creative direction in one place.',
    icon: 'file-lines',
  },
  {
    number: '02',
    title: 'Shape the story',
    body: 'Use the studio page to explore visual formats and the current product workflow. The preview gallery is illustrative.',
    icon: 'wand-magic-sparkles',
  },
  {
    number: '03',
    title: 'Plan the next step',
    body: 'Create an account to explore FlowSmartly, or request a conversation about the video workflow you need.',
    icon: 'arrow-up-right-from-square',
  },
] as const;

const PLANNED = [
  { title: 'Generate a finished video', body: 'Video generation is not connected to this public page yet.', icon: 'film' },
  { title: 'Choose a model or provider', body: 'Provider selection and routing remain behind the API.', icon: 'sliders' },
  { title: 'Send motion and shot settings', body: 'Settings need an end-to-end request path before they can affect output.', icon: 'arrows-rotate' },
] as const;

function VideoStudioPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l), [t, l]);
  const [activePreview, setActivePreview] = useState(0);
  const [focusedPreview, setFocusedPreview] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const preview = PREVIEWS[activePreview];
  const faqs = [
    {
      question: 'Can I generate a video from this page?',
      answer: 'Not yet. The public page currently presents the workflow and lets you explore the existing visual references. Video generation is not wired to this page.',
    },
    {
      question: 'Does the preview selector send my choices anywhere?',
      answer: 'No. It changes the local reference image and caption only. It does not submit a brief or send creative settings to a provider.',
    },
    {
      question: 'How can I discuss the video workflow?',
      answer: 'Use “Talk to the team” to open the demo request form, or create an account to explore the V5 product.',
    },
  ];

  return (
    <PageShell
      title="Video Studio"
      description="Explore FlowSmartly’s video workflow, preview creative directions and see what is available today and what is planned."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Video Studio', path: ROUTES.videoStudio },
        ]),
      ]}>
      <OpenSection art="none" style={styles.heroSection}>
        <View style={styles.heroGrid}>
          <Reveal style={styles.heroCopy} distance={18}>
            <View style={styles.eyebrow}>
              <View style={styles.liveDot} />
              <SectionLabel>VIDEO WORKFLOW · V5</SectionLabel>
            </View>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Make your next story feel unmistakably yours.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Explore the creative direction behind product films, campaigns, social video and voice. A thoughtful starting point for a video workflow that is still taking shape.
            </Text>
            <View style={styles.heroActions}>
              <ButtonRow>
                <PrimaryButton
                  label="Create an account"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="video-studio.hero.create-account"
                  onPress={goToRegister}
                />
                <SecondaryButton
                  label="Talk to the team"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-up-right-from-square"
                  trackId="video-studio.hero.talk-to-team"
                  onPress={() => router.push(contactHref('demo') as never)}
                />
              </ButtonRow>
            </View>
            <View style={styles.heroNote}>
              <FontAwesome6 name="circle-info" size={14} color={t.textMuted} aria-hidden={true} />
              <Text style={[type.caption, styles.heroNoteText]}>
                Video generation and provider controls are planned; this page does not submit a video request.
              </Text>
            </View>
          </Reveal>

          <Reveal style={styles.previewWrap} delay={80} distance={14}>
            <View style={styles.previewFrame}>
              <View style={styles.previewTopline}>
                <View style={styles.previewBrand}>
                  <View style={styles.previewMark}><FontAwesome6 name="clapperboard" size={12} color={t.textOnBrand} aria-hidden={true} /></View>
                  <Text style={styles.previewBrandText}>CREATIVE REFERENCES</Text>
                </View>
                <View style={styles.previewBadge}><View style={styles.previewBadgeDot} /><Text style={styles.previewBadgeText}>PREVIEW</Text></View>
              </View>
              <View style={styles.previewImageFrame}>
                <Media name={preview.media} alt={preview.alt} style={styles.previewImage} radius={18} />
                <View pointerEvents="none" style={styles.imageIndex}>
                  <Text style={styles.imageIndexText}>{String(activePreview + 1).padStart(2, '0')}</Text>
                  <View style={styles.imageIndexRule} />
                  <Text style={styles.imageIndexTotal}>04</Text>
                </View>
              </View>
              <View style={styles.previewCaptionRow}>
                <View style={styles.previewCaptionCopy}>
                  <Text style={styles.previewKicker}>DIRECTION {String(activePreview + 1).padStart(2, '0')}</Text>
                  <Text style={styles.previewTitle}>{preview.label}</Text>
                  <Text style={styles.previewNote}>{preview.note}</Text>
                </View>
                <View style={styles.previewArrow}>
                  <FontAwesome6 name="arrow-down-left-and-arrow-up-right-to-center" size={14} color={t.textMuted} aria-hidden={true} />
                </View>
              </View>
              <View accessibilityRole="group" accessibilityLabel="Choose a reference preview" style={styles.previewTabs}>
                {PREVIEWS.map((item, index) => {
                  const selected = activePreview === index;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${item.label} reference`}
                      accessibilityState={{ selected }}
                      aria-pressed={selected}
                      onPress={() => setActivePreview(index)}
                      onFocus={() => setFocusedPreview(index)}
                      onBlur={() => setFocusedPreview(null)}
                      style={({ pressed }) => [styles.previewTab, selected && styles.previewTabSelected, focusedPreview === index && styles.previewTabFocused, pressed && styles.pressed]}>
                      <Text style={[styles.previewTabText, selected && styles.previewTabTextSelected]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.previewDisclaimer}>Sample reference imagery · This selector changes the preview only</Text>
            </View>
          </Reveal>
        </View>
        <View style={styles.heroFoot}>
          <Text style={styles.heroFootLabel}>A CLEARER CREATIVE START</Text>
          <FontAwesome6 name="arrow-down" size={13} color={t.textSubtle} aria-hidden={true} />
          <Text style={styles.heroFootLabel}>BUILT AROUND WHAT WORKS TODAY</Text>
        </View>
      </OpenSection>

      <Band tone="violet" style={styles.band}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <SectionLabel>FROM IDEA TO DIRECTION</SectionLabel>
            <Heading level={2} style={[type.h2, styles.sectionTitle]}>
              A calmer way to shape the first cut.
            </Heading>
          </View>
          <Text style={[type.bodySm, styles.sectionIntro]}>
            A strong video starts with a clear brief. FlowSmartly brings the conversation, product context and creative decisions into a workflow designed to grow over time.
          </Text>
        </View>
        <View style={styles.workflowGrid}>
          {WORKFLOW.map((item, index) => (
            <Reveal key={item.number} style={styles.workflowCell} delay={index * 70} distance={10}>
              <View style={styles.workflowItem}>
                <View style={styles.workflowMeta}>
                  <Text style={styles.workflowNumber}>{item.number}</Text>
                  <View style={styles.workflowIcon}><FontAwesome6 name={item.icon as never} size={15} color={t.brand} aria-hidden={true} /></View>
                </View>
                <Heading level={3} style={[type.h3, styles.workflowTitle]}>{item.title}</Heading>
                <Text style={[type.bodySm, styles.workflowBody]}>{item.body}</Text>
                {index < WORKFLOW.length - 1 ? <View style={styles.workflowRule} /> : null}
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      <OpenSection style={styles.capabilitiesSection}>
        <View style={styles.capabilitiesHeader}>
          <SectionLabel>PRODUCT STATUS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Clear about what is ready.
          </Heading>
          <Text style={[type.body, styles.statusIntro]}>
            The public experience should make room for ambition without suggesting that unfinished controls already work.
          </Text>
        </View>
        <View style={styles.statusGrid}>
          <View style={styles.statusColumn}>
            <View style={styles.statusColumnTitle}>
              <View style={[styles.statusTitleIcon, { backgroundColor: softFill(t.green, t) }]}>
                <FontAwesome6 name="circle-check" size={15} color={t.green} aria-hidden={true} />
              </View>
              <Heading level={3} style={[type.h3, styles.statusTitle]}>Available today</Heading>
            </View>
            <View style={styles.availableRow}>
              <FontAwesome6 name="check" size={13} color={t.green} aria-hidden={true} />
              <Text style={[type.bodySm, styles.availableText]}>Explore creative reference imagery and formats</Text>
            </View>
            <View style={styles.availableRow}>
              <FontAwesome6 name="check" size={13} color={t.green} aria-hidden={true} />
              <Text style={[type.bodySm, styles.availableText]}>Create an account through the V5 entry point</Text>
            </View>
            <View style={styles.availableRow}>
              <FontAwesome6 name="check" size={13} color={t.green} aria-hidden={true} />
              <Text style={[type.bodySm, styles.availableText]}>Request a product conversation</Text>
            </View>
          </View>
          <View style={styles.statusColumn}>
            <View style={styles.statusColumnTitle}>
              <View style={[styles.statusTitleIcon, { backgroundColor: softFill(t.violet, t) }]}>
                <FontAwesome6 name="sparkles" size={15} color={t.violet} aria-hidden={true} />
              </View>
              <Heading level={3} style={[type.h3, styles.statusTitle]}>In development</Heading>
            </View>
            {PLANNED.map((item) => (
              <View key={item.title} style={styles.plannedRow}>
                <View style={styles.plannedIcon}><FontAwesome6 name={item.icon as never} size={13} color={t.violet} aria-hidden={true} /></View>
                <View style={styles.plannedCopy}>
                  <Text style={styles.plannedTitle}>{item.title}</Text>
                  <Text style={styles.plannedBody}>{item.body}</Text>
                </View>
                <View style={styles.plannedPill}><Text style={styles.plannedPillText}>PLANNED</Text></View>
              </View>
            ))}
          </View>
        </View>
      </OpenSection>

      <Band tone="surface" style={styles.band}>
        <View style={styles.faqLayout}>
          <View style={styles.faqIntro}>
            <SectionLabel>GOOD TO KNOW</SectionLabel>
            <Heading level={2} style={[type.h2, styles.sectionTitle]}>A few straight answers.</Heading>
            <Text style={[type.bodySm, styles.sectionIntro]}>The current boundaries matter as much as the direction.</Text>
          </View>
          <View style={styles.faqList}>
            {faqs.map((item, index) => {
              const expanded = openFaq === index;
              return (
                <View key={item.question} style={styles.faqItem}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    aria-expanded={expanded}
                    onPress={() => setOpenFaq(expanded ? null : index)}
                    style={({ pressed }) => [styles.faqTrigger, pressed && styles.pressed]}>
                    <Text style={styles.faqQuestion}>{item.question}</Text>
                    <View style={[styles.faqToggle, expanded && styles.faqToggleOpen]}>
                      <FontAwesome6 name={expanded ? 'minus' : 'plus'} size={12} color={expanded ? t.textOnBrand : t.textMuted} aria-hidden={true} />
                    </View>
                  </Pressable>
                  {expanded ? <Text style={[type.bodySm, styles.faqAnswer]}>{item.answer}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.closingRow}>
          <View style={styles.closingCopy}>
            <Text style={styles.closingEyebrow}>MAKE YOUR NEXT STEP A CLEAR ONE</Text>
            <Text style={[type.h3, styles.closingTitle]}>Explore the V5 experience.</Text>
          </View>
          <ButtonRow>
            <PrimaryButton label="Create an account" size="md" icon="arrow-right" iconRight trackId="video-studio.closing.create-account" onPress={goToRegister} />
            <SecondaryButton label="Talk to the team" size="md" trackId="video-studio.closing.contact" onPress={() => router.push(contactHref('demo') as never)} />
          </ButtonRow>
        </View>
      </Band>
    </PageShell>
  );
}

function createStyles(t: ThemeTokens, l: Layout) {
  const columns = l.gridColumns(3);
  const previewColumns = l.gridColumns(4);
  return StyleSheet.create({
    heroSection: { paddingTop: l.isPhone ? 38 : 64, paddingBottom: l.isPhone ? 26 : 34 },
    heroGrid: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: 'center',
      gap: l.isPhone ? 34 : 48,
    },
    heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: l.isStacked ? 'auto' : '48%', minWidth: 0, alignSelf: 'stretch', justifyContent: 'center' },
    eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 20 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.violet },
    heroTitle: { maxWidth: 660, marginBottom: 20, color: t.text },
    heroBody: { maxWidth: 540, marginBottom: 24, color: t.textMuted },
    heroActions: { alignItems: 'flex-start' },
    heroNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 19, maxWidth: 510 },
    heroNoteText: { color: t.textSubtle, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    previewWrap: { flexGrow: 1, flexShrink: 1, flexBasis: l.isStacked ? 'auto' : '52%', minWidth: 0, width: '100%', maxWidth: 680, alignSelf: l.isStacked ? 'center' : 'auto' },
    previewFrame: { borderWidth: 1, borderColor: t.border, borderRadius: l.isPhone ? 22 : 28, backgroundColor: t.surface, padding: l.isPhone ? 12 : 18, ...elevation(t, 2) },
    previewTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
    previewBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    previewMark: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.brand },
    previewBrandText: { color: t.textSubtle, fontSize: 11, letterSpacing: 1.2, fontWeight: '800' },
    previewBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: softFill(t.violet, t) },
    previewBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.violet },
    previewBadgeText: { color: t.violet, fontSize: 11, letterSpacing: 0.7, fontWeight: '800' },
    previewImageFrame: { width: '100%', aspectRatio: l.isPhone ? 1.24 : 1.4, overflow: 'hidden', borderRadius: 18, backgroundColor: t.surfaceMuted, position: 'relative' },
    previewImage: { width: '100%', height: '100%' },
    imageIndex: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: t.scrimGlass, borderWidth: 1, borderColor: t.scrimGlassLine },
    imageIndexText: { color: t.textOnScrim, fontSize: 12, fontWeight: '800' },
    imageIndexRule: { width: 20, height: 1, backgroundColor: t.scrimGlassLine },
    imageIndexTotal: { color: t.textOnScrim, fontSize: 11, opacity: 0.72 },
    previewCaptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingTop: 15, paddingBottom: 13 },
    previewCaptionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    previewKicker: { color: t.violet, fontSize: 11, letterSpacing: 1.1, fontWeight: '800', marginBottom: 4 },
    previewTitle: { color: t.text, fontSize: 19, lineHeight: 24, fontWeight: '800' },
    previewNote: { color: t.textMuted, fontSize: 13, marginTop: 3 },
    previewArrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    previewTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.divider },
    previewTab: { flexGrow: 0, flexShrink: 1, flexBasis: `${100 / previewColumns - 2}%` as `${number}%`, minWidth: 72, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: t.border, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: t.background },
    previewTabSelected: { backgroundColor: t.brand, borderColor: t.brand },
    previewTabFocused: { borderColor: t.brand, borderWidth: 2 },
    previewTabText: { color: t.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    previewTabTextSelected: { color: t.textOnBrand },
    previewDisclaimer: { color: t.textSubtle, fontSize: 11, lineHeight: 16, marginTop: 10, textAlign: 'center' },
    pressed: { opacity: 0.82 },
    heroFoot: { borderTopWidth: 1, borderTopColor: t.divider, marginTop: l.isPhone ? 32 : 50, paddingTop: 15, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    heroFootLabel: { color: t.textSubtle, fontSize: 11, letterSpacing: 1, fontWeight: '800' },
    band: { paddingTop: l.isPhone ? 38 : 64, paddingBottom: l.isPhone ? 38 : 64 },
    sectionHead: { flexDirection: l.isStacked ? 'column' : 'row', alignItems: l.isStacked ? 'flex-start' : 'flex-end', justifyContent: 'space-between', gap: 22, marginBottom: 30 },
    sectionHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: '52%', minWidth: 0 },
    sectionTitle: { color: t.text, marginTop: 11, maxWidth: 650 },
    sectionIntro: { flexGrow: 1, flexShrink: 1, flexBasis: '40%', color: t.textMuted, maxWidth: 570 },
    workflowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: l.isPhone ? 0 : 22 },
    workflowCell: { flexGrow: 1, flexShrink: 1, flexBasis: l.isPhone ? '100%' : cellBasis(columns), minWidth: 0 },
    workflowItem: { position: 'relative', paddingTop: 18, paddingBottom: l.isPhone ? 19 : 5, minHeight: l.isPhone ? 0 : 190, borderTopWidth: 1, borderTopColor: t.border },
    workflowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    workflowNumber: { color: t.violet, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    workflowIcon: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: softFill(t.violet, t) },
    workflowTitle: { color: t.text, marginBottom: 9 },
    workflowBody: { color: t.textMuted, maxWidth: 360 },
    workflowRule: { position: 'absolute', right: -12, top: 60, height: 1, width: 22, backgroundColor: t.border, display: l.isPhone ? 'none' : 'flex' },
    capabilitiesSection: { paddingTop: l.isPhone ? 42 : 70, paddingBottom: l.isPhone ? 42 : 70 },
    capabilitiesHeader: { maxWidth: 720, marginBottom: 28 },
    statusIntro: { color: t.textMuted, marginTop: 12 },
    statusGrid: { flexDirection: l.isStacked ? 'column' : 'row', gap: l.isPhone ? 26 : 38, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.border, paddingVertical: 22 },
    statusColumn: { flexGrow: 1, flexShrink: 1, flexBasis: '50%', minWidth: 0 },
    statusColumnTitle: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 17 },
    statusTitleIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statusTitle: { color: t.text },
    availableRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 12, paddingRight: 10 },
    availableText: { color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    plannedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 11, borderTopWidth: 1, borderTopColor: t.divider },
    plannedIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: softFill(t.violet, t), alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    plannedCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    plannedTitle: { color: t.text, fontSize: 14, lineHeight: 20, fontWeight: '800' },
    plannedBody: { color: t.textMuted, fontSize: 13, lineHeight: 19, marginTop: 2 },
    plannedPill: { borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: t.surfaceMuted },
    plannedPillText: { color: t.textSubtle, fontSize: 10, letterSpacing: 0.6, fontWeight: '800' },
    faqLayout: { flexDirection: l.isStacked ? 'column' : 'row', gap: 30, paddingBottom: 42 },
    faqIntro: { flexGrow: 1, flexShrink: 1, flexBasis: '35%', minWidth: 0 },
    faqList: { flexGrow: 1, flexShrink: 1, flexBasis: '60%', minWidth: 0 },
    faqItem: { borderTopWidth: 1, borderTopColor: t.border },
    faqTrigger: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 10 },
    faqQuestion: { color: t.text, fontSize: 15, lineHeight: 21, fontWeight: '700', flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    faqToggle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceMuted },
    faqToggleOpen: { backgroundColor: t.brand },
    faqAnswer: { color: t.textMuted, paddingBottom: 17, paddingRight: 20 },
    closingRow: { flexDirection: l.isStacked ? 'column' : 'row', alignItems: l.isStacked ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 18, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 25 },
    closingCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    closingEyebrow: { color: t.textSubtle, fontSize: 11, letterSpacing: 0.9, fontWeight: '800', marginBottom: 5 },
    closingTitle: { color: t.text },
  });
}

export default VideoStudioPage;
