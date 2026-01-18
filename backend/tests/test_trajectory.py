from backend.app.models import FlightPlan
from backend.app.trajectory import build_trajectory, great_circle_nm


def _flight():
    return FlightPlan(
        **{
            "ACID": "TEST1",
            "Plane type": "jet",
            "route": "0N/0E 0N/1E",
            "altitude": 30000,
            "departure time": 0,
            "aircraft speed": 360,
            "passengers": 100,
            "is_cargo": False,
        }
    )


def test_great_circle_distance():
    dist = great_circle_nm((0.0, 0.0), (0.0, 1.0))
    assert 59.9 < dist < 60.5


def test_build_trajectory_samples():
    flight = _flight()
    points = [(0.0, 0.0), (0.0, 1.0)]
    trajectory = build_trajectory(flight, points, sample_sec=60)
    assert trajectory[0].timestamp == flight.departure_time
    assert trajectory[-1].timestamp >= flight.departure_time
    assert len(trajectory) > 1
