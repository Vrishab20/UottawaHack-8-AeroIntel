from __future__ import annotations

import re
from typing import Iterable, List, Optional, Tuple

WAYPOINT_RE = re.compile(
    r"^(?P<lat_deg>\d+(?:\.\d+)?)(?P<lat_dir>[NS])/(?P<lon_deg>\d+(?:\.\d+)?)(?P<lon_dir>[EW])$",
    re.IGNORECASE,
)

# Canadian airport coordinates (lat, lon)
AIRPORT_COORDINATES = {
    # Major hubs
    "CYYZ": (43.6777, -79.6248),   # Toronto Pearson
    "CYVR": (49.1947, -123.1839),  # Vancouver
    "CYUL": (45.4706, -73.7408),   # Montreal Trudeau
    "CYOW": (45.3225, -75.6692),   # Ottawa
    "CYYC": (51.1225, -114.0139),  # Calgary
    "CYEG": (53.3097, -113.5797),  # Edmonton
    "CYWG": (49.9100, -97.2399),   # Winnipeg
    "CYQB": (46.7911, -71.3933),   # Quebec City
    "CYHZ": (44.8808, -63.5086),   # Halifax
    "CYXE": (52.1708, -106.6997),  # Saskatoon
    "CYQR": (50.4319, -104.6656),  # Regina
    "CYYJ": (48.6469, -123.4258),  # Victoria
    "CYYT": (47.6186, -52.7519),   # St. John's
    "CYQM": (46.1122, -64.6786),   # Moncton
    "CYFC": (45.8689, -66.5372),   # Fredericton
    "CYSJ": (45.3161, -65.8903),   # Saint John
    "CYQI": (43.8269, -66.0881),   # Yarmouth
    "CYDF": (49.2108, -57.3914),   # Deer Lake
    "CYQX": (48.9369, -54.5681),   # Gander
    "CYXY": (60.7096, -135.0674),  # Whitehorse
    "CYZF": (62.4628, -114.4403),  # Yellowknife
    "CYFB": (63.7561, -68.5558),   # Iqaluit
    # Secondary airports
    "CYTZ": (43.6275, -79.3962),   # Toronto Billy Bishop
    "CYOO": (43.9228, -78.8950),   # Oshawa
    "CYKF": (43.4608, -80.3786),   # Waterloo
    "CYXU": (43.0356, -81.1539),   # London
    "CYHM": (43.1736, -79.9350),   # Hamilton
    "CYAM": (46.4853, -84.5094),   # Sault Ste. Marie
    "CYQA": (44.9747, -79.3033),   # Muskoka
    "CYTS": (48.5697, -81.3767),   # Timmins
    "CYVO": (48.0533, -77.7828),   # Val-d'Or
    "CYMX": (45.6795, -74.0387),   # Montreal Mirabel
    "CYHU": (45.5175, -73.4169),   # Montreal St-Hubert
    "CYQY": (46.1614, -60.0478),   # Sydney
    "CYPR": (54.2861, -130.4447),  # Prince Rupert
    "CYXS": (53.8894, -122.6789),  # Prince George
    "CYKA": (50.7022, -120.4444),  # Kamloops
    "CYLW": (49.9561, -119.3778),  # Kelowna
    "CYCD": (49.0522, -123.8700),  # Nanaimo
    "CYXX": (49.0253, -122.3608),  # Abbotsford
    "CYBL": (49.9508, -125.2708),  # Campbell River
    "CYXC": (49.6108, -115.7822),  # Cranbrook
    "CYYF": (49.4631, -119.6022),  # Penticton
    "CYQQ": (49.7108, -124.8867),  # Comox
    "CYZT": (50.6806, -127.3667),  # Port Hardy
}


def parse_waypoint(token: str) -> Tuple[float, float]:
    match = WAYPOINT_RE.match(token.strip())
    if not match:
        raise ValueError(f"invalid waypoint: {token!r}")

    lat = float(match.group("lat_deg"))
    lon = float(match.group("lon_deg"))
    if match.group("lat_dir").upper() == "S":
        lat = -lat
    if match.group("lon_dir").upper() == "W":
        lon = -lon

    return lat, lon


def get_airport_coords(airport_code: Optional[str]) -> Optional[Tuple[float, float]]:
    """Get coordinates for an airport code."""
    if not airport_code:
        return None
    code = airport_code.strip().upper()
    return AIRPORT_COORDINATES.get(code)


def parse_route(
    route_str: str,
    departure_airport: Optional[str] = None,
    arrival_airport: Optional[str] = None,
) -> List[Tuple[float, float]]:
    """
    Parse a route string into a list of (lat, lon) tuples.
    
    If the route has only one waypoint, attempt to expand it using
    departure and arrival airport coordinates.
    """
    if not route_str or not route_str.strip():
        raise ValueError("route is empty")

    points: List[Tuple[float, float]] = []
    for token in route_str.split():
        points.append(parse_waypoint(token))

    # If only one waypoint, try to expand using airports
    if len(points) == 1:
        dep_coords = get_airport_coords(departure_airport)
        arr_coords = get_airport_coords(arrival_airport)
        
        if dep_coords and arr_coords:
            # Have both airports: departure -> waypoint -> arrival
            points = [dep_coords, points[0], arr_coords]
        elif dep_coords:
            # Only departure: departure -> waypoint
            points = [dep_coords, points[0]]
        elif arr_coords:
            # Only arrival: waypoint -> arrival
            points = [points[0], arr_coords]
        else:
            raise ValueError("route must include at least two waypoints")

    if len(points) < 2:
        raise ValueError("route must include at least two waypoints")

    return points


def parse_routes(routes: Iterable[str]) -> List[List[Tuple[float, float]]]:
    return [parse_route(route) for route in routes]
