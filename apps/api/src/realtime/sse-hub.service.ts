import { Injectable, Logger } from "@nestjs/common";
import type { Response } from "express";

export interface RealtimeEvent {
  event: string;
  communityId?: string;
  data: unknown;
  at?: string;
}

interface Client {
  userId: string;
  res: Response;
}

/**
 * Server-Sent Events hub (ADR-003). Clients subscribe per authenticated user;
 * publishers target users (resident approvals) or whole communities
 * (notices, ticket updates). Transport can be swapped for WebSockets behind
 * this service without touching business modules.
 */
@Injectable()
export class SseHubService {
  private readonly logger = new Logger(SseHubService.name);
  private readonly clients = new Map<string, Set<Client>>();

  subscribe(userId: string, res: Response): () => void {
    const client: Client = { userId, res };
    let set = this.clients.get(userId);
    if (!set) {
      set = new Set();
      this.clients.set(userId, set);
    }
    set.add(client);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 3000\n\n`);
    res.write(`event: connected\ndata: {"ok":true}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        /* cleaned up by close handler */
      }
    }, 25_000);

    return () => {
      clearInterval(heartbeat);
      set?.delete(client);
      if (set && set.size === 0) this.clients.delete(userId);
    };
  }

  /** Send to a specific set of users. Returns number of deliveries attempted. */
  publishToUsers(userIds: Iterable<string>, evt: RealtimeEvent): number {
    let n = 0;
    const payload = JSON.stringify({ ...evt, at: evt.at ?? new Date().toISOString() });
    for (const userId of userIds) {
      const set = this.clients.get(userId);
      if (!set) continue; // not connected right now — in-app notifications cover the gap
      for (const c of set) {
        try {
          c.res.write(`event: ${evt.event}\ndata: ${payload}\n\n`);
          n++;
        } catch (err) {
          this.logger.warn(`SSE write failed for user ${userId}`, err as Error);
        }
      }
    }
    return n;
  }

  connectedUserIds(): string[] {
    return [...this.clients.keys()];
  }

  connectionCount(): number {
    let n = 0;
    for (const s of this.clients.values()) n += s.size;
    return n;
  }
}
