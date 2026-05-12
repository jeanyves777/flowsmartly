import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";
import {
  generateAutomationBlogPost,
  type AutomationExecutionBrand,
  type AutomationExecutionTask,
} from "@/lib/strategy/automation-execution";
import {
  getBlogReadinessForUser,
  isBlogAutomationPlatform,
  publishAutomationBlogPost,
  taskLooksLikeBlogPost,
} from "@/lib/website/blog-posting";
import { uploadToS3 } from "@/lib/utils/s3-client";

export { isBlogAutomationPlatform };

export function shouldPublishAsBlogAutomation(
  platforms: string[],
  task?: { title?: string | null; description?: string | null } | null
) {
  return isBlogAutomationPlatform(platforms) || taskLooksLikeBlogPost(task || {});
}

export interface BlogAutomationRecord {
  id: string;
  userId: string;
  topic: string | null;
  aiPrompt: string | null;
  aiTone: string;
  includeMedia: boolean;
  mediaType: string | null;
  mediaStyle: string | null;
  strategyTaskId?: string | null;
}

export async function runBlogAutomationPublication(params: {
  automation: BlogAutomationRecord;
  brandKit: AutomationExecutionBrand | null;
  linkedTask: AutomationExecutionTask | null;
}) {
  const { automation, brandKit, linkedTask } = params;
  const blogReadiness = await getBlogReadinessForUser(automation.userId);
  if (!blogReadiness.ready || !blogReadiness.website) {
    throw new Error(
      blogReadiness.blockers[0] || "Publish a website with an active Blog page before running blog automation"
    );
  }

  const blogPost = await generateAutomationBlogPost({
    topic: automation.topic,
    aiPrompt: automation.aiPrompt,
    aiTone: automation.aiTone,
    platforms: ["blog"],
    includeMedia: automation.includeMedia,
    mediaType: automation.mediaType,
    mediaStyle: automation.mediaStyle,
    brand: brandKit,
    task: linkedTask,
  });

  let imageUrl: string | null = null;
  if (automation.includeMedia && automation.mediaType === "image") {
    const generatedImage = await generateImageXaiFirst(
      blogPost.imagePrompt ||
        `Create a polished website blog hero image for: ${blogPost.title}. Leave a clean logo-safe area for compositing.`,
      1536,
      1024,
      { quality: "medium" }
    );

    if (generatedImage.base64) {
      let imageBuffer = Buffer.from(generatedImage.base64, "base64");
      const brandLogo = brandKit?.logo || brandKit?.iconLogo || null;
      if (brandLogo) {
        const composited = await compositeBrandLogoOnImageBuffer({
          imageBuffer,
          logoSource: brandLogo,
          placement: { x: 0.03, y: 0.03, sizePercent: 14 },
        });
        imageBuffer = Buffer.from(composited);
      }

      const s3Key = `website-blog/${blogReadiness.website.id}/${automation.id}/${Date.now()}.png`;
      await uploadToS3(s3Key, imageBuffer, "image/png");
      imageUrl = s3Key;
    }
  }

  const saved = await publishAutomationBlogPost({
    userId: automation.userId,
    website: blogReadiness.website,
    automationId: automation.id,
    strategyTaskId: automation.strategyTaskId || null,
    title: blogPost.title,
    excerpt: blogPost.excerpt,
    content: blogPost.content,
    category: blogPost.category,
    image: imageUrl,
    author: brandKit?.name || "FlowSmartly",
    source: "AUTOMATION",
  });

  return {
    blogPostId: saved.id,
    websiteId: blogReadiness.website.id,
    websiteName: blogReadiness.website.name,
    title: saved.title,
    imageUrl,
    qualityNotes: blogPost.qualityNotes,
  };
}
