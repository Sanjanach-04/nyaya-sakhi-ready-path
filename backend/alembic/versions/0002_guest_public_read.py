"""Guest access: let the anon role execute match_legal_chunks / has_role.

Mirrors drizzle/migrations/0004_guest_public_read.sql. Idempotent (GRANT is a
no-op when already granted). Private tables keep no anon grants.

Revision ID: 0002_guest_public_read
Revises: 0001_embedding_768
Create Date: 2026-11-04
"""
from __future__ import annotations

from alembic import op

revision = "0002_guest_public_read"
down_revision = "0001_embedding_768"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("grant execute on function public.match_legal_chunks(vector(768), int, float) to anon")
    op.execute("grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated")


def downgrade() -> None:
    op.execute("revoke execute on function public.match_legal_chunks(vector(768), int, float) from anon")
