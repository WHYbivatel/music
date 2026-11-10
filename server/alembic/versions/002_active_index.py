"""Allow a configurable number of active jobs. The wallet lock enforces the limit."""

from alembic import op

revision = "002_active_index"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS jobs_one_active")
    op.execute("CREATE INDEX IF NOT EXISTS jobs_active_owner ON jobs (account_id) WHERE status IN ('queued', 'running')")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS jobs_active_owner")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_active ON jobs (account_id) WHERE status IN ('queued', 'running')")
