"""Tasks business logic — CRUD, assignment, and points-awarding on completion."""

from datetime import date

from fastapi import status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.deps import ClubContext
from app.core.exceptions import AppError
from app.core.permissions import DOMAIN_SCOPED_ROLES, can_manage, role_at_least
from app.core.tenant import tenant_query
from app.models import ClubMember, Domain, PointsLedger, Task, TaskAssignment, User
from app.models.base import utcnow

# ── Enrichment helper ─────────────────────────────────────────────────────────

def _enrich(session: Session, tasks: list[Task]) -> list[dict]:
    """Attach domain_name and assignees to a list of Task rows (batched, no N+1)."""
    if not tasks:
        return []

    task_ids = [t.id for t in tasks]
    domain_ids = {t.domain_id for t in tasks}

    domains = {
        d.id: d.name
        for d in session.exec(select(Domain).where(Domain.id.in_(domain_ids))).all()
    }

    assignments = list(
        session.exec(select(TaskAssignment).where(TaskAssignment.task_id.in_(task_ids))).all()
    )
    user_ids = {a.user_id for a in assignments}
    users = (
        {u.id: u for u in session.exec(select(User).where(User.id.in_(user_ids))).all()}
        if user_ids
        else {}
    )

    assignees_by_task: dict[int, list[dict]] = {t.id: [] for t in tasks}
    for a in assignments:
        if a.user_id in users:
            assignees_by_task[a.task_id].append({"id": a.user_id, "name": users[a.user_id].name})

    return [
        {
            "id": t.id,
            "club_id": t.club_id,
            "domain_id": t.domain_id,
            "domain_name": domains.get(t.domain_id, ""),
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "points": t.points,
            "due_date": t.due_date,
            "creator_id": t.creator_id,
            "created_at": t.created_at,
            "completed_at": t.completed_at,
            "assignees": assignees_by_task[t.id],
        }
        for t in tasks
    ]


def _load_task(session: Session, ctx: ClubContext, task_id: int) -> Task:
    task = session.exec(tenant_query(Task, ctx).where(Task.id == task_id)).first()
    if task is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "Task not found in this club.", "TASK_NOT_FOUND")
    return task


def _creator_role(session: Session, club_id: int, creator_id: int) -> str | None:
    member = session.exec(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == creator_id
        )
    ).first()
    return member.role if member else None


def _can_modify_task(ctx: ClubContext, creator_id: int, creator_role: str | None) -> bool:
    """Only the task's creator, or someone who strictly outranks the creator's current
    role, may edit its fields or delete it. A peer or subordinate Head (e.g. a Secretary
    on a task a President created) must not be able to touch it — being Lead+ alone is
    no longer enough, per the reported hierarchy gap.
    """
    if ctx.user_id == creator_id:
        return True
    if creator_role is None:
        # Creator has since left the club; fall back to the plain Lead+ floor.
        return role_at_least(ctx.role, "lead")
    return can_manage(ctx.role, creator_role)


def _assert_domain_access(ctx: ClubContext, task_domain_id: int) -> None:
    """Domain-scoped roles (member/associate/lead) may only act on tasks in their own
    domain — a Technical task is invisible and untouchable to a Design member, even one
    who'd otherwise outrank its creator. Exec roles (joint_secretary+) aren't
    domain-scoped, so this is a no-op for them.
    """
    if ctx.role in DOMAIN_SCOPED_ROLES and ctx.domain_id != task_domain_id:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You can only act on tasks in your own domain.",
            "WRONG_DOMAIN",
        )


# ── Points awarding ───────────────────────────────────────────────────────────

def _award_points(session: Session, task: Task) -> None:
    """Credit all assignees when a task is completed. Idempotent — safe to call again.

    Uses an existence check before INSERT to avoid a mid-transaction IntegrityError on the
    uq_ledger_task_user constraint; the constraint is a DB-level backstop.
    """
    assignments = list(
        session.exec(select(TaskAssignment).where(TaskAssignment.task_id == task.id)).all()
    )
    for a in assignments:
        already = session.exec(
            select(PointsLedger).where(
                PointsLedger.task_id == task.id,
                PointsLedger.user_id == a.user_id,
            )
        ).first()
        if already:
            continue

        session.add(
            PointsLedger(
                club_id=task.club_id,
                user_id=a.user_id,
                task_id=task.id,
                delta=task.points,
            )
        )

        member = session.exec(
            select(ClubMember).where(
                ClubMember.user_id == a.user_id,
                ClubMember.club_id == task.club_id,
            )
        ).first()
        if member:
            member.points += task.points
            session.add(member)


# ── Task CRUD ─────────────────────────────────────────────────────────────────

def list_tasks(session: Session, ctx: ClubContext) -> list[dict]:
    # Domain-scoped roles (member/associate/lead) only ever see their own domain's
    # tasks — never another domain's board. Exec roles (joint_secretary+) see all of
    # them, mirroring the leaderboard's own domain-scoping rule.
    query = tenant_query(Task, ctx)
    if ctx.role in DOMAIN_SCOPED_ROLES:
        query = query.where(Task.domain_id == ctx.domain_id)
    tasks = list(session.exec(query).all())
    return _enrich(session, tasks)


def create_task(
    session: Session,
    ctx: ClubContext,
    domain_id: int,
    title: str,
    description: str | None,
    points: int,
    due_date: date | None,
    assignee_ids: list[int],
) -> dict:
    domain = session.get(Domain, domain_id)
    if domain is None or domain.club_id != ctx.club_id:
        raise AppError(
            status.HTTP_404_NOT_FOUND, "Domain not found in this club.", "DOMAIN_NOT_FOUND"
        )

    # Domain-scoped roles (Lead and below) may only create tasks in their own domain.
    if ctx.role in DOMAIN_SCOPED_ROLES and ctx.domain_id != domain_id:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You can only create tasks in your own domain.",
            "WRONG_DOMAIN",
        )

    task = Task(
        club_id=ctx.club_id,
        domain_id=domain_id,
        title=title,
        description=description,
        points=points,
        due_date=due_date,
        creator_id=ctx.user_id,
        status="todo",
    )
    session.add(task)
    session.flush()  # populate task.id

    if assignee_ids:
        _validate_and_assign(session, ctx, task.id, assignee_ids, domain_id)

    session.commit()
    session.refresh(task)
    return _enrich(session, [task])[0]


def update_task(
    session: Session,
    ctx: ClubContext,
    task_id: int,
    title: str | None,
    description: str | None,
    due_date: date | None,
    points: int | None,
    new_status: str | None,
) -> dict:
    task = _load_task(session, ctx, task_id)

    # Field edits (title/description/due_date/points) require Lead+, are domain-scoped,
    # and — beyond that floor — restricted to the task's creator or someone who
    # outranks them (see _can_modify_task).
    if any(f is not None for f in [title, description, due_date, points]):
        if not role_at_least(ctx.role, "lead"):
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "Only Lead+ can edit task details.",
                "LEAD_REQUIRED",
            )
        _assert_domain_access(ctx, task.domain_id)
        creator_role = _creator_role(session, ctx.club_id, task.creator_id)
        if not _can_modify_task(ctx, task.creator_id, creator_role):
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "Only this task's creator or someone who outranks them can edit it.",
                "CANNOT_MODIFY_TASK",
            )

    if new_status is not None:
        is_lead = role_at_least(ctx.role, "lead")

        # Completing requires Lead+ — points-award gate.
        if new_status == "completed" and not is_lead:
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "Only Lead+ can mark a task completed.",
                "LEAD_REQUIRED_FOR_COMPLETION",
            )

        # Re-opening a completed task also requires Lead+ (prevent member-driven resets).
        if task.status == "completed" and new_status != "completed" and not is_lead:
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "Only Lead+ can reopen a completed task.",
                "LEAD_REQUIRED_FOR_REOPEN",
            )

        if is_lead:
            # A Lead's status authority (including a plain todo<->in_progress move,
            # not just complete/reopen) is domain-scoped like everything else they do.
            _assert_domain_access(ctx, task.domain_id)
        else:
            # Below-Lead callers must be an assignee to change status at all — no
            # separate domain check needed, since a valid assignment already implies
            # the assignee was in the task's domain at assign time.
            assigned = session.exec(
                select(TaskAssignment).where(
                    TaskAssignment.task_id == task.id,
                    TaskAssignment.user_id == ctx.user_id,
                )
            ).first()
            if assigned is None:
                raise AppError(
                    status.HTTP_403_FORBIDDEN,
                    "You can only update the status of tasks assigned to you.",
                    "NOT_ASSIGNEE",
                )

    if title is not None:
        task.title = title
    if description is not None:
        task.description = description
    if due_date is not None:
        task.due_date = due_date
    if points is not None:
        task.points = points

    if new_status is not None:
        old_status = task.status
        task.status = new_status
        if new_status == "completed" and old_status != "completed":
            task.completed_at = utcnow()
            _award_points(session, task)
        elif new_status != "completed" and old_status == "completed":
            # Re-opening doesn't revoke already-awarded points (ledger is append-only).
            task.completed_at = None

    session.add(task)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        # Two concurrent completion requests raced past the ledger existence check.
        raise AppError(
            status.HTTP_409_CONFLICT,
            "Concurrent update conflict; please retry.",
            "COMPLETION_CONFLICT",
        ) from None
    session.refresh(task)
    return _enrich(session, [task])[0]


def delete_task(session: Session, ctx: ClubContext, task_id: int) -> None:
    task = _load_task(session, ctx, task_id)
    _assert_domain_access(ctx, task.domain_id)
    creator_role = _creator_role(session, ctx.club_id, task.creator_id)
    if not _can_modify_task(ctx, task.creator_id, creator_role):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "Only this task's creator or someone who outranks them can delete it.",
            "CANNOT_MODIFY_TASK",
        )
    session.delete(task)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise AppError(
            status.HTTP_409_CONFLICT, "Task could not be deleted.", "TASK_DELETE_CONFLICT"
        ) from None


# ── Assignment ────────────────────────────────────────────────────────────────

def _validate_and_assign(
    session: Session, ctx: ClubContext, task_id: int, assignee_ids: list[int], task_domain_id: int
) -> None:
    """Replace the assignee list (idempotent replace, not append).

    Assignees must belong to the task's domain OR be club-wide exec members (domain_id IS NULL).
    """
    if assignee_ids:
        valid_ids = {
            m.user_id
            for m in session.exec(
                tenant_query(ClubMember, ctx).where(
                    or_(ClubMember.domain_id == task_domain_id, ClubMember.domain_id.is_(None))
                )
            ).all()
        }
        invalid = [uid for uid in assignee_ids if uid not in valid_ids]
        if invalid:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"These user IDs are not members of this club: {invalid}",
                "NOT_MEMBERS",
            )

    existing = list(
        session.exec(select(TaskAssignment).where(TaskAssignment.task_id == task_id)).all()
    )
    for a in existing:
        session.delete(a)
    session.flush()

    for uid in assignee_ids:
        session.add(TaskAssignment(task_id=task_id, user_id=uid))


def accept_task(session: Session, ctx: ClubContext, task_id: int) -> dict:
    """First-come-first-served self-assignment: a member can claim an unassigned task
    in their own domain (exec roles may claim across any domain) before someone else
    does.
    """
    task = _load_task(session, ctx, task_id)

    if task.status == "completed":
        raise AppError(
            status.HTTP_400_BAD_REQUEST, "This task is already completed.", "TASK_COMPLETED"
        )

    _assert_domain_access(ctx, task.domain_id)

    existing = list(
        session.exec(select(TaskAssignment).where(TaskAssignment.task_id == task_id)).all()
    )
    if existing:
        raise AppError(
            status.HTTP_409_CONFLICT,
            "This task has already been taken by someone else.",
            "TASK_ALREADY_TAKEN",
        )

    session.add(TaskAssignment(task_id=task_id, user_id=ctx.user_id))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise AppError(
            status.HTTP_409_CONFLICT,
            "This task has already been taken by someone else.",
            "TASK_ALREADY_TAKEN",
        ) from None
    session.refresh(task)
    return _enrich(session, [task])[0]


def assign_task(
    session: Session, ctx: ClubContext, task_id: int, assignee_ids: list[int]
) -> dict:
    task = _load_task(session, ctx, task_id)
    _assert_domain_access(ctx, task.domain_id)
    _validate_and_assign(session, ctx, task_id, assignee_ids, task.domain_id)
    session.commit()
    session.refresh(task)
    return _enrich(session, [task])[0]
