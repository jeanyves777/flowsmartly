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
}

export interface TrainingMaterialDTO {
  id: string;
  name: string;
  kind: MaterialKind;
  url: string;
  pages: number;
  sizeBytes: number;
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

  penHolderId: string | null;
  stageSource: StageSource;
  stageKey: string | null;
  stagePage: number;
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
export type RoomEvent =
  | { type: "room:init"; sessionKey: string; me: TrainingParticipantDTO; session: TrainingSessionDTO }
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
  | { type: "knock"; participant: TrainingParticipantDTO }
  | { type: "heartbeat" };

// ------------------------------------------------------------------- defaults
export const SEGMENT_KINDS: Record<SegmentKind, { label: string; note: string; mins: number }> = {
  slides: { label: "Present slides", note: "Walk a deck — annotate the pages live as you go.", mins: 10 },
  board: { label: "Whiteboard it", note: "Draw it live, then hand the pen to someone.", mins: 15 },
  doc: { label: "Work a document", note: "Mark up a PDF together — everyone sees the marks.", mins: 8 },
  video: { label: "Watch a clip", note: "Play a clip in sync, pause to talk over it.", mins: 5 },
  draw: { label: "Draw over an image", note: "Put an illustration on the board and mark it up.", mins: 6 },
  discuss: { label: "Break out in pairs", note: "Pairs get their own board. Hosts drop in.", mins: 10 },
};
