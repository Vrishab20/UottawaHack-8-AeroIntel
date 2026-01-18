from __future__ import annotations

import math
from collections import defaultdict
from typing import Dict, Iterable, List, Tuple

from .models import ConflictEvent, TrajectoryPoint
from .trajectory import great_circle_nm

HORIZONTAL_THRESHOLD_NM = 5.0
VERTICAL_THRESHOLD_FT = 2000


def _bucket_key(lat: float, lon: float, bucket_deg: float) -> Tuple[int, int]:
    return (int(math.floor(lat / bucket_deg)), int(math.floor(lon / bucket_deg)))


def _neighbor_keys(key: Tuple[int, int]) -> Iterable[Tuple[int, int]]:
    for dlat in (-1, 0, 1):
        for dlon in (-1, 0, 1):
            yield (key[0] + dlat, key[1] + dlon)


def _severity(horizontal_nm: float, vertical_ft: int) -> float:
    horiz = max(0.0, (HORIZONTAL_THRESHOLD_NM - horizontal_nm) / HORIZONTAL_THRESHOLD_NM)
    vert = max(0.0, (VERTICAL_THRESHOLD_FT - vertical_ft) / VERTICAL_THRESHOLD_FT)
    return round(horiz + vert, 4)


def detect_conflicts(
    trajectories: Dict[str, List[TrajectoryPoint]],
    time_bin_sec: int = 60,
    bucket_deg: float = 1.0,
) -> List[ConflictEvent]:
    bins: Dict[int, List[TrajectoryPoint]] = defaultdict(list)
    for points in trajectories.values():
        for point in points:
            bin_key = int(point.timestamp // time_bin_sec)
            bins[bin_key].append(point)

    raw_hits: Dict[Tuple[str, str], List[Tuple[int, float, int]]] = defaultdict(list)

    for bin_key, points in bins.items():
        spatial: Dict[Tuple[int, int], List[TrajectoryPoint]] = defaultdict(list)
        for point in points:
            spatial[_bucket_key(point.lat, point.lon, bucket_deg)].append(point)

        checked_pairs = set()
        for bucket, bucket_points in spatial.items():
            candidates: List[TrajectoryPoint] = []
            for neighbor in _neighbor_keys(bucket):
                candidates.extend(spatial.get(neighbor, []))

            for i, point_a in enumerate(bucket_points):
                for point_b in candidates:
                    if point_a.acid == point_b.acid:
                        continue
                    pair = tuple(sorted((point_a.acid, point_b.acid)))
                    pair_key = (pair, point_a.timestamp)
                    if pair_key in checked_pairs:
                        continue
                    checked_pairs.add(pair_key)

                    horizontal_nm = great_circle_nm((point_a.lat, point_a.lon), (point_b.lat, point_b.lon))
                    vertical_ft = abs(point_a.altitude_ft - point_b.altitude_ft)
                    if horizontal_nm < HORIZONTAL_THRESHOLD_NM and vertical_ft < VERTICAL_THRESHOLD_FT:
                        raw_hits[pair].append((point_a.timestamp, horizontal_nm, vertical_ft))

    conflicts: List[ConflictEvent] = []
    for pair, hits in raw_hits.items():
        hits.sort(key=lambda h: h[0])
        start = hits[0][0]
        end = hits[0][0]
        min_h = hits[0][1]
        min_v = hits[0][2]

        for timestamp, horiz, vert in hits[1:]:
            if timestamp <= end + time_bin_sec:
                end = timestamp
                min_h = min(min_h, horiz)
                min_v = min(min_v, vert)
            else:
                conflicts.append(
                    ConflictEvent(
                        flight_a=pair[0],
                        flight_b=pair[1],
                        start_time=start,
                        end_time=end + time_bin_sec,
                        min_horizontal_nm=round(min_h, 4),
                        min_vertical_ft=int(min_v),
                        severity=_severity(min_h, int(min_v)),
                    )
                )
                start = timestamp
                end = timestamp
                min_h = horiz
                min_v = vert

        conflicts.append(
            ConflictEvent(
                flight_a=pair[0],
                flight_b=pair[1],
                start_time=start,
                end_time=end + time_bin_sec,
                min_horizontal_nm=round(min_h, 4),
                min_vertical_ft=int(min_v),
                severity=_severity(min_h, int(min_v)),
            )
        )

    conflicts.sort(key=lambda c: c.severity, reverse=True)
    return conflicts
