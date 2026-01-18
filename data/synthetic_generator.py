import json
import random
from datetime import datetime, timezone


def _rand_route():
    start = (49.5 + random.random(), -111.2 + random.random())
    mid = (49.0 + random.random(), -95.0 + random.random())
    end = (45.0 + random.random(), -76.5 + random.random())
    return f"{start[0]:.2f}N/{abs(start[1]):.2f}W {mid[0]:.2f}N/{abs(mid[1]):.2f}W {end[0]:.2f}N/{abs(end[1]):.2f}W"


def generate(count: int = 10):
    now = int(datetime.now(tz=timezone.utc).timestamp())
    flights = []
    for i in range(count):
        flights.append(
            {
                "ACID": f"SIM{i:03d}",
                "Plane type": random.choice(["jet", "turboprop", "prop"]),
                "route": _rand_route(),
                "altitude": random.choice([18000, 24000, 30000, 34000, 36000]),
                "departure time": now + i * 120,
                "aircraft speed": random.choice([260, 320, 420, 460]),
                "passengers": random.choice([40, 90, 120, 180]),
                "is_cargo": random.choice([False, False, True]),
            }
        )
    return flights


if __name__ == "__main__":
    print(json.dumps(generate(12), indent=2))
