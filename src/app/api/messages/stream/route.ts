import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import { messagingBus, MessagingStreamEvent } from "@/lib/messaging-events";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiWrapper(
  async (req: ValidatedNextRequest) => {
    const session = req.session;
    const userId = session?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userChannel = `user:${userId}`;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let eventListener: ((event: MessagingStreamEvent) => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Initial connection handshake
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", userId, timestamp: Date.now() })}\n\n`)
        );

        eventListener = (event: MessagingStreamEvent) => {
          try {
            if (event.type === "message") {
              controller.enqueue(
                encoder.encode(`event: message\ndata: ${JSON.stringify(event.message)}\n\n`)
              );
            } else if (event.type === "typing") {
              controller.enqueue(
                encoder.encode(`event: typing\ndata: ${JSON.stringify(event)}\n\n`)
              );
            }
          } catch (streamErr) {
            logger.debug("SSE stream enqueue failed; client likely closed connection", { error: streamErr });
          }
        };

        messagingBus.on(userChannel, eventListener);

        heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }, 15000);
      },
      cancel() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (eventListener) {
          messagingBus.off(userChannel, eventListener);
        }
      },
    });

    req.signal.addEventListener("abort", () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (eventListener) {
        messagingBus.off(userChannel, eventListener);
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
  { requireAuth: true }
);
