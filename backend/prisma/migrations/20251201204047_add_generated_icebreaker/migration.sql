-- CreateTable
CREATE TABLE "generated_icebreakers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "triggerEvent" TEXT,
    "variations" JSONB NOT NULL,
    "selected" JSONB,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "editedContent" TEXT,
    "feedback" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "llmProvider" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "contextData" JSONB,
    "generationTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_icebreakers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_icebreakers_userId_idx" ON "generated_icebreakers"("userId");

-- CreateIndex
CREATE INDEX "generated_icebreakers_contactId_idx" ON "generated_icebreakers"("contactId");

-- CreateIndex
CREATE INDEX "generated_icebreakers_createdAt_idx" ON "generated_icebreakers"("createdAt");

-- AddForeignKey
ALTER TABLE "generated_icebreakers" ADD CONSTRAINT "generated_icebreakers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_icebreakers" ADD CONSTRAINT "generated_icebreakers_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
