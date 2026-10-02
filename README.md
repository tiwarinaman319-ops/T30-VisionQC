# VisionQC 🔍

**VisionQC** is an unsupervised industrial visual inspection system designed for real-time quality control on assembly lines. Powered by a **FastAPI** backend running **PatchCore** anomaly detection models and a responsive **React (Vite) + Tailwind CSS** frontend dashboard, VisionQC detects, flags, and localizes manufacturing defects without requiring labeled anomaly training data.

---

## 🚀 Key Features

* **Real-time Anomaly Inspection:** Processes live webcam frames every 500ms and evaluates PatchCore anomaly scores on the fly.
* **Unsupervised Model Calibration:** Rapid baseline enrollment using anomaly-free reference samples.
* **Heatmap Diagnostics:** Visual defect localization generated via anomaly scoring overlays.
* **Dynamic Sensitivity Control:** Real-time threshold adjustment synchronized between UI controls and backend logic.
* **Operator Override System:** Manual pass/fail override capability for edge-case inspections with full audit logging.
* **Persistent Audit Logging:** Inspection logs and shift statistics stored in a local **SQLite** database (`qc.db`).
* **Developer Testing Mode:** Built-in dev panel (`Ctrl + Shift + D`) for offline UI testing and payload simulation.

---

## 🛠️ Tech Stack

### **Backend**
* **Framework:** Python 3.10+, FastAPI, Uvicorn
* **Computer Vision & ML:** PyTorch, PyTorch Lightning, OpenCV, NumPy
* **Anomaly Detection:** PatchCore (Anomalib)
* **Database:** SQLite (`qc.db`)

### **Frontend**
* **Framework:** React 18, Vite
* **Styling:** Tailwind CSS, PostCSS
* **Networking:** Axios / RESTful Fetch API

---

## 📁 Repository Structure

```text
vision-qc/
├── backend/
│   ├── experiment_run/            # Anomaly datasets & experiment runs
│   │   └── bottle/
│   │       ├── test/              # Evaluation categories (broken_large, broken_small, contamination, good)
│   │       ├── train/             # Anomaly-free training baseline images
│   │       ├── exported/
│   │       │   └── weights/torch/model.pt
│   │       └── results/
│   │           └── Patchcore/bottle/
│   │               ├── latest/    # Checkpoints & evaluation runs (weights/lightning/model.ckpt)
│   │               └── v0/
│   ├── exported/
│   │   └── weights/torch/         # Exported PyTorch inference weights (model.pt)
│   ├── calibration.json           # Active baseline settings & reference parameters
│   ├── experiment.ipynb           # Model development & prototyping notebook
│   ├── main.py                    # FastAPI application core & API endpoints
│   ├── qc.db                      # SQLite database for persistent metrics & audit logs
│   └── requirements.txt           # Backend Python dependencies
│
├── frontend/
│   ├── public/                    # Static public web assets
│   ├── src/
│   │   ├── assets/                # Images & media assets
│   │   ├── components/
│   │   │   ├── AuditLog.jsx       # Inspection history log table
│   │   │   ├── CameraView.jsx     # Live camera feed & heatmap overlay renderer
│   │   │   ├── Controls.jsx       # Dynamic threshold sliders & system controls
│   │   │   ├── InspectionModal.jsx# Diagnostic modal for detailed defect comparison
│   │   │   └── ShiftMetrics.jsx   # Shift pass/reject rates & inspection totals
│   │   ├── api.js                 # REST API service connector
│   │   ├── App.css                # Component-level styling rules
│   │   ├── App.jsx                # Main dashboard container & state manager
│   │   ├── index.css              # Tailwind CSS imports & global rules
│   │   └── main.jsx               # React DOM entry point
│   ├── .env                       # Frontend environment variables
│   ├── eslint.config.js           # ESLint configuration
│   ├── index.html                 # Main HTML entry document
│   ├── package.json               # Node.js dependencies & scripts
│   ├── postcss.config.js          # PostCSS configuration
│   ├── tailwind.config.js         # Tailwind CSS design system rules
│   └── vite.config.js             # Vite development server configuration
│
├── .gitignore                     # Git ignore definitions
└── README.md                      # Project documentation
```

---

## ⚙️ Getting Started

### Prerequisites
* **Python:** 3.10+
* **Node.js:** v18+ & `npm`
* **Webcam / Video Device:** Standard USB camera or integrated webcam

---

### Step 1: Clone the Repository

```bash
git clone [https://github.com/tiwarinaman319-ops/vision-qc.git](https://github.com/tiwarinaman319-ops/vision-qc.git)
cd vision-qc
```

---

### Step 2: Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   * **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Launch the FastAPI server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
   *The backend will be running at `http://localhost:8000` (API documentation accessible at `http://localhost:8000/docs`).*

---

### Step 3: Frontend Setup

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

## 🔌 API Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/inspect` | Evaluates a Base64 image frame; returns anomaly score, result status, and heatmap overlay. |
| `POST` | `/train` | Accepts baseline calibration frames to update normal inspection reference bounds. |
| `GET` | `/stats` | Fetches aggregated pass, reject, total inspection counts, and rejection percentages from `qc.db`. |
| `POST` | `/threshold` | Updates internal dynamic pass/fail decision threshold. |
| `POST` | `/override` | Forces a manual `PASS` classification on the most recent inspection entry. |

---

## 🕹️ User Workflow

1. **Calibration:** Click **Start Calibration** and present 25 anomaly-free reference samples to train the baseline.
2. **Inspection:** Click **Start Scanning** to enable real-time 500ms continuous inspection.
3. **Threshold Tuning:** Adjust the sensitivity slider to set pass/fail tolerances dynamically.
4. **Audit Review:** Click any item in the **Audit Log** to open the inspection modal and compare live heatmaps against baseline references.