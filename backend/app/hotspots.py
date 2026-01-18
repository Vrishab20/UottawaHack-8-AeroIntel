from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

from .models import HotspotCell, TrajectoryPoint


@dataclass(frozen=True)
class HotspotConfig:
    lat_bucket_deg: float = 1.0
    lon_bucket_deg: float = 1.0
    altitude_band_ft: int = 2000
    time_bin_sec: int = 60
    top_n: int = 10


def _bucket(value: float, step: float) -> int:
    return int(math.floor(value / step))


def detect_hotspots(
    trajectories: Dict[str, List[TrajectoryPoint]],
    config: HotspotConfig | None = None,
) -> List[HotspotCell]:
    if config is None:
        config = HotspotConfig()

    occupancy: Dict[Tuple[int, int, int, int], List[TrajectoryPoint]] = defaultdict(list)

    for points in trajectories.values():
        for point in points:
            key = (
                _bucket(point.lat, config.lat_bucket_deg),
                _bucket(point.lon, config.lon_bucket_deg),
                _bucket(point.altitude_ft, config.altitude_band_ft),
                int(point.timestamp // config.time_bin_sec),
            )
            occupancy[key].append(point)

    cell_stats: Dict[Tuple[int, int, int], Dict[str, object]] = {}
    for (lat_b, lon_b, alt_b, time_bin), points in occupancy.items():
        cell_key = (lat_b, lon_b, alt_b)
        stats = cell_stats.setdefault(
            cell_key,
            {
                "peak_density": 0,
                "time_bins": set(),
                "flights": set(),
            },
        )
        stats["peak_density"] = max(stats["peak_density"], len(points))
        stats["time_bins"].add(time_bin)
        stats["flights"].update(p.acid for p in points)

    hotspots: List[HotspotCell] = []
    for (lat_b, lon_b, alt_b), stats in cell_stats.items():
        time_bins = sorted(stats["time_bins"])
        if not time_bins:
            continue

        time_start = time_bins[0] * config.time_bin_sec
        time_end = (time_bins[-1] + 1) * config.time_bin_sec
        occupancy_minutes = len(time_bins) * int(config.time_bin_sec / 60)
        unique_flights = len(stats["flights"])
        peak_density = int(stats["peak_density"])

        score = round(peak_density * 0.6 + unique_flights * 0.3 + occupancy_minutes * 0.1, 4)

        hotspots.append(
            HotspotCell(
                lat_bucket=lat_b,
                lon_bucket=lon_b,
                altitude_band=alt_b,
                time_start=time_start,
                time_end=time_end,
                peak_density=peak_density,
                occupancy_minutes=occupancy_minutes,
                unique_flights=unique_flights,
                score=score,
            )
        )

    hotspots.sort(key=lambda h: h.score, reverse=True)
    return hotspots[: config.top_n]
