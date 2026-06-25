from pydantic import BaseModel, Field, model_validator, computed_field
from typing import Optional, List
from datetime import datetime


class EnrichmentRequest(BaseModel):
    nombre: Optional[str] = Field(default=None)
    apellido_paterno: Optional[str] = Field(default=None)
    apellido_materno: Optional[str] = Field(default=None)
    curp: Optional[str] = Field(default=None, max_length=18)
    rfc: Optional[str] = Field(default=None, max_length=13)
    telefono: Optional[str] = Field(default=None, max_length=15)
    operador_id: str = "OP-001"

    @computed_field
    @property
    def nombre_completo(self) -> Optional[str]:
        parts = [p for p in [self.nombre, self.apellido_paterno, self.apellido_materno] if p]
        return " ".join(parts) if parts else None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "EnrichmentRequest":
        has_nombre = any([self.nombre, self.apellido_paterno, self.apellido_materno])
        if not any([has_nombre, self.curp, self.rfc, self.telefono]):
            raise ValueError("Se requiere al menos un campo: nombre, CURP, RFC o teléfono.")
        return self


class EnrichmentResponse(BaseModel):
    request_id: str
    status: str


class SocialMediaEntry(BaseModel):
    platform: str
    url: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = None
    followers: Optional[int] = None
    public_posts_sample: List[str] = []


class NewsMention(BaseModel):
    title: str
    source: str
    date: Optional[str] = None
    url: Optional[str] = None
    sentiment: Optional[str] = None  # positive | neutral | negative


class PublicRecord(BaseModel):
    type: str
    source: str
    date: Optional[str] = None
    description: str
    url: Optional[str] = None


class LoanEntry(BaseModel):
    id: str
    amount: float
    date: str
    status: str
    days_overdue: int


class Reference(BaseModel):
    name: str
    relationship: str
    phone: str


class EmploymentInfo(BaseModel):
    is_government_employee: Optional[bool] = None
    government_entity: Optional[str] = None
    nss: Optional[str] = None
    employment_status: Optional[str] = None  # activo | inactivo | desconocido
    evidence: List[str] = []


class RiskSummary(BaseModel):
    blacklist_hit: bool = False
    judicial_records: bool = False
    digital_presence_score: int = 0
    identity_consistency: bool = True
    overall_risk: str = "low"


class PublicProfile(BaseModel):
    social_media: List[SocialMediaEntry] = []
    news_mentions: List[NewsMention] = []
    public_records: List[PublicRecord] = []


class InternalHistory(BaseModel):
    loans: List[LoanEntry] = []
    payment_score: Optional[int] = None
    references: List[Reference] = []


class SourceStatus(BaseModel):
    source: str
    status: str  # success | not_found | error | timeout
    duration_ms: int


class EnrichedProfile(BaseModel):
    request_id: str
    created_at: str
    status: str
    processing_duration_ms: Optional[int] = None
    input: dict
    ai_summary: Optional[str] = None
    employment_info: EmploymentInfo = EmploymentInfo()
    risk_summary: RiskSummary = RiskSummary()
    public_profile: PublicProfile = PublicProfile()
    internal_history: InternalHistory = InternalHistory()
    sources_queried: List[SourceStatus] = []


class ProfileListItem(BaseModel):
    request_id: str
    created_at: str
    status: str
    input: dict
    risk_summary: Optional[RiskSummary] = None


class ProfileListResponse(BaseModel):
    total: int
    page: int
    pages: int
    items: List[dict]


class StatsResponse(BaseModel):
    total_searches: int
    avg_processing_time_ms: float
    risk_distribution: dict
