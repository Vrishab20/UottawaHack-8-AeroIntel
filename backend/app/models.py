from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

from pydantic import BaseModel, Field, validator


@dataclass(frozen=True)
class AircraftConstraints:
    min_speed_kt: int
    max_speed_kt: int
    min_altitude_ft: int
    max_altitude_ft: int


AIRCRAFT_CONSTRAINTS = {
    # Commercial jets (widebody and narrowbody) - typical cruise speeds 450-530 kts
    "jet": AircraftConstraints(min_speed_kt=200, max_speed_kt=550, min_altitude_ft=10000, max_altitude_ft=45000),
    # Turboprops and regional jets - Dash 8, ATR, CRJ, E-Jets
    "turboprop": AircraftConstraints(
        min_speed_kt=150, max_speed_kt=450, min_altitude_ft=5000, max_altitude_ft=41000
    ),
    # Small prop planes
    "prop": AircraftConstraints(min_speed_kt=90, max_speed_kt=220, min_altitude_ft=1000, max_altitude_ft=18000),
    # Helicopters
    "helicopter": AircraftConstraints(
        min_speed_kt=60, max_speed_kt=160, min_altitude_ft=0, max_altitude_ft=10000
    ),
}


# Known aircraft types and their categories
KNOWN_AIRCRAFT = {
    # Wide-body passenger jets
    "boeing 787-9": "widebody",
    "boeing 787": "widebody",
    "787-9": "widebody",
    "787": "widebody",
    "boeing 777-300er": "widebody",
    "boeing 777": "widebody",
    "777-300er": "widebody",
    "777": "widebody",
    "airbus a330": "widebody",
    "a330": "widebody",
    
    # Narrow-body passenger jets
    "boeing 737-800": "narrowbody",
    "boeing 737 max 8": "narrowbody",
    "boeing 737 max": "narrowbody",
    "boeing 737": "narrowbody",
    "737-800": "narrowbody",
    "737 max 8": "narrowbody",
    "737 max": "narrowbody",
    "737": "narrowbody",
    "airbus a320": "narrowbody",
    "airbus a321": "narrowbody",
    "airbus a220-300": "narrowbody",
    "airbus a220": "narrowbody",
    "a320": "narrowbody",
    "a321": "narrowbody",
    "a220-300": "narrowbody",
    "a220": "narrowbody",
    
    # Regional aircraft (turboprops and regional jets)
    "dash 8-400": "regional",
    "dash 8": "regional",
    "dash-8": "regional",
    "q400": "regional",
    "embraer e195-e2": "regional",
    "embraer e195": "regional",
    "e195-e2": "regional",
    "e195": "regional",
    "embraer": "regional",
    "crj": "regional",
    "bombardier crj": "regional",
    
    # Cargo aircraft
    "boeing 767-300f": "cargo",
    "boeing 767f": "cargo",
    "767-300f": "cargo",
    "767f": "cargo",
    "boeing 757-200f": "cargo",
    "boeing 757f": "cargo",
    "757-200f": "cargo",
    "757f": "cargo",
    "airbus a300-600f": "cargo",
    "airbus a300f": "cargo",
    "a300-600f": "cargo",
    "a300f": "cargo",
}

# Map aircraft categories to constraint categories
CATEGORY_TO_CONSTRAINTS = {
    "widebody": "jet",
    "narrowbody": "jet",
    "regional": "turboprop",  # Regional jets/turboprops use turboprop constraints
    "cargo": "jet",
}


def _classify_aircraft(plane_type: str) -> Tuple[str, bool]:
    normalized = (plane_type or "").strip().lower()
    if not normalized:
        return "jet", False

    # Check known aircraft first
    for aircraft_name, category in KNOWN_AIRCRAFT.items():
        if aircraft_name in normalized:
            return CATEGORY_TO_CONSTRAINTS.get(category, "jet"), True
    
    # Fallback to keyword matching
    if "heli" in normalized:
        return "helicopter", True
    if "turboprop" in normalized or ("turbo" in normalized and "prop" in normalized):
        return "turboprop", True
    if "prop" in normalized or "piston" in normalized:
        return "prop", True
    if "jet" in normalized:
        return "jet", True
    
    # Check for common Boeing/Airbus patterns
    if "boeing" in normalized or "airbus" in normalized:
        return "jet", True
    if normalized.startswith("b7") or normalized.startswith("a3") or normalized.startswith("a2"):
        return "jet", True

    return "jet", False


class FlightPlan(BaseModel):
    acid: str = Field(..., alias="ACID")
    plane_type: str = Field(..., alias="Plane type")
    route: str
    altitude_ft: int = Field(..., alias="altitude")
    departure_time: int = Field(..., alias="departure time")
    speed_kt: int = Field(..., alias="aircraft speed")
    passengers: int
    is_cargo: bool
    departure_airport: Optional[str] = Field(None, alias="departure airport")
    arrival_airport: Optional[str] = Field(None, alias="arrival airport")

    @validator("altitude_ft", "departure_time", "speed_kt", "passengers", pre=True)
    def _coerce_int(cls, value: object) -> int:
        if isinstance(value, bool):
            raise ValueError("expected integer, got boolean")
        return int(value)

    class Config:
        allow_population_by_field_name = True
        anystr_strip_whitespace = True


class TrajectoryPoint(BaseModel):
    acid: str
    lat: float
    lon: float
    altitude_ft: int
    timestamp: int
    speed_kt: Optional[int] = None


class ConflictEvent(BaseModel):
    flight_a: str
    flight_b: str
    start_time: int
    end_time: int
    min_horizontal_nm: float
    min_vertical_ft: int
    severity: float


class HotspotCell(BaseModel):
    lat_bucket: int
    lon_bucket: int
    altitude_band: int
    time_start: int
    time_end: int
    peak_density: int
    occupancy_minutes: int
    unique_flights: int
    score: float


class ResolutionCandidate(BaseModel):
    flight_id: str
    action_type: str
    summary: str
    delta_altitude_ft: Optional[int] = None
    delta_speed_kt: Optional[int] = None
    delta_departure_min: Optional[int] = None
    reroute_waypoint: Optional[str] = None
    score: float
    benefit: float
    cost: float


def validate_flight_plan(flight: FlightPlan) -> List[str]:
    issues: List[str] = []
    category, matched = _classify_aircraft(flight.plane_type)
    constraints = AIRCRAFT_CONSTRAINTS[category]

    if not matched:
        issues.append(
            f"{flight.acid}: unknown plane type '{flight.plane_type}', defaulting to '{category}' constraints"
        )

    if flight.speed_kt < constraints.min_speed_kt or flight.speed_kt > constraints.max_speed_kt:
        issues.append(
            f"{flight.acid}: speed {flight.speed_kt}kt outside {constraints.min_speed_kt}-{constraints.max_speed_kt}kt"
        )
    if flight.altitude_ft < constraints.min_altitude_ft or flight.altitude_ft > constraints.max_altitude_ft:
        issues.append(
            f"{flight.acid}: altitude {flight.altitude_ft}ft outside {constraints.min_altitude_ft}-{constraints.max_altitude_ft}ft"
        )

    return issues
