"""
Nicholson Dorm Ping-Pong League - ELO Calculation Engine (Python 3)
Supports dynamic K-factors, provisional ratings, and score validation.
"""

from dataclasses import dataclass
from typing import Tuple, Optional


@dataclass
class EloResult:
    player_a_new_rating: float
    player_a_delta: float
    player_b_new_rating: float
    player_b_delta: float
    player_a_expected: float
    player_b_expected: float


def get_k_factor(matches_played: int, current_rating: float) -> int:
    """
    Dynamic K-factor:
    - Provisional (<10 matches): K=48 (rapid convergence)
    - Casual (<1600 ELO): K=32 (balanced responsiveness)
    - Veteran (<2000 ELO): K=24 (rating stability)
    - Master (>=2000 ELO): K=16 (elite defense)
    """
    if matches_played < 10:
        return 48
    if current_rating < 1600:
        return 32
    if current_rating < 2000:
        return 24
    return 16


def get_expected_score(rating_a: float, rating_b: float) -> float:
    """
    Standard logistic curve: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
    """
    return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))


def validate_ping_pong_score(score_a: int, score_b: int, game_type: int = 21) -> Tuple[bool, Optional[str]]:
    """
    Enforces official table tennis rules:
    - Must win by at least 2 points.
    - Winning score must be >= game_type (11 or 21).
    - If score goes beyond game_type, game ends as soon as a 2-point lead is established.
    """
    if score_a < 0 or score_b < 0:
        return False, "Scores cannot be negative."
    if score_a == score_b:
        return False, "Table tennis matches cannot end in a draw."

    winner_score = max(score_a, score_b)
    loser_score = min(score_a, score_b)
    diff = winner_score - loser_score

    if diff < 2:
        return False, "Winner must lead by at least 2 points."
    if winner_score < game_type:
        return False, f"Winning score must reach at least {game_type} points."
    if winner_score > game_type and diff > 2:
        return False, f"Overtime beyond {game_type} points must conclude immediately upon a 2-point lead."

    return True, None


def calculate_elo(
    rating_a: float,
    matches_a: int,
    score_a: int,
    rating_b: float,
    matches_b: int,
    score_b: int,
    rating_floor: float = 100.0,
) -> EloResult:
    """
    Calculates post-match ELO ratings with asymmetrical K-factors.
    """
    if score_a == score_b:
        raise ValueError("Matches cannot end in a tie.")

    p1_won = score_a > score_b
    actual_a = 1.0 if p1_won else 0.0
    actual_b = 0.0 if p1_won else 1.0

    expected_a = get_expected_score(rating_a, rating_b)
    expected_b = 1.0 - expected_a

    k_a = get_k_factor(matches_a, rating_a)
    k_b = get_k_factor(matches_b, rating_b)

    raw_delta_a = k_a * (actual_a - expected_a)
    raw_delta_b = k_b * (actual_b - expected_b)

    new_rating_a = max(rating_floor, round(rating_a + raw_delta_a, 1))
    new_rating_b = max(rating_floor, round(rating_b + raw_delta_b, 1))

    return EloResult(
        player_a_new_rating=new_rating_a,
        player_a_delta=round(new_rating_a - rating_a, 1),
        player_b_new_rating=new_rating_b,
        player_b_delta=round(new_rating_b - rating_b, 1),
        player_a_expected=round(expected_a, 4),
        player_b_expected=round(expected_b, 4),
    )


if __name__ == "__main__":
    print("=" * 65)
    print("      NICHOLSON DORM PING-PONG ELO ENGINE VERIFICATION (PY)     ")
    print("=" * 65)

    # Scenario 1: Even match (1200 vs 1200, provisional K=48)
    res1 = calculate_elo(1200.0, 2, 21, 1200.0, 3, 17)
    print(f"\n[1] Even Match (1200 vs 1200):")
    print(f"    Expected: A={res1.player_a_expected*100:.1f}%, B={res1.player_b_expected*100:.1f}%")
    print(f"    Winner New Rating: {res1.player_a_new_rating} (+{res1.player_a_delta})")
    print(f"    Loser New Rating:  {res1.player_b_new_rating} ({res1.player_b_delta})")

    # Scenario 2: Major Upset (1100 Novice defeats 1850 Dorm King)
    res2 = calculate_elo(1100.0, 4, 22, 1850.0, 50, 20)
    print(f"\n[2] Major Upset (Novice 1100 beats Champion 1850):")
    print(f"    Expected: Underdog={res2.player_a_expected*100:.2f}%, Champion={res2.player_b_expected*100:.2f}%")
    print(f"    Underdog Gain: +{res2.player_a_delta} (New: {res2.player_a_new_rating}) [High reward K=48]")
    print(f"    Champion Loss: {res2.player_b_delta} (New: {res2.player_b_new_rating}) [Protected by K=24]")

    # Scenario 3: Expected Victory (1850 Dorm King beats 1100 Novice)
    res3 = calculate_elo(1850.0, 50, 21, 1100.0, 4, 9)
    print(f"\n[3] Expected Victory (Champion 1850 beats Novice 1100):")
    print(f"    Champion Gain: +{res3.player_a_delta} (New: {res3.player_a_new_rating}) [Minimal gain]")
    print(f"    Novice Loss:   {res3.player_b_delta} (New: {res3.player_b_new_rating}) [Minimal drop]")

    # Score checks
    print(f"\n[4] Score Validation Tests:")
    for a, b in [(21, 18), (22, 20), (21, 20), (25, 20), (14, 8)]:
        valid, err = validate_ping_pong_score(a, b, 21)
        print(f"    Score {a:02d}-{b:02d} -> {'VALID' if valid else 'INVALID: ' + str(err)}")
    print("\nVerification complete!")
