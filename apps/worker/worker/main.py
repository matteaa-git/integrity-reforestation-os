"""Integrity Social Media Machine — Worker Service"""

import signal
import sys
import threading

from worker.scheduler import run_loop


def main() -> None:
    print("[worker] starting")

    stop_event = threading.Event()

    def _shutdown(signum, frame):  # noqa: ANN001
        print(f"\n[worker] received signal {signum}, shutting down")
        stop_event.set()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    scheduler_thread = threading.Thread(
        target=run_loop,
        args=(stop_event,),
        daemon=True,
        name="scheduler",
    )
    scheduler_thread.start()

    stop_event.wait()
    scheduler_thread.join(timeout=5)
    print("[worker] stopped")
    sys.exit(0)


if __name__ == "__main__":
    main()
