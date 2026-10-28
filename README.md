# InterviewIQ

> **AI Interview Preparation and Resume Analysis Platform**  
> *Final-Year B.E. Major Project (VTU)*

InterviewIQ bridges the gap between resume screening and live technical interviews. Candidates upload their resumes to receive an instant ATS score, keyword gap analysis, and tailored recommendations. They then take an immersive, voice-enabled AI mock interview driven by Google Gemini with dynamic difficulty adjustment and 5-parameter scoring, concluding with an actionable career roadmap.

---

## 🛠 Tech Stack

- **Frontend:** React 18/19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts
- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, WebSockets
- **AI Engine:** Google Gemini API (`google-genai` SDK)
- **Database:** MongoDB Atlas (Async Motor Driver)
- **Authentication:** Firebase Authentication (Google OAuth + Email/Password)
- **Speech Technologies:** Browser Web Speech API & SpeechSynthesis

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18+)
- Python (v3.11+)
- Git

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend will run at `http://localhost:5173` and communicate with the backend at `http://localhost:8000`.
