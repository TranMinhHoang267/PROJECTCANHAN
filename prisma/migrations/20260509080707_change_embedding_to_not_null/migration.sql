/*
  Warnings:

  - Made the column `embedding` on table `job_vectors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `embedding` on table `resume_vectors` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "job_vectors" ALTER COLUMN "embedding" SET NOT NULL;

-- AlterTable
ALTER TABLE "resume_vectors" ALTER COLUMN "embedding" SET NOT NULL;
