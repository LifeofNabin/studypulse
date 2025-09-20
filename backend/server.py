from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
import json
import asyncio
import logging
import bcrypt
from jose import JWTError, jwt
import socketio

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'study-guardian-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create FastAPI app
app = FastAPI(title="StudyGuardian API", version="1.0.0")

# Security
security = HTTPBearer()

# Create Socket.IO server
sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode='asgi')
socket_app = socketio.ASGIApp(sio)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
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

class Room(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    description: Optional[str] = None
    teacher_id: str
    room_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    student_id: str
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    is_active: bool = True

class GazeMetric(BaseModel):
    session_id: str
    timestamp: float
    face_present: bool = False
    attention_score: float = 0.0
    head_pose: Dict[str, float] = Field(default_factory=dict)
    gaze_direction: Dict[str, float] = Field(default_factory=dict)
    fatigue_level: float = 0.0

# Connection Manager for WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_data: Dict[str, List[Dict]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_data[session_id] = []
        logging.info(f"Session {session_id} connected")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        logging.info(f"Session {session_id} disconnected")

    async def send_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            await websocket.send_text(message)

    def store_metrics(self, session_id: str, data: Dict):
        if session_id not in self.session_data:
            self.session_data[session_id] = []
        self.session_data[session_id].append(data)

manager = ConnectionManager()

# Authentication functions
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
    return User(**user)

# Auth endpoints
@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role
    )
    
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    # Create token
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
    
    user_obj = User(**user)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_obj.id}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

# Room endpoints
@app.post("/api/rooms", response_model=Room)
async def create_room(room_data: RoomCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can create rooms")
    
    room = Room(
        title=room_data.title,
        subject=room_data.subject,
        description=room_data.description,
        teacher_id=current_user.id
    )
    
    await db.rooms.insert_one(room.dict())
    return room

@app.get("/api/rooms", response_model=List[Room])
async def get_rooms(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.TEACHER:
        rooms = await db.rooms.find({"teacher_id": current_user.id}).to_list(100)
    else:
        rooms = await db.rooms.find({"is_active": True}).to_list(100)
    
    return [Room(**room) for room in rooms]

@app.post("/api/rooms/{room_code}/join")
async def join_room(room_code: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can join rooms")
    
    room = await db.rooms.find_one({"room_code": room_code, "is_active": True})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Create study session
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
    
    # Get student details
    for session in sessions:
        student = await db.users.find_one({"id": session["student_id"]})
        session["student_name"] = student["name"] if student else "Unknown"
    
    return sessions

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

@app.get("/api/sessions/{session_id}/metrics")
async def get_session_metrics(session_id: str, current_user: User = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check permissions
    if current_user.role == UserRole.STUDENT and session["student_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.TEACHER:
        room = await db.rooms.find_one({"id": session["room_id"]})
        if not room or room["teacher_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    metrics = await db.metrics.find({"session_id": session_id}).to_list(1000)
    return metrics

# WebSocket endpoint for real-time metrics
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                parsed_data = json.loads(data)
                
                # Store metric in database
                metric = GazeMetric(
                    session_id=session_id,
                    timestamp=parsed_data.get('timestamp', datetime.now(timezone.utc).timestamp()),
                    face_present=parsed_data.get('face_present', False),
                    attention_score=parsed_data.get('attention_score', 0.0),
                    head_pose=parsed_data.get('head_pose', {}),
                    gaze_direction=parsed_data.get('gaze_direction', {}),
                    fatigue_level=parsed_data.get('fatigue_level', 0.0)
                )
                
                await db.metrics.insert_one(metric.dict())
                
                # Store in memory for real-time analysis
                manager.store_metrics(session_id, parsed_data)
                
                # Send acknowledgment
                await manager.send_message(
                    json.dumps({"status": "received", "timestamp": datetime.now(timezone.utc).isoformat()}),
                    session_id
                )
                
            except json.JSONDecodeError:
                await manager.send_message(
                    json.dumps({"error": "Invalid JSON data"}),
                    session_id
                )
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)

# Socket.IO events for real-time communication
@sio.event
async def connect(sid, environ):
    logging.info(f"Socket.IO client connected: {sid}")

@sio.event
async def disconnect(sid):
    logging.info(f"Socket.IO client disconnected: {sid}")

@sio.event
async def join_monitoring(sid, data):
    room_id = data.get('room_id')
    if room_id:
        await sio.enter_room(sid, f"room_{room_id}")
        await sio.emit('joined_room', {'room_id': room_id}, room=sid)

@sio.event
async def student_metrics(sid, data):
    session_id = data.get('session_id')
    room_id = data.get('room_id')
    
    if session_id and room_id:
        # Broadcast to teachers monitoring this room
        await sio.emit('student_update', {
            'session_id': session_id,
            'metrics': data.get('metrics', {}),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=f"room_{room_id}")

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Mount Socket.IO app
app.mount("/socket.io", socket_app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)