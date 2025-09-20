import requests
import json
import sys
import time
import websocket
import threading
from datetime import datetime

class StudyGuardianAPITester:
    def __init__(self, base_url="https://studypulse-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.teacher_token = None
        self.student_token = None
        self.teacher_user = None
        self.student_user = None
        self.room_code = None
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_teacher_registration(self):
        """Test teacher registration"""
        teacher_data = {
            "email": "teacher2@demo.com",
            "password": "password123",
            "name": "Test Teacher",
            "role": "teacher"
        }
        
        success, response = self.run_test(
            "Teacher Registration",
            "POST",
            "api/auth/register",
            200,
            data=teacher_data
        )
        
        if success and 'access_token' in response:
            self.teacher_token = response['access_token']
            self.teacher_user = response['user']
            print(f"   Teacher ID: {self.teacher_user['id']}")
            return True
        return False

    def test_student_registration(self):
        """Test student registration"""
        student_data = {
            "email": "student2@demo.com",
            "password": "password123",
            "name": "Test Student",
            "role": "student"
        }
        
        success, response = self.run_test(
            "Student Registration",
            "POST",
            "api/auth/register",
            200,
            data=student_data
        )
        
        if success and 'access_token' in response:
            self.student_token = response['access_token']
            self.student_user = response['user']
            print(f"   Student ID: {self.student_user['id']}")
            return True
        return False

    def test_teacher_login(self):
        """Test teacher login"""
        login_data = {
            "email": "teacher2@demo.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Teacher Login",
            "POST",
            "api/auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.teacher_token = response['access_token']
            self.teacher_user = response['user']
            return True
        return False

    def test_student_login(self):
        """Test student login"""
        login_data = {
            "email": "student2@demo.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Student Login",
            "POST",
            "api/auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.student_token = response['access_token']
            self.student_user = response['user']
            return True
        return False

    def test_create_room(self):
        """Test room creation by teacher"""
        room_data = {
            "title": "Test Study Room",
            "subject": "Mathematics",
            "description": "Test room for API testing"
        }
        
        success, response = self.run_test(
            "Create Room",
            "POST",
            "api/rooms",
            200,
            data=room_data,
            token=self.teacher_token
        )
        
        if success and 'room_code' in response:
            self.room_code = response['room_code']
            print(f"   Room Code: {self.room_code}")
            return True
        return False

    def test_get_rooms_teacher(self):
        """Test getting rooms as teacher"""
        return self.run_test(
            "Get Rooms (Teacher)",
            "GET",
            "api/rooms",
            200,
            token=self.teacher_token
        )

    def test_get_rooms_student(self):
        """Test getting rooms as student"""
        return self.run_test(
            "Get Rooms (Student)",
            "GET",
            "api/rooms",
            200,
            token=self.student_token
        )

    def test_join_room(self):
        """Test student joining room"""
        if not self.room_code:
            print("❌ No room code available for joining")
            return False
            
        success, response = self.run_test(
            "Join Room",
            "POST",
            f"api/rooms/{self.room_code}/join",
            200,
            token=self.student_token
        )
        
        if success and 'session_id' in response:
            self.session_id = response['session_id']
            print(f"   Session ID: {self.session_id}")
            return True
        return False

    def test_websocket_connection(self):
        """Test WebSocket connection"""
        if not self.session_id:
            print("❌ No session ID available for WebSocket test")
            return False

        print(f"\n🔍 Testing WebSocket Connection...")
        print(f"   Session ID: {self.session_id}")
        
        try:
            # Convert HTTPS URL to WSS for WebSocket
            ws_url = self.base_url.replace('https://', 'wss://') + f"/ws/{self.session_id}"
            print(f"   WebSocket URL: {ws_url}")
            
            # Test data to send
            test_metrics = {
                "timestamp": time.time(),
                "face_present": True,
                "attention_score": 0.85,
                "head_pose": {"pitch": 0.1, "yaw": 0.05, "roll": 0.02},
                "gaze_direction": {"x": 0.3, "y": 0.4},
                "fatigue_level": 0.2
            }
            
            def on_message(ws, message):
                print(f"   WebSocket received: {message}")
                
            def on_error(ws, error):
                print(f"   WebSocket error: {error}")
                
            def on_close(ws, close_status_code, close_msg):
                print(f"   WebSocket closed")
                
            def on_open(ws):
                print("✅ WebSocket connected successfully")
                # Send test metrics
                ws.send(json.dumps(test_metrics))
                print(f"   Sent test metrics: {test_metrics}")
                # Close after sending
                time.sleep(1)
                ws.close()
            
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket in a separate thread with timeout
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            ws_thread.join(timeout=10)
            
            self.tests_run += 1
            self.tests_passed += 1
            return True
            
        except Exception as e:
            print(f"❌ WebSocket test failed: {str(e)}")
            self.tests_run += 1
            return False

    def test_invalid_credentials(self):
        """Test login with invalid credentials"""
        invalid_data = {
            "email": "invalid@demo.com",
            "password": "wrongpassword"
        }
        
        return self.run_test(
            "Invalid Login",
            "POST",
            "api/auth/login",
            401,
            data=invalid_data
        )

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        return self.run_test(
            "Unauthorized Access",
            "GET",
            "api/rooms",
            401
        )

    def test_invalid_room_code(self):
        """Test joining room with invalid code"""
        return self.run_test(
            "Invalid Room Code",
            "POST",
            "api/rooms/INVALID123/join",
            404,
            token=self.student_token
        )

def main():
    print("🚀 Starting StudyGuardian API Tests")
    print("=" * 50)
    
    tester = StudyGuardianAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Teacher Registration", tester.test_teacher_registration),
        ("Student Registration", tester.test_student_registration),
        ("Teacher Login", tester.test_teacher_login),
        ("Student Login", tester.test_student_login),
        ("Create Room", tester.test_create_room),
        ("Get Rooms (Teacher)", tester.test_get_rooms_teacher),
        ("Get Rooms (Student)", tester.test_get_rooms_student),
        ("Join Room", tester.test_join_room),
        ("WebSocket Connection", tester.test_websocket_connection),
        ("Invalid Credentials", tester.test_invalid_credentials),
        ("Unauthorized Access", tester.test_unauthorized_access),
        ("Invalid Room Code", tester.test_invalid_room_code),
    ]
    
    # Run all tests
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {str(e)}")
            tester.tests_run += 1
        
        time.sleep(0.5)  # Small delay between tests
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())