import uuid

from app.auth.jwt import create_access_token, create_refresh_token, decode_access_token


def test_create_and_decode_access_token():
    user_id = uuid.uuid4()
    token = create_access_token(user_id=str(user_id), role="ADMIN")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "ADMIN"


def test_access_token_has_expiry():
    token = create_access_token(user_id="test-id", role="USER")
    payload = decode_access_token(token)
    assert "exp" in payload


def test_decode_invalid_token():
    payload = decode_access_token("invalid.token.here")
    assert payload is None


def test_create_refresh_token_is_unique():
    t1 = create_refresh_token()
    t2 = create_refresh_token()
    assert t1 != t2
