package game

type BuildingType byte
type BuildingVariant byte
type UnitType byte
type UnitVariant byte
type Permission byte
type GameMode byte

const (
	WALL          BuildingType = 0
	SIMPLE_TURRET BuildingType = 1
	SNIPER_TURRET BuildingType = 2
	BARRACKS      BuildingType = 4
	GENERATOR     BuildingType = 5
	HOUSE         BuildingType = 6
)

const (
	// Default
	BASIC_BUILDING BuildingVariant = 0

	// Wall
	BOULDER         BuildingVariant = 1
	SPIKE           BuildingVariant = 2
	MICRO_GENERATOR BuildingVariant = 3

	// Simple Turret
	RAPID_TURRET   BuildingVariant = 1
	GATLING_TURRET BuildingVariant = 2
	HEAVY_TURRET   BuildingVariant = 3

	// Sniper Turret
	SEMI_AUTOMATIC_SNIPER BuildingVariant = 1
	HEAVY_SNIPER          BuildingVariant = 2
	ANTI_TANK_GUN         BuildingVariant = 3

	TRAPPER       BuildingVariant = 4
	HEAVY_TRAPPER BuildingVariant = 5

	// Barracks
	GREATER_BARRACKS BuildingVariant = 1
	TANK_FACTORY     BuildingVariant = 2

	HEAVY_TANK_FACTORY   BuildingVariant = 3
	BOOSTER_TANK_FACTORY BuildingVariant = 4

	CANNON_TANK_FACTORY         BuildingVariant = 5
	SIEGE_TANK_FACTORY          BuildingVariant = 6
	HEAVY_BOOSTER_TANK_FACTORY  BuildingVariant = 7
	BOOSTER_CANNON_TANK_FACTORY BuildingVariant = 8

	HEAVY_SIEGE_TANK_FACTORY   BuildingVariant = 9
	BOOSTER_SIEGE_TANK_FACTORY BuildingVariant = 10

	CANNON_SIEGE_TANK_FACTORY         BuildingVariant = 11
	HEAVY_BOOSTER_SIEGE_TANK_FACTORY  BuildingVariant = 12
	BOOSTER_CANNON_SIEGE_TANK_FACTORY BuildingVariant = 13

	// House
	POWER_PLANT BuildingVariant = 1
	LARGE_HOUSE BuildingVariant = 1
)

const (
	SOLDIER    UnitType = 0
	TANK       UnitType = 1
	SIEGE_TANK UnitType = 2
	COMMANDER  UnitType = 3
)

const (
	BASIC_UNIT UnitVariant = 0

	LIGHT_ARMOR_SOLDIER UnitVariant = 1

	HEAVY_ARMOR_TANK                UnitVariant = 1
	BOOSTER_ENGINE_TANK             UnitVariant = 2
	CANNON_TANK                     UnitVariant = 3
	HEAVY_ARMOR_BOOSTER_ENGINE_TANK UnitVariant = 4
	BOOSTER_ENGINE_CANNON_TANK      UnitVariant = 5

	HEAVY_ARMOR_SIEGE_TANK                UnitVariant = 1
	BOOSTER_ENGINE_SIEGE_TANK             UnitVariant = 2
	CANNON_SIEGE_TANK                     UnitVariant = 3
	HEAVY_ARMOR_BOOSTER_ENGINE_SIEGE_TANK UnitVariant = 4
	BOOSTER_ENGINE_CANNON_SIEGE_TANK      UnitVariant = 5
)

const (
	PERMISSION_NONE      Permission = 0 // User with no special permissions
	PERMISSION_MODERATOR Permission = 1 // Moderator has limited access
	PERMISSION_ADMIN     Permission = 2 // Admin has full access
)

const (
	MODE_FFA         GameMode = 0 // Free For All
	MODE_SMALL_BASES GameMode = 1 // Small player bases, big central neutral base
)

const (
	// Player configuration
	PLAYER_INITIAL_POPULATION = 64
	PLAYER_INITIAL_HEALTH     = 2000
	PLAYER_INITIAL_POWER      = 6000
	PLAYER_MAX_POWER          = 8000

	// Player timeout and protection settings
	PLAYER_TIMEOUT                 = 10 // Minutes
	PLAYER_SPAWN_PROTECTION_TIME   = 10 // Minutes
	PLAYER_SPAWN_PROTECTION_RADIUS = 255 + 145

	// Player health regeneration settings
	PLAYER_HEALTH_REGENERATION           = 30
	PLAYER_HEALTH_REGENERATION_FREQUENCY = 30 // Seconds

	// Player building settings
	PLAYER_MAX_BUILDING_RADIUS = 350
	PLAYER_MIN_BUILDING_RADIUS = 120
	PLAYER_MAX_CORE_RADIUS     = PLAYER_MIN_BUILDING_RADIUS - 2
	PLAYER_SMALL_BASES_CORE_RADIUS = 80 // Smaller core radius for Small Bases mode

	// Neutral base configuration
	NEUTRAL_BASE_POPULATION                    = 32
	NEUTRAL_BASE_INITIAL_HEALTH                = 1000
	NEUTRAL_BASE_HEALTH_REGENERATION           = 50
	NEUTRAL_BASE_HEALTH_REGENERATION_FREQUENCY = 30 // Seconds
	NEUTRAL_BASE_MAX_BUILDING_RADIUS           = 260
	NEUTRAL_BASE_MIN_BUILDING_RADIUS           = 82
	NEUTRAL_BASE_MAX_CORE_RADIUS               = NEUTRAL_BASE_MIN_BUILDING_RADIUS - 2
	NEUTRAL_BASE_CAPTURE_SCORE                 = 10 // Per Second

	// Unit and detection settings
	BARRACKS_UNIT_SPAWN_RADIUS = 100
	UNIT_DETECTION_RADIUS      = 1000

	KICK_REASON_TIMEOUT   = 0
	KICK_REASON_SCRIPTING = 1

	COMMANDER_COST = 7000

	// Player reconnection settings
	PLAYER_RECONNECTION_WINDOW = 45 // Seconds
)
