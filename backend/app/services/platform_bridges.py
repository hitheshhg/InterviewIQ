import uuid
import logging
from typing import List, Optional, Set, Dict, Any
from datetime import datetime, timezone

from app.models.resume_studio import CanonicalResume
from app.models.platform_bridges import (
    InterviewSeedItem,
    GenerateSeedsResponse,
    GenerateRoadmapFromGapsRequest,
)
from app.models.report import RoadmapMilestone, PersonalizedRoadmap
from app.services.scoring_engine import scoring_engine
from app.services.report_engine import report_engine
from app.database import db_manager

logger = logging.getLogger("interviewiq.platform_bridges")


class PlatformBridgesService:
    """
    Connects Resume Studio with the rest of InterviewIQ:
    1. Generates interview question seeds from weak resume claims and JD skill gaps.
    2. Constructs targeted career roadmaps from multi-JD common gaps.
    """

    def generate_interview_seeds(
        self,
        resume: CanonicalResume,
        job_description: Optional[str] = None,
        target_role: Optional[str] = "Software Engineer",
    ) -> GenerateSeedsResponse:
        """
        Extract targeted interview seeds by scanning for:
        - Unsubstantiated skills (listed in catalog with zero project/experience evidence)
        - Weak resume phrasing (passive voice, missing metrics)
        - Missing job description requirements
        """
        seeds: List[InterviewSeedItem] = []
        role_title = target_role or "Software Engineer"

        # 1. Unsubstantiated Skills Check
        # Aggregate all bullets and accomplishment text across experience and projects
        all_bullet_text = " ".join(
            [b for exp in resume.experience for b in exp.bullets]
            + [b for proj in resume.projects for b in proj.bullets]
        ).lower()

        catalog_skills = (
            resume.skills.developer_tools
            + resume.skills.cloud_databases
            + resume.skills.frameworks_libraries
            + resume.skills.languages
            + resume.skills.core_concepts
        )

        unsubstantiated: List[str] = [
            s.strip() for s in catalog_skills if s.strip() and s.strip().lower() not in all_bullet_text
        ]

        unsub_seeds: List[InterviewSeedItem] = []
        for s in unsubstantiated[:2]:
            unsub_seeds.append(
                InterviewSeedItem(
                    id=f"seed-{uuid.uuid4().hex[:8]}",
                    seed_type="unsubstantiated_skill",
                    topic=s,
                    seed_prompt=f"You listed {s} in your technical skills catalog, but there is no project or experience bullet demonstrating it: explain how and where you used {s} in a production or academic system.",
                    reason=f"'{s}' is listed in skills catalog without supporting project evidence.",
                )
            )

        # 2. Weak Resume Claims Check
        weak_claim_seeds: List[InterviewSeedItem] = []
        weak_lines = scoring_engine.detect_weak_lines(resume)
        for wl in weak_lines[:2]:
            if wl.issue_type == "passive_phrase":
                prompt = (
                    f"Your resume bullet mentions: \"{wl.original_line}\". "
                    f"Walk me through your specific individual technical contributions and architectural choices on that system."
                )
            elif wl.issue_type == "missing_metric":
                prompt = (
                    f"In your accomplishment: \"{wl.original_line}\", "
                    f"how did you quantify engineering success? What were the latency, throughput, or user engagement metrics?"
                )
            else:
                prompt = (
                    f"Regarding your project claim: \"{wl.original_line}\", "
                    f"explain the underlying technical tradeoffs and challenges you solved."
                )

            weak_claim_seeds.append(
                InterviewSeedItem(
                    id=f"seed-{uuid.uuid4().hex[:8]}",
                    seed_type="weak_claim",
                    topic=wl.issue_type.replace("_", " ").title(),
                    seed_prompt=prompt,
                    reason=f"Identified weak claim: {wl.recommendation}",
                )
            )

        # 3. Missing JD Skills Check (if JD provided)
        missing_jd_seeds: List[InterviewSeedItem] = []
        if job_description and len(job_description.strip()) >= 15:
            try:
                score_res = scoring_engine.calculate_full_ats_score(
                    resume=resume, job_description=job_description, target_role=role_title
                )
                for ms in score_res.missing_skills[:2]:
                    missing_jd_seeds.append(
                        InterviewSeedItem(
                            id=f"seed-{uuid.uuid4().hex[:8]}",
                            seed_type="missing_jd_skill",
                            topic=ms.skill,
                            seed_prompt=(
                                f"The target {role_title} role requires {ms.skill}, which was not identified on your resume: "
                                f"have you worked with {ms.skill} or an equivalent alternative, and how would you ramp up quickly?"
                            ),
                            reason=f"Target role requires '{ms.skill}', which is missing from resume.",
                        )
                    )
            except Exception as e:
                logger.warning(f"[PlatformBridges] Error checking JD missing skills: {e}")

        # Combine balanced seeds across categories
        final_seeds = unsub_seeds + weak_claim_seeds + missing_jd_seeds


        return GenerateSeedsResponse(
            seeds=final_seeds,
            target_role=role_title,
            total_seeds=len(final_seeds),
        )

    async def generate_roadmap_from_common_gaps(
        self,
        user_id: str,
        request: GenerateRoadmapFromGapsRequest,
    ) -> PersonalizedRoadmap:
        """
        Construct a customized Career Roadmap targeting the exact common gaps
        identified in Multi-JD comparisons.
        """
        target_role = request.target_role or "Software Engineer"
        gaps = request.common_gaps[:6]  # top 6 gaps
        roadmap_id = f"road-{uuid.uuid4().hex[:12]}"

        gap_str_1 = ", ".join(gaps[:2]) if len(gaps) >= 2 else (gaps[0] if gaps else "Distributed Systems")
        gap_str_2 = ", ".join(gaps[2:4]) if len(gaps) >= 4 else (gaps[-1] if gaps else "Cloud Architecture")
        all_gaps_str = ", ".join(gaps) if gaps else "Target Modern Architecture"

        milestones = [
            RoadmapMilestone(
                milestone_id=f"ms-{uuid.uuid4().hex[:8]}",
                step_number=1,
                title=f"Core Foundations: {gap_str_1}",
                target_skill=gap_str_1,
                difficulty="Beginner",
                estimated_days=10,
                actionable_tasks=[
                    f"Read official architectural documentation and guides for {gap_str_1}.",
                    f"Build hello-world prototypes and configure isolated sandbox environments for {gap_str_1}.",
                    "Implement 5 targeted exercises focusing on failure modes, lifecycle management, and error handling.",
                ],
                recommended_resources=[
                    f"Official {gap_str_1} Documentation & Interactive Tutorials",
                    "Designing Data-Intensive Applications (Chapters 1-4)",
                ],
                capstone_mini_project=f"Build and test a containerized microservice demonstrating core {gap_str_1} principles with comprehensive unit tests.",
            ),
            RoadmapMilestone(
                milestone_id=f"ms-{uuid.uuid4().hex[:8]}",
                step_number=2,
                title=f"Intermediate Patterns: {gap_str_2}",
                target_skill=gap_str_2,
                difficulty="Intermediate",
                estimated_days=14,
                actionable_tasks=[
                    f"Integrate {gap_str_2} into an asynchronous pipeline with automated health checks.",
                    "Configure distributed caching, replication, and failover policies.",
                    "Benchmark performance under simulated peak load with Locust or k6.",
                ],
                recommended_resources=[
                    f"Production Engineering Best Practices for {gap_str_2}",
                    "System Design Primer (GitHub / Donne Martin)",
                ],
                capstone_mini_project=f"Deploy an event-driven ingestion service utilizing {gap_str_2} with sub-50ms latency.",
            ),
            RoadmapMilestone(
                milestone_id=f"ms-{uuid.uuid4().hex[:8]}",
                step_number=3,
                title=f"Production Hardening & System Design ({target_role})",
                target_skill=f"{all_gaps_str} Hardening",
                difficulty="Advanced",
                estimated_days=12,
                actionable_tasks=[
                    "Implement end-to-end CI/CD pipelines with linting, automated testing, and zero-downtime deployment.",
                    "Instrument distributed tracing with OpenTelemetry and configure Prometheus/Grafana alerts.",
                    "Document architectural decision records (ADRs) justifying all technical tradeoffs.",
                ],
                recommended_resources=[
                    "Site Reliability Engineering (Google SRE Book)",
                    "Cloud Native Architecture Design Patterns",
                ],
                capstone_mini_project="Engineer a fault-tolerant multi-zone cluster with automated chaos monkey testing.",
            ),
            RoadmapMilestone(
                milestone_id=f"ms-{uuid.uuid4().hex[:8]}",
                step_number=4,
                title=f"Full Portfolio Capstone: {target_role} Integration",
                target_skill="End-to-End System Integration",
                difficulty="Advanced",
                estimated_days=14,
                actionable_tasks=[
                    f"Develop a complete production-grade application integrating {all_gaps_str}.",
                    "Conduct extensive load benchmarking and document quantified performance metrics (throughput, latency, uptime).",
                    "Add detailed README with architectural diagrams, API documentation, and live demo links to your resume.",
                ],
                recommended_resources=[
                    "Clean Architecture & Microservices Masterclass",
                    "Senior Engineering Viva & Technical Defense Guidelines",
                ],
                capstone_mini_project=f"Publish a production-ready, open-source {target_role} project featuring {all_gaps_str} with live cloud deployment.",
            ),
        ]

        now = datetime.now(timezone.utc)
        roadmap = PersonalizedRoadmap(
            roadmap_id=roadmap_id,
            user_id=user_id,
            target_role=target_role,
            identified_weak_areas=gaps,
            milestones=milestones,
            estimated_total_weeks=7,
            created_at=now,
        )

        # Persist to MongoDB Atlas if available
        if db_manager.db is not None:
            try:
                roadmap_doc = roadmap.model_dump()
                await db_manager.db.roadmaps.replace_one(
                    {"user_id": user_id},
                    roadmap_doc,
                    upsert=True,
                )
                logger.info(f"[PlatformBridges] Saved roadmap {roadmap_id} for user {user_id} in Atlas.")
            except Exception as e:
                logger.warning(f"[PlatformBridges] DB error saving roadmap: {e}")

        # In-memory backup in report_engine
        report_engine._in_memory_reports[f"roadmap-{user_id}"] = {
            "roadmap": roadmap.model_dump(),
            "user_id": user_id,
        }

        return roadmap


platform_bridges_service = PlatformBridgesService()
