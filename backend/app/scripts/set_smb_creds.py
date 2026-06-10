"""One-off script to set SMB credentials via the API."""

import httpx
import sys

BASE = "http://localhost:8001"
EMAIL = "admin@americaworks.com"
PASSWORD = "Admin123!"

SMB_USERNAME = "infotech"
SMB_PASSWORD = input("Enter SMB password for 'infotech': ") if len(sys.argv) < 2 else sys.argv[1]


def main():
    with httpx.Client(base_url=BASE) as c:
        r = c.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        r.raise_for_status()
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        for ns_key, value in [
            ("smb/username", SMB_USERNAME),
            ("smb/password", SMB_PASSWORD),
        ]:
            namespace, key = ns_key.split("/")
            r = c.put(f"/api/config/{namespace}/{key}", json={"value": value}, headers=headers)
            r.raise_for_status()
            print(f"OK {namespace}/{key} = {r.json()['value']}")

        print("\nCredentials updated. Triggering full health recheck...")
        r = c.post("/api/pcs/check-all", headers=headers, timeout=120)
        r.raise_for_status()
        print(r.json()["message"])

    print("Done.")


if __name__ == "__main__":
    main()
