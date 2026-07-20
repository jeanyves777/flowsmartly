/**
 * Training Studio — shared types.
 *
 * A session has two faces: the PLAN (a node canvas of segments, mirroring the
 * Video Director) and the LIVE room (a stage). Both read this contract.
 *
 * The board is presenter-authoritative: one pen holder at a time, handed out
 * explicitly. Screen share is different — a GRANT, not a handoff, so several
 * people can hold the right while only one occupies the stage. [[training-studio]]
 */

export type SessionType = "training" | "workshop" | "webinar" | "onboarding" | "coaching";
export type SessionStatus = "draft" | "scheduled" | "live" | "ended";
export type AccessMode = "invite" | "link_email" | "open";
export type SegmentKind = "slides" | "board" | "doc" | "video" | "draw" | "discuss";
export type StageSource = "board" | "slides" | "doc" | "video" | "screen" | "cam";
export type ParticipantRole = "HOST" | "COHOST" | "TRAINEE" | "GUEST";
export type ParticipantState = "WAITING" | "ADMITTED" | "DENIED" | "LEFT" | "REMOVED";
export type MaterialKind = "slides" | "doc" | "video" | "image";

/** Board tools. `sel` doesn't mark the board; `laser` is transient and never stored. */
export type BoardTool = "sel" | "pen" | "hi" | "era" | "shape" | "text" | "note" | "laser";

// ----------------------------------------------------------------- board doc
/** A point in board space. Fractional (0..1) of the board, like the Design
 *  Studio's layer model — so a stroke lands identically on every screen size. */
export interface BoardPoint {
  x: number;
  y: number;
  /** 0..1 pen pressure; 0.5 when the device doesn't report any. */
  p?: number;
}

export interface BoardStroke {
  id: string;
  t: "stroke";
  /** who drew it — a TrainingParticipant.id */
  by: string;
  tool: Extract<BoardTool, "pen" | "hi" | "era">;
  color: string;
  /** stroke width as a fraction of board width, so it scales with the board */
  size: number;
  pts: BoardPoint[];
}

export interface BoardShape {
  id: string;
  t: "shape";
  by: string;
  shape: "rect" | "ellipse" | "arrow" | "line" | "triangle" | "diamond";
  color: string;
  size: number;
  from: BoardPoint;
  to: BoardPoint;
  /** deck whiteboard slides only — the reveal step this mark appears at */
  step?: number;
}

export interface BoardText {
  id: string;
  t: "text";
  by: string;
  at: BoardPoint;
  text: string;
  color: string;
  /** font size as a fraction of board height */
  size: number;
  /** a sticky note when set — the text sits on a coloured card */
  note?: string;
  /** deck whiteboard slides only — the reveal step this mark appears at */
  step?: number;
}

export interface BoardImage {
  id: string;
  t: "image";
  by: string;
  at: BoardPoint;
  w: number;
  h: number;
  url: string;
}

export type BoardItem = BoardStroke | BoardShape | BoardText | BoardImage;

/** The whole whiteboard. `bg` is what sits behind the ink. */
export interface BoardDoc {
  v: 1;
  bg: "blank" | "grid" | "dark";
  items: BoardItem[];
}

export const EMPTY_BOARD: BoardDoc = { v: 1, bg: "grid", items: [] };

// ------------------------------------------------------------------- entities
export interface TrainingSegmentDTO {
  id: string;
  kind: SegmentKind;
  title: string;
  note: string;
  durationMins: number;
  order: number;
  x: number;
  y: number;
  ready: boolean;
  materialId: string | null;
  config: Record<string, unknown>;
}

export interface TrainingParticipantDTO {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: ParticipantRole;
  state: ParticipantState;
  canShare: boolean;
  canDraw: boolean;
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
  sharing: boolean;
  joinedAt: string | null;
  focusPct: number;
  secondsIn: number;
  /** a disclosed AI Presenter co-host (synthetic participant, not a real connection) */
  isAI: boolean;
  /** for an AI co-host: a looping "moving avatar" clip to play in the tile (muted). */
  videoUrl?: string | null;
}

export interface TrainingMaterialDTO {
  id: string;
  name: string;
  kind: MaterialKind;
  url: string;
  pages: number;
  sizeBytes: number;
  /** set only for AI-generated presentation decks (kind "slides") */
  deck?: TrainingDeck | null;
}

// ------------------------------------------------------------ AI presentation deck
/** A generated training deck: an ordered set of slides the host presents on the
 *  Slides stage. Document slides are title + bullets + a visual; whiteboard slides
 *  carry a pre-sketched diagram in the SAME BoardItem model as the live board, so
 *  the host can draw right on top. [[training-studio]] */
export type DeckSlideType = "doc" | "whiteboard" | "livedraw";
export interface DeckVisual {
  kind: "emoji" | "image" | "none";
  style?: "photo" | "3d" | "illustration"; // photoreal photography, a 3D render, or a flat illustration
  emoji?: string;
  url?: string; // a generated image stored in S3
  prompt?: string; // kept so a visual can be regenerated
  tag?: string; // caption, e.g. "AI illustration"
  layout?: "right" | "left" | "top" | "full";
}
export interface DeckSlide {
  id: string;
  type: DeckSlideType;
  title: string;
  subtitle?: string;
  bullets?: string[];
  visual?: DeckVisual;
  board?: BoardItem[]; // whiteboard face — fractional coords, same as BoardDoc.items
  notes?: string;
  /** how many progressive-reveal steps this slide has (bullets for doc, diagram
   *  groups for whiteboard). The host reveals them one at a time as they present. */
  steps?: number;
  /** whiteboard/livedraw only — how many 16:9 frames wide the teaching canvas is
   *  (1 = fits one frame; >1 = an endless horizontal canvas that pans left→right as
   *  the reveal advances). Board coords are 0..1 of this WIDE canvas. */
  wide?: number;
  /** whiteboard/livedraw only — a subject to render as a generated 3D asset and drop
   *  on the board. Kept so the asset can be regenerated. */
  assetPrompt?: string;
  /** AI-presenter narration for this slide — the spoken script + synthesized audio the
   *  co-host plays while the slide is on the stage. Generated from the presenter's voice. */
  narration?: SlideNarration;
  /** a "pause for questions" moment: the co-host invites questions, then STOPS instead of
   *  auto-advancing so the room can ask (host or AI answers). `final` = the wrap-up Q&A
   *  before the conclusion. Rendered as a clean "Any questions?" prompt. */
  qa?: boolean;
  qaKind?: "checkpoint" | "final";
  /** an on-screen quiz: the co-host reads the question + options and pauses for a quick
   *  hand-raise check; the host reveals the answer (reveal step 2) then continues. */
  quiz?: QuizQuestion;
  /** the opening slide: the AI co-host appears on the Presenter stage and introduces
   *  itself (a disclosed self-intro), then the room moves on to the first slide. */
  intro?: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

/** One slide's spoken narration (script + audio) for the AI presenter. */
export interface SlideNarration {
  text: string;
  audioUrl: string;
  durationMs: number;
}
export interface TrainingDeck {
  v: 1;
  slides: DeckSlide[];
  /** the AI presenter built for THIS presentation (a PresenterProfile id) + whether
   *  it's switched on to deliver the room. Set from the presenter step in the builder. */
  presenterId?: string | null;
  presenterActive?: boolean;
  /** the presenter's looping avatar clip (copied from the profile) so the live room can
   *  show a MOVING co-host without a profile lookup. */
  presenterVideoUrl?: string | null;
}

// ------------------------------------------------------------ AI presenter
/** Question behaviour for an AI presenter. */
export interface PresenterQuestionBehavior {
  stopOnHand: boolean;       // pause automatically when a hand is raised
  afterEachSection: boolean; // accept questions at section breaks
  hostApproves: boolean;     // host approves questions before the AI answers
  answerMode: "independent" | "handoff"; // answer itself, or hand to the host
}

/** A reusable AI presenter profile — the owner's cloned voice + likeness that can
 *  deliver a training as a disclosed co-host. Built in "Build with AI". */
export interface PresenterProfileDTO {
  id: string;
  name: string;
  portraitUrl: string | null;
  loopVideoUrl: string | null;
  voiceProfileId: string | null;
  voiceName: string | null;
  deliveryStyle: "professional" | "conversational" | "energetic" | "teacher";
  pace: number;
  expressiveness: number;
  pauseMs: number;
  role: "cohost" | "host" | "assistant";
  followNotes: boolean;
  describeVisuals: boolean;
  advanceReveals: boolean;
  useLiveDraw: boolean;
  questionBehavior: PresenterQuestionBehavior | null;
  consentAcceptedAt: string | null;
  consentOwnerName: string | null;
  createdAt: string;
}

export interface TrainingInviteDTO {
  id: string;
  token: string;
  email: string | null;
  role: ParticipantRole;
  label: string | null;
  useCount: number;
  maxUses: number | null;
  isActive: boolean;
  sentAt: string | null;
}

export interface TrainingSessionDTO {
  id: string;
  title: string;
  brief: string;
  sessionType: SessionType;
  status: SessionStatus;
  seats: number;
  plannedMins: number;
  startsAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  access: AccessMode;

  waitingRoom: boolean;
  recording: boolean;
  joinHeadline: string | null;
  joinMessage: string | null;
  joinLogoUrl: string | null;
  joinBannerUrl: string | null;
  /** the owner's Brand Kit logo — the join page uses it when joinLogoUrl is unset */
  brandLogoUrl: string | null;
  /** the owner's Brand Kit colours — power the on-brand virtual-background presets */
  brandColors: string[];
  joinCollectEmail: boolean;
  transcript: boolean;
  openDraw: boolean;
  openShare: boolean;
  openMic: boolean;
  locked: boolean;
  /** host hid all board marks for the whole room (synced to attendees) */
  hideBoard: boolean;
  /** where the attendee tiles sit for everyone: side | top | bottom */
  rosterLayout: "side" | "top" | "bottom";
  /** a participant the host spotlighted large for the whole room */
  spotlightId: string | null;

  penHolderId: string | null;
  /** the segment (lesson) the room is currently on — drives the progress card */
  activeSegmentId: string | null;
  stageSource: StageSource;
  stageKey: string | null;
  stagePage: number;
  /** progressive-reveal step within the current deck slide (synced to attendees) */
  stageStep: number;
  /** the AI presenter is delivering right now (plays narration + auto-reveals, synced) */
  aiPlaying: boolean;
  boardDoc: BoardDoc;
  recordingUrl: string | null;
  creditsSpent: number;

  segments: TrainingSegmentDTO[];
  participants: TrainingParticipantDTO[];
  materials: TrainingMaterialDTO[];
  invites: TrainingInviteDTO[];
}

// ------------------------------------------------------------------- realtime
/** Events the room SSE stream emits. Read = SSE, write = POST — same shape as
 *  the Design Studio's collab layer, which already survives nginx. */
export interface TrainingMessageDTO {
  id: string;
  participantId: string | null;
  name: string;
  text: string;
  at: string; // ISO timestamp
}

/** The stroke under the presenter's pen RIGHT NOW — streamed while they draw so
 *  attendees see the ink appear live, not only once the stroke is finished. It's
 *  ephemeral presence (never stored); the committed BoardStroke lands via
 *  `board:add` on pointer-up and replaces this preview. [[training-studio]] */
export interface LiveStroke {
  tool: "pen" | "hi";
  color: string;
  /** stroke width as a fraction of board width (same units as BoardStroke.size) */
  size: number;
  pts: BoardPoint[];
}

export type RoomEvent =
  | { type: "room:init"; sessionKey: string; me: TrainingParticipantDTO; session: TrainingSessionDTO; messages: TrainingMessageDTO[] }
  | { type: "room:join"; participant: TrainingParticipantDTO }
  | { type: "room:leave"; participantId: string }
  | { type: "room:state"; patch: Partial<TrainingSessionDTO> }
  | { type: "room:participant"; participant: TrainingParticipantDTO }
  | { type: "board:add"; item: BoardItem }
  | { type: "board:update"; item: BoardItem }
  | { type: "board:remove"; itemId: string }
  | { type: "board:clear" }
  | { type: "cursor"; participantId: string; x: number; y: number }
  | { type: "laser"; participantId: string; x: number; y: number }
  | { type: "livestroke"; participantId: string; stroke: LiveStroke | null }
  | { type: "liveitem"; participantId: string; item: BoardItem | null }
  | { type: "knock"; participant: TrainingParticipantDTO }
  | { type: "chat"; message: TrainingMessageDTO }
  | { type: "presenter:answer"; answer: PresenterAnswer }
  | { type: "presenter:dismiss" }
  | { type: "heartbeat" };

/** A live Q&A answer from the AI presenter — what it says back to a question, plus the
 *  spoken audio, and whether it was confident (else it hands off to the host). */
export interface PresenterAnswer {
  id: string;
  question: string;
  askedBy: string;
  answer: string;
  audioUrl: string | null;
  durationMs: number;
  confident: boolean;
}

// ------------------------------------------------------------------- defaults
export const SEGMENT_KINDS: Record<SegmentKind, { label: string; note: string; mins: number }> = {
  slides: { label: "Present slides", note: "Walk a deck — annotate the pages live as you go.", mins: 10 },
  board: { label: "Whiteboard it", note: "Draw it live, then hand the pen to someone.", mins: 15 },
  doc: { label: "Work a document", note: "Mark up a PDF together — everyone sees the marks.", mins: 8 },
  video: { label: "Watch a clip", note: "Play a clip in sync, pause to talk over it.", mins: 5 },
  draw: { label: "Draw over an image", note: "Put an illustration on the board and mark it up.", mins: 6 },
  discuss: { label: "Break out in pairs", note: "Pairs get their own board. Hosts drop in.", mins: 10 },
};
