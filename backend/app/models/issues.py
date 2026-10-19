"""Data models for issues, warnings, and validation results."""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class Issue(BaseModel):
    """Represents a specific discrepancy, rule violation, math error, or missing field."""

    id: str = Field(..., description="Unique issue identifier")
    severity: str = Field(..., description="'critical' | 'warning' | 'info'")
    category: str = Field(
        ...,
        description="'math_error' | 'conflict' | 'missing' | 'rule_violation' | 'assumption'",
    )
    title: str = Field(..., description="Short title describing the issue")
    description: str = Field(..., description="Detailed explanation of the issue")
    field_name: Optional[str] = Field(None, description="Related brief field key if applicable")
    source: str = Field("validation_engine", description="Where the issue originated")
    suggestion: Optional[str] = Field(None, description="Actionable recommendation to resolve the issue")


class ValidationResult(BaseModel):
    """Aggregate result from deterministic and AI checks."""

    issues: List[Issue] = Field(default_factory=list, description="List of detected issues")
    passed: bool = Field(True, description="True if no critical issues are found")
    summary: Dict[str, int] = Field(
        default_factory=lambda: {"critical": 0, "warning": 0, "info": 0},
        description="Issue count breakdown by severity",
    )
