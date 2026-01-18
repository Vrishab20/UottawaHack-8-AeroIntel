from __future__ import annotations

import math
from typing import List, Sequence, Tuple

from .models import FlightPlan, TrajectoryPoint

EARTH_RADIUS_NM = 3440.065


def great_circle_nm(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])

    dlat = lat2 - lat1
    dlon = lon2 - lon1
    sin_dlat = math.sin(dlat / 2.0)
    sin_dlon = math.sin(dlon / 2.0)
    h = sin_dlat * sin_dlat + math.cos(lat1) * math.cos(lat2) * sin_dlon * sin_dlon
    return 2.0 * EARTH_RADIUS_NM * math.asin(min(1.0, math.sqrt(h)))


def _segment_distances(points: Sequence[Tuple[float, float]]) -> List[float]:
    distances = []
    for idx in range(len(points) - 1):
        distances.append(great_circle_nm(points[idx], points[idx + 1]))
    return distances


def _interpolate(a: Tuple[float, float], b: Tuple[float, float], t: float) -> Tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def build_trajectory(
    flight: FlightPlan, points: Sequence[Tuple[float, float]], sample_sec: int = 60
) -> List[TrajectoryPoint]:
    if sample_sec <= 0:
        raise ValueError("sample_sec must be positive")

    distances = _segment_distances(points)
    total_nm = sum(distances)
    if total_nm <= 0:
        raise ValueError("route distance must be positive")

    speed_kt = max(1, flight.speed_kt)
    total_sec = int(math.ceil(total_nm / speed_kt * 3600.0))

    trajectory: List[TrajectoryPoint] = []
    elapsed = 0
    segment_index = 0
    segment_progress = 0.0
    segment_remaining = distances[0]

    while elapsed <= total_sec:
        while segment_index < len(distances) and segment_remaining <= 0:
            segment_index += 1
            if segment_index < len(distances):
                segment_remaining = distances[segment_index]
                segment_progress = 0.0

        if segment_index >= len(distances):
            lat, lon = points[-1]
        else:
            segment_len = max(1e-6, distances[segment_index])
            t = min(1.0, segment_progress / segment_len)
            lat, lon = _interpolate(points[segment_index], points[segment_index + 1], t)

        trajectory.append(
            TrajectoryPoint(
                acid=flight.acid,
                lat=lat,
                lon=lon,
                altitude_ft=flight.altitude_ft,
                timestamp=flight.departure_time + elapsed,
                speed_kt=flight.speed_kt,
            )
        )

        elapsed += sample_sec
        advance_nm = speed_kt * sample_sec / 3600.0
        segment_progress += advance_nm
        segment_remaining -= advance_nm

    return trajectory
