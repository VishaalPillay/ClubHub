"""Community-promoted colleges — entries auto-promoted from `college_requests` (see
app/scripts/promote_college_requests.py). Distinct from the frontend's static, hand-curated
`collegesIndia.ts`: that file is the day-one seed bundled at build time; this table is the
part of the picker that grows on its own without a redeploy. CollegeSelect merges both."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class College(SQLModel, table=True):
    __tablename__ = "colleges"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    country: str
    state: str | None = Field(default=None)
    # Traceability only — never read for promotion logic itself, so a deleted source
    # request (or a manually inserted college) leaving this null is harmless.
    source_request_id: int | None = Field(
        default=None, foreign_key="college_requests.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
