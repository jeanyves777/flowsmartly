import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return new Response("Missing url parameter", { status: 400 });
    }

    // Fetch the image
    const imageResponse = await fetch(url, {
      headers: {
        "User-Agent": "FlowSmartly/1.0",
      },
    });

    if (!imageResponse.ok) {
      return new Response("Failed to fetch image", { status: imageResponse.status });
    }

    // Get the image data
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Return the image with CORS headers
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
