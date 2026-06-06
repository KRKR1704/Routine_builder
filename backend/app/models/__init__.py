# Import every model so SQLModel.metadata registers all tables before create_all().
# Order matters: tables with no foreign keys first, then dependent ones.
from .user import User, UserPreferences  # noqa: F401
from .routine import RoutineBlock  # noqa: F401
from .task import OneTimeTask  # noqa: F401
from .sleep import SleepLog, PowerNap  # noqa: F401
from .schedule import DailySchedule, ScheduleBlock  # noqa: F401
from .debt import RoutineDebt  # noqa: F401
from .recovery import RecoveryBlock  # noqa: F401
from .review import DailyReview  # noqa: F401
