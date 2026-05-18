/*
  Warnings:

  - Added the required column `template` to the `user_chats` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user_chats" ADD COLUMN     "template" INTEGER NOT NULL;
