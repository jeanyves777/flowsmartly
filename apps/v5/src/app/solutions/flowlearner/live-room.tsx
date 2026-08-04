import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Media } from '@/components/public/media';
import { Reveal, useCountUp } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
  useSectionShell,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Up to 500 seats', 'Recorded automatically', 'Nothing to install'];

type Participant = {
  key: string;
  media: string;
  name: string;
  role: string;
  mic: 'on' | 'off';
  hand?: boolean;
  accent: Accent;
};

const PARTICIPANTS: Participant[] = [
  { key: 'p1', media: 'people/arjun-patel', name: 'Arjun Patel', role: 'Co-host', mic: 'on', accent: 'violet' },
  { key: 'p2', media: 'people/lena-park', name: 'Lena Park', role: 'Moderator', mic: 'off', accent: 'orange' },
  { key: 'p3', media: 'people/david-chen', name: 'David Chen', role: 'Attendee', mic: 'off', hand: true, accent: 'brand' },
  { key: 'p4', media: 'people/aisha-williams', name: 'Aisha Williams', role: 'Attendee', mic: 'off', hand: true, accent: 'green' },
  { key: 'p5', media: 'people/carlos-ramirez', name: 'Carlos Ramirez', role: 'Attendee', mic: 'off', accent: 'pink' },
];

const CHAT: { key: string; media: string; name: string; time: string; body: string }[] = [
  { key: 'm1', media: 'people/maya-chen', name: 'Maya Chen', time: '12:04', body: 'Can you draw the funnel again? I joined late.' },
  { key: 'm2', media: 'people/jordan-lee', name: 'Jordan Lee', time: '12:05', body: 'The qualifying question is the part we always skip 😅' },
  { key: 'm3', media: 'people/priya-shah', name: 'Priya Shah', time: '12:06', body: 'Sharing this with my whole team after.' },
];

const CONTROLS: { key: string; icon: string; label: string; on?: boolean; danger?: boolean }[] = [
  { key: 'mic', icon: 'microphone', label: 'Mute', on: true },
  { key: 'camera', icon: 'video', label: 'Stop camera', on: true },
  { key: 'share', icon: 'arrow-up-from-bracket', label: 'Share screen' },
  { key: 'board', icon: 'chalkboard', label: 'Whiteboard', on: true },
  { key: 'polls', icon: 'chart-simple', label: 'Polls' },
  { key: 'record', icon: 'circle-dot', label: 'Recording', on: true },
  { key: 'end', icon: 'phone-slash', label: 'End session', danger: true },
];

const POLL_OPTIONS: { key: string; label: string; share: number; accent: Accent }[] = [
  { key: 'a', label: 'Ask about their problem', share: 62, accent: 'brand' },
  { key: 'b', label: 'Send the pricing page', share: 18, accent: 'violet' },
  { key: 'c', label: 'Book a demo', share: 14, accent: 'orange' },
  { key: 'd', label: 'Nothing — wait', share: 6, accent: 'pink' },
];

const REACTIONS: { key: string; icon: string; count: string; accent: Accent }[] = [
  { key: 'clap', icon: 'hands-clapping', count: '46', accent: 'orange' },
  { key: 'heart', icon: 'heart', count: '31', accent: 'pink' },
  { key: 'bulb', icon: 'lightbulb', count: '22', accent: 'violet' },
  { key: 'check', icon: 'thumbs-up', count: '58', accent: 'green' },
];

const QUESTIONS: { key: string; who: string; body: string; votes: number; answered?: boolean }[] = [
  { key: 'q1', who: 'David Chen', body: 'How do you qualify without sounding like an interrogation?', votes: 24 },
  { key: 'q2', who: 'Aisha Williams', body: 'What if the buyer will not name a budget?', votes: 17 },
  { key: 'q3', who: 'Maya Chen', body: 'Can we get the funnel drawing afterwards?', votes: 9, answered: true },
];

const PARTICIPATION: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'polls',
    icon: 'chart-simple',
    title: 'Polls with live results',
    body: 'Ask, and the bars fill as the room answers. Everyone sees where the group actually stands.',
    accent: 'brand',
  },
  {
    key: 'reactions',
    icon: 'hands-clapping',
    title: 'Reactions',
    body: 'A quiet room is not an unhappy one. Reactions give people a way to respond without interrupting.',
    accent: 'orange',
  },
  {
    key: 'hand',
    icon: 'hand',
    title: 'Hand raise',
    body: 'Anyone can ask to speak. You see the queue in order, and you decide who gets the microphone.',
    accent: 'violet',
  },
  {
    key: 'qa',
    icon: 'circle-question',
    title: 'Q&A with upvotes',
    body: 'Questions are collected and voted on, so the one twenty people wanted asked does not get lost in chat.',
    accent: 'green',
  },
];

const BOARD_FEATURES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'co',
    icon: 'user-pen',
    title: 'Co-annotation',
    body: 'Let the room draw on the same board. Every cursor is labelled, so you always know whose stroke that was.',
    accent: 'brand',
  },
  {
    key: 'lock',
    icon: 'lock',
    title: 'Presenter lock',
    body: 'One tap and the board is yours alone again — useful the moment a diagram becomes a doodle.',
    accent: 'violet',
  },
  {
    key: 'snap',
    icon: 'shapes',
    title: 'Snap shapes',
    body: 'Rough boxes become boxes and arrows find their target, so a live sketch still reads back later.',
    accent: 'orange',
  },
  {
    key: 'save',
    icon: 'floppy-disk',
    title: 'Save to the lesson',
    body: 'Whatever you drew becomes a slide in the lesson, ready to teach again without redrawing it.',
    accent: 'green',
  },
];

const BOARD_CURSORS: { key: string; name: string; accent: Accent; left: DimensionValue; top: DimensionValue }[] = [
  { key: 'c1', name: 'Arjun', accent: 'violet', left: '18%', top: '16%' },
  { key: 'c2', name: 'Lena', accent: 'orange', left: '58%', top: '52%' },
  { key: 'c3', name: 'David', accent: 'green', left: '34%', top: '72%' },
];

type RoleKey = 'host' | 'cohost' | 'moderator' | 'attendee';

const ROLE_COLUMNS: { key: RoleKey; label: string; accent: Accent }[] = [
  { key: 'host', label: 'Host', accent: 'brand' },
  { key: 'cohost', label: 'Co-host', accent: 'violet' },
  { key: 'moderator', label: 'Moderator', accent: 'orange' },
  { key: 'attendee', label: 'Attendee', accent: 'green' },
];

const PERMISSIONS: { key: string; label: string; allow: Record<RoleKey, boolean> }[] = [
  { key: 'present', label: 'Present and share screen', allow: { host: true, cohost: true, moderator: false, attendee: false } },
  { key: 'draw', label: 'Draw on the whiteboard', allow: { host: true, cohost: true, moderator: false, attendee: true } },
  { key: 'polls', label: 'Launch polls and quizzes', allow: { host: true, cohost: true, moderator: false, attendee: false } },
  { key: 'mute', label: 'Mute or remove someone', allow: { host: true, cohost: true, moderator: true, attendee: false } },
  { key: 'chat', label: 'Moderate chat and Q&A', allow: { host: true, cohost: true, moderator: true, attendee: false } },
  { key: 'breakout', label: 'Open and assign breakouts', allow: { host: true, cohost: true, moderator: false, attendee: false } },
  { key: 'record', label: 'Start and stop recording', allow: { host: true, cohost: false, moderator: false, attendee: false } },
  { key: 'ask', label: 'Ask questions and react', allow: { host: true, cohost: true, moderator: true, attendee: true } },
];

const BREAKOUTS: {
  key: string;
  name: string;
  topic: string;
  people: { media: string; alt: string }[];
  extra: string;
  accent: Accent;
}[] = [
  {
    key: 'b1',
    name: 'Room 1',
    topic: 'Discovery questions',
    people: [
      { media: 'people/arjun-patel', alt: 'Arjun Patel in room 1' },
      { media: 'people/maya-chen', alt: 'Maya Chen in room 1' },
      { media: 'people/david-chen', alt: 'David Chen in room 1' },
    ],
    extra: '+5',
    accent: 'brand',
  },
  {
    key: 'b2',
    name: 'Room 2',
    topic: 'Handling “too expensive”',
    people: [
      { media: 'people/lena-park', alt: 'Lena Park in room 2' },
      { media: 'people/jordan-lee', alt: 'Jordan Lee in room 2' },
      { media: 'people/priya-shah', alt: 'Priya Shah in room 2' },
    ],
    extra: '+4',
    accent: 'violet',
  },
  {
    key: 'b3',
    name: 'Room 3',
    topic: 'The follow-up message',
    people: [
      { media: 'people/aisha-williams', alt: 'Aisha Williams in room 3' },
      { media: 'people/carlos-ramirez', alt: 'Carlos Ramirez in room 3' },
      { media: 'people/michael-reyes', alt: 'Michael Reyes in room 3' },
    ],
    extra: '+6',
    accent: 'orange',
  },
  {
    key: 'b4',
    name: 'Room 4',
    topic: 'When to walk away',
    people: [
      { media: 'people/amanda-rodriguez', alt: 'Amanda Rodriguez in room 4' },
      { media: 'people/daniel-kim', alt: 'Daniel Kim in room 4' },
      { media: 'people/maya-patel', alt: 'Maya Patel in room 4' },
    ],
    extra: '+5',
    accent: 'green',
  },
];

const BREAKOUT_POINTS = [
  'Split the room automatically, or drag people into the group you want them in.',
  'Every room gets the same prompt, a timer and its own whiteboard.',
  'Drop into any room to listen, and broadcast a message to all of them at once.',
  'When time is up everyone comes back — with what they wrote still attached.',
];

const REPLAY_FEATURES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'transcript',
    icon: 'closed-captioning',
    title: 'Automatic transcript',
    body: 'Searchable, speaker-labelled and ready before you have closed your laptop.',
    accent: 'brand',
  },
  {
    key: 'chapters',
    icon: 'list-ol',
    title: 'Chaptered replay',
    body: 'The recording is split at each teaching moment, so nobody scrubs for the part they missed.',
    accent: 'violet',
  },
  {
    key: 'clip',
    icon: 'scissors',
    title: 'Clip to a lesson',
    body: 'Cut the two minutes that explained it best and attach the clip straight to the lesson.',
    accent: 'orange',
  },
];

const CHAPTERS: { key: string; time: string; label: string; moment: string }[] = [
  { key: 'ch1', time: '00:00', label: 'Why this matters', moment: 'Hook' },
  { key: 'ch2', time: '04:12', label: 'The buying journey', moment: 'Explain' },
  { key: 'ch3', time: '12:40', label: 'A real call, annotated', moment: 'Demonstrate' },
  { key: 'ch4', time: '19:05', label: 'Drawing the funnel', moment: 'Draw' },
  { key: 'ch5', time: '26:31', label: 'Breakouts: qualify a lead', moment: 'Practice' },
  { key: 'ch6', time: '38:18', label: 'Check understanding', moment: 'Check' },
];

const SETUP_ROWS: { key: string; icon: string; label: string; value: string; on: boolean }[] = [
  { key: 'seats', icon: 'chair', label: 'Seats', value: '250 of 500', on: true },
  { key: 'waiting', icon: 'door-closed', label: 'Waiting room', value: 'On — you admit', on: true },
  { key: 'record', icon: 'circle-dot', label: 'Record the session', value: 'Automatic', on: true },
  { key: 'chat', icon: 'comments', label: 'Chat & reactions', value: 'Everyone', on: true },
  { key: 'qa', icon: 'circle-question', label: 'Q&A with upvotes', value: 'On, moderated', on: true },
  { key: 'anon', icon: 'user-secret', label: 'Anonymous questions', value: 'Off', on: false },
];

const SUMMARY_STATS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  suffix: string;
  accent: Accent;
}[] = [
  { key: 'attendance', label: 'Attendance', target: 92, decimals: 0, suffix: '%', accent: 'brand' },
  { key: 'engagement', label: 'Avg engagement', target: 8.9, decimals: 1, suffix: '', accent: 'violet' },
  { key: 'questions', label: 'Questions asked', target: 34, decimals: 0, suffix: '', accent: 'orange' },
  { key: 'polls', label: 'Poll responses', target: 216, decimals: 0, suffix: '', accent: 'green' },
];

const SUMMARY_ROWS: { key: string; label: string; value: string }[] = [
  { key: 'r1', label: 'Joined', value: '128 of 139 invited' },
  { key: 'r2', label: 'Stayed to the end', value: '111 people · 87%' },
  { key: 'r3', label: 'Hands raised', value: '19' },
  { key: 'r4', label: 'Replay watched since', value: '46 people' },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useAccent() {
  const t = useTokens();
  return useCallback(
    (accent: Accent) =>
      accent === 'violet'
        ? t.violet
        : accent === 'green'
          ? t.green
          : accent === 'orange'
            ? t.orange
            : accent === 'pink'
              ? t.pink
              : t.brand,
    [t],
  );
}

/** The stroke being drawn on the shared board — real geometry, not a border. */
function BoardStroke({ width, color }: { width: number; color: string }) {
  const w = Math.max(120, width);
  const d =
    `M6 46 C ${w * 0.16} 8, ${w * 0.3} 8, ${w * 0.4} 34 ` +
    `S ${w * 0.58} 62, ${w * 0.68} 32 ` +
    `S ${w * 0.86} 6, ${w - 8} 26`;
  return (
    <Svg width={w} height={62} pointerEvents="none">
      <Path d={d} stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.9} />
    </Svg>
  );
}

/**
 * The room-setup panel's "Go live" bar. It is part of the mockup — identical to
 * the product's primary button, and deliberately without press behaviour.
 */
function MockGoLive({ label, icon, t }: { label: string; icon: string; t: ThemeTokens }) {
  return (
    <View
      style={[
        { width: '100%', minHeight: 48, borderRadius: 10, overflow: 'hidden' },
        elevation(t, 1) as ViewStyle,
      ]}>
      <LinearGradient
        colors={[t.gradient[0], t.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 48,
          paddingHorizontal: 22,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}>
        <FontAwesome6 name={icon as never} size={15} color={t.textOnBrand} />
        <Text style={{ color: t.textOnBrand, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

function StatTile({
  label,
  target,
  decimals,
  suffix,
  accent,
  styles,
}: {
  label: string;
  target: number;
  decimals: number;
  suffix: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(target, { decimals });
  const shown =
    decimals > 0 ? counter.value.toFixed(decimals) : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.statTile}>
      <Text numberOfLines={1} style={[styles.statValue, { color: accent }]}>
        {`${shown}${suffix}`}
      </Text>
      <Text numberOfLines={2} style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function LiveRoomPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const shell = useSectionShell();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  return (
    <PageShell
      title="Live Room"
      description="Teach with video, whiteboard, co-hosts and audience participation — live drawing, polls, chat, Q&A, breakouts and recording, all in one room."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'FlowLearner', path: ROUTES.flowLearner },
          { name: 'Live Room', path: ROUTES.liveRoom },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={shell} distance={22}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>FLOWLEARNER · LIVE ROOM</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Teach with video, whiteboard, co-hosts, and audience participation.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Run interactive sessions where people actually take part — live drawing, polls, chat,
              Q&amp;A, breakouts, and recording.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Start a live room"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="live-room.hero.start-room"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="See a session"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="live-room.hero.see-a-session"
                  onPress={() => router.push(contactHref('demo') as never)}
                />
              </ButtonRow>
            </View>
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <View style={styles.proofIcon}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text numberOfLines={1} style={styles.proofText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="See how FlowLearner fits together"
              onPress={() => router.push(ROUTES.flowLearner as never)}
              style={({ pressed }) => [styles.backLink, pressed ? styles.pressed : null]}>
              <FontAwesome6 name="graduation-cap" size={12} color={t.brand} />
              <Text style={styles.backLinkText}>See how FlowLearner fits together</Text>
              <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
            </Pressable>
          </View>

          {/* ---------------- the room ---------------- */}
          <View style={styles.heroVisual}>
            <View style={styles.room}>
              <View style={styles.roomHead}>
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <Text numberOfLines={1} style={styles.timer}>
                  41:26
                </Text>
                <View style={styles.headCount}>
                  <FontAwesome6 name="user-group" size={11} color={t.textMuted} />
                  <Text numberOfLines={1} style={styles.headCountText}>
                    128 participants
                  </Text>
                </View>
              </View>

              <View style={styles.roomBody}>
                {/* stage: presenter + whiteboard */}
                <View style={styles.stage}>
                  <View style={styles.presenterTile}>
                    <Media
                      name="people/megan-roberts"
                      alt="Megan Roberts presenting the live session"
                      style={styles.presenterImage}
                      radius={13}
                    />
                    <View style={styles.presenterBadge}>
                      <FontAwesome6 name="microphone" size={9} color={t.textOnBrand} />
                      <Text numberOfLines={1} style={styles.presenterName}>
                        Megan Roberts
                      </Text>
                    </View>
                    <View style={styles.speakingRing} />
                  </View>

                  <View style={styles.boardTile}>
                    <View style={styles.boardTileHead}>
                      <Text numberOfLines={1} style={styles.boardTileTitle}>
                        Shared whiteboard
                      </Text>
                      <View style={styles.drawingChip}>
                        <View style={styles.drawingDot} />
                        <Text style={styles.drawingChipText}>Drawing</Text>
                      </View>
                    </View>

                    <View style={styles.boardCanvas}>
                      <View style={styles.boardShapes}>
                        <View style={[styles.boardShape, { borderColor: hexToRgba(t.brand, 0.55) }]}>
                          <Text numberOfLines={1} style={styles.boardShapeText}>
                            Problem
                          </Text>
                        </View>
                        <View style={[styles.boardShape, { borderColor: hexToRgba(t.violet, 0.55) }]}>
                          <Text numberOfLines={1} style={styles.boardShapeText}>
                            Proof
                          </Text>
                        </View>
                        <View style={[styles.boardShape, { borderColor: t.orange }]}>
                          <Text numberOfLines={1} style={styles.boardShapeText}>
                            Offer
                          </Text>
                        </View>
                      </View>
                      <BoardStroke width={l.isPhone ? 200 : 300} color={t.orange} />
                      <Text numberOfLines={1} style={styles.boardCaption}>
                        Megan is drawing · 3 people annotating
                      </Text>
                    </View>
                  </View>
                </View>

                {/* side: participants + chat */}
                <View style={styles.side}>
                  <View style={styles.sidePanel}>
                    <View style={styles.panelHead}>
                      <Text style={styles.paneLabel}>Participants</Text>
                      <Text numberOfLines={1} style={styles.panelCount}>
                        128
                      </Text>
                    </View>
                    <View style={styles.participantList}>
                      {PARTICIPANTS.map((person) => {
                        const accent = accentOf(person.accent);
                        return (
                          <View key={person.key} style={styles.participantRow}>
                            <Media
                              name={person.media}
                              alt={`${person.name}, ${person.role}`}
                              style={styles.participantAvatar}
                              radius={13}
                            />
                            <View style={styles.participantCopy}>
                              <Text numberOfLines={1} style={styles.participantName}>
                                {person.name}
                              </Text>
                              <Text numberOfLines={1} style={[styles.participantRole, { color: accent }]}>
                                {person.role}
                              </Text>
                            </View>
                            {person.hand ? (
                              <View style={styles.handChip}>
                                <FontAwesome6 name="hand" size={9} color={t.warnText} />
                              </View>
                            ) : null}
                            <View style={styles.micChip}>
                              <FontAwesome6
                                name={person.mic === 'on' ? 'microphone' : 'microphone-slash'}
                                size={9}
                                color={person.mic === 'on' ? t.successText : t.textSubtle}
                              />
                            </View>
                          </View>
                        );
                      })}
                      <Text numberOfLines={1} style={styles.participantMore}>
                        and 123 more
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sidePanel}>
                    <View style={styles.panelHead}>
                      <Text style={styles.paneLabel}>Chat</Text>
                      <Text numberOfLines={1} style={styles.panelCount}>
                        62
                      </Text>
                    </View>
                    <View style={styles.chatList}>
                      {CHAT.map((message) => (
                        <View key={message.key} style={styles.chatRow}>
                          <Media
                            name={message.media}
                            alt={`${message.name} in chat`}
                            style={styles.chatAvatar}
                            radius={11}
                          />
                          <View style={styles.chatCopy}>
                            <View style={styles.chatHead}>
                              <Text numberOfLines={1} style={styles.chatName}>
                                {message.name}
                              </Text>
                              <Text numberOfLines={1} style={styles.chatTime}>
                                {message.time}
                              </Text>
                            </View>
                            <Text style={styles.chatBody}>{message.body}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* The room's control bar illustrates the live surface — it keeps
                  the exact look but is not interactive on a marketing page. */}
              <View style={styles.controlBar}>
                {CONTROLS.map((control) => (
                  <View
                    key={control.key}
                    accessibilityLabel={control.label}
                    style={[
                      styles.controlButton,
                      control.on ? styles.controlOn : null,
                      control.danger ? styles.controlDanger : null,
                    ]}>
                    <FontAwesome6
                      name={control.icon as never}
                      size={14}
                      color={control.danger ? t.textOnBrand : control.on ? t.brand : t.textMuted}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ participation */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>PARTICIPATION, NOT ATTENDANCE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Everyone participates, not just watches.</Heading>
          <Text style={[type.body, styles.headSub]}>
            A session where only one person talks is a video. These are the four things that turn a
            room of viewers back into a class.
          </Text>
        </Reveal>

        <View style={styles.featureGrid}>
          {PARTICIPATION.map((item, index) => {
            const accent = accentOf(item.accent);
            return (
              <Reveal key={item.key} style={styles.featureCell} distance={16} delay={index * 60}>
                <View style={styles.featureCard}>
                  <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={item.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.featureTitle]}>{item.title}</Text>
                  <Text style={styles.featureBody}>{item.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <View style={styles.participationRow}>
          <Reveal style={styles.participationCell} distance={16}>
            <View style={styles.panelCard}>
              <View style={styles.panelCardHead}>
                <View style={styles.panelCardIcon}>
                  <FontAwesome6 name="chart-simple" size={14} color={t.brand} />
                </View>
                <View style={styles.panelCardCopy}>
                  <Text numberOfLines={1} style={styles.panelCardTitle}>
                    Live poll
                  </Text>
                  <Text numberOfLines={1} style={styles.panelCardMeta}>
                    216 of 128 seats responded · closing in 12s
                  </Text>
                </View>
              </View>
              <Text style={styles.pollQuestion}>
                A buyer says “send me pricing”. What do you do first?
              </Text>
              <View style={styles.pollList}>
                {POLL_OPTIONS.map((option) => {
                  const accent = accentOf(option.accent);
                  const bar: DimensionValue = `${option.share}%`;
                  return (
                    <View key={option.key} style={styles.pollRow}>
                      <View style={styles.pollLabelRow}>
                        <Text numberOfLines={1} style={styles.pollLabel}>
                          {option.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.pollPct}>
                          {`${option.share}%`}
                        </Text>
                      </View>
                      <View style={styles.pollTrack}>
                        <View style={[styles.pollFill, { width: bar, backgroundColor: accent }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.reactionRow}>
                {REACTIONS.map((reaction) => {
                  const accent = accentOf(reaction.accent);
                  return (
                    <View key={reaction.key} style={styles.reactionChip}>
                      <FontAwesome6 name={reaction.icon as never} size={12} color={accent} />
                      <Text numberOfLines={1} style={styles.reactionCount}>
                        {reaction.count}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.participationCell} distance={16} delay={90}>
            <View style={styles.panelCard}>
              <View style={styles.panelCardHead}>
                <View style={styles.panelCardIcon}>
                  <FontAwesome6 name="circle-question" size={14} color={t.brand} />
                </View>
                <View style={styles.panelCardCopy}>
                  <Text numberOfLines={1} style={styles.panelCardTitle}>
                    Q&amp;A
                  </Text>
                  <Text numberOfLines={1} style={styles.panelCardMeta}>
                    34 asked · sorted by votes
                  </Text>
                </View>
              </View>
              <View style={styles.questionList}>
                {QUESTIONS.map((question) => (
                  <View key={question.key} style={styles.questionRow}>
                    <View style={styles.voteBox}>
                      <FontAwesome6 name="caret-up" size={12} color={t.brand} />
                      <Text style={styles.voteCount}>{question.votes}</Text>
                    </View>
                    <View style={styles.questionCopy}>
                      <Text style={styles.questionText}>{question.body}</Text>
                      <Text numberOfLines={1} style={styles.questionWho}>
                        {question.who}
                      </Text>
                    </View>
                    {question.answered ? (
                      <View style={styles.answeredChip}>
                        <FontAwesome6 name="check" size={8} color={t.successText} />
                        <Text style={styles.answeredChipText}>Answered</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
              <View style={styles.handQueue}>
                <FontAwesome6 name="hand" size={12} color={t.warnText} />
                <Text numberOfLines={1} style={styles.handQueueText}>
                  2 hands raised — David, then Aisha
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ whiteboard */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitVisual} distance={16}>
            <View style={styles.sharedBoardCard}>
              <View style={styles.sharedBoardHead}>
                <Text numberOfLines={1} style={styles.sharedBoardTitle}>
                  Everyone can draw
                </Text>
                <View style={styles.lockChip}>
                  <FontAwesome6 name="lock-open" size={10} color={t.chipText} />
                  <Text style={styles.lockChipText}>Unlocked</Text>
                </View>
              </View>
              <View style={styles.sharedBoard}>
                <View style={styles.sharedShapes}>
                  <View style={[styles.sharedShape, { borderColor: hexToRgba(t.brand, 0.5) }]} />
                  <View style={[styles.sharedShape, { borderColor: hexToRgba(t.violet, 0.5) }]} />
                  <View style={[styles.sharedShape, { borderColor: hexToRgba(t.green, 0.5) }]} />
                </View>
                <BoardStroke width={l.isPhone ? 220 : 340} color={t.brand} />
                {BOARD_CURSORS.map((cursor) => {
                  const accent = accentOf(cursor.accent);
                  return (
                    <View
                      key={cursor.key}
                      style={[styles.cursor, { left: cursor.left, top: cursor.top }]}>
                      <FontAwesome6 name="arrow-pointer" size={11} color={accent} />
                      <View style={[styles.cursorTag, { backgroundColor: accent }]}>
                        <Text numberOfLines={1} style={styles.cursorName}>
                          {cursor.name}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text numberOfLines={1} style={styles.sharedBoardFoot}>
                Saved to “Selling without a script” · step 4
              </Text>
            </View>
          </Reveal>

          <Reveal style={styles.splitCopy} distance={16} delay={90}>
            <SectionLabel>ONE SURFACE, SHARED</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>One whiteboard, many hands.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              The board is the room’s, not just yours — until you decide otherwise. Whatever the class
              builds together goes back into the lesson.
            </Text>
            <View style={styles.rowList}>
              {BOARD_FEATURES.map((feature) => {
                const accent = accentOf(feature.accent);
                return (
                  <View key={feature.key} style={styles.rowItem}>
                    <View style={[styles.rowIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={feature.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{feature.title}</Text>
                      <Text style={styles.rowBody}>{feature.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ roles */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>WHO CAN DO WHAT</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Co-hosts and moderation.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Teaching and running the room are two jobs. Hand the second one to someone else and set
            exactly how far it goes.
          </Text>
        </Reveal>

        <Reveal style={styles.matrixWrap} distance={16}>
          <View style={styles.matrixCard}>
            {/*
              Eight capability rows across four role columns cannot compress below
              roughly 620px without the labels truncating, so the matrix scrolls
              inside its own card rather than pushing the page sideways.
            */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={!l.isPhone}
              contentContainerStyle={styles.matrixScroll}>
              <View style={styles.matrix}>
                <View style={styles.matrixHeadRow}>
                  <Text numberOfLines={1} style={[styles.matrixHeadCell, styles.matrixLabelCell]}>
                    Capability
                  </Text>
                  {ROLE_COLUMNS.map((role) => {
                    const accent = accentOf(role.accent);
                    return (
                      <View key={role.key} style={styles.matrixRoleCell}>
                        <View style={[styles.matrixRoleChip, { backgroundColor: softFill(accent, t) }]}>
                          <Text numberOfLines={1} style={[styles.matrixRoleText, { color: accent }]}>
                            {role.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {PERMISSIONS.map((permission) => (
                  <View key={permission.key} style={styles.matrixRow}>
                    <Text numberOfLines={1} style={[styles.matrixLabel, styles.matrixLabelCell]}>
                      {permission.label}
                    </Text>
                    {ROLE_COLUMNS.map((role) => {
                      const allowed = permission.allow[role.key];
                      return (
                        <View key={role.key} style={styles.matrixRoleCell}>
                          <View
                            style={[
                              styles.matrixMark,
                              { backgroundColor: allowed ? softFill(t.green, t) : t.surfaceInset },
                            ]}>
                            <FontAwesome6
                              name={allowed ? 'check' : 'minus'}
                              size={10}
                              color={allowed ? t.green : t.textSubtle}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ breakouts */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>SMALL GROUPS, SAME SESSION</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Breakout rooms.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              Thirty people will not all speak in one room. Four groups of eight will — and you can be
              in any of them.
            </Text>
            <View style={styles.pointList}>
              {BREAKOUT_POINTS.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.breakoutCard}>
              <View style={styles.breakoutHead}>
                <View style={styles.breakoutHeadCopy}>
                  <Text numberOfLines={1} style={styles.breakoutTitle}>
                    Breakout rooms
                  </Text>
                  <Text numberOfLines={1} style={styles.breakoutMeta}>
                    4 rooms · 32 people assigned · 8 minutes
                  </Text>
                </View>
                <View style={styles.breakoutTimer}>
                  <FontAwesome6 name="clock" size={10} color={t.chipText} />
                  <Text style={styles.breakoutTimerText}>07:12</Text>
                </View>
              </View>

              <View style={styles.roomGrid}>
                {BREAKOUTS.map((room) => {
                  const accent = accentOf(room.accent);
                  return (
                    <View key={room.key} style={styles.roomCell}>
                      <View style={styles.roomCard}>
                        <View style={styles.roomCardHead}>
                          <View style={[styles.roomBadge, { backgroundColor: softFill(accent, t) }]}>
                            <Text numberOfLines={1} style={[styles.roomBadgeText, { color: accent }]}>
                              {room.name}
                            </Text>
                          </View>
                        </View>
                        <Text numberOfLines={2} style={styles.roomTopic}>
                          {room.topic}
                        </Text>
                        <View style={styles.roomPeople}>
                          {room.people.map((person, index) => (
                            <View
                              key={person.media}
                              style={[styles.roomAvatarWrap, index === 0 ? null : styles.roomAvatarOverlap]}>
                              <Media
                                name={person.media}
                                alt={person.alt}
                                style={styles.roomAvatar}
                                radius={12}
                              />
                            </View>
                          ))}
                          <Text numberOfLines={1} style={styles.roomExtra}>
                            {room.extra}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Breakout controls inside the mockup — illustration only. */}
              <View style={styles.breakoutFoot}>
                <View style={styles.ghostButton}>
                  <FontAwesome6 name="shuffle" size={11} color={t.brand} />
                  <Text style={styles.ghostButtonText}>Auto-assign</Text>
                </View>
                <View style={styles.solidButton}>
                  <Text style={styles.solidButtonText}>Bring everyone back</Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ recording & replay */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>THE SESSION OUTLIVES THE HOUR</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Recording and replay.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Whoever could not make it should still learn it. The recording arrives written up,
            chaptered and ready to reuse.
          </Text>
        </Reveal>

        <View style={styles.replayGrid}>
          {REPLAY_FEATURES.map((item, index) => {
            const accent = accentOf(item.accent);
            return (
              <Reveal key={item.key} style={styles.replayCell} distance={16} delay={index * 65}>
                <View style={styles.featureCard}>
                  <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={item.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.featureTitle]}>{item.title}</Text>
                  <Text style={styles.featureBody}>{item.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <Reveal style={styles.replayWrap} distance={16}>
          <View style={styles.replayCard}>
            <View style={styles.replayHead}>
              <View style={styles.replayHeadCopy}>
                <Text numberOfLines={1} style={styles.replayTitle}>
                  Selling without a script — replay
                </Text>
                <Text numberOfLines={1} style={styles.replayMeta}>
                  46 min · transcript ready · 128 attended
                </Text>
              </View>
              <View style={styles.recordedChip}>
                <FontAwesome6 name="circle-dot" size={10} color={t.successText} />
                <Text style={styles.recordedChipText}>Recorded</Text>
              </View>
            </View>

            <View style={styles.scrubRow}>
              <View style={styles.scrubButton}>
                <FontAwesome6 name="play" size={11} color={t.brand} />
              </View>
              <View style={styles.scrubTrack}>
                <View style={styles.scrubFill} />
                {['9%', '27%', '41%', '57%', '83%'].map((mark) => (
                  <View key={mark} style={[styles.scrubMark, { left: mark as DimensionValue }]} />
                ))}
              </View>
              <Text numberOfLines={1} style={styles.scrubTime}>
                19:05
              </Text>
            </View>

            <View style={styles.chapterList}>
              {CHAPTERS.map((chapter, index) => (
                <View
                  key={chapter.key}
                  style={[styles.chapterRow, index === 3 ? styles.chapterRowActive : null]}>
                  <Text numberOfLines={1} style={styles.chapterTime}>
                    {chapter.time}
                  </Text>
                  <Text numberOfLines={1} style={styles.chapterLabel}>
                    {chapter.label}
                  </Text>
                  {/* the moment chip is the first thing to go on a phone — it is
                      what squeezes the chapter title down to two words */}
                  {l.isPhone ? null : (
                    <View style={styles.chapterChip}>
                      <Text numberOfLines={1} style={styles.chapterChipText}>
                        {chapter.moment}
                      </Text>
                    </View>
                  )}
                  <View style={styles.clipButton}>
                    <FontAwesome6 name="scissors" size={10} color={t.brand} />
                    <Text style={styles.clipButtonText}>Clip</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ room setup */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>DECIDED BEFORE ANYONE JOINS</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Room setup you control.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              Every session starts from a setup you can see at a glance — and change mid-session
              without dropping a single person.
            </Text>
            <View style={styles.setupNote}>
              <FontAwesome6 name="shield-halved" size={14} color={t.green} />
              <Text style={styles.setupNoteText}>
                Recording, chat and Q&amp;A are announced to everyone in the room when they are on.
              </Text>
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.setupCard}>
              <View style={styles.setupHead}>
                <View style={styles.setupIcon}>
                  <FontAwesome6 name="sliders" size={14} color={t.brand} />
                </View>
                <View style={styles.setupHeadCopy}>
                  <Text numberOfLines={1} style={styles.setupTitle}>
                    Session setup
                  </Text>
                  <Text numberOfLines={1} style={styles.setupMeta}>
                    Thursday · 2:00pm · 60 min
                  </Text>
                </View>
                <View style={styles.readyChip}>
                  <View style={styles.readyDot} />
                  <Text numberOfLines={1} style={styles.readyChipText}>
                    Ready
                  </Text>
                </View>
              </View>

              <View style={styles.setupList}>
                {SETUP_ROWS.map((row) => (
                  <View key={row.key} style={styles.setupRow}>
                    <View style={styles.setupRowIcon}>
                      <FontAwesome6 name={row.icon as never} size={12} color={t.textMuted} />
                    </View>
                    <View style={styles.setupRowCopy}>
                      <Text numberOfLines={1} style={styles.setupLabel}>
                        {row.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.setupValue}>
                        {row.value}
                      </Text>
                    </View>
                    <View style={[styles.toggle, row.on ? styles.toggleOn : null]}>
                      <View style={[styles.toggleKnob, row.on ? styles.toggleKnobOn : null]} />
                    </View>
                  </View>
                ))}
              </View>

              {/* Part of the room-setup mockup, not a control. */}
              <View style={styles.goLiveButton}>
                <MockGoLive label="Go live" icon="tower-broadcast" t={t} />
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ session summary */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>MEASURED WITHOUT ASKING</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Attendance and engagement captured automatically.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            No register, no follow-up survey. The room already knows who came, who took part and what
            they struggled with.
          </Text>
        </Reveal>

        <View style={styles.statGrid}>
          {SUMMARY_STATS.map((stat) => (
            <Reveal key={stat.key} style={styles.statCell} distance={14}>
              <StatTile
                label={stat.label}
                target={stat.target}
                decimals={stat.decimals}
                suffix={stat.suffix}
                accent={accentOf(stat.accent)}
                styles={styles}
              />
            </Reveal>
          ))}
        </View>

        <Reveal style={styles.summaryWrap} distance={16}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHead}>
              <View style={styles.summaryIcon}>
                <FontAwesome6 name="clipboard-check" size={14} color={t.brand} />
              </View>
              <View style={styles.summaryHeadCopy}>
                <Text numberOfLines={1} style={styles.summaryTitle}>
                  Session summary
                </Text>
                <Text numberOfLines={1} style={styles.summaryMeta}>
                  Selling without a script · Thursday 2:00pm
                </Text>
              </View>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open training analytics"
                onPress={() => router.push(ROUTES.trainingAnalytics as never)}
                style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}>
                <Text style={styles.ghostButtonText}>See analytics</Text>
                <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
              </Pressable>
            </View>

            <View style={styles.summaryRows}>
              {SUMMARY_ROWS.map((row) => (
                <View key={row.key} style={styles.summaryRow}>
                  <Text numberOfLines={1} style={styles.summaryLabel}>
                    {row.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.summaryValue}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ close */}
      <Section>
        <View style={styles.closeRow}>
          <Reveal style={styles.closeCopy} distance={16}>
            <SectionLabel>FLOWLEARNER · LIVE ROOM</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Host your first session.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              Open a room, send one link, and teach. Everything the session produces — the drawing,
              the answers, the recording — is waiting for you when it ends.
            </Text>
            <View style={styles.closeButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Start a live room"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="live-room.close.start-room"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Explore FlowLearner"
                  size="lg"
                  full={l.isPhone}
                  trackId="live-room.close.explore-flowlearner"
                  onPress={() => router.push(ROUTES.flowLearner as never)}
                />
              </ButtonRow>
            </View>
          </Reveal>

          <Reveal style={styles.closeVisual} distance={16} delay={90}>
            <View style={styles.closeCard}>
              <Text style={styles.paneLabel}>What you need</Text>
              <View style={styles.closeList}>
                <View style={styles.closeItem}>
                  <View style={styles.closeItemIcon}>
                    <FontAwesome6 name="pen-ruler" size={12} color={t.brand} />
                  </View>
                  <Text style={styles.closeItemText}>
                    A lesson — build one in Training Studio, or bring slides you already have.
                  </Text>
                </View>
                <View style={styles.closeItem}>
                  <View style={styles.closeItemIcon}>
                    <FontAwesome6 name="link" size={12} color={t.brand} />
                  </View>
                  <Text style={styles.closeItemText}>
                    One link. Attendees join in the browser — no download, no account required.
                  </Text>
                </View>
                <View style={styles.closeItem}>
                  <View style={styles.closeItemIcon}>
                    <FontAwesome6 name="user-group" size={12} color={t.brand} />
                  </View>
                  <Text style={styles.closeItemText}>
                    A co-host, if you want one. Give them the room while you do the teaching.
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Build the lesson first in Training Studio"
                onPress={() => router.push(ROUTES.trainingStudio as never)}
                style={({ pressed }) => [styles.closeLink, pressed ? styles.pressed : null]}>
                <FontAwesome6 name="pen-ruler" size={12} color={t.brand} />
                <Text style={styles.closeLinkText}>Build the lesson first in Training Studio</Text>
                <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
              </Pressable>
            </View>
          </Reveal>
        </View>
      </Section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gap = l.isPhone ? 12 : 18;
  const half = gap / 2;

  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  const featureColumns = columns(1, 2, 2, 4);
  const replayColumns = columns(1, 3, 3, 3);
  const statColumns = columns(1, 2, 4, 4);

  /** The room's stage and side rail sit on top of each other below the tablet width. */
  const roomStacked = l.isCompact;

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 20,
    ...(elevation(t, 1) as ViewStyle),
  };

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
    marginTop: l.isPhone ? 20 : 28,
  };

  const cellBase = (count: number): ViewStyle => ({
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: cellBasis(count),
    minWidth: 0,
    padding: half,
  });

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };

  const panelBase: ViewStyle = {
    height: '100%',
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 18,
    backgroundColor: t.surfaceMuted,
    padding: l.isPhone ? 14 : 20,
    ...(elevation(t, 1) as ViewStyle),
  };

  return StyleSheet.create({
    pressed: { opacity: 0.82 },
    paneLabel: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },

    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'flex-start',
      gap: stacked ? 28 : 40,
    },
    heroCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 400, minWidth: 300, paddingTop: 6 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 540 },
    heroButtons: { marginTop: 22 },
    proofRow: {
      marginTop: 20,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: l.isPhone ? 10 : 18,
    },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    proofIcon: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    proofText: { ...type.caption, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    backLink: {
      marginTop: 18,
      minHeight: 44,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingRight: 4,
    },
    backLinkText: { ...type.caption, color: t.brand, fontWeight: '700' },
    heroVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 600, minWidth: 0 },

    /* -------------------------------------------------- the room */
    room: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 16,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    roomHead: { flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
    liveChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: hexToRgba(t.pink, t.mode === 'light' ? 0.12 : 0.2),
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.pink },
    liveText: { ...type.micro, color: t.pink, fontWeight: '800', letterSpacing: 0.8 },
    timer: {
      fontSize: l.isPhone ? 17 : 19,
      lineHeight: l.isPhone ? 22 : 24,
      fontWeight: '800',
      color: t.text,
      flexGrow: 0,
      flexShrink: 0,
    },
    headCount: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 7,
    },
    headCountText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    roomBody: { flexDirection: roomStacked ? 'column' : 'row', alignItems: 'stretch', gap: 12 },
    stage: roomStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 10 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },

    presenterTile: {
      height: l.isPhone ? 150 : 176,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    presenterImage: { width: '100%', height: '100%' },
    presenterBadge: {
      position: 'absolute',
      left: 10,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: hexToRgba(t.brand, 0.92),
    },
    presenterName: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.textOnBrand },
    speakingRing: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: hexToRgba(t.green, 0.75),
    },

    boardTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 14,
      gap: 10,
    },
    boardTileHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    boardTileTitle: {
      ...type.caption,
      color: t.text,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    drawingChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: softFill(t.orange, t),
    },
    drawingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.orange },
    drawingChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.orange },
    boardCanvas: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 10 : 14,
      gap: 8,
      overflow: 'hidden',
    },
    boardShapes: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    boardShape: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 66,
      minWidth: 0,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 8,
    },
    boardShapeText: { ...type.micro, color: t.text, fontWeight: '800' },
    boardCaption: { ...type.micro, color: t.textSubtle },

    side: roomStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 10 }
      : { flexGrow: 0, flexShrink: 0, flexBasis: l.isDesktop ? 236 : 208, width: l.isDesktop ? 236 : 208, gap: 10 },
    sidePanel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 9,
    },
    panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    panelCount: { ...type.micro, color: t.textMuted, fontWeight: '800' },
    participantList: { gap: 7 },
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    participantAvatar: { width: 26, height: 26, flexGrow: 0, flexShrink: 0 },
    participantCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 1 },
    participantName: { ...type.micro, color: t.text, fontWeight: '700' },
    participantRole: { ...type.micro, fontWeight: '700' },
    handChip: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.warnBg,
    },
    micChip: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    participantMore: { ...type.micro, color: t.textSubtle, paddingTop: 2 },

    chatList: { gap: 9 },
    chatRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    chatAvatar: { width: 22, height: 22, flexGrow: 0, flexShrink: 0 },
    chatCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    chatHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    chatName: { ...type.micro, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    chatTime: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    chatBody: { ...type.micro, color: t.textMuted },

    controlBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    controlButton: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    controlOn: { backgroundColor: t.brandSoft },
    controlDanger: { backgroundColor: t.pink },

    /* -------------------------------------------------- shared heads */
    head: { gap: 10, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    headSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 700 },

    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    splitCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { ...twoUp, paddingTop: 4 },
    splitVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : twoUp,
    blockTitle: { marginTop: 14 },
    blockBody: { marginTop: 14, maxWidth: 540 },

    pointList: { marginTop: 20, gap: 13 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    pointTick: {
      width: 22,
      height: 22,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    pointText: { ...type.bodySm, color: t.text, flexShrink: 1, minWidth: 0 },

    rowList: { marginTop: 20, gap: 16 },
    rowItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    rowIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    rowTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    rowBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- participation */
    featureGrid: gridBase,
    featureCell: cellBase(featureColumns),
    featureCard: { ...cardBase, height: '100%', gap: 10 },
    featureIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTitle: { marginTop: 2 },
    featureBody: { ...type.bodySm, color: t.textMuted },

    participationRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: gap,
      marginTop: l.isPhone ? 16 : 22,
    },
    participationCell: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : twoUp,
    panelCard: { ...panelBase, gap: 12 },
    panelCardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    panelCardIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    panelCardCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    panelCardTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    panelCardMeta: { ...type.micro, color: t.textSubtle },

    pollQuestion: { ...type.bodySm, color: t.text, fontWeight: '700' },
    pollList: { gap: 11 },
    pollRow: { gap: 6 },
    pollLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pollLabel: { ...type.caption, color: t.text, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    pollPct: { ...type.caption, color: t.textMuted, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    pollTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    pollFill: { height: 8, borderRadius: 4 },
    reactionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 12,
    },
    reactionChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minHeight: 32,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
    },
    reactionCount: { ...type.micro, color: t.text, fontWeight: '800' },

    questionList: { gap: 8 },
    questionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    voteBox: {
      width: 40,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingVertical: 6,
    },
    voteCount: { ...type.micro, color: t.text, fontWeight: '800' },
    questionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    questionText: { ...type.caption, color: t.text, fontWeight: '600' },
    questionWho: { ...type.micro, color: t.textSubtle },
    answeredChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    answeredChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.successText },
    handQueue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 12,
      backgroundColor: t.warnBg,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    handQueueText: { ...type.micro, color: t.warnText, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- shared whiteboard */
    sharedBoardCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 12,
      ...(elevation(t, 2) as ViewStyle),
    },
    sharedBoardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sharedBoardTitle: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    lockChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    lockChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.chipText },
    sharedBoard: {
      minHeight: 210,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      overflow: 'hidden',
    },
    sharedShapes: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sharedShape: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      height: 46,
      borderWidth: 2,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
    },
    cursor: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
    cursorTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    cursorName: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.textOnBrand },
    sharedBoardFoot: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- permissions matrix */
    matrixWrap: { marginTop: l.isPhone ? 20 : 28 },
    matrixCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 10 : 16,
      overflow: 'hidden',
      ...(elevation(t, 1) as ViewStyle),
    },
    matrixScroll: { minWidth: '100%' },
    // label column + four role columns + the gaps and row padding
    matrix: { minWidth: 660, gap: 5 },
    matrixHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingBottom: 6,
    },
    matrixHeadCell: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    matrixLabelCell: { width: 250, flexGrow: 0, flexShrink: 0 },
    matrixRoleCell: {
      width: 84,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matrixRoleChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    matrixRoleText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
    matrixRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    matrixLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    matrixMark: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* -------------------------------------------------- breakouts */
    breakoutCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    breakoutHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    breakoutHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    breakoutTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    breakoutMeta: { ...type.micro, color: t.textSubtle },
    breakoutTimer: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    breakoutTimerText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.chipText },
    roomGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -4,
    },
    roomCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(l.isPhone ? 1 : 2),
      minWidth: 0,
      padding: 4,
    },
    roomCard: {
      height: '100%',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 9,
    },
    roomCardHead: { flexDirection: 'row', alignItems: 'center' },
    roomBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    roomBadgeText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
    roomTopic: { ...type.caption, color: t.text, fontWeight: '600' },
    roomPeople: { flexDirection: 'row', alignItems: 'center' },
    roomAvatarWrap: {
      width: 24,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: t.surfaceRaised,
      overflow: 'hidden',
    },
    roomAvatarOverlap: { marginLeft: -8 },
    roomAvatar: { width: '100%', height: '100%' },
    roomExtra: { ...type.micro, color: t.textSubtle, fontWeight: '700', marginLeft: 8 },
    breakoutFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },

    ghostButton: {
      minHeight: 44,
      flexGrow: 0,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 16,
    },
    ghostButtonText: { fontSize: 13, fontWeight: '700', color: t.brand },
    solidButton: {
      minHeight: 44,
      flexGrow: 0,
      flexShrink: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: t.chipBg,
      paddingHorizontal: 16,
    },
    solidButtonText: { fontSize: 13, fontWeight: '700', color: t.chipText },

    /* -------------------------------------------------- replay */
    replayGrid: gridBase,
    replayCell: cellBase(replayColumns),
    replayWrap: { marginTop: l.isPhone ? 16 : 22 },
    replayCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 22,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    replayHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    replayHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    replayTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    replayMeta: { ...type.micro, color: t.textSubtle },
    recordedChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.successBg,
    },
    recordedChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.successText },
    scrubRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    scrubButton: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    scrubTrack: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.surfaceInset,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    scrubFill: { width: '41%', height: 8, borderRadius: 4, backgroundColor: t.brand },
    scrubMark: {
      position: 'absolute',
      width: 2,
      height: 8,
      backgroundColor: t.surfaceRaised,
    },
    scrubTime: { ...type.micro, color: t.textMuted, fontWeight: '700', flexGrow: 0, flexShrink: 0 },
    chapterList: { gap: 6 },
    chapterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexWrap: 'wrap',
    },
    chapterRowActive: { borderColor: hexToRgba(t.brand, 0.5), backgroundColor: t.brandSoft },
    chapterTime: { ...type.micro, color: t.textMuted, fontWeight: '800', flexGrow: 0, flexShrink: 0, width: 42 },
    chapterLabel: { ...type.caption, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    chapterChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.chipBg,
    },
    chapterChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.chipText },
    clipButton: {
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
    },
    clipButtonText: { fontSize: 12, fontWeight: '700', color: t.brand },

    /* -------------------------------------------------- setup */
    setupNote: {
      marginTop: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: hexToRgba(t.green, 0.35),
      borderRadius: 14,
      backgroundColor: t.successBg,
      paddingHorizontal: l.isPhone ? 14 : 18,
      paddingVertical: 14,
    },
    setupNoteText: { ...type.caption, color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    setupCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    setupHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    setupIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    setupHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    readyChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.successBg,
    },
    readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    readyChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.successText },
    goLiveButton: { marginTop: 2 },
    setupTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    setupMeta: { ...type.micro, color: t.textSubtle },
    setupList: { gap: 7 },
    setupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 56,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    setupRowIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    setupRowCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    setupLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    setupValue: { ...type.micro, color: t.textSubtle },
    toggle: {
      width: 40,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      backgroundColor: t.surfaceInset,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleOn: { backgroundColor: t.brand },
    toggleKnob: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: t.surfaceRaised,
    },
    toggleKnobOn: { alignSelf: 'flex-end', backgroundColor: t.textOnBrand },

    /* -------------------------------------------------- summary */
    statGrid: gridBase,
    statCell: cellBase(statColumns),
    statTile: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: l.isPhone ? 16 : 20,
      ...(elevation(t, 1) as ViewStyle),
    },
    statValue: { ...type.h2, textAlign: 'center' },
    statLabel: { ...type.caption, color: t.textMuted, fontWeight: '600', textAlign: 'center' },

    summaryWrap: { marginTop: l.isPhone ? 16 : 22 },
    summaryCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 22,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
    summaryIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    summaryHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0, gap: 2 },
    summaryTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    summaryMeta: { ...type.micro, color: t.textSubtle },
    summaryRows: { gap: 7 },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    summaryLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    summaryValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- close */
    closeRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    closeCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { ...twoUp, paddingTop: 4 },
    closeVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : twoUp,
    closeButtons: { marginTop: 24 },
    closeCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 22,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    closeList: { gap: 12 },
    closeItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    closeItemIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    closeItemText: { ...type.caption, color: t.text, flexShrink: 1, minWidth: 0 },
    closeLink: {
      minHeight: 44,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 12,
      width: '100%',
    },
    closeLinkText: {
      ...type.caption,
      color: t.brand,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
  });
}
