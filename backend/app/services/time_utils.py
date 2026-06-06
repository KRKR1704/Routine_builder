"""Helpers for working with "HH:MM" time strings and datetime objects."""
from datetime import date, datetime, time, timedelta


def parse_hhmm(time_str: str) -> time:
    """Parse an "HH:MM" string to a :class:`datetime.time` object."""
    h, m = map(int, time_str.strip().split(":"))
    return time(h, m)


def time_to_minutes(t: time) -> int:
    """Convert a time object to minutes elapsed since midnight."""
    return t.hour * 60 + t.minute


def minutes_to_time(minutes: int) -> time:
    """Convert minutes-since-midnight back to a :class:`datetime.time`."""
    minutes = minutes % (24 * 60)  # wrap at midnight
    return time(minutes // 60, minutes % 60)


def hhmm_to_dt(d: date, time_str: str) -> datetime:
    """Combine a :class:`date` and an "HH:MM" string into a :class:`datetime`."""
    return datetime.combine(d, parse_hhmm(time_str))


def block_duration_minutes(start: datetime, end: datetime) -> float:
    """Return the duration between two datetimes in minutes (always positive)."""
    delta = end - start
    return delta.total_seconds() / 60.0


def overnight_end(start_dt: datetime, end_dt: datetime) -> datetime:
    """
    If *end_dt* is on the same day as *start_dt* but earlier in the day
    (i.e., the block spans midnight, e.g. Sleep 22:30 → 07:00),
    advance *end_dt* by one day.
    """
    if end_dt <= start_dt:
        return end_dt + timedelta(days=1)
    return end_dt


def compute_wake_delay(planned_wake: str, actual_wake: str) -> int:
    """
    Return how many minutes the user woke up after their planned wake time.
    A negative value means they woke up *early*.
    """
    p = time_to_minutes(parse_hhmm(planned_wake))
    a = time_to_minutes(parse_hhmm(actual_wake))
    delay = a - p
    # Handle crossing midnight edge-case (e.g., planned 23:00, actual 00:30)
    if delay > 12 * 60:
        delay -= 24 * 60
    elif delay < -12 * 60:
        delay += 24 * 60
    return delay


def compute_sleep_duration(sleep_time: str, wake_time: str) -> int:
    """
    Compute sleep duration in minutes.  Handles overnight (sleep before
    midnight, wake after midnight).
    """
    s = time_to_minutes(parse_hhmm(sleep_time))
    w = time_to_minutes(parse_hhmm(wake_time))
    if w <= s:
        return (24 * 60 - s) + w
    return w - s
