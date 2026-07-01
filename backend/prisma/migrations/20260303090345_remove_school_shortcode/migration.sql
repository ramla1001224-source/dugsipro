/*
  Warnings:

  - You are about to drop the column `shortCode` on the `School` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[shortCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "School_shortCode_key";

-- AlterTable
ALTER TABLE "School" DROP COLUMN "shortCode";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shortCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_shortCode_key" ON "User"("shortCode");
