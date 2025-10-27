Myapp/
├── backend/ # Express + Node.js server
│ ├── routes/ # API routes (auth, analytics, etc.)
│ ├── models/ # Mongoose models (User, Annotation, etc.)
│ ├── config/ # Database & environment setup
│ └── server.js # Entry point for backend
│
├── frontend/ # React frontend
│ ├── src/ # Components, hooks, utils
│ ├── public/ # Static assets
│ └── package.json
│
└── README.md


---

## ⚙️ Tech Stack

**Frontend**
- React.js (Hooks + Context API)
- Tailwind CSS
- MediaPipe Vision Tasks (Face & Presence Detection)
- Axios

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- Socket.io (for real-time room sessions)

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/yourusername/Myapp.git
cd Myapp
