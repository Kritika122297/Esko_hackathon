"""In-memory session storage for BriefForge."""

from typing import Dict, Any, Optional, List
from threading import Lock

from app.models.brief import PackagingBrief
from app.models.extraction import ExtractedData
from app.models.issues import ValidationResult


class SessionStore:
    """Manages in-memory storage of uploaded file extractions, briefs, and validation results."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()

    def create_session(self, session_id: str) -> Dict[str, Any]:
        """Initializes a new session entry."""
        with self._lock:
            session_data = {
                "session_id": session_id,
                "extracted_data": ExtractedData(session_id=session_id),
                "brief": None,
                "validation": None,
                "uploaded_files": [],
            }
            self._sessions[session_id] = session_data
            return session_data

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves raw session dictionary by session_id."""
        with self._lock:
            return self._sessions.get(session_id)

    def set_extracted_data(self, session_id: str, data: ExtractedData) -> None:
        """Stores extracted data for a session."""
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = {"session_id": session_id}
            self._sessions[session_id]["extracted_data"] = data

    def get_extracted_data(self, session_id: str) -> Optional[ExtractedData]:
        """Retrieves extracted data for a session."""
        with self._lock:
            sess = self._sessions.get(session_id)
            return sess.get("extracted_data") if sess else None

    def set_brief(self, session_id: str, brief: PackagingBrief) -> None:
        """Stores or updates the packaging brief for a session."""
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = {"session_id": session_id}
            self._sessions[session_id]["brief"] = brief

    def get_brief(self, session_id: str) -> Optional[PackagingBrief]:
        """Retrieves current packaging brief for a session."""
        with self._lock:
            sess = self._sessions.get(session_id)
            return sess.get("brief") if sess else None

    def set_validation(self, session_id: str, validation: ValidationResult) -> None:
        """Stores validation result."""
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = {"session_id": session_id}
            self._sessions[session_id]["validation"] = validation

    def get_validation(self, session_id: str) -> Optional[ValidationResult]:
        """Retrieves validation result."""
        with self._lock:
            sess = self._sessions.get(session_id)
            return sess.get("validation") if sess else None

    def add_uploaded_file(self, session_id: str, file_info: Dict[str, Any]) -> None:
        """Appends uploaded file metadata."""
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = {
                    "session_id": session_id,
                    "extracted_data": ExtractedData(session_id=session_id),
                    "uploaded_files": [],
                }
            if "uploaded_files" not in self._sessions[session_id]:
                self._sessions[session_id]["uploaded_files"] = []
            self._sessions[session_id]["uploaded_files"].append(file_info)

    def list_sessions(self) -> List[str]:
        """Lists all active session IDs."""
        with self._lock:
            return list(self._sessions.keys())


# Singleton session store
session_store = SessionStore()
