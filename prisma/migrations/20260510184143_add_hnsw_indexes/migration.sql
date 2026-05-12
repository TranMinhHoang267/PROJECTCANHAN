CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "job_vectors" ALTER COLUMN "embedding" TYPE vector(384);
ALTER TABLE "resume_vectors" ALTER COLUMN "embedding" TYPE vector(384);

CREATE INDEX IF NOT EXISTS idx_job_vectors_hnsw ON "job_vectors" 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64); 

CREATE INDEX IF NOT EXISTS idx_resume_vectors_hnsw ON "resume_vectors" 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);