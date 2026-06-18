# ADR-0001 — Store enums as VARCHAR, validate with Pydantic enums

- **Status:** Accepted
- **Date:** 2026-06-18
- **Context:** ClubHub backend re-platform (Foundation + Auth slice)

## Decision

Role and status fields (`club_members.role`, `tasks.status`, `join_requests.status`,
`action_requests.action_type`/`status`, `announcements.type`/`scope`, `events.type`/`status`)
are stored as plain `VARCHAR` columns, **not** native PostgreSQL `ENUM` types.

Validation happens at the API edge via Python `enum.Enum` (subclassing `str`) referenced in
Pydantic request/response schemas. Optionally a `CHECK` constraint can pin the allowed set at the
DB level.

In SQLModel this means: annotate the field with the Python `Enum` for typing/validation but force
the storage type explicitly, e.g.

```python
role: Role = Field(sa_column=Column(String, nullable=False))
```

so SQLAlchemy emits `VARCHAR`, never a native `CREATE TYPE ... AS ENUM`.

## Why

- The 7-role hierarchy and status sets **will evolve**. Adding a value to a native PG enum requires
  an `ALTER TYPE ... ADD VALUE` migration, which cannot run inside a transaction and is awkward to
  reverse. A `VARCHAR` (+ optional `CHECK`) changes with an ordinary migration.
- We still get full type-safety where it matters — at the application boundary — via the Pydantic
  enums.

## Consequences

- DB-level guarantees are weaker than native enums unless we add `CHECK` constraints (we may, per
  table). Application validation is the primary guard.
- Ordering by rank uses the `ROLE_HIERARCHY` index in `app/core/permissions.py`, not enum ordinal.
