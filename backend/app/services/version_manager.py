import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Set
from app.database import get_db
from app.models.resume_studio import CanonicalResume, ResumeVersionDoc, VersionSummaryItem
from app.models.version_compare import (
    CompareVersionsRequest,
    VersionSummaryMeta,
    VersionComparisonResponse,
    UpdateVersionLabelRequest,
)
from app.services.resume_parser import resume_studio_parser
from app.services.scoring_engine import scoring_engine

logger = logging.getLogger("interviewiq.version_manager")


class VersionManagerService:
    """
    Service for managing resume versions, side-by-side version comparison diffs,
    and version restoration.
    """

    def _count_words(self, resume: CanonicalResume) -> int:
        """Count total words across summary, skills, experience, projects, education."""
        tokens: List[str] = []
        if resume.summary:
            tokens.extend(resume.summary.split())

        # Skills
        for skill_list in [
            resume.skills.languages,
            resume.skills.frameworks_libraries,
            resume.skills.cloud_databases,
            resume.skills.developer_tools,
            resume.skills.core_concepts,
        ]:
            for s in skill_list:
                tokens.extend(s.split())

        # Experience
        for exp in resume.experience:
            tokens.extend(exp.role.split())
            tokens.extend(exp.company.split())
            for b in exp.bullets:
                tokens.extend(b.split())

        # Projects
        for proj in resume.projects:
            tokens.extend(proj.title.split())
            if getattr(proj, "description", None):
                tokens.extend(proj.description.split())
            for b in proj.bullets:
                tokens.extend(b.split())


        # Education
        for edu in resume.education:
            tokens.extend(edu.institution.split())
            tokens.extend(edu.degree.split())

        return len(tokens)

    def _extract_all_skills(self, resume: CanonicalResume) -> Dict[str, List[str]]:
        """Return skills map categorized and clean."""
        return {
            "languages": list(resume.skills.languages),
            "frameworks_libraries": list(resume.skills.frameworks_libraries),
            "cloud_databases": list(resume.skills.cloud_databases),
            "developer_tools": list(resume.skills.developer_tools),
            "core_concepts": list(resume.skills.core_concepts),
        }

    async def update_version_label(
        self, user_id: str, version_id: str, new_label: str
    ) -> Optional[VersionSummaryItem]:
        """Update label of a saved resume version."""
        updated = False
        try:
            db = get_db()
            if db is not None:
                res = await db.resume_versions.update_one(
                    {"id": version_id, "user_id": user_id},
                    {"$set": {"label": new_label, "updated_at": datetime.now(timezone.utc)}},
                )
                updated = res.modified_count > 0 or res.matched_count > 0
        except Exception as e:
            logger.warning(f"[VersionManager] DB error updating label for {version_id}: {e}")

        # Update in-memory fallback
        if version_id in resume_studio_parser._in_memory_versions:
            mem = resume_studio_parser._in_memory_versions[version_id]
            if mem.get("user_id") == user_id:
                mem["label"] = new_label
                mem["updated_at"] = datetime.now(timezone.utc)
                updated = True

        if not updated:
            return None

        doc = await resume_studio_parser.get_version_by_id(user_id=user_id, version_id=version_id)
        if not doc:
            return None

        return VersionSummaryItem(
            id=doc.id,
            user_id=doc.user_id,
            label=doc.label,
            target_role=doc.target_role,
            parent_version_id=doc.parent_version_id,
            ats_score=doc.ats_score,
            created_at=str(doc.created_at),
            updated_at=str(doc.updated_at),
        )

    async def restore_version(
        self, user_id: str, version_id: str
    ) -> Optional[ResumeVersionDoc]:
        """
        Restore a target resume version by duplicating it as a new active version
        stamped with a 'Restored' label and referencing the parent version ID.
        """
        source_doc = await resume_studio_parser.get_version_by_id(user_id=user_id, version_id=version_id)
        if not source_doc:
            return None

        new_version_id = f"ver-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        restored_doc = ResumeVersionDoc(
            id=new_version_id,
            user_id=user_id,
            parent_version_id=version_id,
            label=f"Restored: {source_doc.label}",
            target_role=source_doc.target_role,
            data=source_doc.data,
            ats_score=source_doc.ats_score,
            created_at=now,
            updated_at=now,
        )

        try:
            db = get_db()
            if db is not None:
                await db.resume_versions.insert_one(restored_doc.model_dump())
        except Exception as e:
            logger.warning(f"[VersionManager] DB error saving restored version: {e}")

        # In-memory store
        resume_studio_parser._in_memory_versions[new_version_id] = restored_doc.model_dump()
        return restored_doc

    async def compare_versions(
        self, user_id: str, request: CompareVersionsRequest
    ) -> VersionComparisonResponse:
        """
        Side-by-side comparison of two resume versions (by ID or direct CanonicalResume).
        Calculates score delta, word count delta, skills added/removed, summary diff,
        and experience differences.
        """
        # Resolve Resume 1
        res_1: Optional[CanonicalResume] = request.resume_1
        v1_meta_id = "v1"
        v1_label = "Base Version"
        v1_role = "Software Engineer"
        v1_score = 0.0
        v1_date = datetime.now(timezone.utc).strftime("%b %d, %Y")

        if request.version_id_1:
            doc1 = await resume_studio_parser.get_version_by_id(user_id=user_id, version_id=request.version_id_1)
            if not doc1:
                raise ValueError(f"Resume version '{request.version_id_1}' not found.")
            res_1 = doc1.data
            v1_meta_id = doc1.id
            v1_label = doc1.label
            v1_role = doc1.target_role
            v1_score = doc1.ats_score
            v1_date = doc1.created_at.strftime("%b %d, %Y") if hasattr(doc1.created_at, "strftime") else str(doc1.created_at)[:10]

        # Resolve Resume 2
        res_2: Optional[CanonicalResume] = request.resume_2
        v2_meta_id = "v2"
        v2_label = "Target Version"
        v2_role = "Software Engineer"
        v2_score = 0.0
        v2_date = datetime.now(timezone.utc).strftime("%b %d, %Y")

        if request.version_id_2:
            doc2 = await resume_studio_parser.get_version_by_id(user_id=user_id, version_id=request.version_id_2)
            if not doc2:
                raise ValueError(f"Resume version '{request.version_id_2}' not found.")
            res_2 = doc2.data
            v2_meta_id = doc2.id
            v2_label = doc2.label
            v2_role = doc2.target_role
            v2_score = doc2.ats_score
            v2_date = doc2.created_at.strftime("%b %d, %Y") if hasattr(doc2.created_at, "strftime") else str(doc2.created_at)[:10]

        if not res_1 or not res_2:
            raise ValueError("Both resumes or valid version IDs must be provided.")

        # Compute Word Counts
        words_1 = self._count_words(res_1)
        words_2 = self._count_words(res_2)
        word_delta = words_2 - words_1

        # Calculate ATS scores if 0.0
        if v1_score <= 0.0:
            eval1 = scoring_engine.calculate_full_ats_score(resume=res_1, target_role=v1_role)
            v1_score = float(eval1.overall_score)
        if v2_score <= 0.0:
            eval2 = scoring_engine.calculate_full_ats_score(resume=res_2, target_role=v2_role)
            v2_score = float(eval2.overall_score)

        score_delta = round(v2_score - v1_score, 1)

        # 1. Summary Diff
        summary_changed = (res_1.summary or "").strip() != (res_2.summary or "").strip()
        summary_diff = {
            "changed": summary_changed,
            "version_1_summary": res_1.summary,
            "version_2_summary": res_2.summary,
            "v1_words": len((res_1.summary or "").split()),
            "v2_words": len((res_2.summary or "").split()),
        }

        # 2. Skills Diff
        skills_1_map = self._extract_all_skills(res_1)
        skills_2_map = self._extract_all_skills(res_2)

        all_v1_skills: Set[str] = set()
        for cat_skills in skills_1_map.values():
            all_v1_skills.update(s.strip() for s in cat_skills if s.strip())

        all_v2_skills: Set[str] = set()
        for cat_skills in skills_2_map.values():
            all_v2_skills.update(s.strip() for s in cat_skills if s.strip())

        v1_lower_map = {s.lower(): s for s in all_v1_skills}
        v2_lower_map = {s.lower(): s for s in all_v2_skills}

        added_skills = [v2_lower_map[k] for k in v2_lower_map if k not in v1_lower_map]
        removed_skills = [v1_lower_map[k] for k in v1_lower_map if k not in v2_lower_map]
        common_skills = [v2_lower_map[k] for k in v2_lower_map if k in v1_lower_map]

        skills_diff = {
            "added": sorted(added_skills),
            "removed": sorted(removed_skills),
            "common": sorted(common_skills),
            "total_v1": len(all_v1_skills),
            "total_v2": len(all_v2_skills),
            "categories_v1": skills_1_map,
            "categories_v2": skills_2_map,
        }

        # 3. Experience Diff
        exp_diff: List[Dict[str, Any]] = []
        for e2 in res_2.experience:
            matching_e1 = next(
                (e for e in res_1.experience if e.company.lower() == e2.company.lower() or e.id == e2.id),
                None,
            )
            if not matching_e1:
                exp_diff.append({
                    "company": e2.company,
                    "role": e2.role,
                    "status": "new_entry",
                    "bullets_added": e2.bullets,
                    "bullets_removed": [],
                })
            else:
                b1_set = set(matching_e1.bullets)
                b2_set = set(e2.bullets)
                b_added = [b for b in e2.bullets if b not in b1_set]
                b_removed = [b for b in matching_e1.bullets if b not in b2_set]
                exp_diff.append({
                    "company": e2.company,
                    "role": e2.role,
                    "status": "modified" if (b_added or b_removed) else "unchanged",
                    "bullets_added": b_added,
                    "bullets_removed": b_removed,
                })

        # 4. Project Diff
        proj_diff: List[Dict[str, Any]] = []
        for p2 in res_2.projects:
            matching_p1 = next(
                (p for p in res_1.projects if p.title.lower() == p2.title.lower() or p.id == p2.id),
                None,
            )
            if not matching_p1:
                proj_diff.append({
                    "title": p2.title,
                    "status": "new_project",
                    "tech_stack": p2.tech_stack,
                })
            else:
                tech_diff = list(set(p2.tech_stack) - set(matching_p1.tech_stack))
                proj_diff.append({
                    "title": p2.title,
                    "status": "modified" if tech_diff else "unchanged",
                    "new_tech_added": tech_diff,
                })

        # Formulate Viva-friendly verdict
        if score_delta > 0:
            verdict = (
                f"{v2_label} outperforms {v1_label} with a +{score_delta}% higher ATS score "
                f"({v1_score} → {v2_score}), featuring {len(added_skills)} additional targeted skills."
            )
        elif score_delta == 0:
            verdict = (
                f"{v2_label} maintains an identical ATS score of {v2_score}% with "
                f"{abs(word_delta)} words {'added' if word_delta > 0 else 'condensed'}."
            )
        else:
            verdict = (
                f"{v2_label} has an ATS score of {v2_score}% ({score_delta} points vs {v1_label}), "
                f"containing {len(removed_skills)} fewer keywords."
            )

        return VersionComparisonResponse(
            version_1=VersionSummaryMeta(
                id=v1_meta_id,
                label=v1_label,
                target_role=v1_role,
                ats_score=v1_score,
                created_at=v1_date,
                word_count=words_1,
            ),
            version_2=VersionSummaryMeta(
                id=v2_meta_id,
                label=v2_label,
                target_role=v2_role,
                ats_score=v2_score,
                created_at=v2_date,
                word_count=words_2,
            ),
            score_delta=score_delta,
            word_count_delta=word_delta,
            summary_diff=summary_diff,
            skills_diff=skills_diff,
            experience_diff={"items": exp_diff},
            projects_diff={"items": proj_diff},
            verdict=verdict,
        )


version_manager_service = VersionManagerService()
