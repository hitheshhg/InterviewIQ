import os
import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from app.models.session import (
    QuestionItem,
    AnswerScores,
    AnswerEvaluation,
    TurnHistoryItem,
    CombinedTurnResponse,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    SessionSummary,
)
from app.services.gemini_client import GeminiClient
from app.database import db_manager

logger = logging.getLogger("interviewiq.session_manager")

# Path to prompts directory
PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")


def load_prompt_template(filename: str) -> str:
    path = os.path.join(PROMPTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


ROLE_FALLBACK_QUESTIONS: Dict[str, List[Dict[str, Any]]] = {
    "default": [
        {
            "category": "project_deep_dive",
            "text": "Walk me through the most technically challenging project you have built. What was the architecture, and what was your specific technical contribution?",
            "context_note": "Foundational icebreaker evaluating architectural reasoning and ownership.",
            "hint": "Explain system architecture, technical choices, difficulties overcome, and quantified impact."
        },
        {
            "category": "technical",
            "text": "How do you handle asynchronous operations and state management in your applications? What are the key pitfalls to avoid?",
            "context_note": "Probing concurrency, thread safety, and event-driven patterns.",
            "hint": "Discuss async/await, event loops, promises/futures, race conditions, and deadlocks."
        },
        {
            "category": "system_design",
            "text": "Design a high-throughput rate limiter for an API with millions of daily requests. What data structures and caching strategies would you use?",
            "context_note": "Evaluates distributed systems, Redis Token Bucket / Leaky Bucket algorithms, and horizontal scaling.",
            "hint": "Token bucket algorithm, Redis, sliding window log, handling network latency and failover."
        },
        {
            "category": "technical",
            "text": "Explain database indexing strategies. When would a composite B-tree index hurt query performance rather than help it?",
            "context_note": "Evaluating database internals, write amplification, and query planner optimization.",
            "hint": "B-Tree structure, column cardinality, write latency overhead, table scan vs index scan."
        },
        {
            "category": "behavioral",
            "text": "Tell me about a time when you strongly disagreed with a teammate's architectural or code decision. How did you resolve the conflict constructively?",
            "context_note": "STAR format behavioral evaluation: Situation, Task, Action, Result.",
            "hint": "Focus on data-driven benchmarking, objective trade-off evaluation, and team consensus."
        },
        {
            "category": "situational",
            "text": "Suppose a critical production service starts throwing 500 errors right after a deployment, but rollback fails. What are your immediate troubleshooting steps?",
            "context_note": "Assessing incident response, logging, metrics, and post-mortem mindset.",
            "hint": "Check logs/APM, isolate traffic, feature flags, hotfix pipeline, communication with stakeholders."
        }
    ]
}


class InterviewSessionManager:
    """Manages interview lifecycle, turn evaluation, adaptive difficulty, and persistence."""

    def __init__(self):
        self.gemini = GeminiClient()
        # In-memory session store fallback for isolated tests or disconnected DB
        self._in_memory_sessions: Dict[str, Dict[str, Any]] = {}
        self._in_memory_answers: Dict[str, List[Dict[str, Any]]] = {}

    def _determine_category_for_index(self, index: int, total: int) -> str:
        """Adaptive category sequence tailored to interview progression."""
        if index == 1:
            return "project_deep_dive"
        elif index == 2:
            return "technical"
        elif index == 3:
            return "system_design"
        elif index == 4:
            return "technical"
        elif index == total - 1:
            return "behavioral"
        elif index == total:
            return "situational"
        else:
            return "technical"

    def _calculate_next_difficulty(
        self,
        current_difficulty: str,
        scores_history: List[float]
    ) -> str:
        """
        Adaptive difficulty adjustment:
        - Recent average >= 7.5: raise difficulty
        - Recent average <= 4.5: lower difficulty
        - Otherwise maintain
        """
        if not scores_history:
            return current_difficulty

        recent_window = scores_history[-2:] if len(scores_history) >= 2 else scores_history
        avg = sum(recent_window) / len(recent_window)

        levels = ["easy", "medium", "hard"]
        curr_idx = levels.index(current_difficulty) if current_difficulty in levels else 1

        if avg >= 7.5 and curr_idx < 2:
            return levels[curr_idx + 1]
        elif avg <= 4.5 and curr_idx > 0:
            return levels[curr_idx - 1]
        return current_difficulty

    async def _fetch_resume_text(self, resume_id: Optional[str], user_id: str) -> str:
        """Look up resume context from MongoDB resumes collection."""
        if not resume_id:
            return ""

        if db_manager.db is not None:
            try:
                # Query by resume_id or _id
                doc = await db_manager.db.resumes.find_one({"resume_id": resume_id})
                if not doc:
                    try:
                        doc = await db_manager.db.resumes.find_one({"_id": ObjectId(resume_id)})
                    except Exception:
                        pass
                if doc:
                    skills = ", ".join(doc.get("skills", []))
                    projects = "; ".join([p.get("title", "") for p in doc.get("projects", [])])
                    return f"Skills: {skills}\nProjects: {projects}\nRaw Excerpt: {doc.get('raw_text', '')[:500]}"
            except Exception as e:
                logger.warning(f"[SessionManager] Failed to fetch resume {resume_id}: {e}")

        return ""

    async def start_session(
        self,
        user_id: str,
        request: StartInterviewRequest
    ) -> StartInterviewResponse:
        """Initialize session, generate Question 1, and persist to MongoDB."""
        session_id = str(uuid.uuid4())

        # 1. Resolve resume context
        resume_context = request.resume_text or ""
        if not resume_context and request.resume_id:
            resume_context = await self._fetch_resume_text(request.resume_id, user_id)

        if not resume_context:
            resume_context = f"Candidate interviewing for {request.target_role}. Relevant modern tech stack and projects."

        # Incorporate targeted resume/JD seeds if provided
        if request.question_seeds and len(request.question_seeds) > 0:
            seeds_formatted = "\n".join(f"- {s}" for s in request.question_seeds[:3])
            resume_context += (
                f"\n\nTargeted Candidate Improvement Seeds:\n{seeds_formatted}\n"
                "Priority Directive: Formulate Question 1 directly probing one of these weak resume claims, unsubstantiated skills, or missing job requirements."
            )

        # 2. Generate Question 1 via Gemini
        first_question: Optional[QuestionItem] = None
        try:
            start_template = load_prompt_template("interview_start.txt")
            prompt = start_template.format(
                target_role=request.target_role,
                resume_context=resume_context[:1800],
                job_description=(request.job_description or "General industry standards")[:1000],
                total_questions=request.total_questions,
                difficulty=request.initial_difficulty
            )

            q1_obj, model_used, latency = await self.gemini.generate_structured_json(
                prompt=prompt,
                response_model=QuestionItem,
                system_instruction="You are an elite technical interviewer conducting a structured mock interview."
            )
            # Ensure index and ID are canonical
            q1_obj.question_id = str(uuid.uuid4())
            q1_obj.question_index = 1
            q1_obj.difficulty = request.initial_difficulty
            first_question = q1_obj
            logger.info(f"[SessionManager] Generated Q1 via {model_used} in {latency}ms")
        except Exception as e:
            logger.warning(f"[SessionManager] Gemini Q1 generation failed ({e}), using curated role fallback.")
            if request.question_seeds and len(request.question_seeds) > 0:
                first_question = QuestionItem(
                    question_id=str(uuid.uuid4()),
                    question_index=1,
                    question_text=request.question_seeds[0],
                    question_category="project_deep_dive",
                    difficulty=request.initial_difficulty,
                    context_note="Targeted question probing candidate's weakest resume claim or missing requirement.",
                    sample_answer_hint="Provide concrete production details, system architecture choices, and quantifiable impact."
                )
            else:
                fallbacks = ROLE_FALLBACK_QUESTIONS.get("default", [])
                fb = fallbacks[0]
                first_question = QuestionItem(
                    question_id=str(uuid.uuid4()),
                    question_index=1,
                    question_text=fb["text"],
                    question_category=fb["category"],
                    difficulty=request.initial_difficulty,
                    context_note=fb["context_note"],
                    sample_answer_hint=fb["hint"]
                )

        # 3. Create Session Record
        session_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "target_role": request.target_role,
            "job_description": request.job_description,
            "resume_id": request.resume_id,
            "resume_context": resume_context[:2000],
            "question_seeds": request.question_seeds or [],
            "total_questions": request.total_questions,

            "current_question_index": 1,
            "current_difficulty": request.initial_difficulty,
            "status": "in_progress",
            "current_question": first_question.model_dump(),
            "history": [],
            "scores_history": [],
            "difficulty_progression": [request.initial_difficulty],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        # 4. Save to MongoDB
        if db_manager.db is not None:
            try:
                await db_manager.db.sessions.insert_one(session_doc)
            except Exception as e:
                logger.error(f"[SessionManager] Failed to insert session into DB: {e}")

        # In-memory backup
        self._in_memory_sessions[session_id] = session_doc
        self._in_memory_answers[session_id] = []

        return StartInterviewResponse(
            session_id=session_id,
            target_role=request.target_role,
            total_questions=request.total_questions,
            current_question_index=1,
            current_difficulty=request.initial_difficulty,
            first_question=first_question,
            status="in_progress"
        )

    async def get_session(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session record from MongoDB or in-memory backup strictly scoped to user_id."""
        if db_manager.db is not None:
            try:
                doc = await db_manager.db.sessions.find_one({"session_id": session_id, "user_id": user_id})
                if doc:
                    doc["_id"] = str(doc["_id"])
                    return doc
            except Exception as e:
                logger.warning(f"[SessionManager] DB error fetching session {session_id}: {e}")

        mem_session = self._in_memory_sessions.get(session_id)
        if mem_session and mem_session.get("user_id") == user_id:
            return mem_session
        return None

    async def process_answer(
        self,
        session_id: str,
        user_id: str,
        request: SubmitAnswerRequest
    ) -> SubmitAnswerResponse:
        """
        Evaluate candidate's answer and generate the next adaptive question in 1 turn.
        """
        session = await self.get_session(session_id, user_id)
        if not session:
            raise ValueError(f"Interview session '{session_id}' not found.")

        if session.get("status") == "completed":
            raise ValueError("This interview session has already been completed.")

        curr_index = session.get("current_question_index", 1)
        total_questions = session.get("total_questions", 6)
        curr_difficulty = session.get("current_difficulty", "medium")
        curr_question_data = session.get("current_question", {})
        scores_history: List[float] = session.get("scores_history", [])

        # Calculate next difficulty adaptively
        next_difficulty = self._calculate_next_difficulty(curr_difficulty, scores_history)
        next_index = curr_index + 1
        is_last_question = curr_index >= total_questions
        next_cat_suggestion = self._determine_category_for_index(next_index, total_questions)

        # Build turn prompt
        turn_template = load_prompt_template("interview_turn.txt")
        history_summary = "\n".join([
            f"Q{item.get('question_index')}: {item.get('question', {}).get('question_text', '')} | Score: {item.get('evaluation', {}).get('average_score', 0)}"
            for item in session.get("history", [])
        ]) or "No previous turns yet."

        prompt = turn_template.format(
            target_role=session.get("target_role", "Software Engineer"),
            job_description=session.get("job_description") or "Standard Industry Requirements",
            resume_context=session.get("resume_context", "")[:1000],
            current_index=curr_index,
            total_questions=total_questions,
            current_question_text=curr_question_data.get("question_text", ""),
            current_category=curr_question_data.get("question_category", "technical"),
            current_difficulty=curr_difficulty,
            candidate_answer=request.answer_text,
            history_summary=history_summary,
            next_index=next_index,
            target_difficulty=next_difficulty,
            next_category_suggestion=next_cat_suggestion
        )

        evaluation: Optional[AnswerEvaluation] = None
        next_question: Optional[QuestionItem] = None

        try:
            combined_resp, model_used, latency = await self.gemini.generate_structured_json(
                prompt=prompt,
                response_model=CombinedTurnResponse,
                system_instruction="You are an expert technical interviewer evaluating an answer and picking the next adaptive question."
            )
            evaluation = combined_resp.evaluation
            if not is_last_question and combined_resp.next_question:
                next_q = combined_resp.next_question
                next_q.question_id = str(uuid.uuid4())
                next_q.question_index = next_index
                next_q.difficulty = next_difficulty
                next_question = next_q
            logger.info(f"[SessionManager] Evaluated turn {curr_index} via {model_used} in {latency}ms (avg score: {evaluation.average_score})")
        except Exception as e:
            logger.warning(f"[SessionManager] Turn AI generation failed ({e}), using rule-based evaluation.")
            # Fallback evaluation based on length and structure
            words = len(request.answer_text.strip().split())
            score_base = min(9, max(4, 4 + (words // 25)))
            scores = AnswerScores(
                relevance=score_base,
                technical_accuracy=score_base,
                clarity=min(10, score_base + 1),
                depth=max(1, score_base - 1),
                confidence=score_base
            )
            evaluation = AnswerEvaluation(
                scores=scores,
                average_score=float(score_base),
                feedback="Response demonstrated foundational familiarity with the topic, addressing key aspects directly.",
                strengths=["Clear articulation of core concepts", "Direct addressing of the primary scenario"],
                areas_for_improvement=["Elaborate deeper on real-world edge cases", "Include quantified metrics or benchmarking"],
                ideal_answer_summary="A top answer articulates architectural tradeoffs, concrete benchmarks, and disaster recovery edge cases."
            )

            if not is_last_question:
                fallbacks = ROLE_FALLBACK_QUESTIONS.get("default", [])
                fb_idx = min(next_index - 1, len(fallbacks) - 1)
                fb = fallbacks[fb_idx]
                next_question = QuestionItem(
                    question_id=str(uuid.uuid4()),
                    question_index=next_index,
                    question_text=fb["text"],
                    question_category=fb["category"],
                    difficulty=next_difficulty,
                    context_note=fb["context_note"],
                    sample_answer_hint=fb["hint"]
                )

        # 4. Save Turn to Answers collection
        answer_record = {
            "session_id": session_id,
            "question_index": curr_index,
            "question": curr_question_data,
            "answer_text": request.answer_text,
            "duration_seconds": request.duration_seconds or 0,
            "evaluation": evaluation.model_dump(),
            "created_at": datetime.now(timezone.utc)
        }

        if db_manager.db is not None:
            try:
                await db_manager.db.answers.insert_one(answer_record)
            except Exception as e:
                logger.error(f"[SessionManager] Failed to save answer: {e}")

        # Update in-memory answer record
        self._in_memory_answers.setdefault(session_id, []).append(answer_record)

        # 5. Update Session Document
        scores_history.append(evaluation.average_score)
        running_avg = round(sum(scores_history) / len(scores_history), 2)

        turn_history_item = {
            "question_index": curr_index,
            "question": curr_question_data,
            "answer_text": request.answer_text,
            "duration_seconds": request.duration_seconds or 0,
            "evaluation": evaluation.model_dump(),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        update_fields: Dict[str, Any] = {
            "updated_at": datetime.now(timezone.utc),
            "current_difficulty": next_difficulty if not is_last_question else curr_difficulty,
            "scores_history": scores_history,
        }

        if is_last_question:
            update_fields["status"] = "completed"
            update_fields["completed_at"] = datetime.now(timezone.utc)
            update_fields["overall_score"] = running_avg
        else:
            update_fields["current_question_index"] = next_index
            update_fields["current_question"] = next_question.model_dump() if next_question else None
            session.setdefault("difficulty_progression", []).append(next_difficulty)
            update_fields["difficulty_progression"] = session["difficulty_progression"]

        if db_manager.db is not None:
            try:
                await db_manager.db.sessions.update_one(
                    {"session_id": session_id},
                    {
                        "$set": update_fields,
                        "$push": {"history": turn_history_item}
                    }
                )
            except Exception as e:
                logger.error(f"[SessionManager] DB update error: {e}")

        # Sync in-memory backup
        if session_id in self._in_memory_sessions:
            mem_session = self._in_memory_sessions[session_id]
            mem_session.update(update_fields)
            mem_session.setdefault("history", []).append(turn_history_item)

        return SubmitAnswerResponse(
            session_id=session_id,
            question_index=curr_index,
            evaluation=evaluation,
            next_question=next_question,
            is_complete=is_last_question,
            current_difficulty=next_difficulty if not is_last_question else curr_difficulty,
            average_score_so_far=running_avg
        )

    async def end_session(self, session_id: str, user_id: str) -> SessionSummary:
        """Explicitly end the session and compute overall metrics."""
        session = await self.get_session(session_id, user_id)
        if not session:
            raise ValueError(f"Session '{session_id}' not found.")

        scores_history = session.get("scores_history", [])
        overall_avg = round(sum(scores_history) / max(1, len(scores_history)), 2)

        # Aggregate category scores
        category_totals: Dict[str, List[float]] = {}
        for h in session.get("history", []):
            cat = h.get("question", {}).get("question_category", "general")
            score = h.get("evaluation", {}).get("average_score", 0.0)
            category_totals.setdefault(cat, []).append(score)

        cat_averages = {
            cat: round(sum(scores) / len(scores), 2)
            for cat, scores in category_totals.items()
        }

        now = datetime.now(timezone.utc)
        update_data = {
            "status": "completed",
            "completed_at": now,
            "overall_score": overall_avg,
            "category_scores": cat_averages
        }

        if db_manager.db is not None:
            try:
                await db_manager.db.sessions.update_one(
                    {"session_id": session_id},
                    {"$set": update_data}
                )
            except Exception as e:
                logger.error(f"[SessionManager] DB update error on end_session: {e}")

        if session_id in self._in_memory_sessions:
            self._in_memory_sessions[session_id].update(update_data)

        started_at = session.get("created_at")
        if isinstance(started_at, str):
            try:
                started_at = datetime.fromisoformat(started_at)
            except Exception:
                started_at = now
        elif not isinstance(started_at, datetime):
            started_at = now

        return SessionSummary(
            session_id=session_id,
            user_id=user_id,
            target_role=session.get("target_role", "Software Engineer"),
            total_questions=session.get("total_questions", 6),
            completed_turns=len(session.get("history", [])),
            overall_average_score=overall_avg,
            difficulty_progression=session.get("difficulty_progression", ["medium"]),
            category_scores=cat_averages,
            status="completed",
            started_at=started_at,
            completed_at=now
        )


session_manager = InterviewSessionManager()
