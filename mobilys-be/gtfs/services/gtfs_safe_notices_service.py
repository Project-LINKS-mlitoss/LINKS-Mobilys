from __future__ import annotations

from typing import Any, Optional

from django.db.models import QuerySet
from django.utils import timezone

from gtfs.models import GtfsSafeNoticeRule
from gtfs.services.base import log_service_call, transactional


@log_service_call
class GtfsSafeNoticesService:
    @staticmethod
    def list_rules(*, severity: Optional[str], is_active: bool | None) -> QuerySet[GtfsSafeNoticeRule]:
        qs: QuerySet[GtfsSafeNoticeRule] = GtfsSafeNoticeRule.objects.all().order_by("severity", "code")

        if severity:
            qs = qs.filter(severity=severity)

        if is_active is not None:
            qs = qs.filter(is_active=is_active)

        return qs

    @staticmethod
    @transactional
    def bulk_upsert_rules(*, rules: list[dict[str, Any]]) -> dict[str, int]:
        items = rules
        codes = [item["code"] for item in items]

        existing = {
            r.code: r
            for r in GtfsSafeNoticeRule.objects.select_for_update().filter(code__in=codes)
        }

        now = timezone.now()
        to_create: list[GtfsSafeNoticeRule] = []
        to_update: list[GtfsSafeNoticeRule] = []

        for item in items:
            code = item["code"]
            obj = existing.get(code)

            if obj is None:
                to_create.append(
                    GtfsSafeNoticeRule(
                        severity=item["severity"],
                        code=code,
                        reason_ja=item["reason_ja"],
                        reason_en=item["reason_en"],
                        sample_conditions=item.get("sample_conditions", None),
                        allowed_filenames=item.get("allowed_filenames", []),
                        skip=item.get("skip", False),
                        is_active=item.get("is_active", True),
                        is_fixable=item.get("is_fixable", False),
                    )
                )
            else:
                obj.severity = item["severity"]
                obj.reason_ja = item["reason_ja"]
                obj.reason_en = item["reason_en"]
                obj.sample_conditions = item.get("sample_conditions", None)
                obj.allowed_filenames = item.get("allowed_filenames", [])
                obj.skip = item.get("skip", False)
                obj.is_active = item.get("is_active", True)
                obj.is_fixable = item.get("is_fixable", False)
                obj.updated_at = now
                to_update.append(obj)

        if to_create:
            GtfsSafeNoticeRule.objects.bulk_create(to_create, batch_size=200)

        if to_update:
            GtfsSafeNoticeRule.objects.bulk_update(
                to_update,
                fields=[
                    "severity",
                    "reason_ja",
                    "reason_en",
                    "sample_conditions",
                    "allowed_filenames",
                    "skip",
                    "is_active",
                    "updated_at",
                    "is_fixable",
                ],
                batch_size=200,
            )

        return {"created": len(to_create), "updated": len(to_update), "total": len(items)}
