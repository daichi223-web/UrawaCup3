"""
Pydanticスキーマ
"""

from .tournament import (
    TournamentBase,
    TournamentCreate,
    TournamentUpdate,
    TournamentResponse,
    TournamentListResponse,
    GroupResponse,
)
from .team import (
    TeamBase,
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamListResponse,
)
from .match import (
    MatchBase,
    MatchCreate,
    MatchUpdate,
    MatchResponse,
    MatchListResponse,
    ScoreInput,
    GoalInput,
    LockResponse,
)
from .standing import (
    StandingResponse,
    GroupStandings,
    ScorerRanking,
    StandingWithTeam,
)
from .exclusion import (
    ExclusionPairCreate,
    ExclusionPairResponse,
    GroupExclusions,
)
from .report import (
    ReportRecipientCreate,
    ReportRecipientResponse,
    SenderSettingsUpdate,
    SenderSettingsResponse,
    MatchReport,
    GoalReport,
    ReportData,
    DailyReportRequest,
)
from .common import (
    CamelCaseModel,
    ApiResponse,
    ApiErrorResponse,
    PaginationParams,
    PaginatedResponse,
)
from .goal import (
    GoalBase,
    GoalCreate,
    GoalUpdate,
    GoalInput as GoalInputSchema,
    GoalResponse,
    GoalDetail,
)
from .group import (
    GroupBase,
    GroupCreate,
    GroupResponse as GroupSchemaResponse,
    GroupWithDetails,
)
from .team_uniform import (
    TeamUniformBase,
    TeamUniformCreate,
    TeamUniformUpdate,
    TeamUniformResponse,
    TeamUniformList,
)

__all__ = [
    # Tournament
    "TournamentBase",
    "TournamentCreate",
    "TournamentUpdate",
    "TournamentResponse",
    "TournamentListResponse",
    "GroupResponse",
    # Team
    "TeamBase",
    "TeamCreate",
    "TeamUpdate",
    "TeamResponse",
    "TeamListResponse",
    # Match
    "MatchBase",
    "MatchCreate",
    "MatchUpdate",
    "MatchResponse",
    "MatchListResponse",
    "ScoreInput",
    "GoalInput",
    "LockResponse",
    # Standing
    "StandingResponse",
    "GroupStandings",
    "ScorerRanking",
    "StandingWithTeam",
    # Exclusion
    "ExclusionPairCreate",
    "ExclusionPairResponse",
    "GroupExclusions",
    # Report
    "ReportRecipientCreate",
    "ReportRecipientResponse",
    "SenderSettingsUpdate",
    "SenderSettingsResponse",
    "MatchReport",
    "GoalReport",
    "ReportData",
    "DailyReportRequest",
    # Common
    "CamelCaseModel",
    "ApiResponse",
    "ApiErrorResponse",
    "PaginationParams",
    "PaginatedResponse",
    # Goal
    "GoalBase",
    "GoalCreate",
    "GoalUpdate",
    "GoalInputSchema",
    "GoalResponse",
    "GoalDetail",
    # Group
    "GroupBase",
    "GroupCreate",
    "GroupSchemaResponse",
    "GroupWithDetails",
    # TeamUniform
    "TeamUniformBase",
    "TeamUniformCreate",
    "TeamUniformUpdate",
    "TeamUniformResponse",
    "TeamUniformList",
]
