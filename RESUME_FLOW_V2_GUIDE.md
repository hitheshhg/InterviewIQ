# InterviewIQ: Resume Flow v2 ("Upload, Improve, Rebuild") Technical Guide & Viva Documentation

**Candidate:** Shreya  
**Institution:** Visvesvaraya Technological University (VTU)  
**Degree:** Bachelor of Engineering (B.E.) in Computer Science & Engineering  
**Major Project Title:** InterviewIQ – AI-Powered Adaptive Interview Preparation & Resume Optimization Platform  

---

## 1. Executive Summary & Flow Overview

Resume Flow v2 introduces an end-to-end, single-page, 3-step reactive pipeline ("Upload, Improve, Rebuild") replacing traditional builder-heavy workflows:
- **Step 1: Upload & Verify:** Extracts plain text from PDF/DOCX resumes (with strict guardrails for scanned, corrupt, and empty files), parses unstructured text into a canonical Pydantic AST schema (`CanonicalResume`), allows direct inline corrections, and persists the active resume in MongoDB Atlas.
- **Step 2: Guided Improvement:** Deterministic 5-factor ATS scoring engine (JD/Keyword match 40%, Section completeness 15%, Quantified achievements 15%, Action verbs 15%, Formatting 15% with transparent redistribution to 25/25/25/25 when no JD is provided), impact-ranked fix issue cards, STAR bullet rewrites adhering to the **Truth Rule** (never inventing numbers or facts, converting missing metrics into `[Fill in: ...]` candidate inputs), and interactive missing skill confirmation questions.
- **Step 3: Rebuild ATS Resume:** 3 ATS-safe single-column templates (Classic, Modern, Minimal), live paper-style preview with direct click-to-edit capabilities, 1-page/2-page fit budget indicator, automated export self-test re-parser awarding a green "ATS-readable" badge, and version-tracked PDF/DOCX downloads (`Name_Resume.pdf`).
- **Interview Studio Integration:** Active resume and algorithmic question seeds automatically injected into mock interviews to probe unproven skills and weak claims.

---

## 2. End-to-End Manual Verification Checklist

| Step / Feature | Test Procedure | Expected Result | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **Security & Auth** | Send GET/POST to `/api/v1/resume/*` without Authorization header. | Returns HTTP 401 Unauthorized with `{"detail": "Missing Authorization header or Bearer token."}`. | ✅ PASS |
| **Rate Limiting** | Fire $>15$ rewrite requests within 1 minute from the same token. | Returns HTTP 429 with `{"detail": "AI usage limit reached...", "error": "rate_limit_exceeded"}`. | ✅ PASS |
| **Empty File Upload** | Upload 0-byte `.pdf` or `.docx` on `/analyzer`. | UI displays red alert: *"File is empty. Upload a populated resume."* HTTP 400. | ✅ PASS |
| **Scanned PDF Upload** | Upload image-only or scanned PDF without text layer. | UI displays alert: *"Scanned or image-only PDF detected. Please upload a PDF with selectable text."* | ✅ PASS |
| **Canonical Parse** | Upload valid PDF/DOCX resume. | Extracted into Contact, Summary, Categorized Skills, Experience Bullets, Projects, Education, Certifications. | ✅ PASS |
| **Active Resume Save** | Click *"Save Active Resume"* or advance to Step 2. | MongoDB `active_resumes` collection persists document with candidate `user_id` and increments version. | ✅ PASS |
| **Transparent ATS Gauge** | View ATS score gauge with and without Job Description. | Shows 5-factor breakdown. If no JD, displays note: *"No JD provided: 40% keyword weight redistributed equally across remaining factors."* | ✅ PASS |
| **Semantic Skill Matcher** | Provide target Job Description with required tools. | Shows Matched (green), Partial (amber), Missing (rose) with exact evidence line citations. | ✅ PASS |
| **Truth Rule Verification** | Request bullet rewrite for *"Responsible for backend APIs."* | Generates active STAR rewrites (`"Architected backend APIs..."`) with `[Fill in: % latency / metric]` without inventing fake numbers. | ✅ PASS |
| **Missing Skill Questions** | Candidate clicks fix card for missing skill (e.g. Docker). | Asks *"Have you used Docker?"* with Confirm / Deny. Only confirmed skills are injected into the resume. | ✅ PASS |
| **Live Score Dynamic Update** | Candidate clicks *"Accept Rewrite"*. | Bullet replaces original line; ATS ScoreGauge instantly increments live (+3 to +5 pts). | ✅ PASS |
| **Template Switching** | Toggle between Classic, Modern, and Minimal templates in Step 3. | Live paper preview changes typography, dividers, and accents instantly. | ✅ PASS |
| **Direct Paper Editing** | Click any bullet or summary line in the live preview. | Turns into an inline textarea; pressing Enter or clicking outside saves edit instantly. | ✅ PASS |
| **Page Budget Indicator** | Toggle templates or edit content length. | Displays dynamic badge: `1-Page Fit: Optimal (78% height)` or `2-Page Fit: Extended`. | ✅ PASS |
| **Export Self-Test Re-Parser** | Click *"Export PDF"* or *"Export DOCX"*. | Backend generates file, re-parses with pdfplumber/docx parser, confirms 5 headers and contact survived, displays green `badge: "ATS-readable"`. | ✅ PASS |
| **File Naming Specification** | Check exported file download. | Filename matches `Name_Resume.pdf` (e.g. `Shreya_CS_Resume.pdf`). | ✅ PASS |
| **Interview Auto-Binding** | Navigate to `/interview` after saving active resume. | Setup card displays `Using: Resume v{N} ({filename})` with version switcher dropdown. | ✅ PASS |
| **Question Seed Probing** | Start interview session. | AI Question 1 or follow-ups probe unproven skills (e.g. Docker listed with no project evidence). | ✅ PASS |
| **Dashboard Score Trend** | Navigate to `/dashboard`. | KPI 4 displays active ATS score; version chart tracks score evolution (`v1: 48` $\to$ `v2: 85`). | ✅ PASS |

---

## 3. 8 Technical VTU Viva Questions & Answers

### Q1: What is the Canonical Resume JSON schema, and why is an Abstract Syntax Tree (AST) intermediate representation superior to raw text for ATS optimization?
**Answer:**
In InterviewIQ, the `CanonicalResume` is a strongly-typed Pydantic schema representing the resume as an AST. It decomposes the document into discrete entities: `ContactInfo`, `CategorizedSkills` (partitioned into languages, frameworks, developer tools, cloud/databases), `ExperienceItem` (with structured bullets), `ProjectItem`, `EducationItem`, and `CertificationItem`.

Treating the resume as an AST provides three key advantages:
1. **Separation of Content and Presentation:** The same canonical data can be rendered into multiple ATS-safe formats (Classic, Modern, Minimal, PDF, DOCX) without altering underlying semantics.
2. **Deterministic Mutation:** Guided improvements, metric insertions, and skill confirmations mutate specific nodes in the tree rather than performing risky string replacements on raw text.
3. **Cross-Feature Reusability:** The identical AST is ingested by the ATS scoring engine, the Truth Rule bullet rewriter, the interview question seed generator, and the career roadmap engine without duplicate parsing.

---

### Q2: How does the deterministic 5-factor ATS scoring engine calculate scores, and how does the weight redistribution algorithm handle resumes without a target Job Description?
**Answer:**
The scoring engine evaluates the candidate's canonical resume across 5 weighted dimensions:
1. **Keyword / JD Match (40%):** Evaluates semantic overlap between required JD skills and candidate skills using tokenized lemmatized matching and exact evidence citations.
2. **Section Completeness (15%):** Evaluates presence and depth of essential ATS sections (Contact info, Summary, Categorized Skills, Experience, Projects, Education).
3. **Quantified Achievements (15%):** Detects measurable metrics, percentages, latencies, currency, or user scale across all experience and project bullets.
4. **Action Verbs & Language (15%):** Penalizes passive clichés (`"responsible for"`, `"worked on"`) and rewards Google X-Y-Z formula verbs (`"Architected"`, `"Engineered"`, `"Spearheaded"`).
5. **Formatting & Structure (15%):** Validates clean bullet lengths (15–45 words), absence of multi-column tables, and single-column readability.

**Weight Redistribution Algorithm:** When the user does not provide a target Job Description, the 40% keyword weight cannot be fairly evaluated. Instead of assigning a 0 score or inventing keywords, the engine redistributes the 40% equally across the remaining 4 factors (each factor's weight increases from 15% to $15\% + \frac{40\%}{4} = 25\%$). The breakdown explicitly informs the candidate: *"No JD provided: 40% keyword weight redistributed equally across remaining factors."*

---

### Q3: Explain the "Truth Rule" in your guided improvement engine. How does your architecture mathematically prevent AI hallucination of fake skills, numbers, or employers?
**Answer:**
Large Language Models have a notorious tendency to hallucinate inflated metrics (e.g. inventing *"reduced latency by 45%"* or claiming experience with *"Kubernetes"* when the candidate never used it). InterviewIQ enforces a zero-hallucination policy called the **Truth Rule**:
1. **Prompt Boundary Constraints:** The Gemini prompt strictly instructs the model never to invent metrics or ungrounded claims. If an impact metric is missing, it must generate a structured placeholder: `[Fill in: % latency / efficiency]`.
2. **Deterministic Post-Sanitization Layer (`verify_bullet_truthfulness`):** The backend executes an automated regex audit on every AI-generated suggestion before returning it to the client:
   - It extracts all numeric tokens from the original bullet: $N_{orig} = \text{regex}(\text{numbers})$.
   - It extracts all numeric tokens from the rewritten suggestion outside of fill-in brackets: $N_{new} = \text{regex}(\text{numbers})$.
   - If $N_{new} \setminus N_{orig} \neq \emptyset$ (i.e. the AI generated numbers absent from the candidate's original text), the algorithm sanitizes the hallucination by replacing the unverified number with `[Fill in: verified metric / result]`.
3. **Missing Skills Confirmation Protocol:** Missing JD skills are never added automatically. They are presented as interactive questions (*"Have you used Docker?"*), and only candidate-confirmed skills are inserted into the canonical resume.

---

### Q4: How does the Semantic Skill Matcher extract and categorize candidate skills against job requirements, and how does it generate evidence line citations?
**Answer:**
The `canonical_scorer` implements a dual-pass skill matching algorithm:
1. **Extraction Pass:** It parses the target Job Description to identify technical skills across 4 categories (Languages, Frameworks, Developer Tools, Cloud & Databases) using boundary-aware regex against a curated dictionary of 150+ standard industry tools and aliases (e.g. mapping `reactjs` to `React`, `k8s` to `Kubernetes`).
2. **Matching Pass:** For each required skill $S_{req}$, it checks whether $S_{req}$ exists in the candidate's `CategorizedSkills`. If matched in the skills list, it searches all experience bullets and project descriptions for contextual evidence lines where the skill was actually used.
3. **Categorization & Evidence Citation:**
   - **Matched:** Skill exists in candidate skills and has an accompanying evidence line in their projects or experience.
   - **Partial:** Skill is listed in candidate skills, but no contextual evidence line exists in their work or projects.
   - **Missing:** Skill is required by the JD but completely absent from the candidate's resume.
   The resulting JSON includes the exact sentence as an `evidence_line`, which is highlighted in amber/green on the UI.

---

### Q5: Why did you choose ReportLab and python-docx for ATS document generation, and what technical guidelines ensure 100% ATS readability?
**Answer:**
Many online resume builders generate multi-column graphic PDFs using HTML Canvas, nested flexboxes, or image layers. Legacy Applicant Tracking Systems (Workday, Taleo, Greenhouse) parse documents sequentially from top-to-bottom and left-to-right; multi-column or table-heavy layouts cause text from different columns to interleave, scrambling candidate contact details and experience.

InterviewIQ uses **ReportLab Flowables** (PDF) and **python-docx** (DOCX) under strict ATS guidelines:
1. **Single-Column Linear Flow:** All elements are sequential `Paragraph` and `Spacer` flowables. Zero floating text boxes, zero absolute coordinate positioning, and zero multi-column tables.
2. **Real Selectable Text:** ReportLab draws true Type 1 / TrueType fonts directly into the PDF content stream, ensuring 100% extractability by OCR-less parsers.
3. **Standard Semantic Headings:** Headings use standard ATS vocabulary: `TECHNICAL SKILLS`, `WORK EXPERIENCE`, `PROJECTS`, `EDUCATION`, and `CERTIFICATIONS`.
4. **XML & Unicode Escaping:** International accents (e.g. `München`, `José`, `Café`) and XML entities (`&`, `<`, `>`, quotes) are escaped with `html.escape()` while preserving formatting tags (`<b>`, `<i>`).

---

### Q6: How does the Export Self-Test Re-Parser work, and what security and reliability guarantees does it provide to the candidate?
**Answer:**
Before a candidate downloads their exported resume, the platform runs an automated verification self-test (`POST /api/v1/resume/export-self-test`):
1. **In-Memory Generation:** The backend synthesizes the binary PDF or DOCX file stream in an in-memory `io.BytesIO` buffer.
2. **Independent Re-Parsing:** The platform passes the generated bytes into its own ATS extraction engine (`pdfplumber` for PDF, `docx.Document` for DOCX) without touching disk.
3. **Round-Trip Survival Audit:** The self-test inspects the re-parsed text to verify:
   - Candidate full name, email, and phone number survived intact.
   - All 5 critical section headings (`SUMMARY`, `SKILLS`, `EXPERIENCE`, `PROJECTS`, `EDUCATION`) were cleanly detected.
   - Key technical skills are present in the re-parsed text stream.
4. **Badge Award:** If all checks pass, the endpoint returns `badge: "ATS-readable"`, displaying a green shield badge on the UI. If any section failed to parse, the candidate is alerted before submitting to real job portals.

---

### Q7: How does the Question Seed Generator bridge the candidate's resume to the Mock Interview Studio?
**Answer:**
The `QuestionSeedGenerator` analyzes the candidate's active canonical resume and target JD to detect vulnerabilities and interview probe targets:
1. **Unproven Skills:** Skills declared in the skills list but never cited in any project or experience bullet (e.g. *"You listed Kubernetes in your skills with no direct project evidence. Explain how you used it..."*).
2. **Weak Claims:** Experience bullets that lack metrics or use passive phrasing (e.g. *"In your role at StartupX, describe the technical architecture..."*).
3. **JD Gaps:** Skills required by the target job that the candidate does not have.

When the candidate starts a mock interview session, `session_manager.py` automatically binds their active resume version (`Using: Resume v3`) and injects these question seeds into the Gemini system prompt. This ensures interview questions are personalized to the candidate's real resume claims rather than generic template questions.

---

### Q8: How does InterviewIQ enforce authentication, per-user rate limiting, and multi-tenant data isolation across all endpoints?
**Answer:**
1. **Cryptographic Token Verification:** Every API endpoint depends on `get_current_user` via FastAPI's `Depends` injection. Incoming requests must contain a valid `Authorization: Bearer <firebase_id_token>` header, verified against Firebase Admin SDK public keys. Unauthenticated requests strictly return HTTP 401.
2. **Per-User Token Bucket Rate Limiting:** Using `slowapi`, rate limits are keyed to `user:{token[-24:]}` rather than shared client IPs. This guarantees that one candidate hitting their 15 rewrites/minute limit does not block other candidates on the same campus or NAT gateway.
3. **Multi-Tenant MongoDB Data Isolation:** Every database query filters strictly by `user_id == current_user["firebase_uid"]`. In our automated test suite (`test_candidate_data_isolation_resume_versions`), User B querying User A's resume or session ID strictly receives an HTTP 404 Not Found, preventing cross-tenant information leakage.

---

## 4. 2-Minute Evaluator Demo Script (Time-Budgeted)

| Time | Screen / Action | Voiceover / Script for Evaluator |
| :--- | :--- | :--- |
| **0:00 - 0:20** | **Step 1: Upload & Verify**<br>Navigate to `/analyzer`. Upload sample resume (`Shreya_Resume.pdf`). | *"Good morning, examiners. This is InterviewIQ's Resume Flow v2. In Step 1, we upload a candidate resume. Notice the system instantly extracts text and parses it into our Canonical Resume AST schema using structured Gemini with deterministic fallback. Contact details, categorized skills, and experience are extracted. We can edit any parsed detail right here before saving our Active Resume in MongoDB Atlas."* |
| **0:20 - 0:50** | **Step 2: Guided Improvement**<br>Click Next. View ATS ScoreGauge and Fix Cards. Paste optional JD. | *"In Step 2, the deterministic 5-factor scoring engine calculates our ATS score — here, 54/100. When no JD is pasted, notice the transparent weight redistribution note. With a JD pasted, our semantic matcher categorizes skills into Matched, Partial, and Missing with exact evidence citations. Below is our impact-ranked fix list."* |
| **0:50 - 1:15** | **Truth Rule Rewrite & Live Update**<br>Click fix card for passive bullet. Accept rewrite. | *"Notice this fix card: 'Replace passive verbs'. The AI generates STAR rewrites using the Google X-Y-Z formula. But crucially, our platform enforces the **Truth Rule**: the AI never hallucinates fake metrics or employers. It provides a '[Fill in: % metric]' prompt for the candidate's verified data. When I click 'Accept', notice the bullet updates and the ATS ScoreGauge immediately increments live to 72."* |
| **1:15 - 1:35** | **Step 3: Rebuild ATS Resume & Self-Test**<br>Click Next. Switch templates. Click Export PDF. | *"In Step 3, we generate a new ATS-safe resume. We can switch between Classic, Modern, and Minimal templates. The paper preview allows direct click-to-edit. The page fit budget indicator confirms optimal 1-page density. When I click 'Export PDF', the backend runs an automated round-trip self-test re-parsing the PDF with pdfplumber. See the green 'ATS-readable' badge confirming all 5 section headers and contact details survived."* |
| **1:35 - 2:00** | **Interview Auto-Binding & Dashboard**<br>Navigate to `/interview` and then `/dashboard`. | *"Finally, our active resume is automatically bound to Interview Studio without re-uploading — displaying 'Using: Resume v2'. The AI generates targeted question seeds probing unproven skills. And on the candidate Dashboard, KPI 4 tracks our latest ATS score with a historical version evolution chart from 54 to 82. All endpoints are hardened with per-user rate limiting and Firebase token authentication. Thank you!"* |
