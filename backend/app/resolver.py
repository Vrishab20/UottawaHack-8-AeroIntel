from __future__ import annotations

from typing import Dict, Iterable, List

from .models import ConflictEvent, FlightPlan, ResolutionCandidate, validate_flight_plan
from .scoring import score_candidate


ALTITUDE_STEPS = [-4000, -2000, 2000, 4000]
SPEED_STEPS = [-25, -15, -10, 10, 15, 25]
DEPARTURE_STEPS = [-10, -5, -2, 2, 5, 10]


def _candidate(
    flight_id: str,
    action_type: str,
    summary: str,
    delta_altitude_ft: int | None = None,
    delta_speed_kt: int | None = None,
    delta_departure_min: int | None = None,
    reroute_waypoint: str | None = None,
) -> ResolutionCandidate:
    return ResolutionCandidate(
        flight_id=flight_id,
        action_type=action_type,
        summary=summary,
        delta_altitude_ft=delta_altitude_ft,
        delta_speed_kt=delta_speed_kt,
        delta_departure_min=delta_departure_min,
        reroute_waypoint=reroute_waypoint,
        score=0.0,
        benefit=0.0,
        cost=0.0,
    )


def _valid_with_delta(flight: FlightPlan, delta_alt: int = 0, delta_speed: int = 0, delta_dep_min: int = 0) -> bool:
    updated = flight.copy(update={"altitude_ft": flight.altitude_ft + delta_alt, "speed_kt": flight.speed_kt + delta_speed})
    issues = validate_flight_plan(updated)
    return len(issues) == 0


def propose_resolutions(
    conflicts: Iterable[ConflictEvent],
    flights: Dict[str, FlightPlan],
) -> Dict[str, List[ResolutionCandidate]]:
    proposals: Dict[str, List[ResolutionCandidate]] = {}

    for conflict in conflicts:
        for flight_id in (conflict.flight_a, conflict.flight_b):
            flight = flights.get(flight_id)
            if not flight:
                continue

            candidates: List[ResolutionCandidate] = []

            for delta in ALTITUDE_STEPS:
                if _valid_with_delta(flight, delta_alt=delta):
                    candidates.append(
                        _candidate(
                            flight_id,
                            "altitude",
                            f"Change altitude by {delta:+} ft",
                            delta_altitude_ft=delta,
                        )
                    )

            for delta in SPEED_STEPS:
                if _valid_with_delta(flight, delta_speed=delta):
                    candidates.append(
                        _candidate(
                            flight_id,
                            "speed",
                            f"Change speed by {delta:+} kt",
                            delta_speed_kt=delta,
                        )
                    )

            for delta in DEPARTURE_STEPS:
                candidates.append(
                    _candidate(
                        flight_id,
                        "departure",
                        f"Shift departure by {delta:+} min",
                        delta_departure_min=delta,
                    )
                )

            if flight.route:
                candidates.append(
                    _candidate(
                        flight_id,
                        "reroute",
                        "Insert waypoint FIX01",
                        reroute_waypoint="FIX01",
                    )
                )

            scored = [score_candidate(candidate, conflict) for candidate in candidates]
            scored.sort(key=lambda c: c.score, reverse=True)
            key = f"{conflict.flight_a}-{conflict.flight_b}:{flight_id}"
            proposals[key] = scored[:3]

    return proposals
