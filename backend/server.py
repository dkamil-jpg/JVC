from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'just-vitality-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 6

app = FastAPI(title="Just Vitality Clinic API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==========================================
# MODELS
# ==========================================

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "STAFF"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    username: str
    role: str
    active: bool
    last_login: Optional[str] = None

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    dob: str  # YYYY-MM-DD
    phone: str
    email: str
    street: str
    city: str
    postcode: str
    emergency_name: str
    emergency_phone: str
    reason: str
    medications: str = ""
    allergies: str = "NKDA"
    conditions: str = ""
    surgeries: str = ""
    procedures: str = ""
    alerts: str = ""

class PatientUpdate(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    postcode: Optional[str] = None
    emergency_name: Optional[str] = None
    emergency_phone: Optional[str] = None
    medications: Optional[str] = None
    allergies: Optional[str] = None
    conditions: Optional[str] = None
    surgeries: Optional[str] = None
    procedures: Optional[str] = None

class VisitCreate(BaseModel):
    patient_id: str
    treatment: str
    notes: str
    consultant: str

class QueueEntry(BaseModel):
    patient_id: str
    first_name: str
    last_name: str
    reason: str
    alerts: str = ""
    status: str = "WAITING"

class KioskRegistration(BaseModel):
    first_name: str
    last_name: str
    dob: str
    postcode: str
    phone: str
    email: str
    street: str
    city: str
    emergency_name: str
    emergency_phone: str
    reason: str
    medications: str = ""
    allergies: str = "NKDA"
    conditions: str = ""
    surgeries: str = ""
    procedures: str = ""
    alerts: str = ""
    skip_queue: bool = False

class ReportFilters(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    consultant: Optional[str] = None

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def hash_password(password: str, salt: str) -> str:
    """Hash password with salt using SHA256"""
    raw = password + salt
    return hashlib.sha256(raw.encode()).hexdigest()

def generate_salt() -> str:
    """Generate random salt"""
    return secrets.token_hex(8)

def generate_patient_id(first_name: str, last_name: str, dob: str) -> str:
    """Generate patient ID from name and DOB"""
    def normalize(s):
        return ''.join(c for c in s.upper() if c.isalnum())
    return f"{normalize(last_name)}-{normalize(first_name)}-{dob}"

def create_jwt_token(username: str, role: str) -> str:
    """Create JWT token"""
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return user info"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"username": payload["sub"], "role": payload["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def verify_admin(user: dict = Depends(verify_token)) -> dict:
    """Verify user is admin"""
    if user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def verify_manager_or_admin(user: dict = Depends(verify_token)) -> dict:
    """Verify user is manager or admin"""
    if user["role"] not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Manager or Admin access required")
    return user

def format_date(dt: datetime, include_time: bool = False) -> str:
    """Format datetime to string"""
    if not dt:
        return ""
    if include_time:
        return dt.strftime("%Y-%m-%d %H:%M")
    return dt.strftime("%Y-%m-%d")

# ==========================================
# INITIALIZATION
# ==========================================

async def init_database():
    """Initialize database with default admin user if not exists"""
    admin = await db.users.find_one({"username": "ADMIN"})
    if not admin:
        salt = generate_salt()
        password_hash = hash_password("vit2025", salt)
        await db.users.insert_one({
            "username": "ADMIN",
            "password_hash": password_hash,
            "salt": salt,
            "role": "ADMIN",
            "active": True,
            "last_login": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Created default ADMIN user")
    
    # Create indexes
    await db.patients.create_index("patient_id", unique=True)
    await db.visits.create_index("patient_id")
    await db.queue.create_index([("date", 1), ("patient_id", 1)])

@app.on_event("startup")
async def startup():
    await init_database()

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ==========================================
# AUTH ENDPOINTS
# ==========================================

@api_router.post("/auth/login")
async def login(data: UserLogin):
    """Login and get JWT token"""
    username = data.username.strip().upper()
    
    user = await db.users.find_one({"username": username})
    if not user:
        await db.login_audit.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "username": username,
            "event": "FAIL",
            "details": "User not found"
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("active", True):
        await db.login_audit.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "username": username,
            "event": "LOCKED",
            "details": "Account inactive"
        })
        raise HTTPException(status_code=401, detail="Account locked. Contact admin.")
    
    if hash_password(data.password, user["salt"]) != user["password_hash"]:
        # Track failed attempts
        await db.login_audit.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "username": username,
            "event": "FAIL",
            "details": "Wrong password"
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Successful login
    token = create_jwt_token(username, user["role"])
    await db.users.update_one(
        {"username": username},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    await db.login_audit.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": username,
        "event": "SUCCESS",
        "details": "Logged in"
    })
    
    return {
        "success": True,
        "token": token,
        "username": username,
        "role": user["role"]
    }

@api_router.post("/auth/logout")
async def logout(user: dict = Depends(verify_token)):
    """Log session end"""
    await db.login_audit.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": user["username"],
        "event": "LOGOUT",
        "details": "Session ended"
    })
    return {"success": True}

@api_router.post("/auth/change-password")
async def change_password(data: ChangePassword, user: dict = Depends(verify_token)):
    """Change user password"""
    db_user = await db.users.find_one({"username": user["username"]})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if hash_password(data.current_password, db_user["salt"]) != db_user["password_hash"]:
        raise HTTPException(status_code=400, detail="Current password incorrect")
    
    if len(data.new_password) < 5:
        raise HTTPException(status_code=400, detail="Password too short")
    
    new_salt = generate_salt()
    new_hash = hash_password(data.new_password, new_salt)
    
    await db.users.update_one(
        {"username": user["username"]},
        {"$set": {"password_hash": new_hash, "salt": new_salt}}
    )
    
    return {"success": True}

@api_router.get("/auth/me")
async def get_current_user(user: dict = Depends(verify_token)):
    """Get current user info"""
    return {"username": user["username"], "role": user["role"]}

# ==========================================
# ADMIN ENDPOINTS
# ==========================================

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_users(user: dict = Depends(verify_manager_or_admin)):
    """Get all users (admin/manager only)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "salt": 0}).to_list(100)
    return [UserResponse(
        username=u["username"],
        role=u["role"],
        active=u.get("active", True),
        last_login=u.get("last_login")
    ) for u in users]

@api_router.post("/admin/users")
async def create_user(data: UserCreate, user: dict = Depends(verify_admin)):
    """Create new user (admin only)"""
    username = data.username.strip().upper()
    
    existing = await db.users.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    salt = generate_salt()
    password_hash = hash_password(data.password, salt)
    
    await db.users.insert_one({
        "username": username,
        "password_hash": password_hash,
        "salt": salt,
        "role": data.role.upper(),
        "active": True,
        "last_login": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True}

@api_router.post("/admin/users/{username}/reset-password")
async def reset_password(username: str, new_password: str, user: dict = Depends(verify_manager_or_admin)):
    """Reset user password"""
    target = username.strip().upper()
    
    target_user = await db.users.find_one({"username": target})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Managers cannot reset admin passwords
    if user["role"] == "MANAGER" and target_user["role"] == "ADMIN":
        raise HTTPException(status_code=403, detail="Managers cannot reset Admin passwords")
    
    new_salt = generate_salt()
    new_hash = hash_password(new_password, new_salt)
    
    await db.users.update_one(
        {"username": target},
        {"$set": {"password_hash": new_hash, "salt": new_salt, "active": True}}
    )
    
    await db.login_audit.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": target,
        "event": "ADMIN_RESET",
        "details": f"Password reset by {user['username']}"
    })
    
    return {"success": True}

@api_router.post("/admin/users/{username}/toggle-active")
async def toggle_user_active(username: str, active: bool, user: dict = Depends(verify_manager_or_admin)):
    """Enable/disable user account"""
    target = username.strip().upper()
    
    target_user = await db.users.find_one({"username": target})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["role"] == "MANAGER" and target_user["role"] == "ADMIN":
        raise HTTPException(status_code=403, detail="Managers cannot change Admin status")
    
    await db.users.update_one({"username": target}, {"$set": {"active": active}})
    
    await db.login_audit.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": target,
        "event": "ADMIN_ACTIVE",
        "details": f"Active set to {active} by {user['username']}"
    })
    
    return {"success": True}

@api_router.get("/admin/login-audit")
async def get_login_audit(limit: int = 200, user: dict = Depends(verify_admin)):
    """Get login audit log"""
    logs = await db.login_audit.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"success": True, "rows": logs}

# ==========================================
# PATIENT ENDPOINTS
# ==========================================

@api_router.get("/patients")
async def get_all_patients(user: dict = Depends(verify_token)):
    """Get all patients"""
    patients = await db.patients.find({}, {"_id": 0}).sort("last_name", 1).to_list(10000)
    
    # Check which patients have visits (for "NEW" badge)
    visited_ids = set()
    async for visit in db.visits.find({}, {"patient_id": 1}):
        visited_ids.add(visit["patient_id"])
    
    result = []
    for p in patients:
        result.append({
            **p,
            "is_new": p["patient_id"] not in visited_ids,
            "name": f"{p['first_name']} {p['last_name']}"
        })
    
    return result

@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, user: dict = Depends(verify_token)):
    """Get single patient details"""
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, data: PatientUpdate, user: dict = Depends(verify_token)):
    """Update patient details"""
    patient = await db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Log changes to audit
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    for field, new_value in update_data.items():
        old_value = patient.get(field, "")
        if old_value != new_value:
            await db.audit_log.insert_one({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "patient_id": patient_id,
                "action": "UPDATE",
                "field": field,
                "old_value": str(old_value),
                "new_value": str(new_value),
                "user": user["username"]
            })
    
    await db.patients.update_one({"patient_id": patient_id}, {"$set": update_data})
    
    return {"success": True}

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, password: str, user: dict = Depends(verify_manager_or_admin)):
    """Delete patient record (manager/admin only)"""
    # Verify password
    db_user = await db.users.find_one({"username": user["username"]})
    if hash_password(password, db_user["salt"]) != db_user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Delete patient
    result = await db.patients.delete_one({"patient_id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Delete visits
    await db.visits.delete_many({"patient_id": patient_id})
    
    # Log deletion
    await db.audit_log.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "patient_id": patient_id,
        "action": "DELETE",
        "field": "Full Record",
        "old_value": "DELETED",
        "new_value": "",
        "user": user["username"]
    })
    
    return {"success": True}

@api_router.get("/patients/{patient_id}/audit")
async def get_patient_audit(patient_id: str, user: dict = Depends(verify_token)):
    """Get patient change history"""
    logs = await db.audit_log.find(
        {"patient_id": patient_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    return logs

# ==========================================
# KIOSK & QUEUE ENDPOINTS
# ==========================================

@api_router.post("/kiosk/check")
async def check_patient_exists(first_name: str, last_name: str, dob: str, postcode: str):
    """Check if patient exists (for kiosk identification)"""
    patient_id = generate_patient_id(first_name, last_name, dob)
    
    patient = await db.patients.find_one({"patient_id": patient_id})
    
    if not patient:
        return {"status": "NOT_FOUND", "id": patient_id, "data": None}
    
    # Verify postcode
    db_postcode = patient.get("postcode", "").replace(" ", "").upper()
    input_postcode = postcode.replace(" ", "").upper()
    
    if db_postcode != input_postcode:
        return {"status": "PARTIAL_MATCH", "id": patient_id, "data": None}
    
    # Return patient data for pre-fill
    return {
        "status": "SUCCESS",
        "id": patient_id,
        "data": {
            "first_name": patient["first_name"],
            "last_name": patient["last_name"],
            "phone": patient.get("phone", ""),
            "email": patient.get("email", ""),
            "street": patient.get("street", ""),
            "city": patient.get("city", ""),
            "postcode": patient.get("postcode", ""),
            "medications": patient.get("medications", ""),
            "allergies": patient.get("allergies", ""),
            "conditions": patient.get("conditions", ""),
            "emergency_name": patient.get("emergency_name", ""),
            "emergency_phone": patient.get("emergency_phone", "")
        }
    }

@api_router.post("/kiosk/register")
async def kiosk_register(data: KioskRegistration):
    """Register/update patient and add to queue"""
    patient_id = generate_patient_id(data.first_name, data.last_name, data.dob)
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Check if patient exists
    existing = await db.patients.find_one({"patient_id": patient_id})
    
    patient_data = {
        "patient_id": patient_id,
        "first_name": data.first_name.strip().upper(),
        "last_name": data.last_name.strip().upper(),
        "dob": data.dob,
        "phone": data.phone,
        "email": data.email,
        "street": data.street,
        "city": data.city,
        "postcode": data.postcode.upper(),
        "emergency_name": data.emergency_name,
        "emergency_phone": data.emergency_phone,
        "reason": data.reason,
        "medications": data.medications,
        "allergies": data.allergies or "NKDA",
        "conditions": data.conditions,
        "surgeries": data.surgeries,
        "procedures": data.procedures,
        "updated_at": now.isoformat()
    }
    
    if existing:
        # Update existing patient
        await db.patients.update_one({"patient_id": patient_id}, {"$set": patient_data})
    else:
        # Create new patient
        patient_data["registered_at"] = now.isoformat()
        await db.patients.insert_one(patient_data)
    
    # Add to queue (if not skipping - staff registration skips queue)
    if not data.skip_queue:
        # Remove any existing queue entry for today
        await db.queue.delete_one({"patient_id": patient_id, "date": today})
        
        # Add new queue entry
        queue_entry = {
            "date": today,
            "timestamp": now.isoformat(),
            "patient_id": patient_id,
            "first_name": data.first_name.strip().upper(),
            "last_name": data.last_name.strip().upper(),
            "reason": data.reason,
            "alerts": data.alerts,
            "status": "WAITING"
        }
        await db.queue.insert_one(queue_entry)
        logger.info(f"Added patient {patient_id} to queue for {today}")
    
    return {"success": True, "patient_id": patient_id}

@api_router.get("/queue")
async def get_queue(user: dict = Depends(verify_token)):
    """Get today's queue"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    queue = await db.queue.find(
        {"date": today, "status": {"$ne": "DONE"}},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    
    return queue

@api_router.get("/queue/all")
async def get_all_queue(user: dict = Depends(verify_token)):
    """Get queue with all statuses for today"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    queue = await db.queue.find(
        {"date": today},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    
    return queue

@api_router.post("/queue/{patient_id}/complete")
async def complete_queue_entry(patient_id: str, user: dict = Depends(verify_token)):
    """Mark queue entry as done"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    result = await db.queue.update_one(
        {"patient_id": patient_id, "date": today},
        {"$set": {"status": "DONE"}}
    )
    
    # Also clear reason from patient record
    await db.patients.update_one(
        {"patient_id": patient_id},
        {"$set": {"reason": ""}}
    )
    
    return {"success": True}

# ==========================================
# VISITS ENDPOINTS
# ==========================================

@api_router.post("/visits")
async def create_visit(data: VisitCreate, user: dict = Depends(verify_token)):
    """Create new visit record"""
    patient = await db.patients.find_one({"patient_id": data.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    visit = {
        "visit_id": str(uuid.uuid4()),
        "patient_id": data.patient_id,
        "date": datetime.now(timezone.utc).isoformat(),
        "treatment": data.treatment,
        "notes": data.notes,
        "consultant": data.consultant
    }
    
    await db.visits.insert_one(visit)
    
    # Mark queue entry as done
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.queue.update_one(
        {"patient_id": data.patient_id, "date": today},
        {"$set": {"status": "DONE"}}
    )
    
    # Clear patient reason
    await db.patients.update_one(
        {"patient_id": data.patient_id},
        {"$set": {"reason": ""}}
    )
    
    return {"success": True, "visit_id": visit["visit_id"]}

@api_router.get("/visits/{patient_id}")
async def get_patient_visits(patient_id: str, user: dict = Depends(verify_token)):
    """Get all visits for a patient"""
    visits = await db.visits.find(
        {"patient_id": patient_id},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return visits

# ==========================================
# DASHBOARD ENDPOINT
# ==========================================

@api_router.get("/dashboard")
async def get_dashboard_data(user: dict = Depends(verify_token)):
    """Get all dashboard data in one call"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all patients
    patients = await db.patients.find({}, {"_id": 0}).sort("last_name", 1).to_list(10000)
    
    # Get today's queue
    queue = await db.queue.find(
        {"date": today, "status": {"$ne": "DONE"}},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    
    # Get visited patient IDs
    visited_ids = set()
    async for visit in db.visits.find({}, {"patient_id": 1}):
        visited_ids.add(visit["patient_id"])
    
    # Build queue map for alerts
    queue_map = {q["patient_id"]: q for q in queue}
    
    # Format patient list
    all_patients = []
    queue_patients = []
    
    for p in patients:
        pid = p["patient_id"]
        patient_data = {
            **p,
            "name": f"{p['first_name']} {p['last_name']}",
            "is_new": pid not in visited_ids,
            "alerts": queue_map.get(pid, {}).get("alerts", ""),
            "queue_reason": queue_map.get(pid, {}).get("reason", "")
        }
        all_patients.append(patient_data)
        
        if pid in queue_map:
            queue_patients.append(patient_data)
    
    return {
        "success": True,
        "all": all_patients,
        "queue": queue_patients
    }

# ==========================================
# REPORTS/ANALYTICS ENDPOINTS
# ==========================================

@api_router.get("/reports/summary")
async def get_reports_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(verify_token)
):
    """Get summary statistics for reports"""
    # Default to last 30 days
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Count visits in range
    visits = await db.visits.find({
        "date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }, {"_id": 0}).to_list(10000)
    
    # Count unique patients
    unique_patients = set(v["patient_id"] for v in visits)
    
    # Count new patients (registered in range)
    new_patients = await db.patients.count_documents({
        "registered_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    })
    
    # Visits by consultant
    consultant_stats = {}
    for v in visits:
        consultant = v.get("consultant", "Unknown")
        consultant_stats[consultant] = consultant_stats.get(consultant, 0) + 1
    
    # Visits by day
    daily_stats = {}
    for v in visits:
        day = v["date"][:10]
        daily_stats[day] = daily_stats.get(day, 0) + 1
    
    # Visits by hour (for heatmap)
    hourly_stats = {}
    for v in visits:
        try:
            dt = datetime.fromisoformat(v["date"].replace("Z", "+00:00"))
            hour = dt.hour
            day_of_week = dt.weekday()  # 0=Monday
            key = f"{day_of_week}-{hour}"
            hourly_stats[key] = hourly_stats.get(key, 0) + 1
        except:
            pass
    
    return {
        "total_visits": len(visits),
        "unique_patients": len(unique_patients),
        "new_patients": new_patients,
        "avg_visits_per_day": round(len(visits) / max(1, len(daily_stats)), 1),
        "consultant_stats": consultant_stats,
        "daily_stats": daily_stats,
        "hourly_stats": hourly_stats,
        "start_date": start_date,
        "end_date": end_date
    }

@api_router.get("/reports/visits")
async def get_visits_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    consultant: Optional[str] = None,
    user: dict = Depends(verify_token)
):
    """Get detailed visits for export"""
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    
    query = {"date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}}
    if consultant:
        query["consultant"] = consultant
    
    visits = await db.visits.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    
    # Enrich with patient names
    patient_cache = {}
    for v in visits:
        pid = v["patient_id"]
        if pid not in patient_cache:
            patient = await db.patients.find_one({"patient_id": pid}, {"first_name": 1, "last_name": 1})
            if patient:
                patient_cache[pid] = f"{patient['first_name']} {patient['last_name']}"
            else:
                patient_cache[pid] = "Unknown"
        v["patient_name"] = patient_cache[pid]
    
    return visits

@api_router.get("/reports/consultants")
async def get_consultants(user: dict = Depends(verify_token)):
    """Get list of all consultants"""
    consultants = await db.visits.distinct("consultant")
    return consultants

# ==========================================
# PDF EXPORT ENDPOINTS
# ==========================================

@api_router.get("/patients/{patient_id}/pdf")
async def get_patient_pdf(patient_id: str, user: dict = Depends(verify_token)):
    """Generate patient record as HTML (for PDF conversion in frontend)"""
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    visits = await db.visits.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(100)
    
    visits_html = ""
    for v in visits:
        visits_html += f"<tr><td>{v.get('date', '')[:10]}</td><td>{v.get('treatment', '')}</td><td>{v.get('notes', '')}</td><td>{v.get('consultant', '')}</td></tr>"
    
    if not visits_html:
        visits_html = "<tr><td colspan='4' style='text-align:center'>No visits recorded</td></tr>"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 40px; color: #333; }}
            h1 {{ color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }}
            h2 {{ background: #f3f4f6; padding: 8px 12px; margin-top: 25px; font-size: 14px; border-left: 4px solid #2563eb; }}
            .grid {{ display: grid; grid-template-columns: 150px 1fr; gap: 8px; margin-bottom: 15px; }}
            .label {{ font-weight: bold; color: #666; }}
            .value {{ color: #111; }}
            .alert {{ color: #dc2626; font-weight: bold; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
            th {{ background: #e5e7eb; padding: 10px; text-align: left; font-size: 12px; }}
            td {{ padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }}
            .footer {{ margin-top: 40px; text-align: center; color: #999; font-size: 10px; }}
        </style>
    </head>
    <body>
        <h1>Patient Record Export</h1>
        
        <div class="grid">
            <div class="label">Patient ID:</div><div class="value">{patient.get('patient_id', '')}</div>
            <div class="label">Name:</div><div class="value"><strong>{patient.get('first_name', '')} {patient.get('last_name', '')}</strong></div>
            <div class="label">Date of Birth:</div><div class="value">{patient.get('dob', '')}</div>
            <div class="label">Registered:</div><div class="value">{patient.get('registered_at', '')[:10] if patient.get('registered_at') else ''}</div>
        </div>
        
        <h2>Contact Information</h2>
        <div class="grid">
            <div class="label">Phone:</div><div class="value">{patient.get('phone', '')}</div>
            <div class="label">Email:</div><div class="value">{patient.get('email', '')}</div>
            <div class="label">Address:</div><div class="value">{patient.get('street', '')}, {patient.get('city', '')} {patient.get('postcode', '')}</div>
            <div class="label">Emergency Contact:</div><div class="value">{patient.get('emergency_name', '')} ({patient.get('emergency_phone', '')})</div>
        </div>
        
        <h2>Medical Profile</h2>
        <div class="grid">
            <div class="label">Conditions:</div><div class="value">{patient.get('conditions', '-')}</div>
            <div class="label">Allergies:</div><div class="value alert">{patient.get('allergies', 'NKDA')}</div>
            <div class="label">Medications:</div><div class="value">{patient.get('medications', '-')}</div>
            <div class="label">Surgeries:</div><div class="value">{patient.get('surgeries', '-')}</div>
            <div class="label">IV History/Notes:</div><div class="value">{patient.get('procedures', '-')}</div>
        </div>
        
        <h2>Visit History</h2>
        <table>
            <thead><tr><th>Date</th><th>Treatment</th><th>Notes</th><th>Consultant</th></tr></thead>
            <tbody>{visits_html}</tbody>
        </table>
        
        <div class="footer">Generated by Just Vitality Clinic System on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}</div>
    </body>
    </html>
    """
    
    return {"success": True, "html": html, "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}"}

# ==========================================
# ADMIN PANEL ENDPOINTS
# ==========================================

@api_router.get("/admin/system-audit")
async def get_system_audit(limit: int = 500, user: dict = Depends(verify_admin)):
    """Get full system audit log (all patient changes)"""
    logs = await db.audit_log.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"success": True, "logs": logs}

@api_router.delete("/admin/system-audit")
async def clear_system_audit(user: dict = Depends(verify_admin)):
    """Clear system audit log"""
    await db.audit_log.delete_many({})
    await db.audit_log.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "patient_id": "SYSTEM",
        "action": "CLEAR_AUDIT",
        "field": "System Audit Log",
        "old_value": "CLEARED",
        "new_value": "",
        "user": user["username"]
    })
    return {"success": True}

@api_router.delete("/admin/login-audit")
async def clear_login_audit(user: dict = Depends(verify_admin)):
    """Clear login audit log"""
    await db.login_audit.delete_many({})
    await db.login_audit.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": "SYSTEM",
        "event": "CLEAR_LOG",
        "details": f"Login audit cleared by {user['username']}"
    })
    return {"success": True}

# ==========================================
# HEALTH CHECK
# ==========================================

@api_router.get("/")
async def root():
    return {"message": "Just Vitality Clinic API", "version": "2.1"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
