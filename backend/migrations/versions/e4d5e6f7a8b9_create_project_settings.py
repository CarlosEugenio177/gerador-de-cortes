"""Create project settings

Revision ID: e4d5e6f7a8b9
Revises: dc3cc38d0f99
Create Date: 2026-07-01 11:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4d5e6f7a8b9'
down_revision: Union[str, None] = 'dc3cc38d0f99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('remove_silences', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('remove_breaths', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('generate_clips', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('subtitle_style', sa.String(length=50), nullable=False, server_default='default'),
        sa.Column('aspect_ratio', sa.String(length=20), nullable=False, server_default='9:16'),
        sa.Column('auto_crop', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('language', sa.String(length=10), nullable=False, server_default='pt'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id')
    )


def downgrade() -> None:
    op.drop_table('project_settings')
