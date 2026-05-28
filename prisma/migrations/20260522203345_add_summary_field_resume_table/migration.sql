-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "summary" JSON;

-- AlterTable
ALTER TABLE "user_chats" ALTER COLUMN "template" SET DEFAULT 0;
