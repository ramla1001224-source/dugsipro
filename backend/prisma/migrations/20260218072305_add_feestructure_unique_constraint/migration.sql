/*
  Warnings:

  - A unique constraint covering the columns `[classId,name,frequency]` on the table `FeeStructure` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_classId_name_frequency_key" ON "FeeStructure"("classId", "name", "frequency");
