import os
import tempfile
from pathlib import Path

# Must be set before `app` is imported: settings and the engine are created at import time.
_tmp = Path(tempfile.mkdtemp())
os.environ["DB_PATH"] = str(_tmp / "test.db")
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 32
