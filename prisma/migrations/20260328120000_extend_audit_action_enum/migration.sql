-- Extend audit action enum for stronger audit trail semantics
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELETE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GENERATE_REPORT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FINALIZE_REPORT';
