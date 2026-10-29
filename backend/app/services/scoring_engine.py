import re
import logging
from typing import Dict, List, Set, Tuple, Optional
from app.models.resume_studio import CanonicalResume
from app.models.scoring import (
    ATSScoreResponse,
    ScoreBreakdown,
    SectionScoreItem,
    SkillMatchItem,
    WeakLineItem,
)

logger = logging.getLogger("interviewiq.scoring_engine")

# --------------------------------------------------------------------------
# Linguistic Knowledge Base: Synonyms, Related Skills & Verbs
# --------------------------------------------------------------------------
SYNONYM_MAP: Dict[str, str] = {
    "reactjs": "react",
    "react.js": "react",
    "react native": "react",
    "nodejs": "node.js",
    "node": "node.js",
    "postgres": "postgresql",
    "psql": "postgresql",
    "mongo": "mongodb",
    "mongodb atlas": "mongodb",
    "k8s": "kubernetes",
    "kube": "kubernetes",
    "fast api": "fastapi",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "aws": "amazon web services",
    "amazon web services": "aws",
    "gcp": "google cloud",
    "google cloud platform": "google cloud",
    "rest": "restful apis",
    "restful": "restful apis",
    "rest apis": "restful apis",
    "restful apis": "restful apis",
    "golang": "go",
    "nextjs": "next.js",
    "vuejs": "vue",
    "vue.js": "vue",
    "ci/cd": "cicd",
    "ci cd": "cicd",
    "continuous integration": "cicd",
}

RELATED_SKILLS: Dict[str, Set[str]] = {
    "django": {"fastapi", "flask", "python"},
    "fastapi": {"flask", "django", "python"},
    "flask": {"fastapi", "django", "python"},
    "mysql": {"postgresql", "sqlite", "sql", "mariadb"},
    "postgresql": {"mysql", "sqlite", "sql", "mongodb"},
    "mongodb": {"postgresql", "redis", "couchdb", "nosql"},
    "angular": {"react", "vue", "typescript", "javascript"},
    "vue": {"react", "angular", "javascript"},
    "react": {"next.js", "vue", "angular", "typescript"},
    "aws": {"gcp", "azure", "cloud", "docker"},
    "gcp": {"aws", "azure", "cloud"},
    "azure": {"aws", "gcp", "cloud"},
    "kubernetes": {"docker", "helm", "terraform", "devops"},
    "docker": {"kubernetes", "containerization", "devops"},
}

STRONG_ACTION_VERBS: Set[str] = {
    "accelerated", "achieved", "architected", "automated", "built", "configured",
    "constructed", "created", "decreased", "delivered", "deployed", "designed",
    "developed", "eliminated", "engineered", "enhanced", "established", "executed",
    "expanded", "expedited", "generated", "implemented", "improved", "increased",
    "initiated", "instituted", "integrated", "launched", "led", "managed",
    "maximized", "mentored", "minimized", "orchestrated", "optimized", "overhauled",
    "pioneered", "reduced", "refactored", "resolved", "restructured", "scaled",
    "spearheaded", "standardized", "streamlined", "transformed", "upgraded",
}

PASSIVE_WEAK_PHRASES: List[str] = [
    "responsible for",
    "helped with",
    "worked on",
    "assisted in",
    "participated in",
    "handled tasks",
    "involved in",
    "duties included",
    "tried to",
    "worked with",
]

COMMON_TECH_ENTITIES: Set[str] = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "ruby", "rust",
    "sql", "nosql", "react", "next.js", "vue", "angular", "node.js", "fastapi", "django",
    "flask", "express", "spring boot", "postgresql", "mongodb", "redis", "mysql",
    "docker", "kubernetes", "aws", "gcp", "azure", "git", "linux", "ci/cd", "restful apis",
    "graphql", "microservices", "system design", "tailwind css", "html", "css",
}

ALL_TECH_KEYWORDS: List[str] = sorted(
    list(COMMON_TECH_ENTITIES | set(SYNONYM_MAP.keys())),
    key=lambda x: len(x),
    reverse=True,
)


class ATSScoringEngine:
    """
    Transparent, deterministic ATS scoring engine implementing weighted multi-factor
    evaluation with synonym normalization and weak-line detection.
    """

    def normalize_skill(self, skill: str) -> str:
        """Normalize a skill token by stripping punctuation and consulting synonym map."""
        cleaned = skill.strip().lower()
        cleaned = re.sub(r"[\s\-_]+", " ", cleaned)
        return SYNONYM_MAP.get(cleaned, cleaned)

    def extract_candidate_skill_catalog(self, resume: CanonicalResume) -> Dict[str, str]:
        """
        Builds a map of normalized skills present in the resume to the exact context line
        supporting that skill (from skills section or experience/project bullets).
        """
        catalog: Dict[str, str] = {}

        # 1. Direct Skills Section
        skills_obj = resume.skills
        direct_skills = (
            skills_obj.languages
            + skills_obj.frameworks_libraries
            + skills_obj.cloud_databases
            + skills_obj.developer_tools
            + skills_obj.core_concepts
        )
        for s in direct_skills:
            norm = self.normalize_skill(s)
            catalog[norm] = f"Skills section: {s}"

        # 2. Evidence from Experience Bullets
        for exp in resume.experience:
            for bullet in exp.bullets:
                lower_bullet = bullet.lower()
                for tech in ALL_TECH_KEYWORDS:
                    pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech) + r"(?![a-zA-Z0-9])"
                    if re.search(pattern, lower_bullet):
                        norm = self.normalize_skill(tech)
                        if norm not in catalog:
                            catalog[norm] = f"{exp.company} ({exp.role}): \"{bullet[:120]}...\""

        # 3. Evidence from Project Bullets
        for proj in resume.projects:
            for s in proj.tech_stack:
                norm = self.normalize_skill(s)
                catalog[norm] = f"Project: {proj.title} (tech stack)"
            for bullet in proj.bullets:
                lower_bullet = bullet.lower()
                for tech in ALL_TECH_KEYWORDS:
                    pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech) + r"(?![a-zA-Z0-9])"
                    if re.search(pattern, lower_bullet):
                        norm = self.normalize_skill(tech)
                        if norm not in catalog:
                            catalog[norm] = f"Project {proj.title}: \"{bullet[:120]}...\""

        return catalog

    def extract_jd_required_skills(self, jd_text: str) -> Set[str]:
        """Extracts technical skill requirements from the Job Description text."""
        if not jd_text or len(jd_text.strip()) < 10:
            return set()

        jd_lower = jd_text.lower()
        required_skills: Set[str] = set()

        for tech in ALL_TECH_KEYWORDS:
            pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech) + r"(?![a-zA-Z0-9])"
            if re.search(pattern, jd_lower):
                required_skills.add(self.normalize_skill(tech))

        return required_skills

    def evaluate_skill_matches(
        self, candidate_catalog: Dict[str, str], jd_skills: Set[str]
    ) -> Tuple[List[SkillMatchItem], List[SkillMatchItem], List[SkillMatchItem], float]:
        """
        Classifies each JD requirement as matched, partial, or missing.
        Returns: (matched_list, partial_list, missing_list, score_percentage)
        """
        matched: List[SkillMatchItem] = []
        partial: List[SkillMatchItem] = []
        missing: List[SkillMatchItem] = []

        if not jd_skills:
            return matched, partial, missing, 100.0

        for req in sorted(jd_skills):
            # Check exact or synonym match
            if req in candidate_catalog:
                matched.append(
                    SkillMatchItem(
                        skill=req.title(),
                        status="matched",
                        resume_evidence_line=candidate_catalog[req],
                        category="technical",
                    )
                )
            else:
                # Check for partial / related skill match
                related = RELATED_SKILLS.get(req, set())
                found_related = [r for r in related if r in candidate_catalog]
                if found_related:
                    alt = found_related[0]
                    partial.append(
                        SkillMatchItem(
                            skill=req.title(),
                            status="partial",
                            resume_evidence_line=f"Candidate demonstrates related capability in {alt.title()}: {candidate_catalog[alt]}",
                            category="related",
                        )
                    )
                else:
                    missing.append(
                        SkillMatchItem(
                            skill=req.title(),
                            status="missing",
                            resume_evidence_line="No direct or related evidence found in candidate profile.",
                            category="gap",
                        )
                    )

        total_reqs = len(jd_skills)
        score_val = (len(matched) * 1.0 + len(partial) * 0.5) / max(1, total_reqs) * 100
        return matched, partial, missing, round(score_val, 1)

    def evaluate_section_completeness(self, resume: CanonicalResume) -> Tuple[float, List[str]]:
        """
        Evaluates presence and quality of core sections:
        Contact (20%), Summary (15%), Skills (20%), Experience (25%), Education (10%), Projects (10%).
        """
        score = 0.0
        tips: List[str] = []

        # Contact check
        has_contact = bool(resume.contact.full_name and resume.contact.email)
        has_phone = bool(resume.contact.phone)
        if has_contact and has_phone:
            score += 20.0
        elif has_contact:
            score += 15.0
            tips.append("Add a verified contact phone number.")
        else:
            tips.append("Ensure your full name and email are clearly provided.")

        # Summary check
        if resume.summary and len(resume.summary.strip()) >= 50:
            score += 15.0
        else:
            tips.append("Add a 2-3 sentence technical executive summary.")

        # Skills check
        all_skills_count = (
            len(resume.skills.languages)
            + len(resume.skills.frameworks_libraries)
            + len(resume.skills.cloud_databases)
            + len(resume.skills.developer_tools)
        )
        if all_skills_count >= 8:
            score += 20.0
        elif all_skills_count >= 4:
            score += 12.0
            tips.append("List at least 8 specific technical skills across languages, frameworks, and databases.")
        else:
            tips.append("Expand skills inventory to cover core frameworks, databases, and developer tools.")

        # Experience check
        if resume.experience and len(resume.experience) >= 1:
            score += 25.0
        else:
            tips.append("Add work experience or professional internship entries.")

        # Education check
        if resume.education and len(resume.education) >= 1:
            score += 10.0
        else:
            tips.append("Add formal degree and university education details.")

        # Projects check
        if resume.projects and len(resume.projects) >= 1:
            score += 10.0
        else:
            tips.append("Add at least one technical software project with tech stack details.")

        return min(100.0, score), tips

    def evaluate_quantified_achievements(
        self, resume: CanonicalResume
    ) -> Tuple[float, List[WeakLineItem], List[str]]:
        """
        Measures the percentage of experience and project bullet points that contain
        verifiable numerical metrics (percentages, numbers >= 2, scale, currency).
        """
        all_bullets: List[Tuple[str, str]] = []
        for exp in resume.experience:
            for b in exp.bullets:
                all_bullets.append(("Experience", b))
        for proj in resume.projects:
            for b in proj.bullets:
                all_bullets.append(("Projects", b))

        if not all_bullets:
            return 30.0, [], ["Add bullet points to your experience and project sections."]

        metric_pattern = re.compile(
            r"(\b\d+%\b|\$\d+|\b\d+\s*(?:k|m|ms|sec|min|users|requests|records|events|qps|rps)\b|\b(?:reduced|increased|improved|boosted|grew|saved)\s+by\s+\d+|\b[2-9]\d*\b)"
        )

        quantified_count = 0
        weak_lines: List[WeakLineItem] = []

        for section, bullet in all_bullets:
            if metric_pattern.search(bullet.lower()):
                quantified_count += 1
            else:
                weak_lines.append(
                    WeakLineItem(
                        section=section,
                        original_line=bullet,
                        issue_type="missing_metric",
                        recommendation="Quantify this achievement with a measurable outcome (e.g. latency reduced by 30%, 50k active users).",
                    )
                )

        ratio = quantified_count / len(all_bullets)
        score_val = round(min(100.0, ratio * 130), 1)  # 75% quantified yields 100%

        tips = []
        if score_val < 80.0:
            tips.append(f"{len(weak_lines)} bullet(s) lack numerical impact. Add metrics (%, numbers, scale).")

        return score_val, weak_lines, tips

    def evaluate_action_verbs_and_language(
        self, resume: CanonicalResume
    ) -> Tuple[float, List[WeakLineItem], List[str]]:
        """
        Evaluates strong action verb usage and flags passive/weak phrasing.
        """
        all_bullets: List[Tuple[str, str]] = []
        for exp in resume.experience:
            for b in exp.bullets:
                all_bullets.append(("Experience", b))
        for proj in resume.projects:
            for b in proj.bullets:
                all_bullets.append(("Projects", b))

        if not all_bullets:
            return 40.0, [], ["Add action-driven bullets starting with strong verbs."]

        strong_count = 0
        weak_lines: List[WeakLineItem] = []

        for section, bullet in all_bullets:
            stripped = bullet.strip().lstrip("•-* ").strip()
            first_word = stripped.split(" ")[0].lower() if stripped else ""

            # Check passive phrase
            lower_bullet = bullet.lower()
            found_passive = False
            for passive in PASSIVE_WEAK_PHRASES:
                if passive in lower_bullet:
                    weak_lines.append(
                        WeakLineItem(
                            section=section,
                            original_line=bullet,
                            issue_type="passive_phrase",
                            recommendation=f"Replace passive phrasing ('{passive}') with an assertive action verb (e.g. 'Engineered', 'Architected').",
                        )
                    )
                    found_passive = True
                    break

            if first_word in STRONG_ACTION_VERBS and not found_passive:
                strong_count += 1
            elif not found_passive and first_word:
                # Past tense check fallback
                if first_word.endswith("ed"):
                    strong_count += 0.8

        ratio = strong_count / len(all_bullets)
        score_val = round(min(100.0, ratio * 115), 1)

        tips = []
        if score_val < 80.0:
            tips.append("Begin every bullet point with a high-impact past-tense action verb.")

        return score_val, weak_lines, tips

    def evaluate_formatting_and_parseability(
        self, resume: CanonicalResume
    ) -> Tuple[float, List[WeakLineItem], List[str]]:
        """
        Checks bullet point length thresholds, date formatting, and text parseability.
        """
        score = 100.0
        weak_lines: List[WeakLineItem] = []
        tips: List[str] = []

        all_bullets: List[Tuple[str, str]] = []
        for exp in resume.experience:
            for b in exp.bullets:
                all_bullets.append(("Experience", b))
        for proj in resume.projects:
            for b in proj.bullets:
                all_bullets.append(("Projects", b))

        for section, bullet in all_bullets:
            words = bullet.split()
            word_count = len(words)
            if word_count > 38:
                score -= 3.0
                weak_lines.append(
                    WeakLineItem(
                        section=section,
                        original_line=bullet,
                        issue_type="too_long",
                        recommendation=f"Bullet is too long ({word_count} words). Shorten to 15-25 words for readability.",
                    )
                )
            elif word_count < 4:
                score -= 4.0
                weak_lines.append(
                    WeakLineItem(
                        section=section,
                        original_line=bullet,
                        issue_type="too_short",
                        recommendation="Bullet is too brief. Elaborate on your technical contribution and outcome.",
                    )
                )

        # Date consistency check
        date_pattern = re.compile(r"\b(20\d\d|19\d\d|present)\b", re.IGNORECASE)
        for exp in resume.experience:
            if not date_pattern.search(exp.start_date):
                score -= 4.0
                tips.append(f"Format start date for {exp.company} clearly (e.g. 'Jan 2023').")

        final_score = max(0.0, round(score, 1))
        if final_score < 85.0:
            tips.append("Keep bullets concise (15-25 words) and ensure all dates follow standard formats.")

        return final_score, weak_lines, tips

    def calculate_full_ats_score(
        self,
        resume: CanonicalResume,
        job_description: Optional[str] = "",
        target_role: Optional[str] = "Full Stack Developer",
    ) -> ATSScoreResponse:
        """
        Master calculation compiling all 5 dimensions into a transparent weighted score.
        Automatically redistributes the 40% keyword match when JD is absent.
        """
        has_jd = bool(job_description and len(job_description.strip()) >= 15)

        # 1. Candidate Skill Catalog
        candidate_catalog = self.extract_candidate_skill_catalog(resume)

        # 2. Skill & Keyword Match (40% weight if JD present, redistributed if absent)
        matched_skills: List[SkillMatchItem] = []
        partial_skills: List[SkillMatchItem] = []
        missing_skills: List[SkillMatchItem] = []
        keyword_score_pct = 100.0

        if has_jd:
            jd_skills = self.extract_jd_required_skills(job_description)
            matched_skills, partial_skills, missing_skills, keyword_score_pct = (
                self.evaluate_skill_matches(candidate_catalog, jd_skills)
            )

        # 3. Section Completeness (15% or 25%)
        comp_score_pct, comp_tips = self.evaluate_section_completeness(resume)

        # 4. Quantified Achievements (15% or 25%)
        quant_score_pct, quant_weak, quant_tips = self.evaluate_quantified_achievements(resume)

        # 5. Action Verbs & Language Quality (15% or 25%)
        verbs_score_pct, verb_weak, verb_tips = self.evaluate_action_verbs_and_language(resume)

        # 6. Formatting & Parseability (15% or 25%)
        fmt_score_pct, fmt_weak, fmt_tips = self.evaluate_formatting_and_parseability(resume)

        # Weight distribution
        if has_jd:
            w_match, w_comp, w_quant, w_verbs, w_fmt = 40.0, 15.0, 15.0, 15.0, 15.0
        else:
            w_match, w_comp, w_quant, w_verbs, w_fmt = 0.0, 25.0, 25.0, 25.0, 25.0

        pts_match = round(keyword_score_pct * (w_match / 100), 1)
        pts_comp = round(comp_score_pct * (w_comp / 100), 1)
        pts_quant = round(quant_score_pct * (w_quant / 100), 1)
        pts_verbs = round(verbs_score_pct * (w_verbs / 100), 1)
        pts_fmt = round(fmt_score_pct * (w_fmt / 100), 1)

        total_pts = pts_match + pts_comp + pts_quant + pts_verbs + pts_fmt
        overall_score = int(min(100, max(0, round(total_pts))))

        # Verdict tier
        if overall_score >= 80:
            verdict = "Interview Ready"
        elif overall_score >= 65:
            verdict = "Competitive"
        else:
            verdict = "Needs Optimization"

        # Combine weak lines
        all_weak_lines = quant_weak[:3] + verb_weak[:3] + fmt_weak[:2]

        # Top 3 Action Items
        action_items: List[str] = []
        if has_jd and missing_skills:
            top_missing = ", ".join([m.skill for m in missing_skills[:2]])
            action_items.append(f"Incorporate required target skills: {top_missing}.")
        if quant_tips:
            action_items.append(quant_tips[0])
        if verb_tips:
            action_items.append(verb_tips[0])
        if fmt_tips and len(action_items) < 3:
            action_items.append(fmt_tips[0])
        if not action_items:
            action_items = ["Resume is well-calibrated. Ready for technical interviews."]

        match_tips = []
        if has_jd and missing_skills:
            match_tips.append(f"Missing {len(missing_skills)} key skills listed in the job description.")

        breakdown = ScoreBreakdown(
            keyword_semantic_match=SectionScoreItem(
                name="Keyword & Semantic Match",
                score_percentage=keyword_score_pct if has_jd else 0.0,
                weight_percentage=w_match,
                points_earned=pts_match,
                max_points=w_match,
                tips=match_tips,
            ),
            section_completeness=SectionScoreItem(
                name="Section Completeness",
                score_percentage=comp_score_pct,
                weight_percentage=w_comp,
                points_earned=pts_comp,
                max_points=w_comp,
                tips=comp_tips[:2],
            ),
            quantified_achievements=SectionScoreItem(
                name="Quantified Achievements",
                score_percentage=quant_score_pct,
                weight_percentage=w_quant,
                points_earned=pts_quant,
                max_points=w_quant,
                tips=quant_tips[:2],
            ),
            action_verbs_quality=SectionScoreItem(
                name="Action Verbs & Phrasing",
                score_percentage=verbs_score_pct,
                weight_percentage=w_verbs,
                points_earned=pts_verbs,
                max_points=w_verbs,
                tips=verb_tips[:2],
            ),
            formatting_parseability=SectionScoreItem(
                name="Formatting & Parseability",
                score_percentage=fmt_score_pct,
                weight_percentage=w_fmt,
                points_earned=pts_fmt,
                max_points=w_fmt,
                tips=fmt_tips[:2],
            ),
        )

        return ATSScoreResponse(
            overall_score=overall_score,
            is_tailored=has_jd,
            summary_verdict=verdict,
            breakdown=breakdown,
            matched_skills=matched_skills,
            partial_skills=partial_skills,
            missing_skills=missing_skills,
            weak_lines=all_weak_lines,
            top_action_items=action_items[:3],
        )


scoring_engine = ATSScoringEngine()
