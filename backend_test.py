#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import time

class JustVitalityAPITester:
    def __init__(self, base_url="https://clinic-manager-171.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_patient_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    self.log(f"   Error: {error_data}")
                except:
                    self.log(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic health endpoints"""
        self.log("\n=== HEALTH CHECK ===")
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)
        
    def test_authentication(self):
        """Test authentication flow"""
        self.log("\n=== AUTHENTICATION ===")
        
        # Test login with correct credentials
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "ADMIN", "password": "vit2025"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.log(f"✅ Token obtained: {self.token[:20]}...")
            
            # Test token validation
            self.run_test("Get Current User", "GET", "auth/me", 200)
            
            return True
        else:
            self.log("❌ Failed to get authentication token")
            return False
            
    def test_kiosk_flow(self):
        """Test the complete kiosk registration flow - CRITICAL TEST"""
        self.log("\n=== KIOSK REGISTRATION FLOW ===")
        
        # Generate unique test data
        timestamp = datetime.now().strftime("%H%M%S")
        test_data = {
            "first_name": f"TEST{timestamp}",
            "last_name": "PATIENT",
            "dob": "1990-01-01",
            "postcode": "SW1A 1AA",
            "phone": "07700900123",
            "email": f"test{timestamp}@example.com",
            "street": "123 Test Street",
            "city": "London",
            "emergency_name": "Emergency Contact",
            "emergency_phone": "07700900456",
            "reason": "Test visit for automated testing",
            "medications": "None",
            "allergies": "NKDA",
            "conditions": "",
            "surgeries": "",
            "procedures": "",
            "alerts": "",
            "skip_queue": False
        }
        
        # Step 1: Check if patient exists (should not exist)
        success, response = self.run_test(
            "Kiosk Check - New Patient",
            "POST",
            "kiosk/check",
            200,
            data={
                "first_name": test_data["first_name"],
                "last_name": test_data["last_name"], 
                "dob": test_data["dob"],
                "postcode": test_data["postcode"]
            }
        )
        
        if success and response.get("status") == "NOT_FOUND":
            self.log("✅ New patient correctly identified")
        else:
            self.log(f"⚠️ Unexpected check result: {response}")
            
        # Step 2: Register patient through kiosk
        success, response = self.run_test(
            "Kiosk Registration",
            "POST", 
            "kiosk/register",
            200,
            data=test_data
        )
        
        if success and response.get("success"):
            self.test_patient_id = response.get("patient_id")
            self.log(f"✅ Patient registered with ID: {self.test_patient_id}")
            
            # Step 3: CRITICAL - Check if patient appears in queue
            time.sleep(1)  # Brief delay to ensure data consistency
            success, queue_response = self.run_test(
                "Check Queue After Registration",
                "GET",
                "queue",
                200
            )
            
            if success:
                queue_patients = queue_response if isinstance(queue_response, list) else []
                patient_in_queue = any(p.get("patient_id") == self.test_patient_id for p in queue_patients)
                
                if patient_in_queue:
                    self.log("✅ CRITICAL: Patient appears in queue after registration!")
                    self.tests_passed += 1
                else:
                    self.log("❌ CRITICAL BUG: Patient NOT in queue after registration!")
                    self.log(f"   Queue contents: {queue_patients}")
                    
                self.tests_run += 1
                return patient_in_queue
            else:
                self.log("❌ Failed to check queue")
                return False
        else:
            self.log("❌ Patient registration failed")
            return False
            
    def test_patient_management(self):
        """Test patient management endpoints"""
        self.log("\n=== PATIENT MANAGEMENT ===")
        
        # Get all patients
        self.run_test("Get All Patients", "GET", "patients", 200)
        
        if self.test_patient_id:
            # Get specific patient
            self.run_test(
                "Get Test Patient", 
                "GET", 
                f"patients/{self.test_patient_id}", 
                200
            )
            
            # Update patient
            update_data = {
                "phone": "07700900999",
                "medications": "Updated medications"
            }
            self.run_test(
                "Update Patient",
                "PUT",
                f"patients/{self.test_patient_id}",
                200,
                data=update_data
            )
            
            # Get patient audit log
            self.run_test(
                "Get Patient Audit",
                "GET", 
                f"patients/{self.test_patient_id}/audit",
                200
            )
            
    def test_visit_management(self):
        """Test visit creation and management"""
        self.log("\n=== VISIT MANAGEMENT ===")
        
        if self.test_patient_id:
            # Create a visit
            visit_data = {
                "patient_id": self.test_patient_id,
                "treatment": "IV Vitamin Infusion",
                "notes": "Test visit created by automated testing",
                "consultant": "ADMIN"
            }
            
            success, response = self.run_test(
                "Create Visit",
                "POST",
                "visits",
                200,
                data=visit_data
            )
            
            if success:
                # Get patient visits
                self.run_test(
                    "Get Patient Visits",
                    "GET",
                    f"visits/{self.test_patient_id}",
                    200
                )
                
    def test_dashboard_data(self):
        """Test dashboard data endpoint"""
        self.log("\n=== DASHBOARD DATA ===")
        self.run_test("Get Dashboard Data", "GET", "dashboard", 200)
        
    def test_analytics_endpoints(self):
        """Test analytics and reporting endpoints"""
        self.log("\n=== ANALYTICS & REPORTS ===")
        
        # Get reports summary
        self.run_test("Reports Summary", "GET", "reports/summary", 200)
        
        # Get consultants list
        self.run_test("Get Consultants", "GET", "reports/consultants", 200)
        
        # Get visits report
        self.run_test("Visits Report", "GET", "reports/visits", 200)
        
    def test_queue_management(self):
        """Test queue management"""
        self.log("\n=== QUEUE MANAGEMENT ===")
        
        # Get current queue
        self.run_test("Get Current Queue", "GET", "queue", 200)
        
        # Get all queue (including completed)
        self.run_test("Get All Queue", "GET", "queue/all", 200)
        
        if self.test_patient_id:
            # Complete queue entry
            self.run_test(
                "Complete Queue Entry",
                "POST",
                f"queue/{self.test_patient_id}/complete",
                200
            )

def main():
    """Main test execution"""
    print("🏥 Just Vitality Clinic API Testing")
    print("=" * 50)
    
    tester = JustVitalityAPITester()
    
    # Run test suite
    tester.test_health_check()
    
    if not tester.test_authentication():
        print("\n❌ Authentication failed - stopping tests")
        return 1
        
    # Core functionality tests
    tester.test_kiosk_flow()  # MOST CRITICAL TEST
    tester.test_patient_management()
    tester.test_visit_management()
    tester.test_queue_management()
    tester.test_dashboard_data()
    tester.test_analytics_endpoints()
    
    # Print results
    print(f"\n📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("✅ All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())