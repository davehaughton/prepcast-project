
# Shared pytest fixtures

import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture
def client(tmp_path):
  
    tmp_db = tmp_path / "test.db"
    shutil.copy(ROOT / "prepcast.db", tmp_db)

  
    import app
    import db
    app.DB = str(tmp_db)
    db.DB = str(tmp_db)

  
    app.app.config["TESTING"] = True
    with app.app.test_client() as c:
        yield c
