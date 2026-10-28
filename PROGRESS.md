# Project Progress Tracker - InterviewIQ

**Candidate:** Shreya  
**Target:** VTU Major Project (B.E. Computer Science)  
**Design Theme:** Aurora Glassmorphism  
**Frontend Language:** TypeScript  

---

## Phase Status Summary

| Phase | Description | Status | Verification / Notes |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Discovery & Plan | ✅ COMPLETED | Monorepo structure, DB schemas, API specs, reference repo analysis approved. |
| **Phase 1** | Environment & Skeleton | ✅ COMPLETED | FastAPI backend operational with `/health`, Vite + React + TS with Aurora theme, automated tests passing. |
| **Phase 2** | MongoDB Atlas Setup | ✅ COMPLETED | Motor async client, automated indexes on all 5 collections, live `/health` ping verified (latency ~109ms). |
| **Phase 3** | Firebase Authentication | ✅ COMPLETED | Google OAuth + Email/Password, Firebase Admin backend token verification middleware, Atlas user sync, 7/7 tests passing. |
| **Phase 4** | Design System & Landing Page | ✅ COMPLETED | Aurora Glassmorphism components (`Button`, `Card`, `Badge`, `Input`, `ScoreGauge`), responsive Navbar/Footer, and high-impact Landing Page with tagline. |
| **Phase 5** | Gemini Setup | ✅ COMPLETED | Official `google-genai` client, strict Pydantic JSON mode, retry with exponential backoff & model fallback chain, 9/9 tests passing. |
| **Phase 6** | Resume Upload & ATS Engine | ✅ COMPLETED | PDF/DOCX extractor, deterministic ATS engine, skill-gap matrix, ResumeAnalyzerPage, 15/15 tests passing. |
| **Phase 7** | Interview Engine (Text Mode) | ✅ COMPLETED | Multi-turn state machine, adaptive difficulty (easy/med/hard), 5-parameter rubric evaluation, 1-turn combined AI response, REST + WS endpoints, InterviewRoomPage, 20/20 tests passing. |
| **Phase 8** | Voice & Real-time Experience | 🔄 READY TO START | Web Speech API, SpeechSynthesis, live audio waveform visualizer, AI orb. |
| **Phase 9** | Report, Roadmap, Dashboard | ⏳ PENDING | Radar chart, PDF download, milestone career roadmap, session history. |
| **Phase 10** | Hardening & Testing | ⏳ PENDING | Input validation, rate limiting, error boundaries, test suite. |
| **Phase 11** | Deployment | ⏳ PENDING | Vercel (frontend) + Render (backend) deployment guide. |
| **Phase 12** | Documentation & Viva Prep | ⏳ PENDING | 25 Viva questions with answers, 5-minute demo script, architecture guide. |

---

## Environment Variables Needed Across Phases

### Backend (`backend/.env`)
- `PORT`: `8000`
- `ENVIRONMENT`: `development`
- `CORS_ORIGINS`: `http://localhost:5173`
- `MONGODB_URI`: (Added in Phase 2)
- `FIREBASE_CREDENTIALS_PATH`: (Added in Phase 3)
- `GEMINI_API_KEY`: (Added in Phase 5)
- `GEMINI_MODEL`: (Added in Phase 5)
- `GEMINI_FALLBACK_MODEL`: (Added in Phase 5)

### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL`: `http://localhost:8000`
- `VITE_WS_BASE_URL`: `ws://localhost:8000`
- Firebase Web Config (Added in Phase 3)
