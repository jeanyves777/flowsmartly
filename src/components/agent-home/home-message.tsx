"use client";

import { cn } from "@/lib/utils/cn";
import {
  MessageBlocks,
  AgentActivity,
  PlanProposalCard,
  TaskCard,
  CopyTextButton,
  SpeakButton,
  FeedbackButtons,
} from "@/components/flow-ai/agent-cards";
import { RichText } from "@/components/flow-ai/rich-text";
import { LogoGlowLoader, DotGrid } from "@/components/shared/logo-glow-loader";
import { BrandMark } from "./brand-mark";
import type { HomeMessage } from "./use-home-agent";
import type { ViewEvent } from "@/lib/agent-views/spec";

/**
 * One conversation turn in the agent home. Renders the same Flow-AI cards as
 * the widget/shell (chronological MessageBlocks when available, else a text
 * bubble + tool/plan/task cards), styled to the home and fully responsive.
 */
export function HomeMessageView({
  message,
  initials,
  conversationId,
  onPlanResponse,
  onPickTemplate,
  onPickOption,
  onViewEvent,
}: {
  message: HomeMessage;
  initials: string;
  conversationId: string | null;
  onPlanResponse: (planId: string, confirmed: boolean) => void;
  onPickTemplate: (choice: { id: string; name: string } | null) => void;
  onPickOption: (text: string) => void;
  onViewEvent?: (e: ViewEvent) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("mx-auto mb-5 flex w-full max-w-[840px] gap-2.5 sm:gap-3", isUser && "flex-row-reverse")}>
      {isUser ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-[11px] font-bold text-white sm:h-[30px] sm:w-[30px]">
          {initials}
        </span>
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white p-1 sm:h-[30px] sm:w-[30px]">
          <BrandMark size={22} className="shadow-none" />
        </span>
      )}

      <div className={cn("min-w-0 flex-1 space-y-2", isUser && "flex flex-col items-end")}>
        {!isUser && message.blocks && message.blocks.length > 0 ? (
          <MessageBlocks
            blocks={message.blocks}
            toolCalls={message.toolCalls}
            planProposals={message.planProposals}
            agentTasks={message.agentTasks}
            onPlanResponse={onPlanResponse}
            onPickTemplate={onPickTemplate}
            onPickOption={onPickOption}
            onViewEvent={onViewEvent}
            bubbleClassName="bg-card border-border text-foreground"
          />
        ) : isUser ? (
          <>
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {message.attachments.map((a, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={a.dataUrl || a.url} alt={a.name} className="h-20 w-20 rounded-xl border border-border object-cover" />
                ))}
              </div>
            )}
            {message.content && (
              <div className="inline-block whitespace-pre-wrap break-words rounded-[13px] border border-brand-500/25 bg-brand-500/10 px-3.5 py-2.5 text-[14.5px]">
                {message.content}
              </div>
            )}
          </>
        ) : (
          <>
            {message.content ? (
              <div className="inline-block max-w-full break-words rounded-2xl border border-border bg-card px-3.5 py-2 text-left leading-relaxed">
                <RichText text={message.content} />
              </div>
            ) : (
              !message.toolCalls?.length &&
              !message.planProposals?.length &&
              !message.agentTasks?.length && (
                <div className="relative inline-grid h-[54px] w-[76px] place-items-center overflow-hidden rounded-2xl border border-border bg-card text-muted-foreground/20">
                  <DotGrid />
                  <LogoGlowLoader size={30} />
                </div>
              )
            )}
            {message.content && (
              <div className="flex items-center gap-3 pl-1">
                <CopyTextButton text={message.content} />
                <SpeakButton text={message.content} />
                <FeedbackButtons messageId={message.id} conversationId={conversationId} content={message.content} />
              </div>
            )}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <AgentActivity calls={message.toolCalls} />
            )}
            {message.planProposals && message.planProposals.length > 0 && (
              <div className="flex flex-col gap-2">
                {message.planProposals.map((p) => (
                  <PlanProposalCard key={p.id} proposal={p} onResponse={onPlanResponse} />
                ))}
              </div>
            )}
            {message.agentTasks && message.agentTasks.length > 0 && (
              <div className="flex flex-col gap-2">
                {message.agentTasks.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
