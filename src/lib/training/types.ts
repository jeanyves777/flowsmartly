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
  photoUrl?: string | null; // a still photo the attendee uses instead of their live camera
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
  /** the headless recording bot — filtered from the roster/tiles/count and never billed. */
  isRecorder?: boolean;
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
/* ---------- Content-aware slides: layout, visual style, reveal & animation ----------
 * These are INDEPENDENT selections (the big win over fixed PowerPoint templates): the agent
 * picks a LAYOUT per teaching moment, a VISUAL STYLE for the deck's direction, a VISUAL TYPE
 * per slide, and a REVEAL/animation behaviour timed to the narration. [[training-studio]] */

/** Content-aware slide layouts — chosen by purpose, not by colour. */
export const SLIDE_LAYOUTS = [
  "hero_statement", "big_idea", "image_explanation", "full_visual", "concept_3d_callouts",
  "step_process", "vertical_journey", "timeline", "before_after", "problem_solution_result",
  "question_answer", "myth_reality", "comparison_table", "pros_cons", "data_spotlight",
  "dashboard_insight", "case_study", "real_world_scenario", "role_play", "customer_journey",
  "system_architecture", "workflow_diagram", "concept_map", "layered_explanation", "zoom_in",
  "live_draw", "annotated_photo", "interactive_question", "workshop", "key_takeaways",
  "quote", "section_divider", "recap_map", "action_plan", "closing",
] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

/** Visual direction, chosen independently of the layout. */
export const VISUAL_STYLES = [
  "modern_professional", "cinematic", "3d_technology", "whiteboard_teacher", "editorial",
  "minimal", "bold_startup", "data_driven", "storytelling", "workshop", "elegant",
  "playful_learning", "dark_technology", "brand_first",
] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

/** Human labels for the deck-level style picker (order = display order). */
export const VISUAL_STYLE_LABELS: Record<VisualStyle, string> = {
  modern_professional: "Modern Professional",
  cinematic: "Cinematic",
  "3d_technology": "3D Technology",
  dark_technology: "Dark Tech",
  data_driven: "Data-Driven",
  bold_startup: "Bold Startup",
  storytelling: "Storytelling",
  editorial: "Editorial",
  elegant: "Elegant",
  minimal: "Minimal",
  whiteboard_teacher: "Whiteboard Teacher",
  workshop: "Workshop",
  playful_learning: "Playful Learning",
  brand_first: "Brand-First",
};

/** What the slide's main visual IS. */
export type VisualType = "photo" | "3d" | "illustration" | "diagram" | "annotated" | "video" | "none";
/** How the slide reveals while it's narrated. */
export type RevealMode = "all_at_once" | "progressive" | "stroke_by_stroke" | "word_by_word" | "build_diagram";

/** The hand-and-pen + reveal animation library (agent chooses per moment, synced to narration). */
export const ANIMATION_TYPES = [
  "hand_write", "hand_draw_diagram", "hand_circle", "underline", "arrow_annotation",
  "highlight", "checkmark", "cross_out", "sticky_note", "sketch_to_visual",
  "stroke_by_stroke", "word_by_word", "bullet_reveal", "build_diagram", "progressive_image",
  "zoom_detail", "spotlight", "blur_to_focus", "color_emphasis", "draw_over_image",
] as const;
export type AnimationType = (typeof ANIMATION_TYPES)[number];

/** One timed animation step on a slide — matches the agent's authoring format. */
export interface SlideAnimation {
  animationType: AnimationType;
  /** the element/keyword/region this acts on (an id or a short text match). */
  targetId?: string;
  /** start this many ms after the slide's narration begins (or after the previous step). */
  startAfterNarrationMs?: number;
  durationMs?: number;
  handStyle?: "realistic" | "animated";
  handedness?: "right" | "left";
  tool?: "pen" | "pencil" | "marker" | "highlighter";
  /** ink: a hex colour or "brand". */
  color?: string;
  strokeStyle?: "natural" | "precise";
  pauseAfterMs?: number;
}

/** Deck-level hand/pen defaults (a slide's animation can override any of these). */
export interface HandStyleSettings {
  handStyle?: "realistic" | "animated";
  handedness?: "right" | "left";
  tool?: "pen" | "pencil" | "marker" | "highlighter";
  color?: string;
  skinTone?: string;
  strokeStyle?: "natural" | "precise";
  speed?: number;
  strokeWidth?: number;
  showHand?: boolean; // false = pen tip only
}

/** The whiteboard's look — a named preset plus granular overrides (set in the Animation
 *  Studio's whiteboard mode). Empty = derive from the deck's visual style. [[training-studio]] */
export const BOARD_PRESETS = ["clean_grid", "marker_board", "notebook", "blueprint", "workshop", "dark_canvas"] as const;
export type BoardPreset = (typeof BOARD_PRESETS)[number];
export interface BoardStyleSettings {
  preset?: BoardPreset;
  background?: "dots" | "grid" | "plain";
  connector?: "straight" | "curved" | "elbow";
  nodeShape?: "rounded" | "square" | "pill";
  /** ink colour override (hex) — else the preset's ink. */
  ink?: string;
  /** live hand-drawing on (the diagram sketches itself on). */
  animate?: boolean;
}
/** Gallery metadata for the whiteboard style picker (the visual theme lives in the renderer). */
export const BOARD_STYLE_META: { key: BoardPreset; name: string; category: "Light" | "Hand-drawn" | "Technical" | "Dark"; subtitle: string; swatches: [string, string, string] }[] = [
  { key: "clean_grid", name: "Clean Grid", category: "Light", subtitle: "Dots · straight lines · sans", swatches: ["#0f2540", "#e5e7eb", "#fde047"] },
  { key: "marker_board", name: "Marker Board", category: "Hand-drawn", subtitle: "Circles · curved · hand font", swatches: ["#17181c", "#2563eb", "#dc2626"] },
  { key: "notebook", name: "Notebook", category: "Light", subtitle: "Ruled paper · serif", swatches: ["#2563eb", "#eab308", "#dc2626"] },
  { key: "blueprint", name: "Blueprint", category: "Technical", subtitle: "Grid · elbow · mono", swatches: ["#7dd3fc", "#0e7490", "#1e3a5f"] },
  { key: "workshop", name: "Workshop", category: "Hand-drawn", subtitle: "Sticky notes · curved · shadows", swatches: ["#22c55e", "#eab308", "#ec4899"] },
  { key: "dark_canvas", name: "Dark Canvas", category: "Dark", subtitle: "Dark · glow · pill nodes", swatches: ["#a78bfa", "#8b5cf6", "#64748b"] },
];

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
  /** the spoken ANSWER-reveal for a quiz slide ("The correct answer is …") — played when
   *  the host resumes after the hand-raise pause, instead of re-reading the question. */
  quizReveal?: SlideNarration;
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
  /** a "talking AI moment" BETWEEN slides: the co-host appears full-screen and SPEAKS a
   *  short bridge line, then the deck moves on — rendered as a realistic Avatar-IV talking
   *  video (see momentVideoUrl). */
  presenterMoment?: boolean;
  /** for intro / presenterMoment slides: the realistic Avatar-IV TALKING video (the presenter
   *  actually speaking this moment's line in the cloned voice — plays WITH its own audio, not
   *  the muted loop). Generated in the Build Studio. */
  momentVideoUrl?: string;
  /** the spoken line for this on-screen moment. Synth'd to the audio the Avatar-IV video
   *  lip-syncs to, and shown as the caption. */
  momentScript?: string;

  /** ---- content-aware presentation model (independent axes) ---- */
  /** the content layout for this teaching moment (hero, problem→solution, comparison, …). */
  layout?: SlideLayout;
  /** the slide's visual direction (falls back to the deck's style). */
  visualStyle?: VisualStyle;
  /** what the main visual is (photo / 3d / diagram / annotated …). */
  visualType?: VisualType;
  /** how this slide reveals while narrated. */
  revealMode?: RevealMode;
  /** hand-and-pen + reveal animations for this slide, timed to the narration. */
  animations?: SlideAnimation[];
  /** a short (~15s) GENERATED demonstration video for this slide — a moving 3D/photoreal
   *  illustration of the concept. `videoPrompt` is set by the generator on 1-2 key slides;
   *  `videoUrl` is filled once the host generates it in the Build Studio. */
  videoPrompt?: string;
  videoUrl?: string;
  /** the single most important 2-4 word phrase on a DOC slide — the AI co-host's hand circles
   *  and highlights it as it's spoken. Must appear verbatim in the subtitle or a talking point. */
  highlight?: string;
  /** how the hand marks the highlighted phrase (default: circle). */
  annotate?: "circle" | "underline" | "highlight" | "point" | "box" | "strike" | "check" | "arrow" | "bracket";
  /** when the hand mark fires, in ms from the slide's narration start (set on the Animation
   *  Studio timeline). Undefined = after all the points have revealed. */
  annotateAtMs?: number;
}

/** The hand-mark animation variants — the ONE source of truth for every picker (Animation
 *  Studio, the slide inspector's Animate panel, and the Regenerate modal), so they always
 *  show the full set. "none" is offered separately by each UI (it clears the mark). */
export type AnnotateStyle = NonNullable<DeckSlide["annotate"]>;
export const ANNOTATE_VARIANTS: { v: AnnotateStyle; icon: string; label: string; hint: string }[] = [
  { v: "circle", icon: "✍️", label: "Circle", hint: "Circle a key term" },
  { v: "underline", icon: "＿", label: "Underline", hint: "Underline a fact" },
  { v: "box", icon: "▢", label: "Box", hint: "Box a definition" },
  { v: "bracket", icon: "❲❳", label: "Brackets", hint: "Frame the phrase" },
  { v: "strike", icon: "⊘", label: "Strike", hint: "Strike a myth" },
  { v: "check", icon: "✔", label: "Check", hint: "Approve / do this" },
  { v: "arrow", icon: "↗", label: "Arrow", hint: "Point an arrow at it" },
  { v: "highlight", icon: "🖍️", label: "Marker", hint: "Highlighter sweep" },
  { v: "point", icon: "👉", label: "Point", hint: "Point at it" },
];

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
  /** full-body, gesture-rich intro/outro films (audio-free) — shown large on the Presenter
   *  stage at the open/close; distinct from the small talking-photo loop. */
  introVideoUrl?: string | null;
  outroVideoUrl?: string | null;
  /** the presenter VOICE (a VoiceProfile id) the current narration + talking videos were
   *  generated with. If the presenter's voice later changes, this no longer matches and the
   *  builder prompts a regenerate so the whole session speaks in the new voice. */
  voiceKey?: string | null;
  /** the deck's overall visual direction (a slide can override with its own visualStyle). */
  visualStyle?: VisualStyle;
  /** deck-level hand/pen defaults for drawing animations (a slide animation can override). */
  handStyle?: HandStyleSettings;
  /** the whiteboard look (preset + granular overrides); empty = derive from the visual style. */
  boardStyle?: BoardStyleSettings;
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
  introVideoUrl: string | null;
  outroVideoUrl: string | null;
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
  recordingStartedAt: string | null; // ISO — shared start instant so every client's REC timer matches
  recordingPausedAt: string | null;  // ISO — set while PAUSED, so the timer freezes for everyone
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
