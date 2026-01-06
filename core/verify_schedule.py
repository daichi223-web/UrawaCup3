import requests
import sys

BASE_URL = "http://localhost:8001"

def test_schedule_endpoint():
    print("Testing /schedule endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/schedule")
        if response.status_code == 200 and "<!DOCTYPE html>" in response.text:
            print("✓ /schedule Endpoint: OK")
        else:
            print(f"✗ /schedule Endpoint: FAILED (Status: {response.status_code})")
            sys.exit(1)
    except Exception as e:
        print(f"✗ /schedule Endpoint: ERROR ({str(e)})")
        sys.exit(1)

if __name__ == "__main__":
    test_schedule_endpoint()
