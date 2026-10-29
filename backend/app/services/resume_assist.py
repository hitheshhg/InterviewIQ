import re
import logging
from typing import List, Set, Tuple
from pydantic import BaseModel, Field
from app.models.assist import AIAssistRequest, AIAssistOption, AIAssistResponse
from app.services.gemini_client import gemini_client
from app.services.scoring_engine import ALL_TECH_KEYWORDS, STRONG_ACTION_VERBS, PASSIVE_WEAK_PHRASES

logger = logging.getLogger("interviewiq.resume_assist")


class AIAssistRawOption(BaseModel):
    text: str = Field(..., description="Rewritten bullet or summary")
    diff_summary: str = Field(..., description="1-line summary of improvements")
    explanation: str = Field(..., description="ATS rationale")


class AIAssistGeneratedResponse(BaseModel):
    options: List[AIAssistRawOption] = Field(default_factory=list)


class ResumeAssistService:
    """
    Truthful AI bullet & summary enhancement service.
    Enforces the Evidence Check principle: flags any newly introduced numbers or skills
    requiring candidate confirmation.
    """

    def extract_numbers_and_metrics(self, text: str) -> Set[str]:
        """Extracts numerical quantities, percentages, and metrics from text."""
        # Finds: 35%, $50k, 200, 4.5, 50k, etc.
        tokens = re.findall(r"\b\d+(?:\.\d+)?(?:%|k|m|ms|s|x)?\b|\$\d+", text.lower())
        return set(tokens)

    def extract_tech_entities(self, text: str) -> Set[str]:
        """Extracts recognized technical entities from text."""
        lower = text.lower()
        found = set()
        for tech in ALL_TECH_KEYWORDS:
            pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech) + r"(?![a-zA-Z0-9])"
            if re.search(pattern, lower):
                found.add(tech)
        return found

    def verify_truthful_evidence(
        self,
        original_text: str,
        option_text: str,
        candidate_skills: List[str],
    ) -> Tuple[bool, List[str]]:
        """
        Truthful AI Evidence Check:
        Returns (has_new_claims, unverified_tokens).
        Flags any numbers or tech entities present in option_text that were absent
        from original_text and candidate's verified skills list.
        """
        orig_metrics = self.extract_numbers_and_metrics(original_text)
        opt_metrics = self.extract_numbers_and_metrics(option_text)

        orig_tech = self.extract_tech_entities(original_text)
        cand_tech_normalized = {s.strip().lower() for s in candidate_skills}
        opt_tech = self.extract_tech_entities(option_text)

        unverified = []

        # Check for newly invented numbers/metrics
        for m in opt_metrics:
            if m not in orig_metrics:
                unverified.append(m)

        # Check for newly invented tech stack claims
        for t in opt_tech:
            if t not in orig_tech and t not in cand_tech_normalized:
                unverified.append(t.title())

        has_new_claims = len(unverified) > 0
        return has_new_claims, unverified

    async def generate_assist_options(self, req: AIAssistRequest) -> AIAssistResponse:
        """
        Generates 3 varied rewrite options tailored to the requested action,
        with automated Truthful AI evidence verification on each option.
        """
        orig_text = req.text.strip()
        action = req.action

        prompt = f"""You are an elite ATS resume optimization assistant.
Your task is to rewrite this candidate's resume bullet point or summary based on the action: '{action}'.

CANDIDATE ORIGINAL TEXT:
"{orig_text}"

ROLE CONTEXT: {req.context_role or 'Software Engineer'}
COMPANY CONTEXT: {req.context_company or 'Tech Company'}

CRITICAL RULES:
1. TRUTHFUL AI: Never invent fake employers, companies, or ungrounded statistics.
2. If action is 'improve': Replace weak passive verbs with strong action verbs (e.g. Engineered, Spearheaded, Optimized, Architected), sharpen clarity.
3. If action is 'add_impact': Rephrase using the Google X-Y-Z formula (Accomplished [X] as measured by [Y], by doing [Z]). If metrics exist in original, highlight them. If not, provide structured outcome framing.
4. If action is 'shorten': Condense to under 22 words, high impact, cutting unnecessary fluff.
5. Provide EXACTLY 3 distinct options with varying tone/angle.

Return JSON adhering strictly to:
{{
  "options": [
    {{
      "text": "Rewritten bullet string",
      "diff_summary": "1-line explanation of changes",
      "explanation": "Why this works well for ATS and recruiters"
    }}
  ]
}}
"""

        try:
            parsed_data, _, _ = await gemini_client.generate_structured_json(
                prompt=prompt,
                response_model=AIAssistGeneratedResponse,
            )

            options: List[AIAssistOption] = []

            for opt in parsed_data.options[:3]:
                text = opt.text.strip()
                if not text:
                    continue
                diff_summary = opt.diff_summary or "Enhanced action phrasing and clarity."
                explanation = opt.explanation or "ATS-optimized phrasing with strong verb alignment."

                has_claims, unverified = self.verify_truthful_evidence(
                    original_text=orig_text,
                    option_text=text,
                    candidate_skills=req.candidate_skills or [],
                )

                options.append(
                    AIAssistOption(
                        text=text,
                        diff_summary=diff_summary,
                        has_new_claims=has_claims,
                        unverified_tokens=unverified,
                        explanation=explanation,
                    )
                )

            if len(options) >= 2:
                return AIAssistResponse(
                    original_text=orig_text,
                    action=action,
                    options=options,
                )

        except Exception as e:
            logger.warning(f"[ResumeAssist] Gemini assist call failed or timed out: {e}. Using deterministic fallback.")

        # Graceful Deterministic Fallback
        fallback_options = self._generate_rule_based_fallback(req)
        return AIAssistResponse(
            original_text=orig_text,
            action=action,
            options=fallback_options,
        )

    def _generate_rule_based_fallback(self, req: AIAssistRequest) -> List[AIAssistOption]:
        """Deterministic heuristic rewriter when AI model is unavailable or rate-limited."""
        text = req.text.strip().lstrip("•-* ").strip()

        # Remove passive openers
        cleaned = text
        for passive in PASSIVE_WEAK_PHRASES:
            if cleaned.lower().startswith(passive):
                cleaned = cleaned[len(passive):].strip().lstrip(",").strip()
                if cleaned.startswith("to "):
                    cleaned = cleaned[3:].strip()
                break

        words = cleaned.split()

        if req.action == "shorten":
            # High-impact condensed variants strictly under 18 words
            short1 = " ".join(words[:14])
            short2 = " ".join(words[:12])
            short3 = " ".join(words[:10])

            opt1_text = f"Engineered {short1[0].lower() + short1[1:] if short1 else text}."
            opt2_text = f"Architected and optimized {short2[0].lower() + short2[1:] if short2 else text}."
            opt3_text = f"Streamlined {short3[0].lower() + short3[1:] if short3 else text}."

            h1, u1 = self.verify_truthful_evidence(req.text, opt1_text, req.candidate_skills or [])
            h2, u2 = self.verify_truthful_evidence(req.text, opt2_text, req.candidate_skills or [])
            h3, u3 = self.verify_truthful_evidence(req.text, opt3_text, req.candidate_skills or [])

            return [
                AIAssistOption(
                    text=opt1_text,
                    diff_summary="Condensed to core technical objective.",
                    has_new_claims=h1,
                    unverified_tokens=u1,
                    explanation="Concise framing under 16 words for fast scanning.",
                ),
                AIAssistOption(
                    text=opt2_text,
                    diff_summary="Focused on architectural contribution.",
                    has_new_claims=h2,
                    unverified_tokens=u2,
                    explanation="Removes fluff and highlights ownership.",
                ),
                AIAssistOption(
                    text=opt3_text,
                    diff_summary="Minimalist high-density action phrasing.",
                    has_new_claims=h3,
                    unverified_tokens=u3,
                    explanation="Short, punchy bullet for 1-page fit resumes.",
                ),
            ]

        # Option 1: Strong Action Verb
        opt1_text = f"Engineered and deployed {cleaned[0].lower() + cleaned[1:] if cleaned else text}"
        has_claims1, unver1 = self.verify_truthful_evidence(req.text, opt1_text, req.candidate_skills or [])

        # Option 2: Outcome & Efficiency Framing
        opt2_text = f"Spearheaded implementation of {cleaned[0].lower() + cleaned[1:] if cleaned else text}, improving workflow efficiency and reliability"
        has_claims2, unver2 = self.verify_truthful_evidence(req.text, opt2_text, req.candidate_skills or [])

        # Option 3: Concise / Shortened
        shortened_body = " ".join(words[:18])
        opt3_text = f"Architected {shortened_body[0].lower() + shortened_body[1:] if shortened_body else text}"
        has_claims3, unver3 = self.verify_truthful_evidence(req.text, opt3_text, req.candidate_skills or [])

        return [
            AIAssistOption(
                text=opt1_text,
                diff_summary="Replaced passive framing with 'Engineered and deployed'.",
                has_new_claims=has_claims1,
                unverified_tokens=unver1,
                explanation="High-impact technical verb recognized by applicant tracking algorithms.",
            ),
            AIAssistOption(
                text=opt2_text,
                diff_summary="Emphasized initiative and process efficiency.",
                has_new_claims=has_claims2,
                unverified_tokens=unver2,
                explanation="Demonstrates leadership and positive downstream technical impact.",
            ),
            AIAssistOption(
                text=opt3_text,
                diff_summary="Concise, high-impact phrasing under 20 words.",
                has_new_claims=has_claims3,
                unverified_tokens=unver3,
                explanation="Optimal bullet length for quick technical recruiter scanning.",
            ),
        ]


resume_assist_service = ResumeAssistService()
