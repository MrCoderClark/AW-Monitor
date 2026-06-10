from app.ingestion.service import derive_backup_status


def test_derive_status_success():
    assert derive_backup_status(files_copied=10, pcs_failed=[]) == "SUCCESS"
    assert derive_backup_status(files_copied=10, pcs_failed=None) == "SUCCESS"


def test_derive_status_partial():
    assert derive_backup_status(files_copied=5, pcs_failed=["PC1"]) == "PARTIAL"


def test_derive_status_failure():
    assert derive_backup_status(files_copied=0, pcs_failed=["PC1"]) == "FAILURE"


def test_derive_status_no_files():
    assert derive_backup_status(files_copied=0, pcs_failed=[]) == "NO_FILES"
    assert derive_backup_status(files_copied=0, pcs_failed=None) == "NO_FILES"
