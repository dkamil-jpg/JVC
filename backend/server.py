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
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'just-vitality-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 6

app = FastAPI(title="Just Vitality Clinic API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

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
    dob: str
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

class PasswordVerify(BaseModel):
    password: str

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def hash_password(password: str, salt: str) -> str:
    raw = password + salt
    return hashlib.sha256(raw.encode()).hexdigest()

def generate_salt() -> str:
    return secrets.token_hex(8)

def generate_patient_id(first_name: str, last_name: str, dob: str) -> str:
    def normalize(s):
        return ''.join(c for c in s.upper() if c.isalnum())
    return f"{normalize(last_name)}-{normalize(first_name)}-{dob}"

def create_jwt_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"username": payload["sub"], "role": payload["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def verify_admin(user: dict = Depends(verify_token)) -> dict:
    if user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def verify_manager_or_admin(user: dict = Depends(verify_token)) -> dict:
    if user["role"] not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Manager or Admin access required")
    return user

async def verify_password_for_user(username: str, password: str) -> bool:
    """Verify password for a user"""
    db_user = await db.users.find_one({"username": username})
    if not db_user:
        return False
    return hash_password(password, db_user["salt"]) == db_user["password_hash"]

async def log_system_event(action: str, details: str, user: str, patient_id: str = "SYSTEM", field: str = "", old_value: str = "", new_value: str = ""):
    """Log any system event to audit log"""
    await db.audit_log.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "patient_id": patient_id,
        "action": action,
        "field": field or action,
        "old_value": old_value,
        "new_value": new_value or details,
        "user": user
    })

# ==========================================
# INITIALIZATION
# ==========================================

async def init_database():
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
        await db.login_audit.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "username": username,
            "event": "FAIL",
            "details": "Wrong password"
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
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
    
    return {"success": True, "token": token, "username": username, "role": user["role"]}

@api_router.post("/auth/logout")
async def logout(user: dict = Depends(verify_token)):
    await db.login_audit.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": user["username"],
        "event": "LOGOUT",
        "details": "Session ended"
    })
    return {"success": True}

@api_router.post("/auth/change-password")
async def change_password(data: ChangePassword, user: dict = Depends(verify_token)):
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
    return {"username": user["username"], "role": user["role"]}

# ==========================================
# ADMIN PANEL ENDPOINTS
# ==========================================

@api_router.get("/admin/users")
async def get_users(user: dict = Depends(verify_manager_or_admin)):
    """Get all users (admin/manager)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "salt": 0}).to_list(100)
    return [UserResponse(
        username=u["username"],
        role=u["role"],
        active=u.get("active", True),
        last_login=u.get("last_login")
    ) for u in users]

@api_router.post("/admin/users")
async def create_user(data: UserCreate, user: dict = Depends(verify_manager_or_admin)):
    """Create new user - managers can only create STAFF/MANAGER, admins can create any"""
    username = data.username.strip().upper()
    role = data.role.upper()
    
    # Managers cannot create ADMINs
    if user["role"] == "MANAGER" and role == "ADMIN":
        raise HTTPException(status_code=403, detail="Managers cannot create Admin users")
    
    existing = await db.users.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    salt = generate_salt()
    password_hash = hash_password(data.password, salt)
    
    await db.users.insert_one({
        "username": username,
        "password_hash": password_hash,
        "salt": salt,
        "role": role,
        "active": True,
        "last_login": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_system_event("USER_CREATE", f"Created user {username} with role {role}", user["username"])
    
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
    
    await log_system_event("PASSWORD_RESET", f"Password reset for {target}", user["username"])
    
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
    
    await log_system_event("USER_STATUS", f"User {target} active={active}", user["username"])
    
    return {"success": True}

@api_router.get("/admin/login-audit")
async def get_login_audit(limit: int = 500, user: dict = Depends(verify_manager_or_admin)):
    """Get login audit log - available to managers and admins"""
    logs = await db.login_audit.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"success": True, "rows": logs}

@api_router.delete("/admin/login-audit")
async def clear_login_audit(user: dict = Depends(verify_admin)):
    """Clear login audit log - ADMIN ONLY"""
    await db.login_audit.delete_many({})
    await db.login_audit.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": "SYSTEM",
        "event": "CLEAR_LOG",
        "details": f"Login audit cleared by {user['username']}"
    })
    return {"success": True}

@api_router.get("/admin/system-audit")
async def get_system_audit(limit: int = 1000, user: dict = Depends(verify_manager_or_admin)):
    """Get full system audit log - available to managers and admins"""
    logs = await db.audit_log.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"success": True, "logs": logs}

@api_router.delete("/admin/system-audit")
async def clear_system_audit(user: dict = Depends(verify_admin)):
    """Clear system audit log - ADMIN ONLY"""
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

# ==========================================
# PATIENT ENDPOINTS
# ==========================================

@api_router.get("/patients")
async def get_all_patients(user: dict = Depends(verify_token)):
    patients = await db.patients.find({}, {"_id": 0}).sort("last_name", 1).to_list(10000)
    
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
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, data: PatientUpdate, user: dict = Depends(verify_token)):
    patient = await db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
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

@api_router.post("/patients/{patient_id}/delete")
async def delete_patient(patient_id: str, data: PasswordVerify, user: dict = Depends(verify_manager_or_admin)):
    """Delete patient record - requires password verification"""
    if not await verify_password_for_user(user["username"], data.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    patient = await db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    patient_name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}"
    
    await db.patients.delete_one({"patient_id": patient_id})
    await db.visits.delete_many({"patient_id": patient_id})
    
    await log_system_event("DELETE", f"Deleted patient {patient_name}", user["username"], patient_id, "Full Record", patient_name, "DELETED")
    
    return {"success": True}

@api_router.get("/patients/{patient_id}/audit")
async def get_patient_audit(patient_id: str, user: dict = Depends(verify_token)):
    logs = await db.audit_log.find({"patient_id": patient_id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return logs

# ==========================================
# PDF EXPORT - REQUIRES PASSWORD FOR MANAGER/ADMIN
# ==========================================

@api_router.post("/patients/{patient_id}/pdf")
async def get_patient_pdf(patient_id: str, data: PasswordVerify, user: dict = Depends(verify_manager_or_admin)):
    """Generate patient record PDF - requires password verification"""
    if not await verify_password_for_user(user["username"], data.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    patient = await db.patients.find_one({"patient_id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    visits = await db.visits.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(100)
    
    visits_html = ""
    for v in visits:
        visits_html += f"<tr><td>{v.get('date', '')[:10]}</td><td>{v.get('treatment', '')}</td><td>{v.get('notes', '')}</td><td>{v.get('consultant', '')}</td></tr>"
    
    if not visits_html:
        visits_html = "<tr><td colspan='4' style='text-align:center'>No visits recorded</td></tr>"
    
    html = f"""<!DOCTYPE html>
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
        <div class="label">Emergency:</div><div class="value">{patient.get('emergency_name', '')} ({patient.get('emergency_phone', '')})</div>
    </div>
    <h2>Medical Profile</h2>
    <div class="grid">
        <div class="label">Conditions:</div><div class="value">{patient.get('conditions', '-')}</div>
        <div class="label">Allergies:</div><div class="value alert">{patient.get('allergies', 'NKDA')}</div>
        <div class="label">Medications:</div><div class="value">{patient.get('medications', '-')}</div>
        <div class="label">Surgeries:</div><div class="value">{patient.get('surgeries', '-')}</div>
        <div class="label">IV History:</div><div class="value">{patient.get('procedures', '-')}</div>
    </div>
    <h2>Visit History</h2>
    <table><thead><tr><th>Date</th><th>Treatment</th><th>Notes</th><th>Consultant</th></tr></thead><tbody>{visits_html}</tbody></table>
    <div class="footer">Generated by Just Vitality Clinic on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} | Exported by: {user['username']}</div>
</body>
</html>"""
    
    await log_system_event("PDF_EXPORT", f"Exported patient record", user["username"], patient_id)
    
    return {"success": True, "html": html, "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}"}

# ==========================================
# KIOSK & QUEUE ENDPOINTS
# ==========================================

@api_router.post("/kiosk/check")
async def check_patient_exists(first_name: str, last_name: str, dob: str, postcode: str):
    patient_id = generate_patient_id(first_name, last_name, dob)
    
    patient = await db.patients.find_one({"patient_id": patient_id})
    
    if not patient:
        return {"status": "NOT_FOUND", "id": patient_id, "data": None}
    
    db_postcode = patient.get("postcode", "").replace(" ", "").upper()
    input_postcode = postcode.replace(" ", "").upper()
    
    if db_postcode != input_postcode:
        return {"status": "PARTIAL_MATCH", "id": patient_id, "data": None}
    
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
    patient_id = generate_patient_id(data.first_name, data.last_name, data.dob)
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
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
        await db.patients.update_one({"patient_id": patient_id}, {"$set": patient_data})
        await log_system_event("KIOSK_UPDATE", f"Updated via kiosk", "KIOSK", patient_id)
    else:
        patient_data["registered_at"] = now.isoformat()
        await db.patients.insert_one(patient_data)
        await log_system_event("KIOSK_REGISTER", f"New patient registered via kiosk", "KIOSK", patient_id, "Registration", "", f"{data.first_name} {data.last_name}")
    
    if not data.skip_queue:
        await db.queue.delete_one({"patient_id": patient_id, "date": today})
        
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
        await log_system_event("QUEUE_ADD", f"Added to queue: {data.reason}", "KIOSK", patient_id)
        logger.info(f"Added patient {patient_id} to queue for {today}")
    
    return {"success": True, "patient_id": patient_id}

@api_router.get("/queue")
async def get_queue(user: dict = Depends(verify_token)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    queue = await db.queue.find({"date": today, "status": {"$ne": "DONE"}}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    return queue

@api_router.get("/queue/all")
async def get_all_queue(user: dict = Depends(verify_token)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    queue = await db.queue.find({"date": today}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    return queue

@api_router.post("/queue/{patient_id}/complete")
async def complete_queue_entry(patient_id: str, user: dict = Depends(verify_token)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.queue.update_one({"patient_id": patient_id, "date": today}, {"$set": {"status": "DONE"}})
    await db.patients.update_one({"patient_id": patient_id}, {"$set": {"reason": ""}})
    return {"success": True}

# ==========================================
# VISITS ENDPOINTS
# ==========================================

@api_router.post("/visits")
async def create_visit(data: VisitCreate, user: dict = Depends(verify_token)):
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
    
    # Log new visit
    await log_system_event("NEW_VISIT", f"Treatment: {data.treatment}", user["username"], data.patient_id, "Visit", "", data.treatment)
    
    # Mark queue entry as done
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.queue.update_one({"patient_id": data.patient_id, "date": today}, {"$set": {"status": "DONE"}})
    await db.patients.update_one({"patient_id": data.patient_id}, {"$set": {"reason": ""}})
    
    return {"success": True, "visit_id": visit["visit_id"]}

@api_router.get("/visits/{patient_id}")
async def get_patient_visits(patient_id: str, user: dict = Depends(verify_token)):
    visits = await db.visits.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(100)
    return visits

# ==========================================
# DASHBOARD ENDPOINT
# ==========================================

@api_router.get("/dashboard")
async def get_dashboard_data(user: dict = Depends(verify_token)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    patients = await db.patients.find({}, {"_id": 0}).sort("last_name", 1).to_list(10000)
    queue = await db.queue.find({"date": today, "status": {"$ne": "DONE"}}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    
    visited_ids = set()
    async for visit in db.visits.find({}, {"patient_id": 1}):
        visited_ids.add(visit["patient_id"])
    
    queue_map = {q["patient_id"]: q for q in queue}
    
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
    
    return {"success": True, "all": all_patients, "queue": queue_patients}

# ==========================================
# COMPREHENSIVE REPORTS ENDPOINTS
# ==========================================

@api_router.get("/reports/comprehensive")
async def get_comprehensive_reports(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(verify_token)
):
    """Get all reports data in one call"""
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Get all visits in range
    visits = await db.visits.find({
        "date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }, {"_id": 0}).to_list(50000)
    
    # Get all patients
    patients = await db.patients.find({}, {"_id": 0}).to_list(50000)
    patients_map = {p["patient_id"]: p for p in patients}
    
    # Get queue data for the period
    queue_data = await db.queue.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(50000)
    
    # Calculate date range
    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date)
    total_days = max(1, (end_dt - start_dt).days + 1)
    
    # ==========================================
    # 1. VISIT TRENDS
    # ==========================================
    daily_visits = defaultdict(int)
    weekly_visits = defaultdict(int)
    monthly_visits = defaultdict(int)
    
    for v in visits:
        try:
            dt = datetime.fromisoformat(v["date"].replace("Z", "+00:00"))
            day = dt.strftime("%Y-%m-%d")
            week = dt.strftime("%Y-W%W")
            month = dt.strftime("%Y-%m")
            daily_visits[day] += 1
            weekly_visits[week] += 1
            monthly_visits[month] += 1
        except:
            pass
    
    daily_counts = list(daily_visits.values()) if daily_visits else [0]
    peak_day = max(daily_visits.items(), key=lambda x: x[1]) if daily_visits else ("N/A", 0)
    worst_day = min(daily_visits.items(), key=lambda x: x[1]) if daily_visits else ("N/A", 0)
    avg_daily = round(sum(daily_counts) / total_days, 1)
    
    visit_trends = {
        "daily_stats": dict(sorted(daily_visits.items())),
        "weekly_stats": dict(sorted(weekly_visits.items())),
        "monthly_stats": dict(sorted(monthly_visits.items())),
        "peak_day": {"date": peak_day[0], "count": peak_day[1]},
        "worst_day": {"date": worst_day[0], "count": worst_day[1]},
        "avg_daily": avg_daily,
        "total_visits": len(visits)
    }
    
    # ==========================================
    # 2. CONSULTANT WORKLOAD
    # ==========================================
    consultant_visits = defaultdict(int)
    consultant_weekly = defaultdict(lambda: defaultdict(int))
    
    for v in visits:
        consultant = v.get("consultant", "Unknown")
        consultant_visits[consultant] += 1
        try:
            dt = datetime.fromisoformat(v["date"].replace("Z", "+00:00"))
            week = dt.strftime("%Y-W%W")
            consultant_weekly[consultant][week] += 1
        except:
            pass
    
    total_consultant_visits = sum(consultant_visits.values())
    consultant_stats = []
    for name, count in sorted(consultant_visits.items(), key=lambda x: -x[1]):
        pct = round(count / total_consultant_visits * 100, 1) if total_consultant_visits else 0
        consultant_stats.append({
            "name": name,
            "count": count,
            "percentage": pct,
            "weekly_trend": dict(sorted(consultant_weekly[name].items()))
        })
    
    top_consultant = consultant_stats[0] if consultant_stats else {"name": "N/A", "count": 0}
    
    consultant_workload = {
        "consultants": consultant_stats,
        "top_consultant": top_consultant,
        "total_visits": total_consultant_visits
    }
    
    # ==========================================
    # 3. TREATMENT MIX
    # ==========================================
    treatment_counts = defaultdict(int)
    treatment_monthly = defaultdict(lambda: defaultdict(int))
    
    for v in visits:
        treatment = v.get("treatment", "Unknown")
        treatment_counts[treatment] += 1
        try:
            dt = datetime.fromisoformat(v["date"].replace("Z", "+00:00"))
            month = dt.strftime("%Y-%m")
            treatment_monthly[treatment][month] += 1
        except:
            pass
    
    total_treatments = sum(treatment_counts.values())
    treatment_stats = []
    for name, count in sorted(treatment_counts.items(), key=lambda x: -x[1])[:20]:  # Top 20
        pct = round(count / total_treatments * 100, 1) if total_treatments else 0
        treatment_stats.append({
            "name": name,
            "count": count,
            "percentage": pct,
            "monthly_trend": dict(sorted(treatment_monthly[name].items()))
        })
    
    treatment_mix = {
        "treatments": treatment_stats,
        "total": total_treatments
    }
    
    # ==========================================
    # 4. NEW VS RETURNING PATIENTS
    # ==========================================
    # First visits per patient
    patient_first_visit = {}
    patient_visit_count = defaultdict(int)
    
    all_visits_sorted = sorted(visits, key=lambda x: x.get("date", ""))
    for v in all_visits_sorted:
        pid = v["patient_id"]
        patient_visit_count[pid] += 1
        if pid not in patient_first_visit:
            patient_first_visit[pid] = v["date"]
    
    # New patients in range (first visit in range)
    new_patient_visits = 0
    returning_patient_visits = 0
    patients_with_multiple = 0
    
    for v in visits:
        pid = v["patient_id"]
        first_visit_date = patient_first_visit.get(pid, "")[:10]
        if first_visit_date >= start_date and first_visit_date <= end_date:
            if v["date"][:10] == first_visit_date:
                new_patient_visits += 1
            else:
                returning_patient_visits += 1
        else:
            returning_patient_visits += 1
    
    # Patients with 2+ visits in period
    patients_in_period = set(v["patient_id"] for v in visits)
    for pid in patients_in_period:
        visits_in_period = sum(1 for v in visits if v["patient_id"] == pid)
        if visits_in_period >= 2:
            patients_with_multiple += 1
    
    repeat_rate = round(patients_with_multiple / len(patients_in_period) * 100, 1) if patients_in_period else 0
    
    new_vs_returning = {
        "new_patient_visits": new_patient_visits,
        "returning_visits": returning_patient_visits,
        "unique_patients": len(patients_in_period),
        "repeat_patients": patients_with_multiple,
        "repeat_rate": repeat_rate,
        "new_registrations": await db.patients.count_documents({
            "registered_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
        })
    }
    
    # ==========================================
    # 5. INACTIVE PATIENTS (Lost / Follow-up needed)
    # ==========================================
    today = datetime.now(timezone.utc)
    inactive_60 = []
    inactive_90 = []
    
    for pid, patient in patients_map.items():
        # Find last visit
        patient_visits = [v for v in visits if v["patient_id"] == pid]
        if patient_visits:
            last_visit_date = max(v["date"] for v in patient_visits)
        else:
            # Check all visits
            all_patient_visits = await db.visits.find({"patient_id": pid}, {"date": 1}).sort("date", -1).limit(1).to_list(1)
            if all_patient_visits:
                last_visit_date = all_patient_visits[0]["date"]
            else:
                continue  # No visits ever
        
        try:
            last_dt = datetime.fromisoformat(last_visit_date.replace("Z", "+00:00"))
            days_since = (today - last_dt).days
            
            patient_info = {
                "patient_id": pid,
                "name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}",
                "phone": patient.get("phone", ""),
                "email": patient.get("email", ""),
                "last_visit": last_visit_date[:10],
                "days_since": days_since
            }
            
            if days_since > 90:
                inactive_90.append(patient_info)
            elif days_since > 60:
                inactive_60.append(patient_info)
        except:
            pass
    
    inactive_patients = {
        "over_60_days": sorted(inactive_60, key=lambda x: -x["days_since"]),
        "over_90_days": sorted(inactive_90, key=lambda x: -x["days_since"]),
        "count_60": len(inactive_60),
        "count_90": len(inactive_90)
    }
    
    # ==========================================
    # 6. QUEUE ANALYTICS
    # ==========================================
    queue_by_day = defaultdict(int)
    completed_by_day = defaultdict(int)
    
    for q in queue_data:
        day = q.get("date", "")[:10]
        queue_by_day[day] += 1
        if q.get("status") == "DONE":
            completed_by_day[day] += 1
    
    total_checkins = sum(queue_by_day.values())
    total_completed = sum(completed_by_day.values())
    completion_rate = round(total_completed / total_checkins * 100, 1) if total_checkins else 0
    
    queue_analytics = {
        "daily_checkins": dict(sorted(queue_by_day.items())),
        "daily_completed": dict(sorted(completed_by_day.items())),
        "total_checkins": total_checkins,
        "total_completed": total_completed,
        "completion_rate": completion_rate,
        "avg_checkins_per_day": round(total_checkins / total_days, 1)
    }
    
    # ==========================================
    # 7. ALERTS ANALYTICS
    # ==========================================
    alert_counts = defaultdict(int)
    checkins_with_alerts = 0
    
    for q in queue_data:
        alerts = q.get("alerts", "")
        if alerts:
            checkins_with_alerts += 1
            for alert in alerts.split(", "):
                if alert.strip():
                    alert_counts[alert.strip()] += 1
    
    alert_rate = round(checkins_with_alerts / total_checkins * 100, 1) if total_checkins else 0
    
    alerts_analytics = {
        "top_alerts": sorted([{"alert": k, "count": v} for k, v in alert_counts.items()], key=lambda x: -x["count"])[:10],
        "checkins_with_alerts": checkins_with_alerts,
        "alert_rate": alert_rate,
        "total_checkins": total_checkins
    }
    
    # ==========================================
    # 8. GEOGRAPHIC DISTRIBUTION
    # ==========================================
    city_counts = defaultdict(int)
    city_registrations = defaultdict(lambda: defaultdict(int))
    city_visits = defaultdict(int)
    
    for p in patients:
        city = p.get("city", "Unknown").strip().upper() or "Unknown"
        city_counts[city] += 1
        reg_date = p.get("registered_at", "")[:7]  # YYYY-MM
        if reg_date:
            city_registrations[city][reg_date] += 1
    
    for v in visits:
        pid = v["patient_id"]
        patient = patients_map.get(pid, {})
        city = patient.get("city", "Unknown").strip().upper() or "Unknown"
        city_visits[city] += 1
    
    city_stats = []
    total_patients_geo = sum(city_counts.values())
    for city, count in sorted(city_counts.items(), key=lambda x: -x[1])[:15]:
        pct = round(count / total_patients_geo * 100, 1) if total_patients_geo else 0
        city_stats.append({
            "city": city,
            "patient_count": count,
            "visit_count": city_visits.get(city, 0),
            "percentage": pct,
            "registration_trend": dict(sorted(city_registrations[city].items()))
        })
    
    geographic = {
        "cities": city_stats,
        "total_cities": len(city_counts),
        "total_patients": total_patients_geo
    }
    
    # ==========================================
    # 9. DATA QUALITY
    # ==========================================
    missing_email = 0
    missing_phone = 0
    missing_postcode = 0
    missing_emergency = 0
    completeness_scores = []
    
    email_counts = defaultdict(int)
    phone_counts = defaultdict(int)
    
    for p in patients:
        score = 0
        total_fields = 7  # email, phone, postcode, street, city, emergency_name, emergency_phone
        
        email = p.get("email", "").strip()
        phone = p.get("phone", "").strip()
        postcode = p.get("postcode", "").strip()
        street = p.get("street", "").strip()
        city = p.get("city", "").strip()
        em_name = p.get("emergency_name", "").strip()
        em_phone = p.get("emergency_phone", "").strip()
        
        if email:
            score += 1
            email_counts[email.lower()] += 1
        else:
            missing_email += 1
        
        if phone:
            score += 1
            phone_counts[phone] += 1
        else:
            missing_phone += 1
        
        if postcode:
            score += 1
        else:
            missing_postcode += 1
        
        if street:
            score += 1
        if city:
            score += 1
        
        if em_name and em_phone:
            score += 2
        else:
            missing_emergency += 1
        
        completeness_scores.append(round(score / total_fields * 100))
    
    # Find duplicates
    duplicate_emails = [email for email, count in email_counts.items() if count > 1 and email]
    duplicate_phones = [phone for phone, count in phone_counts.items() if count > 1 and phone]
    
    avg_completeness = round(sum(completeness_scores) / len(completeness_scores), 1) if completeness_scores else 0
    
    data_quality = {
        "missing": {
            "email": missing_email,
            "phone": missing_phone,
            "postcode": missing_postcode,
            "emergency_contact": missing_emergency
        },
        "duplicates": {
            "emails": duplicate_emails[:10],
            "phones": duplicate_phones[:10],
            "email_count": len(duplicate_emails),
            "phone_count": len(duplicate_phones)
        },
        "avg_completeness_score": avg_completeness,
        "total_patients": len(patients)
    }
    
    # ==========================================
    # 10. HOURLY HEATMAP
    # ==========================================
    hourly_stats = {}
    for v in visits:
        try:
            dt = datetime.fromisoformat(v["date"].replace("Z", "+00:00"))
            hour = dt.hour
            day_of_week = dt.weekday()
            key = f"{day_of_week}-{hour}"
            hourly_stats[key] = hourly_stats.get(key, 0) + 1
        except:
            pass
    
    return {
        "success": True,
        "period": {"start": start_date, "end": end_date, "days": total_days},
        "visit_trends": visit_trends,
        "consultant_workload": consultant_workload,
        "treatment_mix": treatment_mix,
        "new_vs_returning": new_vs_returning,
        "inactive_patients": inactive_patients,
        "queue_analytics": queue_analytics,
        "alerts_analytics": alerts_analytics,
        "geographic": geographic,
        "data_quality": data_quality,
        "hourly_heatmap": hourly_stats
    }

@api_router.get("/reports/consultants")
async def get_consultants(user: dict = Depends(verify_token)):
    consultants = await db.visits.distinct("consultant")
    return consultants

# ==========================================
# HEALTH CHECK
# ==========================================

@api_router.get("/")
async def root():
    return {"message": "Just Vitality Clinic API", "version": "2.2"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
