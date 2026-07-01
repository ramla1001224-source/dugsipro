/*
  Warnings:

  - A unique constraint covering the columns `[shortCode]` on the table `School` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username,schoolId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "shortCode" TEXT,
ADD COLUMN     "superAdminId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "aiInsights" TEXT,
ADD COLUMN     "qrCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "School_shortCode_key" ON "School"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_schoolId_key" ON "User"("username", "schoolId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
