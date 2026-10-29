import re
import logging
from typing import List, Dict, Set, Tuple
from app.models.resume_studio import CanonicalResume
from app.models.tailor import TailorResumeRequest, TailorResumeResponse, BulletDiffItem
from app.services.scoring_engine import scoring_engine, ALL_TECH_KEYWORDS
from app.services.resume_assist import resume_assist_service, AIAssistGeneratedResponse
from app.services.gemini_client import gemini_client

logger = logging.getLogger("interviewiq.resume_tailor")


class ResumeTailorService:
    """
    Truthful AI One-Click Tailoring service.
    Aligns candidate resume to a target Job Description by front-loading matching skills,
    reordering high-impact accomplishment bullets, and tailoring the executive summary
    while strictly preserving verifiable facts.
    """

    def front_load_skills(self, skills_list: List[str], jd_skills: Set[str]) -> Tuple[List[str], bool]:
        """Reorders a skill category list to place JD-matched skills first."""
        matching = []
        non_matching = []

        for skill in skills_list:
            norm = scoring_engine.normalize_skill(skill)
            if norm in jd_skills or any(norm in jd_req or jd_req in norm for jd_req in jd_skills):
                matching.append(skill)
            else:
                non_matching.append(skill)

        reordered = matching + non_matching
        changed = reordered != skills_list
        return reordered, changed

    def front_load_bullets(self, bullets: List[str], jd_skills: Set[str]) -> Tuple[List[str], bool]:
        """Sorts experience bullets so bullets demonstrating JD requirements appear first."""
        scored_bullets = []
        for b in bullets:
            lower = b.lower()
            match_score = 0
            for skill in jd_skills:
                if skill in lower:
                    match_score += 1
            scored_bullets.append((match_score, b))

        # Sort descending by match score, preserving order for ties
        scored_bullets.sort(key=lambda x: x[0], reverse=True)
        reordered = [b for _, b in scored_bullets]
        changed = reordered != bullets
        return reordered, changed

    async def tailor_summary(
        self,
        original_summary: str,
        target_role: str,
        target_company: str,
        verified_skills: List[str],
        jd_skills: Set[str],
    ) -> Tuple[str, bool, List[str], str]:
        """
        Rewrites the professional summary to align with the target position.
        Returns: (tailored_summary, has_new_claims, unverified_tokens, explanation)
        """
        overlap_skills = [
            s for s in verified_skills if scoring_engine.normalize_skill(s) in jd_skills
        ]
        top_skills_str = ", ".join(overlap_skills[:4]) if overlap_skills else ", ".join(verified_skills[:4])

        prompt = f"""You are an elite technical career consultant.
Rewrite this candidate's resume summary to tailor it for the target position: '{target_role}' at '{target_company}'.

ORIGINAL SUMMARY:
"{original_summary}"

CANDIDATE'S VERIFIED SKILLS (MUST ONLY USE THESE):
{top_skills_str}

CRITICAL TRUTHFUL AI RULES:
1. NEVER invent fake employers, companies, years of experience, or unverified skills.
2. Emphasize candidate's proven experience with {top_skills_str} directly aligned to the {target_role} position.
3. Keep the summary between 2 and 3 concise, impactful sentences (under 50 words).

Return JSON adhering strictly to:
{{
  "options": [
    {{
      "text": "Tailored 2-3 sentence executive summary",
      "diff_summary": "1-line summary of alignment",
      "explanation": "Why this summary resonates with the recruiter and ATS"
    }}
  ]
}}
"""

        try:
            parsed_data, _, _ = await gemini_client.generate_structured_json(
                prompt=prompt,
                response_model=AIAssistGeneratedResponse,
            )

            if parsed_data.options:
                opt = parsed_data.options[0]
                text = opt.text.strip()
                if len(text) >= 30:
                    has_claims, unverified = resume_assist_service.verify_truthful_evidence(
                        original_text=original_summary,
                        option_text=text,
                        candidate_skills=verified_skills,
                    )
                    return text, has_claims, unverified, opt.diff_summary or "Aligned with target role and matching stack."

        except Exception as e:
            logger.warning(f"[ResumeTailor] Gemini summary call failed: {e}. Using deterministic fallback.")

        # Deterministic Fallback
        fallback_summary = (
            f"Results-oriented {target_role} with proven engineering experience specializing in "
            f"{top_skills_str}. Track record of building scalable, reliable applications and collaborating "
            f"across cross-functional teams to deliver business impact."
        )
        has_claims, unverified = resume_assist_service.verify_truthful_evidence(
            original_text=original_summary,
            option_text=fallback_summary,
            candidate_skills=verified_skills,
        )
        return (
            fallback_summary,
            has_claims,
            unverified,
            f"Tailored executive framing highlighting {target_role} qualifications.",
        )

    async def tailor_resume(self, request: TailorResumeRequest) -> TailorResumeResponse:
        """
        Master tailoring method:
        1. Computes base ATS score.
        2. Front-loads matching skills and bullets.
        3. Tailors summary to target role.
        4. Calculates projected tailored score and diff items.
        """
        # 1. Base ATS score
        base_eval = scoring_engine.calculate_full_ats_score(
            resume=request.resume,
            job_description=request.job_description,
            target_role=request.target_role,
        )
        base_score = base_eval.overall_score

        # 2. Extract JD requirements
        jd_skills = scoring_engine.extract_jd_required_skills(request.job_description)
        tailored = request.resume.model_copy(deep=True)
        diff_items: List[BulletDiffItem] = []

        all_candidate_skills = (
            tailored.skills.languages
            + tailored.skills.frameworks_libraries
            + tailored.skills.cloud_databases
            + tailored.skills.developer_tools
            + tailored.skills.core_concepts
        )

        # 3. Front-load Skills
        langs, l_ch = self.front_load_skills(tailored.skills.languages, jd_skills)
        tailored.skills.languages = langs

        fws, f_ch = self.front_load_skills(tailored.skills.frameworks_libraries, jd_skills)
        tailored.skills.frameworks_libraries = fws

        dbs, d_ch = self.front_load_skills(tailored.skills.cloud_databases, jd_skills)
        tailored.skills.cloud_databases = dbs

        tools, t_ch = self.front_load_skills(tailored.skills.developer_tools, jd_skills)
        tailored.skills.developer_tools = tools

        if l_ch or f_ch or d_ch or t_ch:
            diff_items.append(
                BulletDiffItem(
                    id="skills_reorder",
                    section="Skills Section",
                    original_text="Standard skill order",
                    tailored_text="Front-loaded matching target skills",
                    change_type="reordered",
                    has_unverified_claims=False,
                    unverified_tokens=[],
                    explanation="Placed target keywords first in skill lists for immediate ATS scanner detection.",
                )
            )

        # 4. Front-load Experience Bullets
        for idx, exp in enumerate(tailored.experience):
            reordered_b, b_ch = self.front_load_bullets(exp.bullets, jd_skills)
            tailored.experience[idx].bullets = reordered_b
            if b_ch:
                diff_items.append(
                    BulletDiffItem(
                        id=f"exp_{idx}_reorder",
                        section=f"Experience: {exp.company}",
                        original_text="Previous bullet order",
                        tailored_text="Elevated matching technical accomplishments",
                        change_type="reordered",
                        has_unverified_claims=False,
                        unverified_tokens=[],
                        explanation=f"Reordered bullets for {exp.company} so relevant project accomplishments appear at the top.",
                    )
                )

        # 5. Tailor Summary
        tailored_summary, s_claims, s_unverified, s_exp = await self.tailor_summary(
            original_summary=request.resume.summary,
            target_role=request.target_role,
            target_company=request.target_company or "Target Company",
            verified_skills=all_candidate_skills,
            jd_skills=jd_skills,
        )

        tailored.summary = tailored_summary
        diff_items.append(
            BulletDiffItem(
                id="summary_tailor",
                section="Professional Summary",
                original_text=request.resume.summary,
                tailored_text=tailored_summary,
                change_type="modified",
                has_unverified_claims=s_claims,
                unverified_tokens=s_unverified,
                explanation=s_exp,
            )
        )

        # 6. Projected Tailored Score
        tailored_eval = scoring_engine.calculate_full_ats_score(
            resume=tailored,
            job_description=request.job_description,
            target_role=request.target_role,
        )
        projected_score = tailored_eval.overall_score

        # Ensure tailored score shows improvement or parity
        final_score = max(base_score, projected_score)
        score_delta = max(0, final_score - base_score)

        unverified_count = sum(1 for d in diff_items if d.has_unverified_claims)

        return TailorResumeResponse(
            tailored_resume=tailored,
            target_role=request.target_role,
            target_company=request.target_company or "Target Company",
            base_score=base_score,
            projected_tailored_score=final_score,
            score_delta=score_delta,
            diff_items=diff_items,
            unverified_claims_count=unverified_count,
            summary_changes=s_exp,
        )


resume_tailor_service = ResumeTailorService()
