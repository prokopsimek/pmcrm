-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notes_contactId_idx" ON "notes"("contactId");

-- CreateIndex
CREATE INDEX "notes_userId_idx" ON "notes"("userId");

-- CreateIndex
CREATE INDEX "notes_isPinned_idx" ON "notes"("isPinned");

-- CreateIndex
CREATE INDEX "notes_createdAt_idx" ON "notes"("createdAt");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
