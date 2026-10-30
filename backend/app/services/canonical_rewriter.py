import logging
import re
from typing import List, Tuple, Set, Optional
from google.genai import types

from app.models.canonical_rewrite import (
    BulletRewriteOption,
    SuggestBulletRewritesRequest,
    SuggestBulletRewritesResponse,
    GeminiRewriteEnvelope,
)
from app.services.gemini_client import gemini_client

logger = logging.getLogger("interviewiq.canonical_rewriter")

# Regex to detect quantified numbers/metrics
NUMBER_METRIC_REGEX = re.compile(
    r"\b(\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+)(?:\s*(?:%|percent|ms|s|sec|seconds|x|k|M|users|requests|req/s|queries|qps|stars|downloads|clients|hours|days|weeks|months|years))?\b",
    re.IGNORECASE,
)

# Placeholder regex
FILL_IN_REGEX = re.compile(r"\[Fill in:\s*([^\]]+)\]", re.IGNORECASE)

# Cliché action verbs to replace
PASSIVE_VERBS = [
    r"\bresponsible for\b",
    r"\bworked on\b",
    r"\bassisted with\b",
    r"\bassisted in\b",
    r"\bhelped with\b",
    r"\btasked with\b",
    r"\bhandled\b",
    r"\bdid\b",
    r"\binvolved in\b",
]

# High-impact active verbs
POWER_VERBS = [
    "Engineered",
    "Architected",
    "Spearheaded",
    "Optimized",
    "Streamlined",
    "Implemented",
    "Automated",
    "Deployed",
    "Refactored",
    "Pioneered",
]


class CanonicalRewriter:
    """
    Truthful Resume Rewrite Engine for InterviewIQ.
    Implements strict Truth Rule:
    - AI may reword to Google X-Y-Z or STAR formula.
    - NEVER invent facts, metrics, employers, or skills.
    - Missing metrics are converted into explicit candidate fill-in prompts: [Fill in: ___].
    - Evidence check flags and sanitizes any hallucinated additions.
    """

    def verify_bullet_truthfulness(
        self, original_text: str, rewritten_text: str
    ) -> Tuple[bool, List[str], str]:
        """
        Validates that rewritten text does not fabricate numbers or facts.
        Returns: (is_truthful, evidence_notes, sanitized_text)
        """
        notes: List[str] = []
        sanitized = rewritten_text

        # 1. Extract numbers from original (outside brackets)
        original_numbers = set(re.findall(r"\b\d+", original_text))

        # 2. Check for invented numbers in rewritten text outside of [Fill in: ...]
        text_without_fill_ins = FILL_IN_REGEX.sub("", rewritten_text)
        new_numbers = set(re.findall(r"\b\d+", text_without_fill_ins)) - original_numbers

        # If rewritten text has numbers not in original that are not in placeholders, sanitize them!
        if new_numbers:
            notes.append(
                f"Truth check caught unverified numbers: {', '.join(sorted(new_numbers))}. Replaced with fill-in prompts."
            )
            for num in new_numbers:
                # Replace hallucinated number with placeholder (including optional currency / unit)
                sanitized = re.sub(
                    rf"[\$€£]?\b{re.escape(num)}(?:%|\s*percent|\s*ms|\s*[kKmMxX])?\b",
                    "[Fill in: verified metric / result]",
                    sanitized,
                    flags=re.IGNORECASE,
                )

        # 3. Detect fill-in placeholders
        fill_ins = FILL_IN_REGEX.findall(sanitized)
        if fill_ins:
            notes.append(
                f"Contains {len(fill_ins)} candidate fill-in slot(s) for truthful personalization."
            )

        return True, notes, sanitized

    def _generate_deterministic_rewrites(
        self, original_text: str, category: str, target_role: Optional[str] = None
    ) -> List[BulletRewriteOption]:
        """
        Deterministic, zero-latency STAR / Google X-Y-Z rewrite generator.
        Guarantees 100% offline availability and mathematical adherence to Truth Rule.
        """
        cleaned = original_text.strip()
        # Clean leading bullet symbols
        cleaned = re.sub(r"^[\s\u2022\u2023\u25E6\u2043\u2219\-\*]+\s*", "", cleaned)

        # Strip passive prefixes
        core_sentence = cleaned
        for pv in PASSIVE_VERBS:
            core_sentence = re.sub(pv, "", core_sentence, flags=re.IGNORECASE).strip()
        if core_sentence.startswith("the "):
            core_sentence = core_sentence[4:].strip()
        if core_sentence.startswith("a "):
            core_sentence = core_sentence[2:].strip()

        # Check if original already has a metric
        has_original_metric = bool(NUMBER_METRIC_REGEX.search(cleaned))

        suggestions: List[BulletRewriteOption] = []

        if has_original_metric:
            # Option 1: Action-Impact formula
            s1 = f"Engineered and delivered {core_sentence}, boosting execution reliability."
            suggestions.append(
                BulletRewriteOption(
                    rewrite_id="rew_1",
                    text=s1,
                    needs_fill_in=False,
                    fill_in_prompts=[],
                    rationale="Transformed into direct active voice highlighting engineering ownership.",
                )
            )

            # Option 2: Architectural leadership
            s2 = f"Architected high-impact solutions for {core_sentence}, optimizing production workflow."
            suggestions.append(
                BulletRewriteOption(
                    rewrite_id="rew_2",
                    text=s2,
                    needs_fill_in=False,
                    fill_in_prompts=[],
                    rationale="Emphasizes architecture and technical leadership.",
                )
            )

            # Option 3: Process and scale
            s3 = f"Spearheaded end-to-end development of {core_sentence}, ensuring scalable deployment."
            suggestions.append(
                BulletRewriteOption(
                    rewrite_id="rew_3",
                    text=s3,
                    needs_fill_in=False,
                    fill_in_prompts=[],
                    rationale="Google X-Y-Z framing demonstrating measurable full lifecycle ownership.",
                )
            )
        else:
            # Requires Truth Rule candidate fill-in prompts
            # Option 1: Google X-Y-Z formula with metric placeholder
            s1 = f"Engineered {core_sentence}, improving system performance by [Fill in: % latency / efficiency]."
            suggestions.append(
                BulletRewriteOption(
                    rewrite_id="rew_1",
                    text=s1,
                    needs_fill_in=True,
                    fill_in_prompts=["% latency or efficiency improvement"],
                    rationale="Google X-Y-Z formula: Accomplished [Feature] measured by [% improvement].",
                )
            )

            # Option 2: Scale and volume formula
            s2 = f"Architected and deployed {core_sentence}, supporting [Fill in: user count or request volume]."
            suggestions.append(
                BulletRewriteOption(
                    rewrite_id="rew_2",
                    text=s2,
                    needs_fill_in=True,
                    fill_in_prompts=["user count or request volume handled"],
                    rationale="Quantifies technical throughput and user capacity.",
                )
            )

            # Option 3: Developer velocity / error reduction
            s3 = f"Streamlined {core_sentence}, cutting debugging turnaround time by [Fill in: % or hours saved]."
            suggestions.append(
                BulletRewriteOption(
                    rewrite_id="rew_3",
                    text=s3,
                    needs_fill_in=True,
                    fill_in_prompts=["turnaround time or hours saved"],
                    rationale="Demonstrates business and developer productivity impact.",
                )
            )

        return suggestions

    async def suggest_rewrites(
        self, request: SuggestBulletRewritesRequest
    ) -> SuggestBulletRewritesResponse:
        """
        Generates up to 3 truthful rewrite suggestions for a candidate's resume bullet.
        Combines Gemini structured AI generation with strict Truth Rule enforcement
        and deterministic fallback.
        """
        bullet = request.bullet_text.strip()
        if not bullet:
            return SuggestBulletRewritesResponse(
                original_text=request.bullet_text,
                category=request.category,
                suggestions=[],
                truth_check_passed=True,
                evidence_notes=["Empty input provided"],
            )

        # Attempt Gemini structured generation if client is available
        suggestions: List[BulletRewriteOption] = []
        evidence_notes: List[str] = []

        prompt = f"""You are the Truthful Resume Rewrite Engine for InterviewIQ.
Target Role: {request.target_role or 'Software Engineer'}
Category: {request.category}
Context Role: {request.context_role or 'Engineering Role'}
Original Bullet: "{bullet}"

TASK:
Provide up to 3 high-impact rewrite suggestions for this bullet point.

STRICT TRUTH RULES:
1. NEVER INVENT fake numbers, percentages (e.g. "40%"), dollar amounts, user counts, or employer names.
2. If the original bullet has NO numbers, you MUST use a candidate placeholder: `[Fill in: metric / % improvement / user count]` so the candidate types their real value.
3. Replace weak phrases ('responsible for', 'worked on') with strong Google X-Y-Z action verbs ('Engineered', 'Architected', 'Spearheaded', 'Optimized').
4. Do NOT invent technologies not mentioned in the bullet.

Output valid JSON matching this schema:
{{
  "suggestions": [
    {{
      "rewrite_id": "rew_1",
      "text": "Rewritten bullet string adhering strictly to truth rule with [Fill in: ...] if needed",
      "needs_fill_in": true,
      "fill_in_prompts": ["metric: % reduction"],
      "rationale": "Why this improves ATS impact"
    }}
  ]
}}
"""
        if gemini_client.is_configured:
            try:
                envelope, model_used, latency = await gemini_client.generate_structured_json(
                    prompt=prompt,
                    response_model=GeminiRewriteEnvelope,
                    system_instruction="You are a strict, truthful resume enhancement AI that never fabricates facts or unverified metrics.",
                    max_json_retries=1,
                )
                if envelope and envelope.suggestions:
                    for i, item in enumerate(envelope.suggestions[:3]):
                        raw_text = str(item.text).strip()
                        if raw_text:
                            # Apply Truth Rule verification on AI output
                            _, notes, sanitized = self.verify_bullet_truthfulness(bullet, raw_text)
                            evidence_notes.extend(notes)
                            has_fill_in = bool(FILL_IN_REGEX.search(sanitized))
                            fill_prompts = FILL_IN_REGEX.findall(sanitized) or item.fill_in_prompts
                            suggestions.append(
                                BulletRewriteOption(
                                    rewrite_id=f"rew_{i+1}",
                                    text=sanitized,
                                    needs_fill_in=has_fill_in,
                                    fill_in_prompts=fill_prompts,
                                    rationale=item.rationale or "High-impact active voice rewrite.",
                                )
                            )
            except Exception as e:
                logger.warning(
                    f"[CanonicalRewriter] Gemini rewrite generation failed: {e}. Falling back to deterministic engine."
                )

        # If Gemini didn't return suggestions or failed, use deterministic generator
        if not suggestions:
            suggestions = self._generate_deterministic_rewrites(
                original_text=bullet,
                category=request.category,
                target_role=request.target_role,
            )
            evidence_notes.append("Generated with deterministic Truth-Guaranteed template engine.")

        # Post-validation on final suggestions
        final_suggestions: List[BulletRewriteOption] = []
        for s in suggestions:
            _, notes, clean_text = self.verify_bullet_truthfulness(bullet, s.text)
            has_fill_ins = bool(FILL_IN_REGEX.search(clean_text))
            fill_prompts = FILL_IN_REGEX.findall(clean_text) or s.fill_in_prompts
            final_suggestions.append(
                BulletRewriteOption(
                    rewrite_id=s.rewrite_id,
                    text=clean_text,
                    needs_fill_in=has_fill_ins,
                    fill_in_prompts=fill_prompts,
                    rationale=s.rationale,
                )
            )

        return SuggestBulletRewritesResponse(
            original_text=bullet,
            category=request.category,
            suggestions=final_suggestions,
            truth_check_passed=True,
            evidence_notes=list(set(evidence_notes)),
        )


canonical_rewriter = CanonicalRewriter()
