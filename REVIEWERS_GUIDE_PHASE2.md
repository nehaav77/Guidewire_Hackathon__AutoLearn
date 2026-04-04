# 🚀 Reviewer's Guide: ShieldRide

Welcome to the **Guidewire DEVTrails 2026** submission for Team AutoLearn! We have designed this repository to be as frictionless as possible for you to evaluate.

There are two ways to evaluate this project:
1. **The Live Demo (Recommended)** - For quickly experiencing the UX/UI of the application.
2. **The Local Runnable Package (Docker)** - For verifying our backend microservices, MongoDB, and Redis queues locally.

---

## Method 1: The Live Demo (Frictionless)

We have deployed the application to Vercel so you can immediately interact with the dual-dashboard architecture.

🔗 **Deployed App:** [https://sheild-ride.vercel.app/](https://sheild-ride.vercel.app/)

### What you should try:
1. **Rider Onboarding Flow:** Act as "Ravi", a Blinkit delivery partner. Go through the 90-second onboarding.
2. **Test Regional Text-to-Speech:** On Step 2 of Onboarding, select **Kannada** or **Hindi** and click the speaker icon. The system will audibly translate the insurance policy using local TTS engines or fallback APIs!
3. **Verify the Dynamic Pricing:** Notice the **5% Zero Claims Discount** uniquely applied to your premium during checkout.
4. **Trigger Simulator:** Once logged in as an Insurer, navigate to the `Trigger Simulator` tab. Click **"Fire Trigger"** to watch the automated Zero-Touch Claim Pipeline execute.
5. **Insurer Reserve Forecast:** On the Insurer dashboard, click the `Reserves` tab to view the AI-generated 7-day predictive reserve pool.

---

## Method 2: The Local Runnable Package (Docker Compose)

To verify our technical architecture (FastAPI, React, MongoDB, Redis, and Celery Workers), everything is bundled securely into a **Docker Compose** package. 

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- Git installed.

### Execution Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/nehaav77/Guidewire_Hackathon__AutoLearn.git
   cd Guidewire_Hackathon__AutoLearn
   ```

2. **Boot the architecture:**
   ```bash
   docker-compose up --build
   ```
   *This single command builds the Frontend and Backend images, pulls MongoDB and Redis, and automatically wires them together using internal container networks. **No `.env` database configuration is required by you.***

3. **Access the Application:**
   - **Frontend UI:** [http://localhost:5173](http://localhost:5173)
   - **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

4. **Shutdown:**
   ```bash
   docker-compose down
   ```

### What's running under the hood?
When you run `docker-compose up`, you are booting:
* `shieldride_mongodb`: A native MongoDB 6.0 instance storing policy/claim JSON datasets.
* `shieldride_redis`: A Redis 7 cache managing states and fraud scores.
* `shieldride_backend`: The asynchronous Python 3.11 FastAPI server.
* `shieldride_celery`: The independent Celery workers waiting to poll disruption events.
* `shieldride_frontend`: The Vite/React Progressive Web App.

Thank you for reviewing ShieldRide!
— *Team AutoLearn*
