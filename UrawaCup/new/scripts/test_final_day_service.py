
import sys
import os
from unittest.mock import MagicMock
from datetime import date, time

# Add src/backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../src/backend'))

from services.final_day_service import FinalDayService, TeamWrapper, MatchType
from models.match import Match, MatchStage, MatchStatus

def create_dummy_standings():
    groups = ['A', 'B', 'C', 'D']
    standings = {}
    
    # Create 6 teams for each group
    for group in groups:
        group_teams = []
        for rank in range(1, 7):
            dummy_standing = MagicMock()
            dummy_standing.team_id = (ord(group) - ord('A')) * 6 + rank
            dummy_standing.team = MagicMock()
            dummy_standing.team.name = f"Team {group}{rank}"
            dummy_standing.group_id = group
            dummy_standing.rank = rank
            dummy_standing.points = 10 - rank
            dummy_standing.goal_difference = 10 - rank
            dummy_standing.goals_for = 10
            group_teams.append(dummy_standing)
        standings[group] = group_teams
    return standings

def test_final_day_service():
    print("Testing FinalDayService...")
    
    # Mock DB Session
    mock_db = MagicMock()
    
    # Mock StandingService
    # We mock the method on the instance that FinalDayService creates
    # Since FinalDayService instantiates StandingService(db) in __init__,
    # we need to patch StandingService class or just mock the instance.
    # However, for simplicity here, we can subclass or just monkeypatch if needed,
    # but since we are importing the class, we can mock the class in sys.modules or similar?
    # Easier way: The service uses self.standing_service.
    
    service = FinalDayService(mock_db)
    
    # Inject mock standing service
    mock_standing_service = MagicMock()
    standings_data = create_dummy_standings()
    
    def side_effect(tournament_id, group_id):
        return standings_data[group_id]
        
    mock_standing_service.update_group_standings.side_effect = side_effect
    service.standing_service = mock_standing_service
    
    venues = []
    default_venues = ["浦和南高G", "市立浦和高G", "浦和学院高G", "武南高G", "駒場スタジアム"]
    for i, name in enumerate(default_venues):
        v = MagicMock()
        v.id = i + 1
        v.name = name
        v.tournament_id = 1
        venues.append(v)

    # Mock query side_effect to handle different models
    def query_side_effect(model):
        m = MagicMock()
        m.filter.return_value = m
        m.in_.return_value = m # For delete filter
        
        if model == Match:
             # handle match queries (delete or select)
             m.delete.return_value = None
             m.all.return_value = [] # No existing matches
        else:
             # Assumes Venue query
             m.all.return_value = venues
             
        return m

    mock_db.query.side_effect = query_side_effect

    # Since we can't easily distinguish models in simple mock, let's assume valid returns.
    # We will just print what is added to DB.
    
    generated_schedule = service.generate_schedule(1)
    
    print(f"\nGenerated {len(generated_schedule)} matches.")
    
    tournament_matches = [m for m in generated_schedule if m.stage != MatchStage.TRAINING]
    training_matches = [m for m in generated_schedule if m.stage == MatchStage.TRAINING]
    
    with open("debug_results.txt", "w", encoding="utf-8") as f:
        f.write(f"Tournament Matches: {len(tournament_matches)}\n")
        f.write(f"Training Matches: {len(training_matches)}\n")
        f.write("\n--- Tournament Matches ---\n")
        for m in tournament_matches:
            f.write(f"[{m.stage.value}] {m.match_time} {m.home_seed} vs {m.away_seed}\n")
        
        f.write("\n--- Training Matches ---\n")
        for m in training_matches:
            home = m.home_team_id if m.home_team_id else "?"
            away = m.away_team_id if m.away_team_id else "?"
            f.write(f"[{m.stage.value}] {m.match_time} TeamID:{home} vs TeamID:{away} ({m.venue})\n")

    if len(tournament_matches) == 4 and len(training_matches) == 20:
        print("\nSUCCESS: Matches generated successfully.")
    else:
        print("\nFAILURE: Match count mismatch.")
        sys.exit(1)

if __name__ == "__main__":
    test_final_day_service()
