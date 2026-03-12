"""Instagram Growth OS — Worker Service

Minimal entrypoint for the background worker.
Job handlers will be added as engines are built.
"""

import signal
import sys
import time


def main() -> None:
    print("[worker] starting — no job handlers registered yet")

    running = True

    def _shutdown(signum, frame):  # noqa: ANN001
        nonlocal running
        print(f"\n[worker] received signal {signum}, shutting down")
        running = False

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    while running:
        time.sleep(1)

    print("[worker] stopped")
    sys.exit(0)


if __name__ == "__main__":
    main()
