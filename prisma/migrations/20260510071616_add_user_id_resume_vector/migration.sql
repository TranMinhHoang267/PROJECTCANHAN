/*
  Warnings:

  - Added the required column `user_id` to the `resume_vectors` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "resume_vectors" ADD COLUMN     "user_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "resume_vectors" ADD CONSTRAINT "resume_vectors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
