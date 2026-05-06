/*
  Warnings:

  - The values [DELETE] on the enum `AuditAction` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `AuditTrail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `AuditTrail` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT');
ALTER TABLE "AuditTrail" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AuditTrail" DROP CONSTRAINT "AuditTrail_userId_fkey";

-- AlterTable
ALTER TABLE "AuditTrail" DROP CONSTRAINT "AuditTrail_pkey",
ADD COLUMN     "ipAddress" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "entityName" DROP NOT NULL,
ALTER COLUMN "entityId" DROP NOT NULL,
ADD CONSTRAINT "AuditTrail_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "AuditTrail" ADD CONSTRAINT "AuditTrail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
