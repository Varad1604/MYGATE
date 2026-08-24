-- AddForeignKey
ALTER TABLE "DomesticHelpUnitAssignment" ADD CONSTRAINT "DomesticHelpUnitAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
