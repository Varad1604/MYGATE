import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { NoticesService } from "./notices.service";
import { CreateNoticeSchema } from "./notices.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

@Controller()
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Post("communities/:communityId/notices")
  @RequirePermissions("notice.publish")
  create(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateNoticeSchema)) dto: unknown,
  ) {
    return this.notices.create(communityId, auth.userId, dto as never);
  }

  @Post("notices/:noticeId/publish")
  @RequirePermissions("notice.publish")
  publish(@CurrentUser() auth: AccessContext, @Param("noticeId") noticeId: string) {
    return this.notices.publishNow(auth.communityId!, auth.userId, noticeId);
  }

  @Get("communities/:communityId/notices")
  @RequirePermissions("notice.read")
  all(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    void auth;
    return this.notices.listAll(communityId);
  }

  /** Resident feed â€” audience-filtered. */
  @Get("me/notices")
  mine(@CurrentUser() auth: AccessContext) {
    return this.notices.listForMe(auth.communityId!, auth.userId);
  }

  @Post("notices/:noticeId/acknowledge")
  ack(@CurrentUser() auth: AccessContext, @Param("noticeId") noticeId: string) {
    return this.notices.ack(auth.communityId!, auth.userId, noticeId);
  }
}
