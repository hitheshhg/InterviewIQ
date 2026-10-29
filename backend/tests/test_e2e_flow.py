import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.dependencies import get_current_user

MOCK_CANDIDATE = {
    "uid": "shreya_vtu_e2e_candidate",
    "email": "shreya.majorproject@vtu.ac.in",
    "name": "Shreya VTU B.E.",
    "firebase_uid": "shreya_vtu_e2e_candidate",
}

SAMPLE_RESUME = """
Shreya - Final Year B.E. Computer Science
Email: shreya@vtu.ac.in | Phone: +91 9876543210 | GitHub: github.com/shreya-vtu | LinkedIn: linkedin.com/in/shreya-vtu

SUMMARY
Dedicated Full Stack Software Engineer experienced in building scalable web platforms with Python, FastAPI, React, TypeScript, and MongoDB.

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, SQL
Frameworks & Tools: FastAPI, React.js, Tailwind CSS, Node.js, WebSockets, Git, Docker
Databases & Cloud: MongoDB Atlas, Redis, AWS

WORK EXPERIENCE
Full Stack Engineering Intern | CloudTech Solutions (2023 - 2024)
• Built high-throughput asynchronous backend microservices using FastAPI and Motor, handling over 5,000 requests per minute with 99.9% uptime.
• Reduced database query latency by 45% through Redis caching and optimized compound B-tree indexing in MongoDB Atlas.
• Developed responsive user interfaces with React, TypeScript, and Tailwind CSS, increasing user session duration by 35%.

PROJECTS
InterviewIQ - AI Mock Interview & Resume Analysis Platform
• Developed real-time Voice AI interview platform with Web Speech API audio processing and Google Gemini structured evaluation.
• Implemented deterministic mathematical ATS rule engine analyzing keyword density, action verbs, and quantified metric achievements.
• Engineered 5-dimension radar chart visualization with Recharts and automated milestone career roadmaps.

EDUCATION
Bachelor of Engineering in Computer Science & Engineering (2020 - 2024)
Visvesvaraya Technological University (VTU) | CGPA: 9.1/10
"""

SAMPLE_JD = """
Full Stack Software Engineer
Requirements:
- Strong experience in Python, FastAPI, React, and TypeScript.
- Hands-on expertise with MongoDB Atlas and Redis caching.
- Familiarity with asynchronous programming, WebSockets, and CI/CD pipelines.
"""


@pytest.mark.asyncio
async def test_complete_platform_e2e_journey():
    """
    End-to-End integration test validating the entire InterviewIQ candidate pipeline:
    1. Resume Parsing & ATS Analysis
    2. Mock Interview Session Initialization
    3. Multi-Turn Response Evaluation & Adaptive Progression
    4. Session Finalization
    5. Comprehensive 5-Dimension Performance Report & Personalized Roadmap
    6. Candidate Dashboard Metrics Compilation
    """
    app.dependency_overrides[get_current_user] = lambda: MOCK_CANDIDATE
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:

            # -------------------------------------------------------------
            # STEP 1: ATS Resume Analysis
            # -------------------------------------------------------------
            ats_res = await client.post(
                "/api/v1/resume/analyze-text",
                data={
                    "resume_text": SAMPLE_RESUME,
                    "job_description": SAMPLE_JD,
                    "target_role": "Full Stack Developer",
                }
            )
            assert ats_res.status_code == 200, f"ATS analysis failed: {ats_res.text}"
            ats_data = ats_res.json()
            assert ats_data["overall_score"] >= 70
            assert "breakdown" in ats_data
            assert len(ats_data["matched_keywords"]) > 0
            assert len(ats_data["actionable_tips"]) > 0

            # -------------------------------------------------------------
            # STEP 2: Mock Interview Initiation
            # -------------------------------------------------------------
            start_res = await client.post(
                "/api/v1/interview/start",
                json={
                    "target_role": "Full Stack Developer",
                    "total_questions": 3,
                    "initial_difficulty": "medium",
                    "resume_text": SAMPLE_RESUME
                }
            )
            assert start_res.status_code == 200, f"Interview start failed: {start_res.text}"
            start_data = start_res.json()
            session_id = start_data["session_id"]
            assert start_data["current_question_index"] == 1
            assert start_data["total_questions"] == 3
            assert start_data["first_question"]["question_text"] is not None

            # -------------------------------------------------------------
            # STEP 3: Turn 1 Submission (Project Deep Dive)
            # -------------------------------------------------------------
            ans1_res = await client.post(
                f"/api/v1/interview/{session_id}/answer",
                json={
                    "answer_text": "In InterviewIQ, I designed the distributed backend using FastAPI and Motor async MongoDB with compound indexes for sub-50ms queries.",
                    "duration_seconds": 35
                }
            )
            assert ans1_res.status_code == 200
            ans1_data = ans1_res.json()
            assert ans1_data["is_complete"] is False
            assert ans1_data["evaluation"]["scores"]["relevance"] >= 1
            assert ans1_data["next_question"]["question_index"] == 2

            # -------------------------------------------------------------
            # STEP 4: Turn 2 Submission (Core Technical)
            # -------------------------------------------------------------
            ans2_res = await client.post(
                f"/api/v1/interview/{session_id}/answer",
                json={
                    "answer_text": "In FastAPI, async def endpoints yield execution back to the event loop on I/O bounds, while CPU-bound tasks are offloaded to worker threads.",
                    "duration_seconds": 40
                }
            )
            assert ans2_res.status_code == 200
            ans2_data = ans2_res.json()
            assert ans2_data["is_complete"] is False
            assert ans2_data["next_question"]["question_index"] == 3

            # -------------------------------------------------------------
            # STEP 5: Turn 3 Submission (Final Turn - System Design)
            # -------------------------------------------------------------
            ans3_res = await client.post(
                f"/api/v1/interview/{session_id}/answer",
                json={
                    "answer_text": "To build a rate limiter handling millions of requests, I use Redis with the Token Bucket algorithm and Lua scripts for atomic increments.",
                    "duration_seconds": 45
                }
            )
            assert ans3_res.status_code == 200
            ans3_data = ans3_res.json()
            assert ans3_data["is_complete"] is True
            assert ans3_data["next_question"] is None

            # -------------------------------------------------------------
            # STEP 6: Finalize Session
            # -------------------------------------------------------------
            end_res = await client.post(f"/api/v1/interview/{session_id}/end")
            assert end_res.status_code == 200
            end_data = end_res.json()
            assert end_data["status"] == "completed"
            assert end_data["completed_turns"] == 3
            assert end_data["overall_average_score"] > 0

            # -------------------------------------------------------------
            # STEP 7: Comprehensive 5-Dimension Performance Report
            # -------------------------------------------------------------
            rep_res = await client.post(f"/api/v1/report/generate/{session_id}")
            assert rep_res.status_code == 200
            rep_data = rep_res.json()
            assert rep_data["session_id"] == session_id
            assert rep_data["overall_score"] > 0
            assert len(rep_data["dimension_scores"]) == 5
            assert rep_data["verdict"] in ["Strong Hire", "Hire", "Leaning Hire", "Needs Revision"]
            assert len(rep_data["questions_breakdown"]) == 3

            # -------------------------------------------------------------
            # STEP 8: Personalized Career Roadmap
            # -------------------------------------------------------------
            road_res = await client.get("/api/v1/roadmap/user/latest")
            assert road_res.status_code == 200
            road_data = road_res.json()
            assert len(road_data["milestones"]) >= 3
            assert road_data["estimated_total_weeks"] > 0
            assert "actionable_tasks" in road_data["milestones"][0]

            # -------------------------------------------------------------
            # STEP 9: Candidate Dashboard Overview Metrics
            # -------------------------------------------------------------
            dash_res = await client.get("/api/v1/dashboard/metrics")
            assert dash_res.status_code == 200
            dash_data = dash_res.json()
            assert dash_data["user_id"] == MOCK_CANDIDATE["uid"]
            assert dash_data["total_interviews_completed"] >= 1
            assert dash_data["average_interview_score"] > 0
            assert len(dash_data["dimension_averages"]) == 5

    finally:
        app.dependency_overrides.pop(get_current_user, None)
