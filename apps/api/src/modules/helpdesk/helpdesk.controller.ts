import { Controller, Body, Get, Param, Post, Query } from "@nestjs/common";
import { HelpdeskService } from "./helpdesk.service";
import {
  AssignSchema,
  CommentSchema,
  CreateTicketSchema,
  ListTicketsQuerySchema,
  RateSchema,
  StatusChangeSchema,
} from "./helpdesk.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

@Controller()
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  /** Active categories for raising a ticket — any member of the community. */
  @Get("communities/:communityId/ticket-categories")
  categories(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    void auth;
    return this.helpdesk.listCategories(communityId);
  }

  @Post("communities/:communityId/tickets")
  @RequirePermissions("helpdesk.create")
  create(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateTicketSchema)) dto: unknown,
  ) {
    return this.helpdesk.create(communityId, auth.userId, dto as never);
  }

  @Get("communities/:communityId/tickets")
  @RequirePermissions("helpdesk.read")
  list(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(ListTicketsQuerySchema)) query: unknown,
  ) {
    const q = query as {
      status?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; categoryId?: string;
      mine?: string; raisedByMe?: string; breachedOnly?: string; page: number; pageSize: number;
    };
    return this.helpdesk.list(communityId, {
      status: q.status,
      priority: q.priority,
      categoryId: q.categoryId,
      mine: q.mine === "true",
      raisedByMe: q.raisedByMe === "true",
      breachedOnly: q.breachedOnly === "true",
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }, auth.userId);
  }

  /** Resident-facing: their own tickets (no staff permission needed). */
  @Get("me/tickets")
  myTickets(
    @CurrentUser() auth: AccessContext,
    @Query(new ZodValidationPipe(ListTicketsQuerySchema)) query: unknown,
  ) {
    const q = query as { page: number; pageSize: number };
    return this.helpdesk.list(auth.communityId!, {
      raisedByMe: true,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }, auth.userId);
  }

  @Get("tickets/:ticketId")
  get(@CurrentUser() auth: AccessContext, @Param("ticketId") ticketId: string) {
    return this.helpdesk.get(auth.communityId!, ticketId, auth.permissions, auth.userId);
  }

  @Post("tickets/:ticketId/comments")
  comment(
    @CurrentUser() auth: AccessContext,
    @Param("ticketId") ticketId: string,
    @Body(new ZodValidationPipe(CommentSchema)) dto: unknown,
  ) {
    const { body, isInternal } = dto as { body: string; isInternal: boolean };
    return this.helpdesk.comment(auth.communityId!, auth.userId, auth.permissions, ticketId, body, isInternal);
  }

  @Post("tickets/:ticketId/assign")
  @RequirePermissions("helpdesk.assign")
  assign(
    @CurrentUser() auth: AccessContext,
    @Param("ticketId") ticketId: string,
    @Body(new ZodValidationPipe(AssignSchema)) dto: unknown,
  ) {
    return this.helpdesk.assign(auth.communityId!, auth.userId, ticketId, (dto as { assigneeUserId: string }).assigneeUserId);
  }

  @Post("tickets/:ticketId/status")
  changeStatus(
    @CurrentUser() auth: AccessContext,
    @Param("ticketId") ticketId: string,
    @Body(new ZodValidationPipe(StatusChangeSchema)) dto: unknown,
  ) {
    const { status, note } = dto as { status: never; note?: string };
    return this.helpdesk.changeStatus(auth.communityId!, auth.userId, auth.permissions, ticketId, status, note);
  }

  @Post("tickets/:ticketId/rate")
  rate(
    @CurrentUser() auth: AccessContext,
    @Param("ticketId") ticketId: string,
    @Body(new ZodValidationPipe(RateSchema)) dto: unknown,
  ) {
    const { rating, comment } = dto as { rating: number; comment?: string };
    return this.helpdesk.rate(auth.communityId!, auth.userId, ticketId, rating, comment);
  }
}
