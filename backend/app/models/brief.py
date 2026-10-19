"""Packaging Brief data models."""

from typing import Any, Optional, List, Dict
from pydantic import BaseModel, Field


class BriefField(BaseModel):
    """Represents a single field inside a packaging brief section."""

    field_name: str = Field(..., description="Unique technical field key, e.g. 'product_name'")
    label: Optional[str] = Field(None, description="Human-readable label, e.g. 'Product Name'")
    value: Any = Field(None, description="Extracted or computed value")
    source: str = Field("unknown", description="Extraction origin, e.g. 'PDF front panel' or 'Excel Notes'")
    confidence: str = Field("medium", description="'high' | 'medium' | 'low'")
    status: str = Field("confirmed", description="'confirmed' | 'flagged' | 'missing' | 'conflicting'")
    issues: List[str] = Field(default_factory=list, description="List of issue descriptions for this field")
    user_override: Optional[Any] = Field(None, description="Value manually overridden by user if any")


class BriefSection(BaseModel):
    """Represents a logical section of a packaging brief."""

    section_name: str = Field(..., description="E.g. 'Label Information', 'Product Overview', etc.")
    fields: List[BriefField] = Field(default_factory=list, description="Fields contained in this section")


class PackagingBrief(BaseModel):
    """Represents the complete packaging design brief document."""

    session_id: str = Field(..., description="Session identifier")
    product_name: str = Field("Untitled Product", description="Main product title")
    created_at: str = Field(..., description="ISO timestamp of creation")
    updated_at: Optional[str] = Field(None, description="ISO timestamp of latest update")
    status: str = Field("draft", description="'draft' | 'in_review' | 'finalized'")
    sections: List[BriefSection] = Field(default_factory=list, description="All standard sections")
    open_questions: List[str] = Field(default_factory=list, description="Unresolved questions for brand/designer")
    issues_summary: Dict[str, int] = Field(
        default_factory=lambda: {"critical": 0, "warning": 0, "info": 0},
        description="Count of issues grouped by severity",
    )

    def get_field(self, field_name: str) -> Optional[BriefField]:
        """Find a field by its field_name across all sections."""
        for section in self.sections:
            for field in section.fields:
                if field.field_name == field_name:
                    return field
        return None

    def get_field_value(self, field_name: str, default: Any = None) -> Any:
        """Get the effective value of a field (user_override if present, else value)."""
        field = self.get_field(field_name)
        if field is None:
            return default
        if field.user_override is not None:
            return field.user_override
        return field.value if field.value is not None else default

    def set_field_value(
        self,
        field_name: str,
        new_value: Any,
        is_override: bool = True,
        status: Optional[str] = None,
    ) -> bool:
        """Update an existing field's value or user_override."""
        field = self.get_field(field_name)
        if field is not None:
            if is_override:
                field.user_override = new_value
                field.status = status or "confirmed"
            else:
                field.value = new_value
                if status:
                    field.status = status
            return True
        return False
