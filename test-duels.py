#!/usr/bin/env python3
"""
Test script for asynchronous duel system
"""
import requests
import json
import time

# Test configuration
API_BASE = "https://app.proofofputt.com/api"
TEST_PLAYERS = {
    1: {"name": "Pop", "token": "test-token-1"},
    2: {"name": "Tiger", "token": "test-token-2"}
}

class DuelTester:
    def __init__(self):
        self.created_duels = []
        
    def make_request(self, method, endpoint, player_id, data=None, params=None):
        """Make authenticated request"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TEST_PLAYERS[player_id]['token']}"
        }
        
        url = f"{API_BASE}/{endpoint}"
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=data, params=params, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=30)
                
            return response
            
        except Exception as e:
            print(f"❌ REQUEST FAILED: {e}")
            return None

    def test_create_duel(self):
        """Test creating a duel challenge"""
        print("\n=== Test: Create Duel Challenge ===")
        
        duel_rules = {
            "duel_type": "standard",
            "time_limit_hours": 48,
            "scoring_method": "total_makes",
            "target_putts": 50
        }
        
        response = self.make_request('POST', 'duels-v2', 1, {
            "challenged_id": 2,
            "rules": duel_rules
        })
        
        if response and response.status_code == 201:
            result = response.json()
            print(f"✅ Duel created successfully!")
            print(f"   Duel ID: {result['duel']['duel_id']}")
            print(f"   Challenger: Player {result['duel']['challenger_id']}")
            print(f"   Challenged: Player {result['duel']['challenged_id']}")
            print(f"   Status: {result['duel']['status']}")
            print(f"   Rules: {result['duel']['rules']['scoring_method']}")
            
            self.created_duels.append(result['duel']['duel_id'])
            return result['duel']['duel_id']
        else:
            print(f"❌ Failed to create duel: {response.status_code if response else 'No response'}")
            if response:
                print(f"   Response: {response.text}")
            return None

    def test_list_duels(self, player_id):
        """Test listing player's duels"""
        print(f"\n=== Test: List Duels for Player {player_id} ===")
        
        response = self.make_request('GET', 'duels-v2', player_id)
        
        if response and response.status_code == 200:
            result = response.json()
            print(f"✅ Found {result['total']} duels")
            
            for duel in result['duels']:
                print(f"   Duel {duel['duel_id']}: {duel['challenger_name']} vs {duel['challenged_name']}")
                print(f"   Status: {duel['status']} | Submitted: {duel['has_submitted']} | Opponent: {duel['opponent_submitted']}")
                
            return result['duels']
        else:
            print(f"❌ Failed to list duels: {response.status_code if response else 'No response'}")
            if response:
                print(f"   Response: {response.text}")
            return []

    def test_accept_duel(self, duel_id):
        """Test accepting a duel challenge"""
        print(f"\n=== Test: Accept Duel {duel_id} ===")
        
        response = self.make_request('PUT', 'duels-v2', 2, {
            "action": "accept"
        }, {"duelId": duel_id})
        
        if response and response.status_code == 200:
            result = response.json()
            print(f"✅ Duel accepted successfully!")
            print(f"   Status: {result['status']}")
            print(f"   Message: {result['message']}")
            return True
        else:
            print(f"❌ Failed to accept duel: {response.status_code if response else 'No response'}")
            if response:
                print(f"   Response: {response.text}")
            return False

    def test_submit_session(self, duel_id, player_id, session_id):
        """Test submitting a session for a duel"""
        print(f"\n=== Test: Submit Session for Duel {duel_id} (Player {player_id}) ===")
        
        response = self.make_request('PUT', 'duels-v2', player_id, {
            "action": "submit",
            "session_id": session_id
        }, {"duelId": duel_id})
        
        if response and response.status_code == 200:
            result = response.json()
            print(f"✅ Session submitted successfully!")
            print(f"   Status: {result['status']}")
            print(f"   Message: {result['message']}")
            
            if 'winner_id' in result:
                print(f"   Winner: Player {result['winner_id']} ({result['result']})")
                
            return True
        else:
            print(f"❌ Failed to submit session: {response.status_code if response else 'No response'}")
            if response:
                print(f"   Response: {response.text}")
            return False

    def test_cancel_duel(self, duel_id, player_id):
        """Test cancelling a duel"""
        print(f"\n=== Test: Cancel Duel {duel_id} (Player {player_id}) ===")
        
        response = self.make_request('DELETE', 'duels-v2', player_id, params={"duelId": duel_id})
        
        if response and response.status_code == 200:
            result = response.json()
            print(f"✅ Duel cancelled successfully!")
            print(f"   Message: {result['message']}")
            return True
        else:
            print(f"❌ Failed to cancel duel: {response.status_code if response else 'No response'}")
            if response:
                print(f"   Response: {response.text}")
            return False

    def create_test_session(self, player_id):
        """Create a test session for duel submission"""
        print(f"\n=== Creating Test Session for Player {player_id} ===")
        
        test_session_data = {
            "report_generated_at": f"25090{player_id}1400", 
            "session_duration": 120.0 + (player_id * 10),  # Slightly different durations
            "total_putts": 40 + (player_id * 5),
            "total_makes": 28 + (player_id * 3),
            "make_percentage": 70.0 + (player_id * 2.5),
            "total_misses": 12 - player_id,
            "miss_percentage": 30.0 - (player_id * 2.5),
            "best_streak": 8 + player_id,
            "putts_per_minute": 12.0 + player_id,
            "makes_per_minute": 8.5 + player_id,
            "most_makes_in_60_seconds": 18 + player_id,
            "fastest_21_makes": 95.0 - (player_id * 5),
            "makes_by_category": {
                "MAKE - TOP: CENTER": 8 + player_id,
                "MAKE - LOW: CENTER": 6 + player_id,
                "MAKE - LEFT: CENTER": 7,
                "MAKE - RIGHT: CENTER": 7 + player_id
            },
            "misses_by_category": {
                "MISS - CATCH: CENTER - CENTER": 4,
                "MISS - RETURN: LEFT - CENTER": 3,
                "MISS - TIMEOUT: RIGHT - RIGHT": 5 - player_id
            },
            "makes_overview": {"TOP": 8 + player_id, "LOW": 6 + player_id, "LEFT": 7, "RIGHT": 7 + player_id},
            "misses_overview": {"CATCH": 4, "TIMEOUT": 3, "RETURN": 5 - player_id, "QUICK PUTT": 0},
            "consecutive_by_category": {"3": 3, "7": 1, "10": 0}
        }

        # Upload session
        response = requests.post(
            f"{API_BASE}/upload-session",
            headers={"Content-Type": "application/json", "x-desktop-upload": "true"},
            json={"player_id": player_id, "session_data": test_session_data},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            session_id = result['session_id']
            print(f"✅ Test session created: {session_id}")
            print(f"   Player {player_id} Stats: {test_session_data['total_makes']} makes, {test_session_data['best_streak']} streak")
            return session_id
        else:
            print(f"❌ Failed to create test session: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    def run_complete_duel_test(self):
        """Run a complete duel lifecycle test"""
        print("🎯 TESTING COMPLETE DUEL SYSTEM")
        print("=" * 50)
        
        # 1. Create duel challenge
        duel_id = self.test_create_duel()
        if not duel_id:
            print("❌ Cannot continue without duel creation")
            return False
        
        # 2. List duels for both players
        challenger_duels = self.test_list_duels(1)
        challenged_duels = self.test_list_duels(2)
        
        # 3. Accept duel (Player 2)
        if not self.test_accept_duel(duel_id):
            print("❌ Cannot continue without duel acceptance")
            return False
        
        # 4. Create test sessions for both players
        challenger_session = self.create_test_session(1)
        challenged_session = self.create_test_session(2)
        
        if not challenger_session or not challenged_session:
            print("❌ Cannot continue without test sessions")
            return False
        
        # 5. Submit sessions (Player 2 first)
        if not self.test_submit_session(duel_id, 2, challenged_session):
            print("❌ Player 2 session submission failed")
            return False
        
        # 6. Submit challenger session (should complete duel)
        if not self.test_submit_session(duel_id, 1, challenger_session):
            print("❌ Player 1 session submission failed")
            return False
        
        # 7. Check final duel status
        print("\n=== Final Duel Status ===")
        final_duels = self.test_list_duels(1)
        
        completed_duel = next((d for d in final_duels if d['duel_id'] == duel_id), None)
        if completed_duel:
            print(f"✅ Duel completed successfully!")
            print(f"   Status: {completed_duel['status']}")
            if completed_duel.get('winner_id'):
                winner_name = TEST_PLAYERS[completed_duel['winner_id']]['name']
                print(f"   Winner: {winner_name} (Player {completed_duel['winner_id']})")
            else:
                print(f"   Result: Tie")
        
        return True

if __name__ == "__main__":
    tester = DuelTester()
    
    print("Note: This test requires authentication tokens to be configured")
    print("For now, testing the API structure without full auth...")
    
    # Test basic endpoint availability
    try:
        response = requests.get(f"{API_BASE}/duels-v2", timeout=5)
        if response.status_code == 401:
            print("✅ Duel endpoint is deployed and requires authentication")
        elif response.status_code == 404:
            print("❌ Duel endpoint not found - needs deployment")
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Endpoint test failed: {e}")
    
    # Note: Full testing requires proper authentication setup
    # tester.run_complete_duel_test()