import re
import logging
from typing import Dict, Any, List, Tuple
from app.models.resume import (
    ATSBreakdown,
    ATSAnalysisResult,
    ParsedResume,
)
from app.services.gemini_client import gemini_client

logger = logging.getLogger("interviewiq.ats")

# Standard Engineering Power Action Verbs
ACTION_VERBS = {
    "architected", "engineered", "designed", "developed", "implemented", "deployed",
    "built", "optimized", "refactored", "automated", "integrated", "orchestrated",
    "led", "accelerated", "scaled", "resolved", "reduced", "streamlined", "spearheaded",
    "collaborated", "managed", "migrated", "enhanced", "secured", "configured",
    "mentored", "maintained", "established", "formulated", "executed", "delivered",
}

# Common Technical Keywords Lexicon for matching
TECH_LEXICON = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "golang", "rust",
    "react", "react.js", "next.js", "vue", "angular", "node.js", "express", "fastapi",
    "django", "flask", "spring", "spring boot", "mongodb", "postgresql", "postgres",
    "mysql", "redis", "cassandra", "graphql", "rest", "rest api", "docker", "kubernetes",
    "k8s", "aws", "azure", "gcp", "git", "github", "ci/cd", "microservices", "kafka",
    "rabbitmq", "elasticsearch", "html", "css", "tailwind", "redux", "linux", "agile",
    "scrum", "unit testing", "pytest", "jest", "web sockets", "websockets", "orm", "motor"
}

# Standard Core Resume Sections
STANDARD_SECTIONS = {
    "summary": [r"\bsummary\b", r"\bobjective\b", r"\bprofile\b", r"\babout\b"],
    "experience": [r"\bexperience\b", r"\bemployment\b", r"\bwork\s+history\b", r"\bprofessional\s+experience\b"],
    "education": [r"\beducation\b", r"\bacademics\b", r"\bacademic\s+background\b", r"\bqualifications\b"],
    "skills": [r"\bskills\b", r"\btechnical\s+skills\b", r"\bcompetencies\b", r"\btechnologies\b"],
    "projects": [r"\bprojects\b", r"\btechnical\s+projects\b", r"\bkey\s+projects\b", r"\bacademic\s+projects\b"],
}


def calculate_rule_based_ats(resume_text: str, job_description: str = "") -> Tuple[int, ATSBreakdown, List[str], List[str]]:
    """
    Deterministic mathematical ATS scoring algorithm.
    Evaluates:
    1. Keyword Match Coverage (35% weight)
    2. Section Completeness (20% weight)
    3. Quantifiable Impact & Metrics (15% weight)
    4. Action Verbs Usage (15% weight)
    5. Formatting, Length & Contact Info (15% weight)
    """
    clean_resume = resume_text.lower()
    clean_jd = (job_description or "").lower()

    # 1. Keyword Matching
    matched_kws, missing_kws, kw_score = _evaluate_keywords(clean_resume, clean_jd)

    # 2. Section Completeness
    section_score = _evaluate_sections(clean_resume)

    # 3. Quantifiable Impact (numbers, %, metrics)
    impact_score = _evaluate_quantifiable_metrics(resume_text)

    # 4. Action Verbs
    action_verb_score = _evaluate_action_verbs(clean_resume)

    # 5. Formatting & Length
    formatting_score = _evaluate_formatting_and_length(resume_text)

    # Weighted Overall Score
    overall = (
        (kw_score * 0.35)
        + (section_score * 0.20)
        + (impact_score * 0.15)
        + (action_verb_score * 0.15)
        + (formatting_score * 0.15)
    )

    overall_score = int(round(max(0, min(100, overall))))

    breakdown = ATSBreakdown(
        keyword_match_score=round(kw_score, 1),
        section_completeness_score=round(section_score, 1),
        quantifiable_impact_score=round(impact_score, 1),
        action_verbs_score=round(action_verb_score, 1),
        formatting_score=round(formatting_score, 1),
    )

    return overall_score, breakdown, matched_kws, missing_kws


def _evaluate_keywords(resume_text: str, jd_text: str) -> Tuple[List[str], List[str], float]:
    """Identify matched and missing keywords against target JD or general lexicon."""
    target_keywords = set()

    if jd_text.strip():
        # Extract tech terms present in JD
        for tech in TECH_LEXICON:
            if re.search(r"\b" + re.escape(tech) + r"\b", jd_text):
                target_keywords.add(tech)
        # Also grab capitalized technical patterns from JD
        capitalized = re.findall(r"\b[A-Z][a-zA-Z0-9\+\#\.\-]{1,15}\b", jd_text)
        for cap in capitalized:
            cap_lower = cap.lower()
            if cap_lower in TECH_LEXICON:
                target_keywords.add(cap_lower)
    else:
        # If no JD provided, evaluate against core full-stack competencies
        target_keywords = {"python", "javascript", "react", "fastapi", "mongodb", "git", "rest", "docker"}

    if not target_keywords:
        target_keywords = {"python", "javascript", "react", "fastapi", "git", "rest api"}

    matched = []
    missing = []

    for kw in sorted(target_keywords):
        if re.search(r"\b" + re.escape(kw) + r"\b", resume_text):
            matched.append(kw.title() if kw not in {"ci/cd", "k8s"} else kw.upper())
        else:
            missing.append(kw.title() if kw not in {"ci/cd", "k8s"} else kw.upper())

    score = (len(matched) / len(target_keywords)) * 100 if target_keywords else 80.0
    return matched, missing, min(100.0, score)


def _evaluate_sections(resume_text: str) -> float:
    """Check presence of standard resume sections."""
    found_count = 0
    for section_name, patterns in STANDARD_SECTIONS.items():
        if any(re.search(pat, resume_text) for pat in patterns):
            found_count += 1
    # 5 standard sections = 20 points each
    return min(100.0, (found_count / len(STANDARD_SECTIONS)) * 100)


def _evaluate_quantifiable_metrics(resume_text: str) -> float:
    """Scan for quantifiable numbers, percentages, multipliers, and metrics."""
    patterns = [
        r"\b\d+%",                          # Percentages: 45%
        r"\b\d+\s*(?:ms|seconds|minutes)\b", # Latency / time
        r"\b\d+\s*(?:k|m|million|users|requests)\b", # Scale
        r"\b\d+x\b",                        # Multipliers: 10x
        r"(?:\$|₹|£|€)\s*\d+",              # Monetary amounts
        r"\bincreased\b|\breduced\b|\bboosted\b|\bgrew\b", # Metric keywords
    ]

    metric_hits = 0
    for pat in patterns:
        matches = re.findall(pat, resume_text, re.IGNORECASE)
        metric_hits += len(matches)

    # 5+ metric instances earns full 100 points
    score = min(100.0, (metric_hits / 5.0) * 100.0)
    return score


def _evaluate_action_verbs(resume_text: str) -> float:
    """Measure the usage and diversity of strong technical action verbs."""
    found_verbs = set()
    for verb in ACTION_VERBS:
        if re.search(r"\b" + verb + r"\b", resume_text):
            found_verbs.add(verb)

    # Using 8+ distinct power verbs earns 100 points
    score = min(100.0, (len(found_verbs) / 8.0) * 100.0)
    return score


def _evaluate_formatting_and_length(resume_text: str) -> float:
    """Check word count, bullet density, and contact details."""
    words = resume_text.split()
    word_count = len(words)
    score = 100.0

    # Ideal length: 300 to 1000 words
    if word_count < 150:
        score -= 40.0
    elif word_count < 300:
        score -= 20.0
    elif word_count > 1500:
        score -= 20.0

    # Contact checks
    has_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", resume_text))
    has_phone = bool(re.search(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", resume_text))
    has_github_or_linkedin = bool(re.search(r"github\.com|linkedin\.com", resume_text, re.IGNORECASE))

    if not has_email:
        score -= 20.0
    if not has_phone:
        score -= 10.0
    if not has_github_or_linkedin:
        score -= 10.0

    return max(0.0, min(100.0, score))


async def run_full_ats_analysis(
    resume_text: str,
    job_description: str = "",
    target_role: str = "Full Stack Developer",
) -> ATSAnalysisResult:
    """
    Orchestrate hybrid ATS evaluation:
    1. Deterministic mathematical calculations for defensible viva scoring.
    2. Gemini structured LLM extraction for semantic parsing and qualitative tips.
    """
    # 1. Run deterministic rule-based algorithms
    overall_score, breakdown, matched_kws, missing_kws = calculate_rule_based_ats(
        resume_text, job_description
    )

    # 2. Extract structured entities and qualitative feedback with Gemini
    prompt_template = f"""
    You are an elite technical ATS evaluator.
    Analyze the following resume text against the target job description.

    Target Role: {target_role}
    Target Job Description:
    {job_description or "General Full Stack Developer role requiring Python, FastAPI, React, TypeScript, and modern databases."}

    Resume Raw Text:
    {resume_text}

    Extract candidate details, categorized skills, education, projects, and provide 3-5 specific actionable tips to boost the resume score.
    """

    try:
        parsed_resume, model_used, latency = await gemini_client.generate_structured_json(
            prompt=prompt_template,
            response_model=ParsedResume,
            system_instruction="You are an expert technical ATS resume parser. Extract structured entities with high accuracy."
        )
    except Exception as e:
        logger.warning(f"[ATS] Gemini parsing fallback triggered: {e}")
        # Graceful fallback parser in case of LLM failure
        parsed_resume = _fallback_entity_extractor(resume_text)

    # Synthesize actionable tips based on calculated rule gaps
    actionable_tips = _generate_actionable_tips(breakdown, missing_kws)

    return ATSAnalysisResult(
        overall_score=overall_score,
        breakdown=breakdown,
        matched_keywords=matched_kws,
        missing_keywords=missing_kws,
        actionable_tips=actionable_tips,
        target_role=target_role,
        parsed_data=parsed_resume,
    )


def _generate_actionable_tips(breakdown: ATSBreakdown, missing_kws: List[str]) -> List[str]:
    """Generate deterministic, high-impact tips based on weakest scoring categories."""
    tips = []

    if missing_kws:
        top_missing = ", ".join(missing_kws[:3])
        tips.append(f"Incorporate targeted keywords: {top_missing} are required by the target job description.")

    if breakdown.quantifiable_impact_score < 70:
        tips.append("Add quantifiable metrics to your project bullet points (e.g., 'reduced API response times by 35%', 'scaled system to 5,000 requests/sec').")

    if breakdown.action_verbs_score < 70:
        tips.append("Begin project bullet points with strong technical power verbs (e.g., 'Architected', 'Engineered', 'Optimized', 'Automated').")

    if breakdown.section_completeness_score < 80:
        tips.append("Ensure your resume has distinct labeled sections for Summary, Technical Skills, Experience, Education, and Projects.")

    if breakdown.formatting_score < 80:
        tips.append("Include clickable links to your GitHub repositories and LinkedIn profile to improve ATS credibility.")

    if not tips:
        tips.append("Strong resume structure! Review project bullet points to ensure recent technical accomplishments are highlighted first.")

    return tips[:4]


def _fallback_entity_extractor(text: str) -> ParsedResume:
    """Basic regex fallback entity extractor if LLM is temporarily unreachable."""
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
    phone_match = re.search(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", text)

    first_line = text.strip().split("\n")[0].strip()
    candidate_name = first_line[:50] if first_line else "Candidate"

    return ParsedResume(
        candidate_name=candidate_name,
        contact={
            "email": email_match.group(0) if email_match else "",
            "phone": phone_match.group(0) if phone_match else "",
            "linkedin": "",
            "github": "",
            "location": ""
        },
        summary="Extracted via InterviewIQ Text Parser",
        technical_skills=["Python", "React", "FastAPI", "MongoDB"],
        soft_skills=["Problem Solving", "Communication"],
        tools=["Git", "Docker"],
        experience=[],
        education=[],
        projects=[],
        certifications=[]
    )
