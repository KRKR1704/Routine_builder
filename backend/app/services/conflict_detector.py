"""
Overlap detection and free-slot finding for schedule blocks.

Blocks are plain dicts or objects that expose:
  .planned_start  (datetime)
  .planned_end    (datetime)
  .title          (str)
  .priority       (str)  critical | high | medium | low
  .is_fixed       (bool, optional)
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

_PRIORITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def _rank(priority: str) -> int:
    return _PRIORITY_RANK.get(priority, 0)


def _blocks_overlap(a_start: datetime, a_end: datetime,
                    b_start: datetime, b_end: datetime) -> bool:
    """Return True when two half-open intervals [a_start, a_end) and
    [b_start, b_end) overlap."""
    return a_start < b_end and b_start < a_end


def detect_overlaps(blocks: List[Any]) -> List[Dict[str, Any]]:
    """
    Return a list of conflict descriptors for every pair of blocks that overlap.
    Each descriptor contains:
      {
        "block_a": title,
        "block_b": title,
        "overlap_minutes": float,
        "suggestion": suggest_resolution(...)
      }
    """
    conflicts: List[Dict[str, Any]] = []
    for i, a in enumerate(blocks):
        for b in blocks[i + 1:]:
            if _blocks_overlap(a.planned_start, a.planned_end,
                               b.planned_start, b.planned_end):
                overlap_mins = (
                    min(a.planned_end, b.planned_end) -
                    max(a.planned_start, b.planned_start)
                ).total_seconds() / 60
                conflicts.append({
                    "block_a": a.title,
                    "block_b": b.title,
                    "overlap_minutes": overlap_mins,
                    "suggestion": suggest_resolution(a, b),
                })
    return conflicts


def find_free_slots(
    blocks: List[Any],
    day_start: datetime,
    day_end: datetime,
    buffer_minutes: int = 5,
) -> List[Tuple[datetime, datetime]]:
    """
    Return a sorted list of (slot_start, slot_end) free intervals within
    [day_start, day_end], accounting for *buffer_minutes* of transition time
    after each block.

    A slot must be at least 5 minutes long to be returned.
    """
    MIN_SLOT = timedelta(minutes=5)
    buf = timedelta(minutes=buffer_minutes)

    # Only consider blocks that fall within the day window
    relevant = sorted(
        [b for b in blocks
         if b.planned_end > day_start and b.planned_start < day_end],
        key=lambda b: b.planned_start,
    )

    free: List[Tuple[datetime, datetime]] = []
    cursor = day_start

    for block in relevant:
        # Slot ends just before the buffer leading into this block
        slot_end = block.planned_start - buf
        if slot_end > cursor + MIN_SLOT:
            free.append((cursor, slot_end))
        # Advance cursor past the block plus its trailing buffer
        cursor = max(cursor, block.planned_end + buf)

    if day_end > cursor + MIN_SLOT:
        free.append((cursor, day_end))

    return free


def suggest_resolution(block_a: Any, block_b: Any) -> Dict[str, Any]:
    """
    Given two conflicting blocks return a resolution suggestion dict.

    Priority rules (V1):
    - Critical and fixed blocks are protected → move the lower-priority one.
    - If both are the same priority, flag for user decision.
    """
    a_fixed = getattr(block_a, "is_fixed", False)
    b_fixed = getattr(block_b, "is_fixed", False)
    a_rank = _rank(getattr(block_a, "priority", "medium"))
    b_rank = _rank(getattr(block_b, "priority", "medium"))

    if a_fixed and not b_fixed:
        return {
            "option": "move_flexible_block",
            "protected": block_a.title,
            "to_move": block_b.title,
            "alternatives": ["compress_low_priority_block", "add_to_recovery"],
        }
    if b_fixed and not a_fixed:
        return {
            "option": "move_flexible_block",
            "protected": block_b.title,
            "to_move": block_a.title,
            "alternatives": ["compress_low_priority_block", "add_to_recovery"],
        }
    if a_rank > b_rank:
        return {
            "option": "move_flexible_block",
            "protected": block_a.title,
            "to_move": block_b.title,
            "alternatives": ["use_free_slot", "add_to_recovery"],
        }
    if b_rank > a_rank:
        return {
            "option": "move_flexible_block",
            "protected": block_b.title,
            "to_move": block_a.title,
            "alternatives": ["use_free_slot", "add_to_recovery"],
        }
    # Equal priority — needs the user to decide
    return {
        "option": "user_decision_required",
        "blocks": [block_a.title, block_b.title],
        "alternatives": [
            "use_free_slot",
            "move_flexible_block",
            "compress_low_priority_block",
            "add_to_recovery",
        ],
    }
