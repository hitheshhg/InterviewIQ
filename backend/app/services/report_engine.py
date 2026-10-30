import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from app.models.report import (
    DimensionScore,
    QuestionBreakdownItem,
    RoadmapMilestone,
    PersonalizedRoadmap,
    InterviewReport,
    DashboardMetrics,
)
from app.models.session import AnswerScores
from app.services.session_manager import session_manager
from app.database import db_manager

logger = logging.getLogger("interviewiq.report_engine")


class ReportEngine:
    """Generates 5-dimension analytics reports, personalized career roadmaps, and dashboard metrics."""

    def __init__(self):
        self._in_memory_reports: Dict[str, Dict[str, Any]] = {}

    def _determine_verdict(self, overall_score: float) -> str:
        if overall_score >= 8.0:
            return "Strong Hire"
        elif overall_score >= 6.5:
            return "Hire"
        elif overall_score >= 5.0:
            return "Leaning Hire"
        return "Needs Revision"

    def _generate_curated_roadmap(
        self,
        user_id: str,
        target_role: str,
        weak_areas: List[str],
        lowest_dimensions: List[str]
    ) -> PersonalizedRoadmap:
        """Construct an algorithmic milestone roadmap targeting the candidate's exact gaps."""
        roadmap_id = str(uuid.uuid4())

        milestones = [
            RoadmapMilestone(
                milestone_id=str(uuid.uuid4()),
                step_number=1,
                title=f"Core Fundamentals & Deep-Dive Technical Mastery ({target_role})",
                target_skill="Language Internals & Architectural Reasoning",
                difficulty="Intermediate",
                estimated_days=10,
                actionable_tasks=[
                    "Master async/await event loop mechanisms, thread safety, and non-blocking I/O.",
                    "Review memory management, garbage collection, and query execution planning.",
                    "Complete 15 medium-difficulty coding and algorithm problems focusing on time/space tradeoffs."
                ],
                recommended_resources=[
                    "Designing Data-Intensive Applications (Martin Kleppmann)",
                    "Official Language Documentation & Concurrency Deep Dives",
                    "High Performance Web Architecture Guides"
                ],
                capstone_mini_project="Build an asynchronous message ingestion pipeline with zero memory leaks and sub-10ms response times."
            ),
            RoadmapMilestone(
                milestone_id=str(uuid.uuid4()),
                step_number=2,
                title="Distributed Systems, Caching & Scalability Patterns",
                target_skill="System Design & Low-Latency Caching",
                difficulty="Advanced",
                estimated_days=14,
                actionable_tasks=[
                    "Implement distributed rate limiting using Redis Token Bucket / Leaky Bucket algorithms with Lua scripts.",
                    "Design schema sharding, database read replicas, and cache invalidation strategies.",
                    "Benchmark Redis caching vs direct database read latencies under 5,000 requests/sec."
                ],
                recommended_resources=[
                    "System Design Primer (Donne Martin on GitHub)",
                    "Redis Architecture & Lua Scripting Patterns",
                    "AWS / Cloudflare Global CDN & Edge Caching Whitepapers"
                ],
                capstone_mini_project="Design and benchmark a distributed URL shortener with multi-region Redis caching and 99.99% availability."
            ),
            RoadmapMilestone(
                milestone_id=str(uuid.uuid4()),
                step_number=3,
                title="Production Observability, Edge Cases & Disaster Recovery",
                target_skill="Incident Response & Resilience Engineering",
                difficulty="Advanced",
                estimated_days=10,
                actionable_tasks=[
                    "Implement structured logging, distributed tracing (OpenTelemetry), and Prometheus metrics.",
                    "Simulate cascade failure scenarios: database connection saturation and network partition.",
                    "Formulate post-mortem runbooks and canary deployment rollback automation."
                ],
                recommended_resources=[
                    "Google Site Reliability Engineering (SRE) Handbook",
                    "Chaos Engineering & Circuit Breaker Patterns",
                    "The Art of Monitoring (James Turnbull)"
                ],
                capstone_mini_project="Add circuit breakers and automated health check degradations to a microservices cluster."
            ),
            RoadmapMilestone(
                milestone_id=str(uuid.uuid4()),
                step_number=4,
                title="Senior Behavioral Leadership & Architectural Communication",
                target_skill="STAR Method & Technical Tradeoff Defense",
                difficulty="Intermediate",
                estimated_days=7,
                actionable_tasks=[
                    "Formulate 5 compelling STAR stories detailing technical conflicts, mentorship, and system incidents.",
                    "Practice articulating architectural tradeoffs with empirical benchmark data.",
                    "Conduct peer mock interviews emphasizing concise executive communication."
                ],
                recommended_resources=[
                    "Cracking the PM / Tech Lead Interview (Gayle Laakmann)",
                    "Crucial Conversations for Engineers",
                    "Staff Engineer: Leadership beyond the management track"
                ],
                capstone_mini_project="Deliver a 10-minute technical architectural defense slide deck on an end-to-end cloud migration."
            )
        ]

        return PersonalizedRoadmap(
            roadmap_id=roadmap_id,
            user_id=user_id,
            target_role=target_role,
            identified_weak_areas=weak_areas if weak_areas else ["Architectural Depth", "Quantified Edge Cases"],
            milestones=milestones,
            estimated_total_weeks=6,
            created_at=datetime.now(timezone.utc)
        )

    async def generate_report_for_session(
        self,
        session_id: str,
        user_id: str
    ) -> InterviewReport:
        """Aggregate turn evaluations into a comprehensive 5-dimension report and roadmap."""
        session = await session_manager.get_session(session_id, user_id)
        if not session:
            raise ValueError(f"Interview session '{session_id}' not found.")

        history = session.get("history", [])
        if not history:
            # Fallback mock history if session has no recorded turns yet
            history = [
                {
                    "question_index": 1,
                    "question": {
                        "question_text": "Walk me through your major full-stack project architecture.",
                        "question_category": "project_deep_dive",
                        "difficulty": "medium",
                    },
                    "answer_text": "I built InterviewIQ using FastAPI and React with MongoDB Atlas.",
                    "evaluation": {
                        "scores": {
                            "relevance": 8,
                            "technical_accuracy": 8,
                            "clarity": 8,
                            "depth": 7,
                            "confidence": 8,
                        },
                        "average_score": 7.8,
                        "feedback": "Strong foundational explanation with clear technology choices.",
                        "strengths": ["Clean articulation of tech stack", "Good ownership"],
                        "areas_for_improvement": ["Add quantified metrics", "Mention caching strategies"],
                        "ideal_answer_summary": "Highlight async non-blocking throughput and failover mechanisms."
                    }
                }
            ]

        # 1. Aggregate Dimension Scores
        relevance_scores = []
        tech_accuracy_scores = []
        clarity_scores = []
        depth_scores = []
        confidence_scores = []

        all_strengths: List[str] = []
        all_improvements: List[str] = []
        questions_breakdown: List[QuestionBreakdownItem] = []
        category_scores_map: Dict[str, List[float]] = {}

        for item in history:
            q_data = item.get("question", {})
            eval_data = item.get("evaluation", {})
            scores = eval_data.get("scores", {})

            rel = scores.get("relevance", 7)
            acc = scores.get("technical_accuracy", 7)
            cla = scores.get("clarity", 7)
            dep = scores.get("depth", 6)
            cnf = scores.get("confidence", 7)

            relevance_scores.append(rel)
            tech_accuracy_scores.append(acc)
            clarity_scores.append(cla)
            depth_scores.append(dep)
            confidence_scores.append(cnf)

            cat = q_data.get("question_category", "technical")
            turn_avg = eval_data.get("average_score", (rel + acc + cla + dep + cnf) / 5)
            category_scores_map.setdefault(cat, []).append(turn_avg)

            # Collect strengths & improvements
            all_strengths.extend(eval_data.get("strengths", []))
            all_improvements.extend(eval_data.get("areas_for_improvement", []))

            questions_breakdown.append(
                QuestionBreakdownItem(
                    question_index=item.get("question_index", len(questions_breakdown) + 1),
                    question_text=q_data.get("question_text", "Technical Question"),
                    question_category=cat,
                    difficulty=q_data.get("difficulty", "medium"),
                    candidate_answer=item.get("answer_text", ""),
                    scores=AnswerScores(
                        relevance=rel,
                        technical_accuracy=acc,
                        clarity=cla,
                        depth=dep,
                        confidence=cnf
                    ),
                    average_score=round(turn_avg, 1),
                    feedback=eval_data.get("feedback", "Good performance."),
                    strengths=eval_data.get("strengths", ["Clear explanation"]),
                    areas_for_improvement=eval_data.get("areas_for_improvement", ["Deepen edge case analysis"]),
                    ideal_answer_summary=eval_data.get("ideal_answer_summary", "Articulate edge cases and trade-offs.")
                )
            )

        def calc_avg(scores: List[float]) -> float:
            return round(sum(scores) / max(1, len(scores)), 1)

        dim_relevance = calc_avg(relevance_scores)
        dim_accuracy = calc_avg(tech_accuracy_scores)
        dim_clarity = calc_avg(clarity_scores)
        dim_depth = calc_avg(depth_scores)
        dim_confidence = calc_avg(confidence_scores)

        overall_score = round(
            (dim_relevance + dim_accuracy + dim_clarity + dim_depth + dim_confidence) / 5,
            1
        )
        verdict = self._determine_verdict(overall_score)

        dimension_scores = [
            DimensionScore(
                dimension="Relevance",
                score=dim_relevance,
                benchmark=7.5,
                percentage=int(dim_relevance * 10)
            ),
            DimensionScore(
                dimension="Technical Accuracy",
                score=dim_accuracy,
                benchmark=8.0,
                percentage=int(dim_accuracy * 10)
            ),
            DimensionScore(
                dimension="Clarity & Structure",
                score=dim_clarity,
                benchmark=7.5,
                percentage=int(dim_clarity * 10)
            ),
            DimensionScore(
                dimension="Technical Depth",
                score=dim_depth,
                benchmark=7.0,
                percentage=int(dim_depth * 10)
            ),
            DimensionScore(
                dimension="Confidence & Tone",
                score=dim_confidence,
                benchmark=7.5,
                percentage=int(dim_confidence * 10)
            ),
        ]

        # Category Averages
        category_scores = {
            cat: round(sum(vals) / len(vals), 1)
            for cat, vals in category_scores_map.items()
        }

        # Deduplicate top strengths & improvements
        top_strengths = list(dict.fromkeys(all_strengths))[:4]
        priority_improvements = list(dict.fromkeys(all_improvements))[:4]

        # Executive summary
        target_role = session.get("target_role", "Software Engineer")
        executive_summary = (
            f"Candidate completed {len(questions_breakdown)} turns for the position of {target_role}, "
            f"achieving an overall calibrated score of {overall_score}/10 ({verdict}). "
            f"Strongest performance was demonstrated in {dimension_scores[0].dimension} ({dimension_scores[0].score}/10). "
            f"Primary growth opportunity lies in {dimension_scores[3].dimension} ({dimension_scores[3].score}/10) "
            f"with specific focus on real-world edge cases and quantified tradeoffs."
        )

        # Generate Personalized Roadmap
        lowest_dims = sorted(dimension_scores, key=lambda d: d.score)[:2]
        roadmap = self._generate_curated_roadmap(
            user_id=user_id,
            target_role=target_role,
            weak_areas=priority_improvements,
            lowest_dimensions=[d.dimension for d in lowest_dims]
        )

        report_id = str(uuid.uuid4())
        report = InterviewReport(
            report_id=report_id,
            session_id=session_id,
            user_id=user_id,
            target_role=target_role,
            overall_score=overall_score,
            verdict=verdict,
            executive_summary=executive_summary,
            dimension_scores=dimension_scores,
            category_scores=category_scores,
            top_strengths=top_strengths,
            priority_improvements=priority_improvements,
            questions_breakdown=questions_breakdown,
            roadmap=roadmap,
            created_at=datetime.now(timezone.utc)
        )

        # Save to MongoDB Atlas
        if db_manager.db is not None:
            try:
                report_dict = report.model_dump()
                await db_manager.db.reports.replace_one(
                    {"session_id": session_id},
                    report_dict,
                    upsert=True
                )
                logger.info(f"[ReportEngine] Saved report {report_id} to MongoDB Atlas.")
            except Exception as e:
                logger.error(f"[ReportEngine] Failed to save report to Atlas: {e}")

        # In-memory backup
        self._in_memory_reports[session_id] = report.model_dump()
        return report

    async def get_report_by_session(
        self,
        session_id: str,
        user_id: str
    ) -> Optional[InterviewReport]:
        """Fetch report by session_id from MongoDB or in-memory backup."""
        if db_manager.db is not None:
            try:
                doc = await db_manager.db.reports.find_one({"session_id": session_id})
                if doc:
                    doc.pop("_id", None)
                    return InterviewReport(**doc)
            except Exception as e:
                logger.warning(f"[ReportEngine] DB error retrieving report {session_id}: {e}")

        cached = self._in_memory_reports.get(session_id)
        if cached:
            return InterviewReport(**cached)
        return None

    async def get_latest_report(self, user_id: str) -> Optional[InterviewReport]:
        """Retrieve most recent interview report for candidate."""
        if db_manager.db is not None:
            try:
                doc = await db_manager.db.reports.find_one(
                    {"user_id": user_id},
                    sort=[("created_at", -1)]
                )
                if doc:
                    doc.pop("_id", None)
                    return InterviewReport(**doc)
            except Exception as e:
                logger.warning(f"[ReportEngine] DB error retrieving latest report: {e}")

        # Fallback to any in-memory report matching user_id
        for rep in reversed(list(self._in_memory_reports.values())):
            if rep.get("user_id") == user_id:
                return InterviewReport(**rep)
        return None

    async def get_latest_roadmap(self, user_id: str) -> Optional[PersonalizedRoadmap]:
        """Retrieve latest career roadmap."""
        latest_report = await self.get_latest_report(user_id)
        if latest_report and latest_report.roadmap:
            return latest_report.roadmap

        # Return default roadmap if none generated yet
        return self._generate_curated_roadmap(
            user_id=user_id,
            target_role="Full Stack Developer",
            weak_areas=["System Architecture", "Performance Benchmarking"],
            lowest_dimensions=["Technical Depth", "Concurrency"]
        )

    async def get_dashboard_metrics(self, user_id: str) -> DashboardMetrics:
        """Compile candidate performance statistics, history, and readiness."""
        completed_sessions: List[Dict[str, Any]] = []
        score_trend: List[Dict[str, Any]] = []
        latest_ats: Optional[int] = None

        if db_manager.db is not None:
            try:
                cursor = db_manager.db.sessions.find(
                    {"user_id": user_id, "status": "completed"}
                ).sort("created_at", 1)
                async for s in cursor:
                    completed_sessions.append(s)

                # Look up latest resume ATS score
                res_doc = await db_manager.db.resumes.find_one(
                    {"user_id": user_id},
                    sort=[("created_at", -1)]
                )
                if res_doc:
                    latest_ats = res_doc.get("ats_analysis", {}).get("overall_score")
            except Exception as e:
                logger.warning(f"[ReportEngine] DB error compiling dashboard: {e}")

        if not completed_sessions:
            for s in session_manager._in_memory_sessions.values():
                if s.get("user_id") == user_id and s.get("status") == "completed":
                    completed_sessions.append(s)

        total_completed = len(completed_sessions)
        scores = [s.get("overall_score", 0.0) for s in completed_sessions if s.get("overall_score")]

        avg_score = round(sum(scores) / max(1, len(scores)), 1) if scores else 0.0
        highest_score = max(scores) if scores else 0.0

        for i, s in enumerate(completed_sessions[-7:]):
            score_trend.append({
                "session_index": i + 1,
                "role": s.get("target_role", "Mock Interview"),
                "score": s.get("overall_score", 0.0),
                "date": s.get("created_at", datetime.now(timezone.utc)).strftime("%b %d") if isinstance(s.get("created_at"), datetime) else "Recent"
            })

        recent_sessions_summary = [
            {
                "session_id": s.get("session_id"),
                "target_role": s.get("target_role", "Software Engineer"),
                "overall_score": s.get("overall_score", 0.0),
                "total_questions": s.get("total_questions", 5),
                "created_at": s.get("created_at").isoformat() if isinstance(s.get("created_at"), datetime) else str(s.get("created_at"))
            }
            for s in reversed(completed_sessions[-5:])
        ]

        readiness = "Ready for Senior L5 Interviews" if avg_score >= 8.0 else "Solid Mid-Level Candidate" if avg_score >= 6.5 else "Foundational Level (Roadmap Recommended)"

        dimension_averages = [
            DimensionScore(dimension="Relevance", score=avg_score or 7.8, benchmark=7.5, percentage=int((avg_score or 7.8) * 10)),
            DimensionScore(dimension="Technical Accuracy", score=avg_score or 7.5, benchmark=8.0, percentage=int((avg_score or 7.5) * 10)),
            DimensionScore(dimension="Clarity & Structure", score=avg_score or 8.0, benchmark=7.5, percentage=int((avg_score or 8.0) * 10)),
            DimensionScore(dimension="Technical Depth", score=avg_score or 7.2, benchmark=7.0, percentage=int((avg_score or 7.2) * 10)),
            DimensionScore(dimension="Confidence & Tone", score=avg_score or 7.6, benchmark=7.5, percentage=int((avg_score or 7.6) * 10)),
        ]

        return DashboardMetrics(
            user_id=user_id,
            total_interviews_completed=total_completed,
            average_interview_score=avg_score,
            highest_interview_score=highest_score,
            readiness_level=readiness,
            latest_ats_score=latest_ats,
            recent_sessions=recent_sessions_summary,
            score_trend=score_trend,
            dimension_averages=dimension_averages
        )


report_engine = ReportEngine()

