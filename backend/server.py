# server.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timedelta, timezone
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
import logging
import bcrypt
from jose import JWTError, jwt
import socketio
from bson import ObjectId
import json
from bson import ObjectId

def convert_objectid(obj):
    """Convert MongoDB ObjectId to string recursively"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_objectid(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid(item) for item in obj]
    return obj
# Custom JSON encoder for FastAPI responses (handles ObjectId & datetimes)
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return super().default(o)

class CustomJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(content, cls=JSONEncoder, ensure_ascii=False).encode("utf-8")

# Helper: convert ObjectId recursively (your provided function)
def convert_objectid(obj):
    """Convert MongoDB ObjectId to string recursively"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_objectid(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid(item) for item in obj]
    return obj

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'studyguardian')]

# JWT settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'study-guardian-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create FastAPI app with custom JSON response class
app = FastAPI(title="StudyGuardian API", version="1.0.0", default_response_class=CustomJSONResponse)

# Security
security = HTTPBearer()

# Create Socket.IO server with corrected CORS
sio = socketio.AsyncServer(
    cors_allowed_origins="http://localhost:3000",
    async_mode='asgi'
)
socket_app = socketio.ASGIApp(sio)

# CORS middleware - single origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Models
class UserRole(str):
    TEACHER = "teacher"
    STUDENT = "student"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class RoomCreate(BaseModel):
    title: str
    subject: str
    description: Optional[str] = None
    duration: Optional[int] = 60

class Room(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    description: Optional[str] = None
    teacher_id: str
    room_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    duration: Optional[int] = 60
    students_count: Optional[int] = 0
    status: Optional[str] = "active"

class StudySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    student_id: str
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    is_active: bool = True
    consent: bool = False

class GazeMetric(BaseModel):
    session_id: str
    timestamp: float
    face_present: bool = False
    face_area_ratio: float = 0.0
    gaze_on_screen: float = 0.0
    attention_score: float = 0.0
    engagement_score: float = 0.0
    blink_rate: float = 0.0
    head_pose: Dict[str, float] = Field(default_factory=dict)
    gaze_direction: Dict[str, float] = Field(default_factory=dict)
    fatigue_level: float = 0.0

# Authentication helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    # Convert ObjectId fields (if any) and create User model
    user = convert_objectid(user)
    return User(**user)

# Health / test endpoint
@app.get("/api/test")
async def test_endpoint():
    return {"message": "Server is working", "rooms": []}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Auth endpoints
@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role
    )
    
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_obj = User(**convert_objectid(user))
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_obj.id}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

# Original Room endpoints (for backward compatibility)
@app.post("/api/rooms", response_model=Room)
async def create_room(room_data: RoomCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can create rooms")
    
    room = Room(
        title=room_data.title,
        subject=room_data.subject,
        description=room_data.description,
        teacher_id=current_user.id,
        duration=room_data.duration
    )
    
    await db.rooms.insert_one(room.dict())
    return room

@app.get("/api/rooms")
async def get_rooms(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.TEACHER:
        rooms_cursor = db.rooms.find({"teacher_id": current_user.id})
    else:
        rooms_cursor = db.rooms.find({"is_active": True})
    rooms = await rooms_cursor.to_list(100)
    
    # Convert ObjectId and prepare response
    result = []
    for room in rooms:
        room_dict = convert_objectid(room)
        if "_id" in room_dict:
            del room_dict["_id"]
        # Add student count safely
        active_sessions = await db.sessions.count_documents({
            "room_id": room_dict["id"], 
            "is_active": True
        })
        room_dict["students_count"] = active_sessions
        room_dict["status"] = "active" if room_dict.get("is_active", True) else "inactive"
        result.append(room_dict)
    
    return result

# Teacher-specific endpoints
@app.get("/api/teacher/rooms")
async def get_teacher_rooms(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    # Get rooms from database
    rooms_cursor = db.rooms.find({"teacher_id": current_user.id})
    rooms = await rooms_cursor.to_list(100)
    
    # Convert ObjectIds and prepare response
    result = []
    for room in rooms:
        # Convert ObjectIds to strings
        room_dict = convert_objectid(room)
        
        # Remove the _id field if it exists
        if "_id" in room_dict:
            del room_dict["_id"]
        
        # Add student count
        active_sessions = await db.sessions.count_documents({
            "room_id": room_dict["id"], 
            "is_active": True
        })
        room_dict["students_count"] = active_sessions
        room_dict["status"] = "active" if room_dict.get("is_active", True) else "inactive"
        
        result.append(room_dict)
    
    return result

@app.post("/api/teacher/rooms")
async def create_teacher_room(room_data: RoomCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can create rooms")
    
    room = Room(
        title=room_data.title,
        subject=room_data.subject,
        description=room_data.description,
        teacher_id=current_user.id,
        duration=room_data.duration or 60
    )
    
    room_dict = room.dict()
    await db.rooms.insert_one(room_dict)
    
    # Add additional fields for response
    room_dict["students_count"] = 0
    room_dict["status"] = "active"
    
    return room_dict

@app.delete("/api/teacher/rooms/{room_id}")
async def delete_teacher_room(room_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can delete rooms")
    
    room = await db.rooms.find_one({"id": room_id, "teacher_id": current_user.id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # End all active sessions in this room
    await db.sessions.update_many(
        {"room_id": room_id, "is_active": True},
        {"$set": {"is_active": False, "end_time": datetime.now(timezone.utc)}}
    )
    
    # Delete the room
    await db.rooms.delete_one({"id": room_id})
    
    return {"message": "Room deleted successfully"}

# Student management endpoints for teachers
@app.get("/api/teacher/students")
async def get_teacher_students(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    # Get all rooms for this teacher
    teacher_rooms = await db.rooms.find({"teacher_id": current_user.id}).to_list(100)
    room_ids = [room["id"] for room in teacher_rooms]
    
    # Get all sessions from teacher's rooms
    sessions = await db.sessions.find({"room_id": {"$in": room_ids}}).to_list(1000)
    
    # Group by student and calculate metrics
    student_stats = {}
    for session in sessions:
        student_id = session["student_id"]
        if student_id not in student_stats:
            student = await db.users.find_one({"id": student_id})
            if student:
                student = convert_objectid(student)
                student_stats[student_id] = {
                    "id": student_id,
                    "name": student.get("name", "Unknown"),
                    "email": student.get("email", ""),
                    "class": "10th Grade",
                    "total_sessions": 0,
                    "avg_attention": 0,
                    "last_session": None,
                    "status": "active"
                }
        
        if student_id in student_stats:
            student_stats[student_id]["total_sessions"] += 1
            if session.get("end_time"):
                student_stats[student_id]["last_session"] = session["end_time"]
            elif student_stats[student_id]["last_session"] is None:
                student_stats[student_id]["last_session"] = session["start_time"]
    
    # Calculate average attention for each student
    for student_id in list(student_stats.keys()):
        student_sessions = [s for s in sessions if s["student_id"] == student_id]
        session_ids = [s["id"] for s in student_sessions]
        
        if session_ids:
            metrics = await db.metrics.find({"session_id": {"$in": session_ids}}).to_list(1000)
            if metrics:
                attention_scores = [m.get("attention_score", 0) for m in metrics if m.get("attention_score") is not None]
                if attention_scores:
                    student_stats[student_id]["avg_attention"] = int(sum(attention_scores) / len(attention_scores))
    
    return list(student_stats.values())

@app.get("/api/teacher/students/{student_id}")
async def get_student_info(student_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    student = await db.users.find_one({"id": student_id, "role": UserRole.STUDENT})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    student = convert_objectid(student)
    return {
        "id": student["id"],
        "name": student["name"],
        "email": student["email"],
        "class": "10th Grade",
        "enrollment_date": student.get("created_at", datetime.now(timezone.utc))
    }

@app.get("/api/teacher/students/{student_id}/progress")
async def get_student_progress(
    student_id: str, 
    period: str = "week", 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    # Verify student exists
    student = await db.users.find_one({"id": student_id, "role": UserRole.STUDENT})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Calculate date range based on period
    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # all time
        start_date = datetime.min.replace(tzinfo=timezone.utc)
    
    # Get student's sessions in teacher's rooms
    teacher_rooms = await db.rooms.find({"teacher_id": current_user.id}).to_list(100)
    room_ids = [room["id"] for room in teacher_rooms]
    
    sessions = await db.sessions.find({
        "student_id": student_id,
        "room_id": {"$in": room_ids},
        "start_time": {"$gte": start_date}
    }).to_list(1000)
    
    if not sessions:
        return {
            "totalStudyTime": 0,
            "averageAttention": 0,
            "averageFatigue": 0,
            "totalSessions": 0,
            "recentSessions": [],
            "subjectStats": [],
            "attentionTrend": [],
            "alerts": []
        }
    
    # Get metrics for these sessions
    session_ids = [session["id"] for session in sessions]
    metrics = await db.metrics.find({"session_id": {"$in": session_ids}}).to_list(10000)
    
    # Calculate statistics
    total_sessions = len(sessions)
    total_study_time = 0
    attention_scores = []
    fatigue_scores = []
    
    for session in sessions:
        if session.get("end_time"):
            duration = (session["end_time"] - session["start_time"]).total_seconds() / 60
            total_study_time += duration
    
    for metric in metrics:
        if metric.get("attention_score") is not None:
            attention_scores.append(metric["attention_score"])
        if metric.get("fatigue_level") is not None:
            fatigue_scores.append(metric["fatigue_level"])
    
    avg_attention = sum(attention_scores) / len(attention_scores) if attention_scores else 0
    avg_fatigue = sum(fatigue_scores) / len(fatigue_scores) if fatigue_scores else 0
    
    # Get recent sessions with room/subject info
    recent_sessions = []
    for session in sorted(sessions, key=lambda x: x["start_time"], reverse=True)[:10]:
        room = await db.rooms.find_one({"id": session["room_id"]})
        duration = 0
        if session.get("end_time"):
            duration = (session["end_time"] - session["start_time"]).total_seconds() / 60
        
        session_metrics = [m for m in metrics if m["session_id"] == session["id"]]
        session_attention = sum(m.get("attention_score", 0) for m in session_metrics) / len(session_metrics) if session_metrics else 0
        session_fatigue = sum(m.get("fatigue_level", 0) for m in session_metrics) / len(session_metrics) if session_metrics else 0
        
        recent_sessions.append({
            "date": session["start_time"].isoformat(),
            "subject": room["subject"] if room else "Unknown",
            "duration": int(duration),
            "avgAttention": int(session_attention),
            "avgFatigue": int(session_fatigue)
        })
    
    # Calculate subject-wise stats
    subject_stats = {}
    for session in sessions:
        room = await db.rooms.find_one({"id": session["room_id"]})
        if not room:
            continue
            
        subject = room["subject"]
        if subject not in subject_stats:
            subject_stats[subject] = {
                "subject": subject,
                "time": 0,
                "sessions": 0,
                "attention_scores": [],
                "fatigue_scores": []
            }
        
        subject_stats[subject]["sessions"] += 1
        if session.get("end_time"):
            duration = (session["end_time"] - session["start_time"]).total_seconds() / 60
            subject_stats[subject]["time"] += duration
        
        # Add metrics for this session
        session_metrics = [m for m in metrics if m["session_id"] == session["id"]]
        for metric in session_metrics:
            if metric.get("attention_score") is not None:
                subject_stats[subject]["attention_scores"].append(metric["attention_score"])
            if metric.get("fatigue_level") is not None:
                subject_stats[subject]["fatigue_scores"].append(metric["fatigue_level"])
    
    # Calculate averages for subjects
    subject_list = []
    for subject_data in subject_stats.values():
        avg_att = sum(subject_data["attention_scores"]) / len(subject_data["attention_scores"]) if subject_data["attention_scores"] else 0
        avg_fat = sum(subject_data["fatigue_scores"]) / len(subject_data["fatigue_scores"]) if subject_data["fatigue_scores"] else 0
        
        subject_list.append({
            "subject": subject_data["subject"],
            "time": int(subject_data["time"]),
            "sessions": subject_data["sessions"],
            "avgAttention": int(avg_att),
            "avgFatigue": int(avg_fat)
        })
    
    return {
        "totalStudyTime": int(total_study_time),
        "averageAttention": int(avg_attention),
        "averageFatigue": int(avg_fatigue),
        "totalSessions": total_sessions,
        "recentSessions": recent_sessions,
        "subjectStats": subject_list,
        "attentionTrend": [],
        "alerts": []
    }

# Student endpoints
@app.get("/api/students/progress")
async def get_student_own_progress(
    period: str = "week", 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can access this endpoint")
    
    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime.min.replace(tzinfo=timezone.utc)
    
    sessions = await db.sessions.find({
        "student_id": current_user.id,
        "start_time": {"$gte": start_date}
    }).to_list(1000)
    
    if not sessions:
        return {
            "totalStudyTime": 0,
            "averageAttention": 0,
            "averageFatigue": 0,
            "totalSessions": 0,
            "subjectStats": [],
            "dailyStats": [],
            "goals": {
                "dailyTarget": 180,
                "weeklyTarget": 1260,
                "targetAttention": 75
            },
            "achievements": []
        }
    
    # Get metrics for these sessions
    session_ids = [session["id"] for session in sessions]
    metrics = await db.metrics.find({"session_id": {"$in": session_ids}}).to_list(10000)
    
    # Calculate basic stats
    total_sessions = len(sessions)
    total_study_time = sum((s.get("end_time", s["start_time"]) - s["start_time"]).total_seconds() / 60 for s in sessions)
    
    attention_scores = [m.get("attention_score", 0) for m in metrics if m.get("attention_score") is not None]
    fatigue_scores = [m.get("fatigue_level", 0) for m in metrics if m.get("fatigue_level") is not None]
    
    avg_attention = sum(attention_scores) / len(attention_scores) if attention_scores else 0
    avg_fatigue = sum(fatigue_scores) / len(fatigue_scores) if fatigue_scores else 0
    
    # Calculate subject stats
    subject_stats = {}
    for session in sessions:
        room = await db.rooms.find_one({"id": session["room_id"]})
        if room:
            subject = room["subject"]
            if subject not in subject_stats:
                subject_stats[subject] = {"subject": subject, "time": 0, "sessions": 0, "avgAttention": 0, "avgFatigue": 0}
            
            subject_stats[subject]["sessions"] += 1
            if session.get("end_time"):
                duration = (session["end_time"] - session["start_time"]).total_seconds() / 60
                subject_stats[subject]["time"] += duration
    
    return {
        "totalStudyTime": int(total_study_time),
        "averageAttention": int(avg_attention),
        "averageFatigue": int(avg_fatigue),
        "totalSessions": total_sessions,
        "subjectStats": list(subject_stats.values()),
        "dailyStats": [],
        "goals": {
            "dailyTarget": 180,
            "weeklyTarget": 1260,
            "targetAttention": 75
        },
        "achievements": []
    }

# Join room & sessions endpoints
@app.post("/api/rooms/{room_code}/join")
async def join_room(room_code: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can join rooms")
    
    room = await db.rooms.find_one({"room_code": room_code, "is_active": True})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    session = StudySession(
        room_id=room["id"],
        student_id=current_user.id
    )
    
    await db.sessions.insert_one(session.dict())
    return {"message": "Joined room successfully", "session_id": session.id}

@app.get("/api/rooms/{room_id}/sessions")
async def get_room_sessions(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if current_user.role == UserRole.TEACHER and room["teacher_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    sessions = await db.sessions.find({"room_id": room_id, "is_active": True}).to_list(100)
    
    result = []
    for session in sessions:
        session = convert_objectid(session)
        student = await db.users.find_one({"id": session["student_id"]})
        student = convert_objectid(student) if student else None
        session["student_name"] = student["name"] if student else "Unknown"
        if "_id" in session:
            del session["_id"]
        result.append(session)
    
    return result

# Session endpoints
@app.post("/api/sessions/{session_id}/end")
async def end_session(session_id: str, current_user: User = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["student_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"end_time": datetime.now(timezone.utc), "is_active": False}}
    )
    
    return {"message": "Session ended successfully"}

@app.post("/api/sessions/{session_id}/consent")
async def record_consent(session_id: str, consent_data: dict, current_user: User = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": session_id})
    if not session or session["student_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"consent": consent_data.get("consented", False)}}
    )
    return {"message": "Consent recorded"}

@app.get("/api/sessions/{session_id}/metrics")
async def get_session_metrics(session_id: str, current_user: User = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if current_user.role == UserRole.STUDENT and session["student_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.TEACHER:
        room = await db.rooms.find_one({"id": session["room_id"]})
        if not room or room["teacher_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    metrics = await db.metrics.find({"session_id": session_id}).to_list(1000)
    # convert ObjectIds in metrics to strings
    metrics = [convert_objectid(m) for m in metrics]
    for m in metrics:
        m.pop("_id", None)
    return metrics

# Socket.IO events
@sio.event
async def connect(sid, environ):
    logging.info(f"Socket.IO client connected: {sid}")

@sio.event
async def disconnect(sid):
    logging.info(f"Socket.IO client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    room_id = data.get('room_id')
    session_id = data.get('session_id')
    if room_id and session_id:
        session = await db.sessions.find_one({"id": session_id, "room_id": room_id})
        if not session:
            await sio.emit('error', {'message': 'Invalid session or room'}, room=sid)
            return
        await sio.enter_room(sid, f"room_{room_id}")
        await sio.emit('joined_room', {'room_id': room_id, 'session_id': session_id}, room=sid)
        logging.info(f"Client {sid} joined room_{room_id}")

@sio.event
async def metric(sid, data):
    session_id = data.get('session_id')
    room_id = data.get('room_id')
    
    if not session_id or not room_id:
        await sio.emit('error', {'message': 'Missing session_id or room_id'}, room=sid)
        return

    session = await db.sessions.find_one({"id": session_id, "room_id": room_id})
    if not session:
        await sio.emit('error', {'message': 'Invalid session'}, room=sid)
        return

    metric = GazeMetric(
        session_id=session_id,
        timestamp=data.get('timestamp', datetime.now(timezone.utc).timestamp()),
        face_present=data.get('facePresent', False),
        face_area_ratio=data.get('faceAreaRatio', 0.0),
        gaze_on_screen=data.get('gazeOnScreen', 0.0),
        attention_score=data.get('attentionScore', 0.0),
        engagement_score=data.get('engagementScore', 0.0),
        blink_rate=data.get('blinkRate', 0.0),
        head_pose=data.get('headPose', {}),
        gaze_direction=data.get('gazeDirection', {}),
        fatigue_level=data.get('fatigueLevel', 0.0),
    )
    
    await db.metrics.insert_one(metric.dict())
    
    await sio.emit('student_update', {
        'session_id': session_id,
        'metrics': metric.dict(),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, room=f"room_{room_id}")

# Mount Socket.IO app
app.mount("/socket.io", socket_app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
