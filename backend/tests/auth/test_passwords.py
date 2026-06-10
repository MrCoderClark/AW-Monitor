from app.auth.passwords import hash_password, verify_password, validate_password_strength


def test_hash_and_verify():
    hashed = hash_password("SecurePass123!")
    assert hashed != "SecurePass123!"
    assert verify_password("SecurePass123!", hashed)


def test_verify_wrong_password():
    hashed = hash_password("SecurePass123!")
    assert not verify_password("WrongPassword1!", hashed)


def test_validate_strength_valid():
    errors = validate_password_strength("SecurePass123!")
    assert errors == []


def test_validate_strength_too_short():
    errors = validate_password_strength("Short1!")
    assert any("12 characters" in e for e in errors)


def test_validate_strength_no_uppercase():
    errors = validate_password_strength("securepass123!")
    assert any("uppercase" in e for e in errors)


def test_validate_strength_no_lowercase():
    errors = validate_password_strength("SECUREPASS123!")
    assert any("lowercase" in e for e in errors)


def test_validate_strength_no_digit():
    errors = validate_password_strength("SecurePassword!")
    assert any("digit" in e for e in errors)


def test_validate_strength_no_special():
    errors = validate_password_strength("SecurePass1234")
    assert any("special" in e for e in errors)
