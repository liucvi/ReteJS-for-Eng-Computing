-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "graphJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_files" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_chunks" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "component_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "component_files_path_key" ON "component_files"("path");

-- CreateIndex
CREATE INDEX "component_files_name_idx" ON "component_files"("name");

-- CreateIndex
CREATE INDEX "component_files_category_idx" ON "component_files"("category");

-- CreateIndex
CREATE UNIQUE INDEX "component_chunks_fileId_chunkIndex_key" ON "component_chunks"("fileId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "component_chunks" ADD CONSTRAINT "component_chunks_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "component_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
