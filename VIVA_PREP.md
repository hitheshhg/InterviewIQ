# InterviewIQ - VTU Viva Examination & Evaluation Handbook

**Candidate:** Shreya  
**Degree:** Bachelor of Engineering (B.E.) in Computer Science & Engineering  
**University:** Visvesvaraya Technological University (VTU), Belagavi  
**Project Title:** InterviewIQ – AI Interview Preparation & Resume Analysis Platform  
**Master Tagline:** *"Get grilled by AI. Get hired by humans."*  
**Core Technologies:** Python 3.12, FastAPI, React 18, TypeScript, Tailwind CSS, Google Gemini 2.5/1.5 Flash, MongoDB Atlas, Firebase Authentication, Web Speech API, Recharts, Docker.

---

# Part 1: 5-Minute High-Impact Live Demo Script

Follow this exact minute-by-minute script during the live evaluator demonstration.

```
+---------------------------------------------------------------------------------------+
| MINUTE 1: HOOK & ARCHITECTURAL OVERVIEW                                               |
| - Action: Start on the Landing Page (http://localhost:5173).                          |
| - Pitch: "Respected evaluators, modern engineering candidates struggle with two       |
|   critical hurdles: passing opaque ATS resume filters and succeeding in dynamic       |
|   technical interviews. We built InterviewIQ with the master tagline:                 |
|   'Get grilled by AI. Get hired by humans.'                                           |
| - Highlight: Point to the Aurora Glassmorphism UI, explaining the decoupled monorepo   |
|   architecture: FastAPI async backend on port 8000, React TypeScript frontend on      |
|   port 5173, MongoDB Atlas distributed cloud database, and Google Gemini LLM."        |
+---------------------------------------------------------------------------------------+
| MINUTE 2: HYBRID ATS RESUME SCANNER DEMO                                              |
| - Action: Click 'Scan Resume' or navigate to /analyzer.                               |
| - Action: Click 'Use Sample Full Stack Resume' (or upload resume.pdf).                |
| - Action: Click 'Analyze Resume Match'.                                               |
| - Explanation: "Our ATS Engine operates on a hybrid model. Rather than relying        |
|   solely on black-box LLMs, it first computes a deterministic mathematical score:     |
|   35% keyword coverage, 20% section completeness, 15% quantified metrics,             |
|   15% action verbs, and 15% contact formatting. It then layers Gemini semantic       |
|   intelligence to extract missing tools and prioritized action items."                |
| - Show: Circular ScoreGauge, section score breakdown, matched vs missing skill pills. |
+---------------------------------------------------------------------------------------+
| MINUTE 3: VOICE AI MOCK INTERVIEW ROOM                                                |
| - Action: Click 'Enter AI Interview Room' or navigate to /interview.                 |
| - Action: Select 'Full Stack Developer', 3 Questions, Medium difficulty.             |
| - Action: Click 'Enter AI Interview Room'.                                            |
| - Explanation: "Notice how the AI immediately formulates a resume-aware opening       |
|   question probing the candidate's actual projects. The living AI Orb dynamically     |
|   pulses in blue as SpeechSynthesis speaks the question aloud."                       |
| - Action: Click 'Fill Sample Answer for Viva Demo' (or toggle microphone and speak).  |
| - Explanation: "In Voice Mode, Web Speech API transcribes audio client-side with      |
|   zero external API costs, while the audio visualizer reflects sound frequency."      |
+---------------------------------------------------------------------------------------+
| MINUTE 4: ADAPTIVE DIFFICULTY & 5-DIMENSION RUBRIC                                    |
| - Action: Click 'Submit Answer'. AI Orb rotates in amber ('Evaluating Answer...').    |
| - Explanation: "To conserve API quotas and minimize turn latency, our backend         |
|   combines previous answer evaluation and next question generation into a single      |
|   Gemini structured JSON turn. Notice the 5-point rubric: Relevance, Technical        |
|   Accuracy, Clarity, Depth, and Confidence. Because the rolling score exceeded 7.5,   |
|   the state machine escalated difficulty from Medium to Hard."                        |
| - Action: Click 'Fill Sample Answer' on subsequent turns to complete all 3 questions. |
+---------------------------------------------------------------------------------------+
| MINUTE 5: REPORT, CAREER ROADMAP & DASHBOARD                                          |
| - Action: Completed interview automatically navigates to /report.                     |
| - Highlight 1: Point to the Recharts 5-Dimension Radar Chart comparing the candidate's|
|   scores directly against the Senior L5 Industry Benchmark polygon.                   |
| - Highlight 2: Click 'Print / Save PDF' to show institutional documentation support.  |
| - Action: Click 'View Career Roadmap' (/roadmap).                                     |
| - Highlight 3: "The AI detected that Technical Depth was the lowest score, so it      |
|   algorithmically synthesized a 4-milestone roadmap with actionable tasks and         |
|   capstone mini-projects." Click a task checkbox to show interactive completion.      |
| - Action: Click 'Dashboard' (/dashboard) to show score trends over historical sessions.|
+---------------------------------------------------------------------------------------+
```

---

# Part 2: 25 Technical Viva Questions & High-Scoring Model Answers

### Category 1: Backend & Python Architecture (Questions 1–5)

#### Q1: Why did you choose FastAPI over traditional frameworks like Django or Flask?
**Model Answer:**  
"FastAPI was chosen because it is built natively on ASGI (Asynchronous Server Gateway Interface) via Starlette and Uvicorn, rather than legacy WSGI. In an AI platform with real-time WebSockets and streaming LLM responses, FastAPI handles thousands of concurrent I/O-bound requests on a single Python process using Python’s `asyncio` event loop without blocking execution threads. Additionally, FastAPI provides native schema validation and automatic OpenAPI documentation through Pydantic v2, which compiles with Rust-based core speeds, giving us up to 5x faster data serialization than Flask-RESTful or Django REST Framework."

#### Q2: How does Python’s `asyncio` event loop work in your backend, and how do you handle CPU-bound tasks?
**Model Answer:**  
"Python’s `asyncio` uses a single-threaded cooperative multitasking event loop. When a coroutine awaits non-blocking I/O—such as querying MongoDB Atlas with Motor or awaiting HTTP responses from Gemini—the coroutine pauses and yields control back to the event loop, which immediately processes other incoming requests. For CPU-bound tasks like parsing complex 10MB PDF resumes with `pdfplumber`, running them directly in `async def` would block the event loop. Therefore, we execute CPU-intensive operations using `asyncio.to_thread` or FastAPI's `run_in_threadpool`, delegating the heavy computations to a separate OS worker thread pool while keeping the main event loop responsive."

#### Q3: What is the purpose of Pydantic v2 in your architecture, and how does it prevent malformed data?
**Model Answer:**  
"Pydantic v2 serves as our strict data contract layer across all system boundaries. Every API request and response payload—including resume extracts, interview turns, rubric evaluations, and roadmap milestones—is defined as a Pydantic `BaseModel`. Pydantic v2 validates types, field bounds (e.g. scores between 1 and 10 using `Field(..., ge=1, le=10)`), and string lengths at runtime before handler logic executes. If input is invalid, FastAPI automatically halts execution and returns a structured HTTP 422 Unprocessable Entity error without throwing unhandled exceptions."

#### Q4: How did you implement rate limiting, and why is it essential for an AI platform?
**Model Answer:**  
"We implemented rate limiting using `slowapi`, a Python ASGI rate-limiter built on the `limits` library. On an AI platform, unbounded access to endpoints that trigger LLM inference—such as `/api/v1/resume/upload` ($20\text{ req/min}$) and `/api/v1/interview/answer` ($60\text{ req/min}$)—can exhaust API token quotas, trigger Google Gemini HTTP 429 rate limits, or cause Denial of Service (DoS). Our limiter uses an intelligent key function: it extracts the authenticated user's Firebase token or real IP address from `X-Forwarded-For` proxy headers, throttling abusers with HTTP 429 Too Many Requests while ensuring valid candidates experience smooth interactions."

#### Q5: How do you handle CORS in FastAPI, and what security risks does it mitigate?
**Model Answer:**  
"CORS (Cross-Origin Resource Sharing) is handled via FastAPI’s `CORSMiddleware`. We explicitly whitelist authorized origins from our configuration—`http://localhost:5173` in development and our production Vercel domain in production—rather than using an insecure wildcard `*`. This prevents Cross-Site Scripting (XSS) and unauthorized third-party malicious websites from forging authenticated credentials or stealing candidate resume evaluation data via the candidate's browser."

---

### Category 2: Database & Distributed Systems (Questions 6–10)

#### Q6: Why did you choose MongoDB Atlas over relational databases like PostgreSQL?
**Model Answer:**  
"Interview preparation and resume analysis deal with highly variable, polymorphic document structures. An ATS resume analysis contains dynamic arrays of skills, nested projects, and varying numbers of improvement tips. Similarly, an interview session contains turn histories of arbitrary length and multi-milestone roadmaps. MongoDB’s JSON/BSON document model provides natural schema flexibility without requiring expensive multi-table joins or complex ALTER TABLE migrations. Furthermore, MongoDB Atlas provides automated multi-cloud failover, sharding, and managed replica sets with 99.99% SLA."

#### Q7: What is Motor, and how does it differ from standard PyMongo?
**Model Answer:**  
"PyMongo is a synchronous, blocking MongoDB driver. If used in an asynchronous framework like FastAPI, every `db.collection.find()` call would freeze the entire asyncio event loop while waiting for network packets from the MongoDB Atlas cloud cluster. Motor is the official async Python driver for MongoDB that wraps PyMongo using `asyncio`. It delegates I/O calls to non-blocking sockets, allowing FastAPI to execute other concurrent HTTP requests while database queries are in flight."

#### Q8: What database indexes did you create, and what is their time complexity benefit?
**Model Answer:**  
"We created optimized B-Tree indexes across all 5 core collections in `database.py`:
1. `users`: Unique index on `firebase_uid` and index on `email`.
2. `resumes`: Compound index on `(user_id, created_at DESC)`.
3. `sessions`: Unique index on `session_id` and index on `(user_id, created_at DESC)`.
4. `answers`: Unique compound index on `(session_id, question_index)`.
5. `reports`: Unique index on `session_id` and index on `user_id`.  
Without indexes, MongoDB performs a Collection Scan ($O(N)$ time complexity), inspecting every document in the database. With our B-Tree indexes, lookups drop to $O(\log N)$ tree traversal, keeping query latencies under 50ms even as data grows to hundreds of thousands of records."

#### Q9: How does the compound index on `(session_id, question_index)` ensure data integrity?
**Model Answer:**  
"In `answers`, the compound index `(session_id, 1, question_index, 1)` with `unique=True` serves two critical purposes. First, it enables fast range queries when retrieving the turn history for a session in sequential order. Second, the uniqueness constraint enforces idempotent write safety: it makes it physically impossible for a candidate or a network race condition to record two conflicting answers for the exact same question index in a given interview session."

#### Q10: How does the application maintain resilience if MongoDB Atlas temporarily experiences network latency?
**Model Answer:**  
"We engineered a dual-layer storage strategy in `session_manager.py` and `report_engine.py`. While MongoDB Atlas is the primary persistent store, the services maintain thread-safe in-memory session caches. If Atlas experiences transient connection jitter or an unexpected socket reset, the platform seamlessly reads from and writes to the memory cache without throwing 500 errors to the candidate, ensuring uninterrupted mock interviews."

---

### Category 3: Artificial Intelligence & LLM Engineering (Questions 11–15)

#### Q11: How do you force Google Gemini to return strictly valid JSON matching your schema?
**Model Answer:**  
"We utilize the official `google-genai` SDK with native Pydantic schema enforcement. In `gemini_client.py`, we configure `GenerateContentConfig(response_mime_type='application/json', response_schema=response_model)`. Gemini’s grammar-guided decoding constrains output tokens to only those that conform to the target JSON structure. Furthermore, our client wraps generation in a validation method that parses the output into the Pydantic model; if malformed JSON is detected, it automatically retries up to 2 times with sanitized prompts."

#### Q12: Explain your multi-model fallback chain and exponential backoff implementation.
**Model Answer:**  
"Google AI Studio's flash models occasionally experience temporary demand spikes resulting in HTTP 503 (Overloaded) or HTTP 429 (Rate Limit). Rather than failing, our `GeminiClient` maintains a prioritized fallback chain: `gemini-3.8-flash` $\to$ `gemini-3.5-flash` $\to$ `gemini-flash-lite-latest` $\to$ `gemini-flash-latest`. If an API error occurs, the client catches the exception, logs a warning, applies exponential backoff ($2^{\text{attempt}} \times 0.5\text{s}$), and seamlessly fails over to the next candidate model in the chain."

#### Q13: How did you optimize LLM API costs and turn latency during the interview?
**Model Answer:**  
"In naive implementations, evaluating an answer requires one LLM call and generating the next question requires a second LLM call, doubling latency ($~20\text{s}$) and doubling token costs. We designed a `CombinedTurnResponse` schema that prompts Gemini to simultaneously evaluate the candidate's previous response across the 5 rubric parameters AND generate the next adaptive question in a single inference call. This cuts latency by 50% and reduces API quota consumption by half."

#### Q14: How does the adaptive difficulty algorithm work?
**Model Answer:**  
"The adaptive difficulty engine is a finite state machine managed by `InterviewSessionManager`. After each turn evaluation, the algorithm calculates a rolling weighted average of the candidate's recent answer scores:
$$\text{Rolling Average} \ge 7.5 \implies \text{Increase Difficulty (Easy} \to \text{Medium} \to \text{Hard)}$$
$$\text{Rolling Average} \le 4.5 \implies \text{Decrease Difficulty (Hard} \to \text{Medium} \to \text{Easy)}$$
$$\text{Otherwise} \implies \text{Retain Current Difficulty}$$
This ensures the mock interview dynamically challenges strong candidates with architecture and scalability problems while easing down for struggling candidates to rebuild confidence."

#### Q15: How does the hybrid ATS scoring engine calculate its score?
**Model Answer:**  
"Our ATS engine uses a deterministic mathematical rule formula combined with semantic analysis:
$$\text{Score} = (\text{KeywordMatch} \times 0.35) + (\text{SectionCompleteness} \times 0.20) + (\text{QuantifiedMetrics} \times 0.15) + (\text{ActionVerbs} \times 0.15) + (\text{Formatting} \times 0.15)$$
- Keyword match compares candidate skills against the job description using tokenized set intersection.
- Section completeness validates standard headings (Experience, Education, Skills, Projects).
- Metrics analysis uses regex to detect quantified impact (percentages, latencies, request volumes).
- Action verbs verify strong verbs (Architected, Engineered, Implemented).
- Formatting verifies email, phone, LinkedIn, and GitHub links.  
Gemini then layers on top to provide prioritized, actionable improvement tips."

---

### Category 4: Frontend Engineering & Real-Time Voice (Questions 16–20)

#### Q16: Why did you choose React 18 with Vite instead of Create React App or Next.js?
**Model Answer:**  
"Create React App (CRA) is deprecated and uses Webpack with slow cold starts. Vite leverages native ES modules (ESM) in modern browsers powered by Rollup and esbuild, giving sub-second Hot Module Replacement (HMR) and optimized tree-shaking that produced our production bundle in under 5 seconds. Next.js was evaluated, but since InterviewIQ is an interactive single-page dashboard with real-time WebSockets and client-side Web Speech APIs rather than a static SEO blog, React 18 SPA with client-side routing is lighter, simpler, and completely decoupled from the backend."

#### Q17: How did you implement real-time voice speech-to-text without paying for third-party audio APIs?
**Model Answer:**  
"We utilized the native browser Web Speech API via our custom hook `useSpeechRecognition.ts`. It connects to `window.SpeechRecognition` / `webkitSpeechRecognition`, capturing candidate audio directly from the microphone and providing real-time streaming transcripts (`interimResults: true`). This approach runs client-side with zero external API fees, zero audio streaming latency, and complete privacy since raw audio bytes are not transferred over external networks."

#### Q18: How does text-to-speech work for the AI interviewer voice?
**Model Answer:**  
"Text-to-speech is implemented via our custom hook `useSpeechSynthesis.ts` wrapping `window.speechSynthesis`. When a new question arrives, the hook generates a `SpeechSynthesisUtterance` and filters the browser's available voices to select high-clarity natural English voices (such as Google US English or Samantha). The hook manages speech queues and automatically cancels active utterances if the candidate starts speaking or clicks 'Submit', avoiding overlapping audio."

#### Q19: Explain the architecture of the animated AI Orb component.
**Model Answer:**  
"The `AIOrb` in `AIOrb.tsx` is built using Framer Motion spring physics and CSS backdrop-filter glassmorphism. It represents a state-driven visual presence that transitions between 4 states:
1. `idle`: Ambient breathing scale in cyan and violet.
2. `speaking`: Radial audio ripple rings pulsing outwards when text-to-speech is active.
3. `listening`: Emerald-teal reactive pulse when the candidate microphone is capturing voice.
4. `thinking`: Orbiting gold particle rings with continuous rotation while Gemini evaluates the turn.  
This provides clear, accessible visual cues to the user during voice conversations."

#### Q20: What is the benefit of using Recharts for the 5-dimension radar chart?
**Model Answer:**  
"Recharts is a declarative charting library built natively on React and SVG. For the performance report, we render a `RadarChart` with dual overlapping polygons: the candidate's actual score polygon in cyan ($45\%$ opacity) layered over the Senior L5 benchmark polygon in violet ($15\%$ opacity). Because it renders vector SVG elements rather than raster canvas bitmaps, it scales crisply across all display resolutions and supports native `@media print` styling when candidates download or print their evaluation reports."

---

### Category 5: Security, Testing & DevOps (Questions 21–25)

#### Q21: How does Firebase Authentication integrate with your FastAPI backend?
**Model Answer:**  
"We implement a zero-trust cryptographic token verification model. The candidate signs in on the frontend via Firebase Client SDK (using Google 1-click OAuth or Email/Password). The frontend client obtains a signed JWT ID token. Axios interceptors automatically attach this token in the `Authorization: Bearer <token>` header on every API request. On the backend, our dependency `get_current_user` uses `firebase_admin.auth.verify_id_token(token)` to cryptographically verify the token's RSA signature, expiration timestamp, and issuer against Google's public keys before allowing access to protected endpoints."

#### Q22: What is the purpose of React Error Boundaries, and how did you implement them?
**Model Answer:**  
"In React, an unhandled JavaScript exception in any child component unmounts the entire component tree, causing a blank white screen. We created `ErrorBoundary.tsx`, a class component implementing `componentDidCatch` and `getDerivedStateFromError`. It wraps the top-level `<App>` router. If an unexpected rendering error occurs, it catches the exception and renders an Aurora-styled recovery interface with buttons to 'Reload Platform' or 'Return Home', ensuring the application never completely crashes."

#### Q23: Why did you use a multi-stage Dockerfile for the backend?
**Model Answer:**  
"A single-stage Dockerfile contains build compilers (`gcc`, `libffi-dev`), development headers, and package caches, resulting in bloated image sizes exceeding 1GB. Our multi-stage Dockerfile uses a `builder` stage to compile dependencies into a user local directory, then copies only the pre-compiled Python wheels into a lightweight `python:3.12-slim` runner stage. This reduces our final image size to $< 180\text{MB}$, eliminates compiler vulnerabilities from production, and executes the server under an unprivileged non-root user (`appuser`, UID 1000) for defense-in-depth security."

#### Q24: How does your `vercel.json` file prevent 404 errors during client-side routing?
**Model Answer:**  
"In a Single Page Application (SPA), routes like `/analyzer` or `/report/session-123` are handled client-side by React Router in the browser; there are no corresponding physical HTML files on the web server. Without configuration, refreshing these URLs on a static host returns HTTP 404 Not Found. Our `vercel.json` defines a rewrite rule:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
This instructs the edge server to route all incoming HTTP requests to `index.html`, allowing React Router to inspect the browser URL and mount the correct page component seamlessly."

#### Q25: What is the primary academic and societal impact of InterviewIQ?
**Model Answer:**  
"InterviewIQ democratizes high-quality technical interview preparation. Historically, candidates had to pay hundreds of dollars for mock interviews with senior engineers or rely on superficial flashcard tools. InterviewIQ provides an end-to-end, multi-turn, resume-aware platform that delivers real-time voice evaluation across a rigorous 5-dimension rubric, identifies concrete knowledge gaps, and algorithmically generates a personalized career roadmap. It bridges the gap between theoretical computer science education and practical industry hiring standards."

---

# Part 3: Quick Reference Cheat Sheet for Examination Day

| Parameter | Value / Technical Fact |
| :--- | :--- |
| **Backend Framework** | FastAPI 0.115 on Python 3.12 (ASGI via Uvicorn) |
| **Database** | MongoDB Atlas (M0 Free Cluster), 5 collections (`users`, `resumes`, `sessions`, `answers`, `reports`) |
| **Async DB Driver** | Motor 3.4.0 (Non-blocking async driver for asyncio) |
| **Authentication** | Firebase Admin SDK (Cryptographic RSA token verification) |
| **Primary LLM** | Google Gemini `gemini-3.8-flash` (Structured Pydantic JSON Mode) |
| **Fallback LLM** | `gemini-3.5-flash` $\to$ `gemini-flash-lite-latest` (Automated failover chain) |
| **Speech-to-Text** | Web Speech API `SpeechRecognition` (Native browser client-side, 0 latency, 0 cost) |
| **Text-to-Speech** | Web Speech API `SpeechSynthesis` (Native natural voice synthesis) |
| **Frontend Framework** | React 18, Vite 5, TypeScript, Tailwind CSS, Framer Motion, Recharts |
| **Theme** | Aurora Glassmorphism (Background `#0B0F19`, glass blur `backdrop-blur-md`) |
| **Deterministic ATS** | 35% Keywords + 20% Sections + 15% Metrics + 15% Verbs + 15% Contact Formatting |
| **Rubric Dimensions** | Relevance (1-10), Technical Accuracy (1-10), Clarity (1-10), Depth (1-10), Confidence (1-10) |
| **Adaptive Difficulty** | Rolling score $\ge 7.5 \to$ Hard; $\le 4.5 \to$ Easy; otherwise Medium |
| **Rate Limiter** | SlowAPI (Token bucket with IP / Authorization keying) |
| **Containerization** | Docker multi-stage build ($<180\text{MB}$ runner image with non-root user) |
| **Test Coverage** | 25 automated pytest tests covering Auth, DB, Gemini, Health, Interview, Report, Resume, E2E |
