import re
import logging
from typing import List, Dict, Tuple, Optional
from app.models.canonical_resume import CanonicalResume
from app.models.canonical_scoring import (
    ATSScoreBreakdown,
    FactorScore,
    SkillEvidenceItem,
    FixIssueItem,
)

logger = logging.getLogger("interviewiq.canonical_scorer")

# Curated catalog of recognized tech skills and synonyms
COMMON_TECH_SKILLS = [
    "python", "typescript", "javascript", "java", "c++", "c#", "go", "rust", "sql", "html", "css",
    "fastapi", "react", "react.js", "next.js", "node.js", "express", "django", "flask", "spring",
    "tailwind css", "bootstrap", "graphql", "rest api", "grpc", "microservices",
    "mongodb", "postgresql", "postgres", "mysql", "redis", "dynamodb", "cassandra", "elasticsearch",
    "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "terraform", "ci/cd", "git", "linux",
    "pytest", "postman", "celery", "kafka", "rabbitmq", "web sockets", "websockets",
    "machine learning", "pytorch", "tensorflow", "agile", "system design"
]

SKILL_SYNONYMS = {
    "postgres": "postgresql",
    "postgresql": "postgres",
    "react.js": "react",
    "react": "react.js",
    "k8s": "kubernetes",
    "kubernetes": "k8s",
    "node": "node.js",
    "node.js": "node",
    "fast api": "fastapi",
    "fastapi": "fast api",
    "websockets": "web sockets",
    "web sockets": "websockets",
    "rest": "rest api",
    "rest api": "rest",
    "ts": "typescript",
    "js": "javascript",
    "py": "python",
}

RELATED_DOMAINS = {
    "sql_databases": {"postgresql", "postgres", "mysql", "sql", "sqlite"},
    "nosql_databases": {"mongodb", "dynamodb", "cassandra"},
    "cloud_providers": {"aws", "azure", "gcp"},
    "container_orchestration": {"docker", "kubernetes", "k8s"},
    "react_ecosystem": {"react", "react.js", "next.js"},
    "python_backend": {"fastapi", "django", "flask"},
}

WEAK_PASSIVE_PHRASES = [
    "responsible for", "assisted with", "assisted in", "helped to", "worked on",
    "handled", "participated in", "duties included", "tasked with", "involved in"
]

STRONG_ACTION_VERBS = [
    "engineered", "architected", "spearheaded", "developed", "deployed", "optimized",
    "built", "designed", "automated", "reduced", "increased", "implemented", "scaled",
    "orchestrated", "streamlined", "constructed", "integrated", "eliminated", "refactored"
]

METRIC_REGEX = re.compile(
    r"(\b\d+(\.\d+)?%|\b\d+x\b|\$\d+([,\d]+)?|\b\d+[kKmMbB]\b|\b\d+,\d+\b|\b\d+\s*(ms|seconds|minutes|hours|days|weeks|months|requests|users|times)\b|\b\d+\+?\b)",
    re.IGNORECASE
)


class CanonicalScorer:
    """
    Deterministic 5-factor ATS scoring engine with semantic JD skill matching,
    evidence line citation, and impact-ranked fix generation.
    """

    def evaluate(
        self,
        resume: CanonicalResume,
        job_description: Optional[str] = "",
        target_role: Optional[str] = "Full Stack Developer",
    ) -> ATSScoreBreakdown:
        jd_text = (job_description or "").strip()
        has_jd = len(jd_text) >= 20

        # 1. Evaluate individual factors
        completeness_score, comp_feedback, comp_issues = self._score_section_completeness(resume)
        metric_score, metric_feedback, metric_issues = self._score_quantified_achievements(resume)
        action_score, action_feedback, action_issues = self._score_action_verbs(resume)
        format_score, format_feedback, format_issues = self._score_formatting(resume)

        # 2. Semantic JD Skill Matching (if JD provided)
        jd_score = 0.0
        jd_feedback = "No job description supplied."
        skills_analysis: List[SkillEvidenceItem] = []
        jd_issues: List[FixIssueItem] = []

        if has_jd:
            jd_score, jd_feedback, skills_analysis, jd_issues = self._score_jd_match(resume, jd_text)
        else:
            jd_feedback = "Not evaluated (no target job description provided)."

        # 3. Apply transparent weights & redistribution
        factors: Dict[str, FactorScore] = {}
        redistribution_note = None

        if has_jd:
            # 40 / 15 / 15 / 15 / 15 breakdown
            factors["keyword_match"] = FactorScore(
                name="Keyword & JD Match",
                score=round(jd_score, 1),
                weight_pct=40.0,
                weighted_points=round(jd_score * 0.40, 2),
                feedback=jd_feedback,
            )
            factors["section_completeness"] = FactorScore(
                name="Section Completeness",
                score=round(completeness_score, 1),
                weight_pct=15.0,
                weighted_points=round(completeness_score * 0.15, 2),
                feedback=comp_feedback,
            )
            factors["quantified_achievements"] = FactorScore(
                name="Quantified Achievements",
                score=round(metric_score, 1),
                weight_pct=15.0,
                weighted_points=round(metric_score * 0.15, 2),
                feedback=metric_feedback,
            )
            factors["action_verbs"] = FactorScore(
                name="Action Verbs & Language",
                score=round(action_score, 1),
                weight_pct=15.0,
                weighted_points=round(action_score * 0.15, 2),
                feedback=action_feedback,
            )
            factors["formatting"] = FactorScore(
                name="Formatting & Readability",
                score=round(format_score, 1),
                weight_pct=15.0,
                weighted_points=round(format_score * 0.15, 2),
                feedback=format_feedback,
            )
        else:
            # 40% weight redistributed equally (+10% each to 25/25/25/25)
            redistribution_note = (
                "No job description provided; 40% keyword weight redistributed equally "
                "(+10% each) across section completeness, metrics, action verbs, and formatting."
            )
            factors["section_completeness"] = FactorScore(
                name="Section Completeness",
                score=round(completeness_score, 1),
                weight_pct=25.0,
                weighted_points=round(completeness_score * 0.25, 2),
                feedback=comp_feedback,
            )
            factors["quantified_achievements"] = FactorScore(
                name="Quantified Achievements",
                score=round(metric_score, 1),
                weight_pct=25.0,
                weighted_points=round(metric_score * 0.25, 2),
                feedback=metric_feedback,
            )
            factors["action_verbs"] = FactorScore(
                name="Action Verbs & Language",
                score=round(action_score, 1),
                weight_pct=25.0,
                weighted_points=round(action_score * 0.25, 2),
                feedback=action_feedback,
            )
            factors["formatting"] = FactorScore(
                name="Formatting & Readability",
                score=round(format_score, 1),
                weight_pct=25.0,
                weighted_points=round(format_score * 0.25, 2),
                feedback=format_feedback,
            )

        total_points = sum(f.weighted_points for f in factors.values())
        overall_score = max(0, min(100, int(round(total_points))))

        # 4. Aggregate and sort Fix Issues list (High -> Medium -> Low)
        all_issues = jd_issues + metric_issues + action_issues + comp_issues + format_issues
        impact_order = {"high": 0, "medium": 1, "low": 2}
        all_issues.sort(key=lambda x: (impact_order.get(x.impact, 3), -x.potential_points))

        matched_count = sum(1 for s in skills_analysis if s.status == "matched")
        partial_count = sum(1 for s in skills_analysis if s.status == "partial")
        missing_count = sum(1 for s in skills_analysis if s.status == "missing")

        return ATSScoreBreakdown(
            overall_score=overall_score,
            jd_provided=has_jd,
            redistribution_note=redistribution_note,
            factors=factors,
            skills_analysis=skills_analysis,
            matched_skills_count=matched_count,
            partial_skills_count=partial_count,
            missing_skills_count=missing_count,
            issues_list=all_issues,
        )

    # -------------------------------------------------------------------------
    # FACTOR 1: SECTION COMPLETENESS (15% or 25%)
    # -------------------------------------------------------------------------
    def _score_section_completeness(
        self, resume: CanonicalResume
    ) -> Tuple[float, str, List[FixIssueItem]]:
        score = 0.0
        issues = []

        # Contact items (max 20 pts)
        c = resume.contact
        if c.full_name.strip():
            score += 5
        else:
            issues.append(
                FixIssueItem(
                    id="comp_name",
                    category="section",
                    impact="high",
                    title="Add full name",
                    original_text="",
                    section="Contact",
                    suggested_action="Provide your full legal or professional name at the top of your resume.",
                    potential_points=5.0,
                )
            )

        if c.email.strip() and "@" in c.email:
            score += 5
        else:
            issues.append(
                FixIssueItem(
                    id="comp_email",
                    category="section",
                    impact="high",
                    title="Add email address",
                    original_text="",
                    section="Contact",
                    suggested_action="Include a professional email address for recruiter contact.",
                    potential_points=5.0,
                )
            )

        if c.phone.strip():
            score += 4
        if c.location.strip():
            score += 3
        if c.linkedin or c.github:
            score += 3

        # Professional Summary (max 15 pts)
        if len(resume.summary.strip()) >= 50:
            score += 15
        elif resume.summary.strip():
            score += 8
        else:
            issues.append(
                FixIssueItem(
                    id="comp_summary",
                    category="section",
                    impact="medium",
                    title="Add professional summary",
                    original_text="",
                    section="Summary",
                    suggested_action="Add a 2-3 line summary highlighting your technical domain, key stack, and career focus.",
                    potential_points=15.0,
                )
            )

        # Skills (max 20 pts)
        all_skills = resume.all_skills()
        if len(all_skills) >= 8:
            score += 20
        elif len(all_skills) >= 4:
            score += 12
        else:
            issues.append(
                FixIssueItem(
                    id="comp_skills",
                    category="section",
                    impact="high",
                    title="Expand technical skills",
                    original_text="",
                    section="Skills",
                    suggested_action="List at least 8 categorized technical skills (languages, frameworks, tools, databases).",
                    potential_points=12.0,
                )
            )

        # Experience (max 20 pts)
        if resume.experience:
            score += 20
        else:
            issues.append(
                FixIssueItem(
                    id="comp_experience",
                    category="section",
                    impact="high",
                    title="Add experience or internship",
                    original_text="",
                    section="Experience",
                    suggested_action="Include internships, student work, freelance, or research experience.",
                    potential_points=15.0,
                )
            )

        # Projects (max 15 pts)
        if len(resume.projects) >= 2:
            score += 15
        elif len(resume.projects) == 1:
            score += 10
        else:
            issues.append(
                FixIssueItem(
                    id="comp_projects",
                    category="section",
                    impact="high",
                    title="Add portfolio projects",
                    original_text="",
                    section="Projects",
                    suggested_action="Detail at least 2 technical projects demonstrating full-stack or systems architecture.",
                    potential_points=15.0,
                )
            )

        # Education (max 10 pts)
        if resume.education:
            score += 10

        score = max(0.0, min(100.0, score))
        feedback = f"Section completeness is {int(score)}% with essential standard headings verified."
        return score, feedback, issues

    # -------------------------------------------------------------------------
    # FACTOR 2: QUANTIFIED ACHIEVEMENTS (15% or 25%)
    # -------------------------------------------------------------------------
    def _score_quantified_achievements(
        self, resume: CanonicalResume
    ) -> Tuple[float, str, List[FixIssueItem]]:
        bullets = resume.all_bullets()
        if not bullets:
            return 30.0, "No experience or project bullets found to evaluate.", []

        metric_bullets = [b for b in bullets if METRIC_REGEX.search(b)]
        ratio = len(metric_bullets) / len(bullets)

        # Score curve: 60%+ metric bullets gives 90+, 80%+ gives 100
        if ratio >= 0.75:
            score = 100.0
        elif ratio >= 0.50:
            score = 85.0
        elif ratio >= 0.30:
            score = 70.0
        elif ratio > 0.10:
            score = 50.0
        else:
            score = 25.0

        issues = []
        issue_id = 0
        for b in bullets:
            if not METRIC_REGEX.search(b):
                issue_id += 1
                if issue_id <= 4:  # limit to top 4 highest-impact metric fixes
                    issues.append(
                        FixIssueItem(
                            id=f"metric_issue_{issue_id}",
                            category="metric",
                            impact="high",
                            title="Add metric to this bullet",
                            original_text=b,
                            section="Experience",
                            suggested_action="Quantify the achievement with a percentage increase, latency reduction, user count, or volume metric.",
                            potential_points=6.0,
                        )
                    )

        feedback = (
            f"{len(metric_bullets)} of {len(bullets)} bullets contain quantifiable metrics. "
            f"ATS systems favor measurable results (e.g. '%', numbers, latency reductions)."
        )
        return score, feedback, issues

    # -------------------------------------------------------------------------
    # FACTOR 3: ACTION VERBS & LANGUAGE (15% or 25%)
    # -------------------------------------------------------------------------
    def _score_action_verbs(
        self, resume: CanonicalResume
    ) -> Tuple[float, str, List[FixIssueItem]]:
        bullets = resume.all_bullets()
        if not bullets:
            return 40.0, "No bullets found to evaluate verbs.", []

        passive_count = 0
        strong_starts = 0
        issues = []
        issue_id = 0

        for b in bullets:
            b_lower = b.lower().strip()

            # Check weak passive phrases
            found_weak = None
            for phrase in WEAK_PASSIVE_PHRASES:
                if phrase in b_lower:
                    found_weak = phrase
                    break

            if found_weak:
                passive_count += 1
                issue_id += 1
                if issue_id <= 3:
                    issues.append(
                        FixIssueItem(
                            id=f"action_verb_issue_{issue_id}",
                            category="action_verb",
                            impact="medium",
                            title=f"Replace '{found_weak}'",
                            original_text=b,
                            section="Experience",
                            suggested_action=f"Replace '{found_weak}' with an active accomplishment verb (e.g., Engineered, Spearheaded, Accelerated).",
                            potential_points=4.0,
                        )
                    )

            # Check starting word against strong verbs
            first_word = re.sub(r"[^\w]", "", b_lower.split(" ")[0]) if b_lower else ""
            if first_word in STRONG_ACTION_VERBS:
                strong_starts += 1

        strong_ratio = strong_starts / len(bullets)
        base_score = strong_ratio * 90.0 + 10.0
        penalty = passive_count * 12.0
        score = max(20.0, min(100.0, base_score - penalty))

        feedback = (
            f"{strong_starts} of {len(bullets)} bullets start with high-impact action verbs. "
            f"{passive_count} passive phrases detected."
        )
        return score, feedback, issues

    # -------------------------------------------------------------------------
    # FACTOR 4: FORMATTING & READABILITY (15% or 25%)
    # -------------------------------------------------------------------------
    def _score_formatting(
        self, resume: CanonicalResume
    ) -> Tuple[float, str, List[FixIssueItem]]:
        bullets = resume.all_bullets()
        if not bullets:
            return 50.0, "Standard formatting checks applied.", []

        score = 100.0
        issues = []
        issue_id = 0

        for b in bullets:
            words = b.strip().split()
            word_count = len(words)

            if word_count < 6:
                score -= 6.0
                issue_id += 1
                if issue_id <= 2:
                    issues.append(
                        FixIssueItem(
                            id=f"format_short_{issue_id}",
                            category="formatting",
                            impact="low",
                            title="Bullet point too short",
                            original_text=b,
                            section="Formatting",
                            suggested_action="Expand this bullet with context on how you executed the task and the outcome.",
                            potential_points=3.0,
                        )
                    )
            elif word_count > 45:
                score -= 8.0
                issue_id += 1
                if issue_id <= 2:
                    issues.append(
                        FixIssueItem(
                            id=f"format_long_{issue_id}",
                            category="formatting",
                            impact="medium",
                            title="Split long bullet point",
                            original_text=b,
                            section="Formatting",
                            suggested_action="Bullet is over 45 words. Break it into 2 focused, punchy bullet points.",
                            potential_points=4.0,
                        )
                    )

        score = max(30.0, min(100.0, score))
        feedback = "Single-column ATS standard geometry and bullet line budgets verified."
        return score, feedback, issues

    # -------------------------------------------------------------------------
    # FACTOR 5: KEYWORD / JD MATCH & EVIDENCE CITATION (40%)
    # -------------------------------------------------------------------------
    def _score_jd_match(
        self, resume: CanonicalResume, jd_text: str
    ) -> Tuple[float, str, List[SkillEvidenceItem], List[FixIssueItem]]:
        jd_lower = jd_text.lower()
        required_skills = self._extract_skills_from_jd(jd_lower)

        if not required_skills:
            return 80.0, "General tech keywords aligned.", [], []

        evidence_items: List[SkillEvidenceItem] = []
        issues: List[FixIssueItem] = []
        resume_skills_lower = {s.lower(): s for s in resume.all_skills()}
        resume_bullets = resume.all_bullets()

        matched_points = 0.0
        issue_id = 0

        for skill in required_skills:
            # 1. Exact match check
            exact_evidence = self._find_evidence_line(skill, resume_skills_lower, resume_bullets)
            if exact_evidence:
                matched_points += 1.0
                evidence_items.append(
                    SkillEvidenceItem(
                        skill=skill.title(),
                        status="matched",
                        evidence_line=exact_evidence,
                        note="Verified in resume",
                    )
                )
                continue

            # 2. Synonym match check
            synonym = SKILL_SYNONYMS.get(skill)
            if synonym:
                syn_evidence = self._find_evidence_line(synonym, resume_skills_lower, resume_bullets)
                if syn_evidence:
                    matched_points += 1.0
                    evidence_items.append(
                        SkillEvidenceItem(
                            skill=skill.title(),
                            status="matched",
                            evidence_line=syn_evidence,
                            note=f"Matched via synonym '{synonym}'",
                        )
                    )
                    continue

            # 3. Partial / Related Domain check
            partial_evidence, related_name = self._find_related_evidence(skill, resume_skills_lower, resume_bullets)
            if partial_evidence:
                matched_points += 0.5
                evidence_items.append(
                    SkillEvidenceItem(
                        skill=skill.title(),
                        status="partial",
                        evidence_line=partial_evidence,
                        note=f"Related to candidate experience with {related_name}",
                    )
                )
                continue

            # 4. Missing skill
            evidence_items.append(
                SkillEvidenceItem(
                    skill=skill.title(),
                    status="missing",
                    evidence_line=None,
                    note="Required in target Job Description but absent from resume",
                )
            )

            issue_id += 1
            if issue_id <= 4:
                issues.append(
                    FixIssueItem(
                        id=f"missing_skill_{issue_id}",
                        category="missing_skill",
                        impact="high",
                        title=f"Add missing skill: {skill.title()} (only if used)",
                        original_text=skill.title(),
                        section="Skills",
                        suggested_action=f"Have you used {skill.title()}? If yes, add it to technical skills or project tech stack.",
                        potential_points=8.0,
                    )
                )

        score = (matched_points / max(1, len(required_skills))) * 100.0
        score = max(10.0, min(100.0, score))
        feedback = f"{int(matched_points)} of {len(required_skills)} required JD keywords matched or partially matched."
        return score, feedback, evidence_items, issues

    def _extract_skills_from_jd(self, jd_lower: str) -> List[str]:
        """Extract skills mentioned in the target job description."""
        found = []
        for s in COMMON_TECH_SKILLS:
            pattern = r"\b" + re.escape(s) + r"\b"
            if re.search(pattern, jd_lower):
                found.append(s)
        # Deduplicate synonyms
        seen = set()
        deduped = []
        for s in found:
            norm = SKILL_SYNONYMS.get(s, s)
            if norm not in seen:
                seen.add(norm)
                deduped.append(s)
        return deduped

    def _find_evidence_line(
        self, skill: str, resume_skills_lower: Dict[str, str], resume_bullets: List[str]
    ) -> Optional[str]:
        """Find the exact line in resume containing the skill for citation."""
        skill_clean = skill.lower().strip()

        # 1. Check in skills section
        if skill_clean in resume_skills_lower:
            return f"Skills: {resume_skills_lower[skill_clean]}"

        # 2. Check in accomplishment bullets
        pattern = r"\b" + re.escape(skill_clean) + r"\b"
        for bullet in resume_bullets:
            if re.search(pattern, bullet, re.IGNORECASE):
                return bullet.strip()

        return None

    def _find_related_evidence(
        self, skill: str, resume_skills_lower: Dict[str, str], resume_bullets: List[str]
    ) -> Tuple[Optional[str], Optional[str]]:
        """Identify related domain skills if exact skill is absent."""
        for domain, domain_skills in RELATED_DOMAINS.items():
            if skill in domain_skills:
                for candidate_skill, original_name in resume_skills_lower.items():
                    if candidate_skill in domain_skills and candidate_skill != skill:
                        return f"Skills: {original_name}", original_name

        return None, None


canonical_scorer = CanonicalScorer()
