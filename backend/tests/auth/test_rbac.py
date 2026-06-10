from app.auth.rbac import ROLE_HIERARCHY


def test_role_hierarchy_order():
    assert ROLE_HIERARCHY["SUPER_ADMIN"] > ROLE_HIERARCHY["ADMIN"]
    assert ROLE_HIERARCHY["ADMIN"] > ROLE_HIERARCHY["MANAGER"]
    assert ROLE_HIERARCHY["MANAGER"] > ROLE_HIERARCHY["USER"]


def test_all_roles_present():
    expected = {"SUPER_ADMIN", "ADMIN", "MANAGER", "USER"}
    assert set(ROLE_HIERARCHY.keys()) == expected
