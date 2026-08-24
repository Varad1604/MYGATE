-- AlterTable
ALTER TABLE "BillRun" ADD COLUMN     "lineTemplate" JSONB NOT NULL DEFAULT '[]';
