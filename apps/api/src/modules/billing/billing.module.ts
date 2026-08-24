import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { PaymentsService, StorageService } from "./payments.service";
import { MockPaymentProvider } from "./mock-payment.provider";

@Module({
  controllers: [BillingController],
  providers: [BillingService, PaymentsService, StorageService, MockPaymentProvider],
  exports: [BillingService, PaymentsService],
})
export class BillingModule {}
