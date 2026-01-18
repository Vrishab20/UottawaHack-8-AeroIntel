import json
from pathlib import Path
from typing import Dict, List, Tuple

from fastapi import Body, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .conflicts import detect_conflicts
from .hotspots import HotspotConfig, detect_hotspots
from .models import FlightPlan, TrajectoryPoint, validate_flight_plan
from .parsing import parse_route
from .resolver import propose_resolutions
from .trajectory import build_trajectory

app = FastAPI(title="Trajectory Insight API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_acid(raw: dict, index: int) -> str:
    return str(raw.get("ACID") or raw.get("acid") or f"index:{index}")


DATA_FILE_PATH = Path(__file__).resolve().parents[2] / "canadian_flights_1000.json"


@app.get("/load-data")
def load_data() -> List[dict]:
    if not DATA_FILE_PATH.exists():
        return []
    with DATA_FILE_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        return []
    return payload


@app.post("/save-data")
def save_data(payload: List[dict] = Body(...)) -> Dict[str, object]:
    """
    Save flight data back to the JSON file.
    Returns success status and number of flights saved.
    """
    try:
        # Validate that it's a list
        if not isinstance(payload, list):
            return {"success": False, "error": "Payload must be a list", "count": 0}
        
        # Create a backup of the original file
        backup_path = DATA_FILE_PATH.with_suffix(".json.backup")
        if DATA_FILE_PATH.exists():
            import shutil
            shutil.copy(DATA_FILE_PATH, backup_path)
        
        # Save the new data
        with DATA_FILE_PATH.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
        
        return {
            "success": True,
            "count": len(payload),
            "message": f"Saved {len(payload)} flights to {DATA_FILE_PATH.name}",
            "backup": str(backup_path.name),
        }
    except Exception as exc:
        return {"success": False, "error": str(exc), "count": 0}


def _parse_flights(payload: List[dict]) -> Tuple[List[FlightPlan], List[str]]:
    issues: List[str] = []
    flights: List[FlightPlan] = []
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            issues.append(f"index:{index}: expected object, got {type(item).__name__}")
            continue

        acid = _get_acid(item, index)
        try:
            flight = FlightPlan.parse_obj(item)
        except ValidationError as exc:
            issues.append(f"{acid}: invalid flight plan ({exc.errors()})")
            continue

        flights.append(flight)
        issues.extend(validate_flight_plan(flight))

    return flights, issues


def _build_trajectories(flights: List[FlightPlan]) -> Tuple[Dict[str, List[TrajectoryPoint]], List[str]]:
    trajectories: Dict[str, List[TrajectoryPoint]] = {}
    issues: List[str] = []
    for flight in flights:
        try:
            # Pass departure/arrival airports to expand single-waypoint routes
            route_points = parse_route(
                flight.route,
                departure_airport=flight.departure_airport,
                arrival_airport=flight.arrival_airport,
            )
        except ValueError as exc:
            issues.append(f"{flight.acid}: {exc}")
            continue
        trajectories[flight.acid] = build_trajectory(flight, route_points)
    return trajectories, issues


@app.post("/validate")
def validate(payload: List[dict] = Body(...)) -> List[str]:
    _, issues = _parse_flights(payload)
    return issues


@app.post("/trajectory")
def trajectory(payload: List[dict] = Body(...)) -> Dict[str, List[TrajectoryPoint]]:
    flights, _ = _parse_flights(payload)
    trajectories, _ = _build_trajectories(flights)
    return trajectories


@app.post("/conflicts")
def conflicts(payload: List[dict] = Body(...)) -> List[dict]:
    trajectories = trajectory(payload)
    return [conflict.dict() for conflict in detect_conflicts(trajectories)]


@app.post("/hotspots")
def hotspots(payload: List[dict] = Body(...)) -> List[dict]:
    trajectories = trajectory(payload)
    return [cell.dict() for cell in detect_hotspots(trajectories, HotspotConfig())]


@app.post("/propose")
def propose(payload: List[dict] = Body(...)) -> Dict[str, List[dict]]:
    flights, _ = _parse_flights(payload)
    flight_map = {flight.acid: flight for flight in flights}
    trajectories, _ = _build_trajectories(flights)
    conflicts_list = detect_conflicts(trajectories)
    proposals = propose_resolutions(conflicts_list, flight_map)
    return {key: [candidate.dict() for candidate in values] for key, values in proposals.items()}


@app.post("/apply")
def apply_changes(payload: Dict = Body(...)) -> Dict[str, object]:
    flights_payload = payload.get("flights", [])
    actions = payload.get("actions", [])
    flights, issues = _parse_flights(flights_payload)
    flight_map = {flight.acid: flight for flight in flights}

    for action in actions:
        flight_id = action.get("flight_id")
        flight = flight_map.get(flight_id)
        if not flight:
            continue

        updates = {}
        if action.get("delta_altitude_ft") is not None:
            updates["altitude_ft"] = flight.altitude_ft + int(action["delta_altitude_ft"])
        if action.get("delta_speed_kt") is not None:
            updates["speed_kt"] = flight.speed_kt + int(action["delta_speed_kt"])
        if action.get("delta_departure_min") is not None:
            updates["departure_time"] = flight.departure_time + int(action["delta_departure_min"]) * 60
        if action.get("reroute_waypoint"):
            updates["route"] = f"{flight.route} {action['reroute_waypoint']}"

        flight_map[flight_id] = flight.copy(update=updates)

    revised = [flight.dict(by_alias=True) for flight in flight_map.values()]
    return {"issues": issues, "revised": revised}


@app.post("/analyze")
def analyze(payload: List[dict] = Body(...)) -> Dict[str, object]:
    flights, issues = _parse_flights(payload)
    flight_map = {flight.acid: flight for flight in flights}
    trajectories, route_issues = _build_trajectories(flights)
    issues.extend(route_issues)
    conflicts_list = detect_conflicts(trajectories)
    hotspots_list = detect_hotspots(trajectories, HotspotConfig())
    proposals = propose_resolutions(conflicts_list, flight_map)
    return {
        "issues": issues,
        "trajectories": {key: [point.dict() for point in values] for key, values in trajectories.items()},
        "conflicts": [conflict.dict() for conflict in conflicts_list],
        "hotspots": [cell.dict() for cell in hotspots_list],
        "proposals": {key: [candidate.dict() for candidate in values] for key, values in proposals.items()},
    }
