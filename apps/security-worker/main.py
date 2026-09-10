"""Security-event enrichment worker.

Critical controls are enforced by the API transaction (for example the four-failed-
login threshold). This worker is deliberately read-only: it identifies patterns,
creates a review payload for the trusted alert-ingestion service, and must never
suspend accounts or change authorization on its own.
"""
from __future__ import annotations

import asyncio
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone

import asyncpg


@dataclass(frozen=True)
class AlertCandidate:
    kind: str
    severity: str
    subject_user_id: str | None
    evidence: dict[str, object]


async def analyze(pool: asyncpg.Pool) -> list[AlertCandidate]:
    since = datetime.now(timezone.utc) - timedelta(minutes=30)
    rows = await pool.fetch(
        """
        SELECT "subjectUserId", COUNT(*) AS event_count
        FROM "SecurityEvent"
        WHERE "detectedAt" >= $1 AND "type" = 'AUTHENTICATION_FAILURE_THRESHOLD'
        GROUP BY "subjectUserId"
        HAVING COUNT(*) >= 2
        """,
        since,
    )
    return [
        AlertCandidate(
            kind="REPEATED_AUTHENTICATION_THRESHOLD",
            severity="HIGH",
            subject_user_id=str(row["subjectUserId"]) if row["subjectUserId"] else None,
            evidence={"threshold_event_count": int(row["event_count"]), "window_minutes": 30},
        )
        for row in rows
    ]


async def main() -> None:
    dsn = os.environ.get("SECURITY_READONLY_DATABASE_URL")
    if not dsn:
        raise RuntimeError("SECURITY_READONLY_DATABASE_URL is required; do not reuse the application credential")
    pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=2)
    try:
        # A production deployment sends this result to an authenticated, audited
        # alert-ingestion endpoint. It is intentionally not an autonomous actuator.
        candidates = await analyze(pool)
        print(json.dumps([asdict(candidate) for candidate in candidates], default=str))
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
