# InterviewIQ - Production Deployment Guide

This guide details the step-by-step procedure for deploying **InterviewIQ** to public cloud infrastructure using **Vercel** (Frontend) and **Render** (Backend API), integrated with **MongoDB Atlas**, **Firebase Authentication**, and **Google Gemini API**.

---

## 1. System Architecture Overview

```
                      +-----------------------------+
                      |       Candidate Browser     |
                      |   (Voice AI / React UI)     |
                      +--------------+--------------+
                                     |
              +----------------------+----------------------+
              |                                             |
   HTTPS / SPA Routing                            HTTPS / WebSocket
              v                                             v
+---------------------------+                 +---------------------------+
|    Vercel Edge Network    |                 |    Render Web Service     |
|  (React 18 + Vite + TS)   |                 | (FastAPI + Python 3.12)   |
|   `frontend/vercel.json`  |                 |    `backend/Dockerfile`   |
+---------------------------+                 +-------------+-------------+
                                                            |
                     +--------------------------------------+---------------------+
                     |                                      |                     |
                     v                                      v                     v
       +---------------------------+          +-------------------+ +-------------------+
       |    MongoDB Atlas (M0)     |          | Firebase Admin SDK| | Google Gemini API |
       | (5 Indexed Collections)   |          |  (JWT Auth Sync)  | | (Pydantic Schema) |
       +---------------------------+          +-------------------+ +-------------------+
```

---

## 2. Backend Deployment (Render)

### Step 2.1: Create Render Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\to$ **Web Service**.
3. Connect your GitHub repository: `InterviewIQ`.
4. Configure service settings:
   - **Name:** `interviewiq-backend`
   - **Region:** `Oregon (US West)` or `Singapore`
   - **Root Directory:** `backend`
   - **Environment:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** `Free`

### Step 2.2: Add Secret File & Environment Variables
1. Under **Secret Files**, create:
   - **Filename:** `serviceAccountKey.json`
   - **Content:** Paste your Firebase Admin service account JSON credentials.
2. Under **Environment Variables**, add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `ENVIRONMENT` | `production` | Production mode |
   | `PORT` | `10000` | Render port |
   | `CORS_ORIGINS` | `https://your-frontend.vercel.app,http://localhost:5173` | Allowed origins |
   | `MONGODB_URI` | `mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/?retryWrites=true&w=majority` | Atlas SRV URI |
   | `MONGODB_DB_NAME` | `interviewiq` | Database name |
   | `FIREBASE_CREDENTIALS_PATH` | `serviceAccountKey.json` | Path to secret file |
   | `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio Key |
   | `GEMINI_MODEL` | `gemini-3.8-flash` | Primary inference model |
   | `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash` | Secondary fallback model |

3. Click **Create Web Service**. Once deployed, your backend will be live at:
   `https://interviewiq-backend.onrender.com`

4. Verify health status:
   ```bash
   curl -s https://interviewiq-backend.onrender.com/health
   ```

---

## 3. Frontend Deployment (Vercel)

### Step 3.1: Import Project to Vercel
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** $\to$ **Project**.
3. Import your GitHub repository.
4. Set project configuration:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 3.2: Configure Frontend Environment Variables
In Vercel Project Settings $\to$ **Environment Variables**, add:
| Key | Value |
| :--- | :--- |
| `VITE_API_BASE_URL` | `https://interviewiq-backend.onrender.com` |
| `VITE_WS_BASE_URL` | `wss://interviewiq-backend.onrender.com` |
| `VITE_FIREBASE_API_KEY` | (Your Firebase Web Config) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `<project-id>` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `<project-id>.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `<sender-id>` |
| `VITE_FIREBASE_APP_ID` | `<app-id>` |

5. Click **Deploy**. Vercel will build the frontend and provide your production URL:
   `https://interviewiq.vercel.app`

---

## 4. Post-Deployment Cross-Service Authorization

1. **Firebase Authentication:**
   - In [Firebase Console](https://console.firebase.google.com) $\to$ **Authentication** $\to$ **Settings** $\to$ **Authorized Domains**, add:
     - `interviewiq.vercel.app`
     - `interviewiq-backend.onrender.com`

2. **MongoDB Atlas Network Whitelist:**
   - In [MongoDB Atlas](https://cloud.mongodb.com) $\to$ **Network Access**, ensure IP Access List includes `0.0.0.0/0` (Allow Access from Anywhere) so Render dynamic worker IPs can connect.

3. **Backend CORS Whitelist:**
   - Update `CORS_ORIGINS` in Render environment variables to include your production Vercel domain:
     `https://interviewiq.vercel.app`

---

## 5. Local Production Replica (Docker Compose)

To test the entire containerized production environment locally:

```bash
# 1. Ensure backend/.env contains your MongoDB and Gemini keys
cp backend/.env.example backend/.env

# 2. Build and launch all containers
docker compose up --build

# 3. Access applications:
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# OpenAPI:  http://localhost:8000/docs
# Health:   http://localhost:8000/health
```

