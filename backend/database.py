"""
ShieldRide Database Module
Proper MongoDB integration via Motor (async) with graceful in-memory fallback.
All rider/policy/claim data is stored in MongoDB when available.
If MongoDB is unreachable, data is stored in memory for demo purposes.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings
import logging

logger = logging.getLogger(__name__)

# ─── MongoDB Connection ───
client: AsyncIOMotorClient | None = None
db = None
_mongo_available = False

try:
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=3000,
        connectTimeoutMS=3000
    )
    db = client[settings.MONGO_DB_NAME]
    logger.info(f"MongoDB client initialized for database: {settings.MONGO_DB_NAME}")
except Exception as e:
    logger.warning(f"MongoDB connection init failed: {e}")
    client = None
    db = None


# ─── Collections (set after verification) ───
riders_collection = None
policies_collection = None
claims_collection = None
events_collection = None
dark_stores_collection = None


# ─── In-Memory Fallback Store ───
# Used when MongoDB is not available (demo/dev mode)
mem_store: dict[str, list] = {
    "riders": [],
    "policies": [],
    "claims": [],
    "events": [],
    "dark_stores": [],
}


class InMemoryCollection:
    """
    A minimal MongoDB-like collection backed by an in-memory list.
    Supports insert_one, find_one, find, update_one, count_documents, aggregate, create_index.
    """
    def __init__(self, name: str):
        self.name = name
        if name not in mem_store:
            mem_store[name] = []

    @property
    def _data(self):
        return mem_store[self.name]

    async def insert_one(self, doc: dict):
        self._data.append(doc.copy())
        return type('Result', (), {'inserted_id': doc.get('_id', id(doc))})()

    async def insert_many(self, docs: list):
        for d in docs:
            self._data.append(d.copy())

    async def find_one(self, filter_dict: dict | None = None):
        if not filter_dict:
            return self._data[0] if self._data else None
        for doc in self._data:
            if all(doc.get(k) == v for k, v in filter_dict.items()):
                return doc.copy()
        return None

    def find(self, filter_dict: dict | None = None):
        return InMemoryCursor(self._data, filter_dict)

    async def update_one(self, filter_dict: dict, update: dict):
        for doc in self._data:
            if all(doc.get(k) == v for k, v in filter_dict.items()):
                if "$set" in update:
                    doc.update(update["$set"])
                return type('Result', (), {'modified_count': 1})()
        return type('Result', (), {'modified_count': 0})()

    async def count_documents(self, filter_dict: dict | None = None):
        if not filter_dict:
            return len(self._data)
        return sum(1 for d in self._data if all(d.get(k) == v for k, v in filter_dict.items()))

    def aggregate(self, pipeline: list):
        return InMemoryAggCursor(self._data, pipeline)

    async def create_index(self, *args, **kwargs):
        pass  # No-op for in-memory


class InMemoryCursor:
    def __init__(self, data: list, filter_dict: dict | None):
        if filter_dict:
            self._data = [d for d in data if all(d.get(k) == v for k, v in filter_dict.items())]
        else:
            self._data = list(data)
        self._sort_key = None
        self._sort_dir = 1
        self._limit_n = None

    def sort(self, key: str, direction: int = 1):
        self._sort_key = key
        self._sort_dir = direction
        return self

    def limit(self, n: int):
        self._limit_n = n
        return self

    async def to_list(self, length: int = 100):
        result = list(self._data)
        if self._sort_key:
            result.sort(key=lambda x: x.get(self._sort_key, ''), reverse=(self._sort_dir == -1))
        limit = self._limit_n or length
        return result[:limit]


class InMemoryAggCursor:
    def __init__(self, data: list, pipeline: list):
        self._data = data
        self._pipeline = pipeline

    async def to_list(self, length: int = 100):
        # Simple $group support for sum
        for stage in self._pipeline:
            if "$group" in stage:
                group = stage["$group"]
                total = 0
                count = 0
                for doc in self._data:
                    for field_name, op in group.items():
                        if field_name == "_id":
                            continue
                        if isinstance(op, dict) and "$sum" in op:
                            src = op["$sum"]
                            if src == 1:
                                count += 1
                            elif isinstance(src, str) and src.startswith("$"):
                                total += doc.get(src[1:], 0)
                return [{"_id": None, "total": total, "count": count or len(self._data)}]
        return []


# ─── Startup: Verify connection and initialize collections ───
async def verify_db_connection() -> bool:
    """Verify MongoDB is reachable. Sets up collections accordingly."""
    global _mongo_available
    global riders_collection, policies_collection, claims_collection, events_collection, dark_stores_collection

    if client is not None:
        try:
            await client.admin.command("ping")
            logger.info("✅ MongoDB connection verified successfully")
            _mongo_available = True

            # Use real MongoDB collections
            riders_collection = db["riders"]
            policies_collection = db["policies"]
            claims_collection = db["claims"]
            events_collection = db["trigger_events"]
            dark_stores_collection = db["dark_stores"]

            # Create indexes
            await riders_collection.create_index("mobile_number", unique=True, sparse=True)
            await riders_collection.create_index("rider_id", unique=True)
            await policies_collection.create_index("rider_id")
            await policies_collection.create_index("policy_id", unique=True)
            await claims_collection.create_index("rider_id")
            await events_collection.create_index("event_id", unique=True)

            return True
        except Exception as e:
            logger.warning(f"❌ MongoDB connection verification failed: {e}")

    # Fall back to in-memory collections
    logger.info("📋 Using in-memory collections (demo mode)")
    _mongo_available = False
    riders_collection = InMemoryCollection("riders")
    policies_collection = InMemoryCollection("policies")
    claims_collection = InMemoryCollection("claims")
    events_collection = InMemoryCollection("events")
    dark_stores_collection = InMemoryCollection("dark_stores")

    return False


def is_mongo_connected() -> bool:
    return _mongo_available


# ─── Seed Demo Data ───
async def seed_dark_stores():
    """Seed dark store data if collection is empty."""
    if dark_stores_collection is None:
        return
    count = await dark_stores_collection.count_documents({})
    if count == 0:
        await dark_stores_collection.insert_many(DEMO_DARK_STORES)
        logger.info(f"Seeded {len(DEMO_DARK_STORES)} dark stores")


# ─── Demo Data Constants ───

DEMO_DARK_STORES = [
    {
        "store_id": "BLK-BLR-047",
        "zone": "Koramangala 4th Block",
        "availability": "Closed",
        "delivery_eta": None,
        "serviceable_pincodes": ["560034", "560095"],
        "hub_radius_km": 2.1,
        "assigned_riders": 12,
        "active_orders_in_queue": 0,
        "infrastructure": "ground_floor"
    },
    {
        "store_id": "BLK-BLR-061",
        "zone": "Bellandur",
        "availability": "Open",
        "delivery_eta": 8,
        "serviceable_pincodes": ["560103", "560037"],
        "hub_radius_km": 2.5,
        "assigned_riders": 18,
        "active_orders_in_queue": 5,
        "infrastructure": "ground_floor"
    },
    {
        "store_id": "BLK-BLR-033",
        "zone": "Indiranagar",
        "availability": "Open",
        "delivery_eta": 6,
        "serviceable_pincodes": ["560038", "560008"],
        "hub_radius_km": 2.0,
        "assigned_riders": 15,
        "active_orders_in_queue": 7,
        "infrastructure": "ground_floor"
    },
    {
        "store_id": "BLK-BLR-089",
        "zone": "Whitefield",
        "availability": "Open",
        "delivery_eta": 10,
        "serviceable_pincodes": ["560066", "560048"],
        "hub_radius_km": 3.0,
        "assigned_riders": 20,
        "active_orders_in_queue": 4,
        "infrastructure": "ground_floor"
    },
    {
        "store_id": "BLK-BLR-092",
        "zone": "Indiranagar 100ft Road",
        "availability": "Open",
        "delivery_eta": 7,
        "serviceable_pincodes": ["560038"],
        "hub_radius_km": 1.8,
        "assigned_riders": 10,
        "active_orders_in_queue": 3,
        "infrastructure": "ground_floor"
    }
]

# Demo insurer credentials
DEMO_INSURER = {
    "email": "admin@shieldride.in",
    "password": "shield2026",
    "name": "ShieldRide Admin",
    "role": "insurer"
}
