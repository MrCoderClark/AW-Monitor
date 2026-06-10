from app.config_store.encryption import decrypt_value, encrypt_value


def test_encrypt_decrypt_roundtrip():
    plaintext = "my-secret-password"
    encrypted = encrypt_value(plaintext)
    assert encrypted != plaintext
    assert decrypt_value(encrypted) == plaintext


def test_encrypted_values_differ():
    encrypted1 = encrypt_value("same-value")
    encrypted2 = encrypt_value("same-value")
    assert encrypted1 != encrypted2


def test_decrypt_both():
    e1 = encrypt_value("same-value")
    e2 = encrypt_value("same-value")
    assert decrypt_value(e1) == "same-value"
    assert decrypt_value(e2) == "same-value"
