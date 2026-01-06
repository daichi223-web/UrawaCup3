import requests
import sys

BASE_URL = "http://localhost:8001"

def test_daily_report():
    print("Testing /daily-report/sample...")
    try:
        response = requests.get(f"{BASE_URL}/daily-report/sample")
        if response.status_code == 200 and response.headers['content-type'] == 'application/pdf':
            print("✓ Daily Report Sample: OK")
            with open("test_daily_report.pdf", "wb") as f:
                f.write(response.content)
        else:
            print(f"✗ Daily Report Sample: FAILED (Status: {response.status_code})")
            print(response.text)
            sys.exit(1)
    except Exception as e:
        print(f"✗ Daily Report Sample: ERROR ({str(e)})")
        sys.exit(1)

def test_final_results():
    print("Testing /final-results/sample...")
    try:
        response = requests.get(f"{BASE_URL}/final-results/sample")
        if response.status_code == 200 and response.headers['content-type'] == 'application/pdf':
            print("✓ Final Results Sample: OK")
            with open("test_final_results.pdf", "wb") as f:
                f.write(response.content)
        else:
            print(f"✗ Final Results Sample: FAILED (Status: {response.status_code})")
            print(response.text)
            sys.exit(1)
    except Exception as e:
        print(f"✗ Final Results Sample: ERROR ({str(e)})")
        sys.exit(1)

if __name__ == "__main__":
    test_daily_report()
    test_final_results()
    print("All tests passed.")
