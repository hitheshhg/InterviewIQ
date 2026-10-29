import hashlib
import logging
from typing import Dict, List, Set, Any
from app.models.multi_jd import (
    MultiJDCompareRequest,
    MultiJDCompareResponse,
    SingleJDMatchResult,
    SkillHeatmapRow,
    JobDescriptionInput,
)
from app.services.scoring_engine import scoring_engine

logger = logging.getLogger("interviewiq.multi_jd_comparator")


class MultiJDComparatorService:
    """
    Parallel multi-job description matching service.
    Computes comparative ATS rankings, cross-role skill heatmap matrix,
    common gap diagnostics, and chart datasets with in-memory caching.
    """

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    def _compute_cache_key(self, resume_summary: str, jd_text: str) -> str:
        content = f"{resume_summary.strip()}|||{jd_text.strip()}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    async def compare_multiple_jds(
        self, request: MultiJDCompareRequest
    ) -> MultiJDCompareResponse:
        """
        Runs parallel evaluation for 1 to 5 Job Descriptions against candidate resume.
        """
        valid_jds = [
            jd for jd in request.job_descriptions if jd.text and len(jd.text.strip()) >= 15
        ]

        if not valid_jds:
            raise ValueError("At least one valid Job Description (minimum 15 characters) is required.")

        # Limit to 5 max
        target_jds = valid_jds[:5]

        candidate_catalog = scoring_engine.extract_candidate_skill_catalog(request.resume)
        resume_cache_fingerprint = f"{request.resume.contact.email}:{len(candidate_catalog)}"

        match_results: List[SingleJDMatchResult] = []
        full_evaluations: List[Dict[str, Any]] = []

        for jd in target_jds:
            cache_key = self._compute_cache_key(resume_cache_fingerprint, jd.text)

            if cache_key in self._cache:
                cached = self._cache[cache_key]
                match_results.append(
                    SingleJDMatchResult(
                        jd_id=jd.id,
                        title=jd.title,
                        company=jd.company or "Target Company",
                        overall_score=cached["overall_score"],
                        keyword_match_pct=cached["keyword_match_pct"],
                        verdict=cached["verdict"],
                        matched_skills=cached["matched_skills"],
                        partial_skills=cached["partial_skills"],
                        missing_skills=cached["missing_skills"],
                    )
                )
                full_evaluations.append(cached)
            else:
                score_eval = scoring_engine.calculate_full_ats_score(
                    resume=request.resume,
                    job_description=jd.text,
                    target_role=jd.title,
                )

                matched_names = [m.skill for m in score_eval.matched_skills]
                partial_names = [p.skill for p in score_eval.partial_skills]
                missing_names = [m.skill for m in score_eval.missing_skills]
                keyword_pct = score_eval.breakdown.keyword_semantic_match.score_percentage

                eval_record = {
                    "overall_score": score_eval.overall_score,
                    "keyword_match_pct": keyword_pct,
                    "verdict": score_eval.summary_verdict,
                    "matched_skills": matched_names,
                    "partial_skills": partial_names,
                    "missing_skills": missing_names,
                    "breakdown": score_eval.breakdown,
                }
                self._cache[cache_key] = eval_record

                match_results.append(
                    SingleJDMatchResult(
                        jd_id=jd.id,
                        title=jd.title,
                        company=jd.company or "Target Company",
                        overall_score=score_eval.overall_score,
                        keyword_match_pct=keyword_pct,
                        verdict=score_eval.summary_verdict,
                        matched_skills=matched_names,
                        partial_skills=partial_names,
                        missing_skills=missing_names,
                    )
                )
                full_evaluations.append(eval_record)

        # 1. Rank roles by match score descending
        rankings = sorted(
            match_results,
            key=lambda r: (r.overall_score, r.keyword_match_pct),
            reverse=True,
        )
        best_fit_jd_id = rankings[0].jd_id

        # 2. Compile Unique Skills Across All JDs
        all_unique_skills: Set[str] = set()
        for r in match_results:
            all_unique_skills.update(r.matched_skills)
            all_unique_skills.update(r.partial_skills)
            all_unique_skills.update(r.missing_skills)

        # 3. Construct Skill Matrix Heatmap Rows
        skill_matrix: List[SkillHeatmapRow] = []
        for skill in sorted(all_unique_skills):
            cells: Dict[str, Any] = {}
            missing_count = 0
            matched_count = 0

            for r in match_results:
                if skill in r.matched_skills:
                    cells[r.jd_id] = "matched"
                    matched_count += 1
                elif skill in r.partial_skills:
                    cells[r.jd_id] = "partial"
                elif skill in r.missing_skills:
                    cells[r.jd_id] = "missing"
                    missing_count += 1
                else:
                    # Skill not required by this specific JD
                    # Check candidate catalog to classify capability
                    norm = scoring_engine.normalize_skill(skill)
                    if norm in candidate_catalog:
                        cells[r.jd_id] = "matched"
                        matched_count += 1
                    else:
                        cells[r.jd_id] = "missing"
                        missing_count += 1

            skill_matrix.append(
                SkillHeatmapRow(
                    skill=skill,
                    category="Technical Skill",
                    cells=cells,
                    missing_count=missing_count,
                    matched_count=matched_count,
                )
            )

        # Sort heatmap: skills missing across most JDs appear first (study priority)
        skill_matrix.sort(key=lambda row: (row.missing_count, -row.matched_count), reverse=True)

        # 4. Identify Common Gaps: skills missing or partial across multiple JDs
        threshold = 1 if len(match_results) <= 2 else max(2, len(match_results) // 2)
        common_gaps: List[str] = [
            row.skill for row in skill_matrix
            if sum(1 for status in row.cells.values() if status in ["missing", "partial"]) >= threshold
        ][:8]

        if not common_gaps:
            common_gaps = [
                row.skill for row in skill_matrix if row.missing_count > 0
            ][:5]

        # 5. Format Comparison Chart Data (for Recharts)
        dims = [
            ("Overall Score", "overall_score"),
            ("Keyword Match", "keyword_match_pct"),
            ("Completeness", "comp_score"),
            ("Quantified Impact", "quant_score"),
            ("Action Verbs", "verbs_score"),
        ]

        chart_data: List[Dict[str, Any]] = []
        for dim_label, dim_key in dims:
            entry: Dict[str, Any] = {"dimension": dim_label}
            for idx, r in enumerate(match_results):
                eval_data = full_evaluations[idx]
                label_key = f"{r.company} ({r.title[:12]})"

                if dim_key == "overall_score":
                    entry[label_key] = r.overall_score
                elif dim_key == "keyword_match_pct":
                    entry[label_key] = round(r.keyword_match_pct, 1)
                elif dim_key == "comp_score":
                    entry[label_key] = round(eval_data["breakdown"].section_completeness.score_percentage, 1)
                elif dim_key == "quant_score":
                    entry[label_key] = round(eval_data["breakdown"].quantified_achievements.score_percentage, 1)
                elif dim_key == "verbs_score":
                    entry[label_key] = round(eval_data["breakdown"].action_verbs_quality.score_percentage, 1)

            chart_data.append(entry)

        return MultiJDCompareResponse(
            rankings=rankings,
            best_fit_jd_id=best_fit_jd_id,
            skill_matrix=skill_matrix,
            common_gaps=common_gaps,
            comparison_chart_data=chart_data,
        )


multi_jd_comparator = MultiJDComparatorService()
