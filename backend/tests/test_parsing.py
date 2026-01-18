import pytest

from backend.app.parsing import parse_route, parse_waypoint


def test_parse_waypoint_nw():
    lat, lon = parse_waypoint("49.97N/110.935W")
    assert lat == pytest.approx(49.97)
    assert lon == pytest.approx(-110.935)


def test_parse_waypoint_se():
    lat, lon = parse_waypoint("12.5S/77.3E")
    assert lat == pytest.approx(-12.5)
    assert lon == pytest.approx(77.3)


def test_parse_route_requires_two_points():
    with pytest.raises(ValueError):
        parse_route("49.97N/110.935W")
