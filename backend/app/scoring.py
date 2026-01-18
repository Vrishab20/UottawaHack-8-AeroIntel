from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .models import ConflictEvent, FlightPlan, ResolutionCandidate


@dataclass(frozen=True)
class ScoreWeights:
    conflict_weight: float = 1.0
    delay_weight: float = 0.04
    altitude_weight: float = 0.002
    speed_weight: float = 0.01
    complexity_weight: float = 0.2


def score_candidate(
    candidate: ResolutionCandidate,
    conflict: ConflictEvent,
    weights: Optional[ScoreWeights] = None,
) -> ResolutionCandidate:
    if weights is None:
        weights = ScoreWeights()

    delay = abs(candidate.delta_departure_min or 0)
    altitude = abs(candidate.delta_altitude_ft or 0)
    speed = abs(candidate.delta_speed_kt or 0)
    complexity = 1.0 if candidate.reroute_waypoint else 0.3

    benefit = round(conflict.severity * weights.conflict_weight, 4)
    cost = round(
        delay * weights.delay_weight
        + altitude * weights.altitude_weight
        + speed * weights.speed_weight
        + complexity * weights.complexity_weight,
        4,
    )
    candidate.benefit = benefit
    candidate.cost = cost
    candidate.score = round(benefit - cost, 4)
    return candidate
