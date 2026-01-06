"""
APIルーター
"""

from .tournaments import router as tournaments_router
from .teams import router as teams_router
from .matches import router as matches_router
from .standings import router as standings_router
from .players import router as players_router
from .venues import router as venues_router
from .staff import router as staff_router
from .auth import router as auth_router
from .exclusions import router as exclusions_router
from .final_day import router as final_day_router
from .reports import router as reports_router
from .reports_excel import router as reports_excel_router

__all__ = [
    "tournaments_router",
    "teams_router",
    "matches_router",
    "standings_router",
    "players_router",
    "venues_router",
    "staff_router",
    "auth_router",
    "exclusions_router",
    "final_day_router",
    "reports_router",
    "reports_excel_router",
]
