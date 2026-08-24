import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { AmenitiesService } from "./amenities.service";
import {
  BookingDecisionSchema,
  CancelBookingSchema,
  CreateAmenitySchema,
  CreateBookingSchema,
} from "./amenities.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

const DateQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

@Controller()
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Post("communities/:communityId/amenities")
  @RequirePermissions("amenity.manage")
  create(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateAmenitySchema)) dto: unknown,
  ) {
    void auth;
    return this.amenities.createAmenity(communityId, dto as never);
  }

  @Get("communities/:communityId/amenities")
  list(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    void auth;
    return this.amenities.listAmenities(communityId);
  }

  @Get("communities/:communityId/amenities/:amenityId/availability")
  availability(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Param("amenityId") amenityId: string,
    @Query(new ZodValidationPipe(DateQuery)) query: unknown,
  ) {
    void auth;
    return this.amenities.availability(communityId, amenityId, (query as { date: string }).date);
  }

  @Post("me/amenity-bookings")
  book(
    @CurrentUser() auth: AccessContext,
    @Body(new ZodValidationPipe(CreateBookingSchema)) dto: unknown,
  ) {
    return this.amenities.createBooking(auth.communityId!, auth.userId, dto as never);
  }

  @Get("me/amenity-bookings")
  mine(@CurrentUser() auth: AccessContext) {
    return this.amenities.myBookings(auth.communityId!, auth.userId);
  }

  @Get("communities/:communityId/amenity-bookings")
  @RequirePermissions("amenity.read")
  all(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    void auth;
    return this.amenities.allBookings(communityId);
  }

  @Post("amenity-bookings/:bookingId/decision")
  @RequirePermissions("amenity.manage")
  decide(
    @CurrentUser() auth: AccessContext,
    @Param("bookingId") bookingId: string,
    @Body(new ZodValidationPipe(BookingDecisionSchema)) dto: unknown,
  ) {
    const d = dto as { decision: "approve" | "reject"; reason?: string };
    return this.amenities.decide(auth.communityId!, auth.userId, bookingId, d.decision, d.reason);
  }

  @Post("amenity-bookings/:bookingId/cancel")
  cancel(
    @CurrentUser() auth: AccessContext,
    @Param("bookingId") bookingId: string,
    @Body(new ZodValidationPipe(CancelBookingSchema)) dto: unknown,
  ) {
    const isAdmin = auth.permissions.includes("amenity.manage");
    return this.amenities.cancel(auth.communityId!, auth.userId, isAdmin, bookingId, (dto as { reason: string }).reason);
  }
}

