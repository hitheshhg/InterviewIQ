import re
import logging
from typing import List, Optional, Set
from app.models.canonical_resume import CanonicalResume
from app.services.canonical_scorer import (
    COMMON_TECH_SKILLS,
    WEAK_PASSIVE_PHRASES,
    canonical_scorer,
)

logger = logging.getLogger("interviewiq.question_seeds")


class QuestionSeedGenerator:
    """
    Algorithmic Question Seed Generator.
    Analyzes candidate's canonical resume and target job description to generate
    high-yield question seeds targeting:
    1. Unproven Skills (skills listed in technical skills but absent from projects/bullets)
    2. Weak / Cliché Claims (bullets with passive verbs or lacking measurable metrics)
    3. Target JD Gaps (missing skills required by the job description)
    """

    def generate_seeds(
        self,
        resume: CanonicalResume,
        job_description: Optional[str] = None,
        target_role: Optional[str] = "Full Stack Developer",
    ) -> List[str]:
        """Generate up to 5 prioritized question seeds for AI interview generation."""
        seeds: List[str] = []

        # 1. Unproven Skills Check
        # Aggregate all text from experience bullets and project descriptions
        all_bullet_text = " ".join(resume.all_bullets()).lower()
        project_text = " ".join(
            [f"{p.name} {p.description} {' '.join(p.bullets)}" for p in resume.projects]
        ).lower()
        combined_evidence = f"{all_bullet_text} {project_text}"

        all_claimed_skills = resume.all_skills()
        unproven_skills: List[str] = []

        for skill in all_claimed_skills:
            skill_clean = skill.strip().lower()
            if len(skill_clean) < 2:
                continue
            # Check if skill appears in actual work or project evidence
            pattern = r"\b" + re.escape(skill_clean) + r"\b"
            if not re.search(pattern, combined_evidence):
                unproven_skills.append(skill.strip())

        # Generate seeds for top unproven skills
        for unproven in unproven_skills[:2]:
            seeds.append(
                f"You listed {unproven} in your technical skills with no direct project or work evidence. Explain how you used {unproven} and how you handled configuration or edge cases."
            )

        # 2. Weak / Passive Claims Check
        weak_claims = []
        for exp in resume.experience:
            for b in exp.bullets:
                b_lower = b.lower()
                for weak_phrase in WEAK_PASSIVE_PHRASES:
                    if weak_phrase in b_lower:
                        weak_claims.append((exp.company, b.strip()))
                        break
                if len(weak_claims) >= 2:
                    break
            if len(weak_claims) >= 2:
                break

        for company, bullet in weak_claims[:2]:
            snippet = bullet[:55] + "..." if len(bullet) > 55 else bullet
            seeds.append(
                f"At {company}, you mentioned '{snippet}'. Describe the technical architecture, specific challenges, and your individual contribution to that initiative."
            )

        # 3. Missing Skills from Job Description
        if job_description and job_description.strip():
            eval_result = canonical_scorer.evaluate(
                resume=resume,
                job_description=job_description,
                target_role=target_role or "Full Stack Developer",
            )
            missing_skills = [
                s.skill for s in eval_result.skills_analysis if s.status == "missing"
            ]
            for missing in missing_skills[:2]:
                seeds.append(
                    f"The target role requires experience with {missing}. How would you approach designing systems with {missing}, and how quickly can you ramp up on it?"
                )

        # 4. Fallback seed if resume is exceptionally strong with no gaps
        if not seeds:
            top_skills = all_claimed_skills[:3]
            skills_str = ", ".join(top_skills) if top_skills else target_role
            seeds.append(
                f"Based on your demonstrated expertise in {skills_str}, explain how you architect high-concurrency systems and handle data consistency during high-load periods."
            )

        return seeds[:5]


question_seed_generator = QuestionSeedGenerator()
