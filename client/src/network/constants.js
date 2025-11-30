/*
Contains multiple utility functions
TODO: move those function into a seperate file

TODO: 
    export const MessageTypes = {
    // Client -> Server Messages
    CLIENT: {
        JOIN: 0,                              // Player joining message
        PLACE_BUILDING: 1,                    // Place building
        ...
    },

    // Server -> Client Messages
    SERVER: {
        PLAYER_JOINED: 5,                     // Player joined
        PLAYER_LEFT: 6,                       // Player left
        BASE_HEALTH_UPDATE: 7,                // Base health update
        ...
    },
};*/


export const Servers = {
    "Moscow": "https://bloble.online/ffa1",
    "Moscow Small Bases": "https://bloble.online/smallbases1",
};

export const MessageTypes = {
    JOIN: 0,                           
    CLIENT_PLACE_BUILDING: 1,            
    CLIENT_UPGRADE_BUILDINGS: 2,         
    CLIENT_REMOVE_BUILDINGS: 3,      
    CLIENT_MOVE_UNITS: 4,             
    PLAYER_JOINED: 5,                    
    PLAYER_LEFT: 6,                      
    BASE_HEALTH_UPDATE: 7,           
    BUILDING_PLACED: 8,                
    BUILDINGS_REMOVED: 9,               
    BUILDINGS_UPGRADED: 10,             
    GAME_STATE: 11,                     
    INITIAL_PLAYER_DATA: 12,           
    RESOURCE_UPDATE: 13,                
    SPAWN_UNIT: 14,                      
    UNITS_POSITION_UPDATE: 15,
    REMOVE_UNIT: 16,
    KILLED: 17,
    SPAWN_BULLET: 18,
    BULLET_POSITION_UPDATE: 19,
    REMOVE_BULLET: 20,
    LEADERBOARD_UPDATE: 21,
    REMOVE_SPAWN_PROTECTION: 22,
    KICK_NOTIFICATION: 23,
    SEND_CHAT_MESSAGE: 24,
    CHAT_MESSAGE: 25,
    UNIT_SPAWN_BULLET: 28,
    BUILDING_PLACEMENT_FAILED: 29,
    UNITS_ROTATION_UPDATE: 30,
    CLIENT_CAMERA_UPDATE: 31,
    INITIAL_BULLET_STATES: 32,
    CLIENT_REQUEST_RESYNC: 33,
    TURRET_ROTATION_UPDATE: 34,
    NEUTRAL_BASE_CAPTURED: 35,
    TOGGLE_UNIT_SPAWNING: 36,
    BARRACKS_ACTIVATION_UPDATE: 37,
    BUY_REPAIR: 38,
    BUY_COMMANDER: 39,
    CLIENT_REQUEST_SKIN_DATA: 40,
    SKIN_DATA: 41,
    HEARTBEAT: 69,
    SERVER_VERSION: 98,
    REBOOT_ALERT: 99,
    ERROR: 100
};

export const BuildingSizes = {
    WALL: { size: 30 },
    SIMPLE_TURRET: { size: 30 },
    SNIPER_TURRET: { size: 33 },
    BARRACKS: { size: 60 },
    GENERATOR: { size: 40 },
    HOUSE: { size: 35 }
};

export const BuildingLimits = {
    WALL: 9999,
    SIMPLE_TURRET: 9999,
    SNIPER_TURRET: 9999,
    BARRACKS: 9999,
    GENERATOR: 9999,
    HOUSE: 64
}

export const BuildingTypes = {
    WALL: 0,
    SIMPLE_TURRET: 1,
    SNIPER_TURRET: 2,
    BARRACKS: 4,
    GENERATOR: 5,
    HOUSE: 6
}

export const BuildingVariantTypes = {
    WALL: {
        BASIC: 0,
        BOULDER: 1,
        SPIKE: 2,
        MICRO_GENERATOR: 3,
    },
    SIMPLE_TURRET: {
        BASIC: 0,
        RAPID_TURRET: 1,
        GATLING_TURRET: 2,
        HEAVY_TURRET: 3,
    },
    SNIPER_TURRET: {
        BASIC: 0,
        SEMI_AUTOMATIC_SNIPER: 1,
        HEAVY_SNIPER: 2,
        ANTI_TANK_GUN: 3,
        TRAPPER: 4,
    },
    BARRACKS: {
        BASIC: 0,
        GREATER_BARRACKS: 1,
        TANK_FACTORY: 2,
        HEAVY_TANK_FACTORY: 3,
        BOOSTER_TANK_FACTORY: 4,
        CANNON_TANK_FACTORY: 5,
        SIEGE_TANK_FACTORY: 6,
        HEAVY_BOOSTER_TANK_FACTORY: 7,
        BOOSTER_CANNON_TANK_FACTORY: 8,
        HEAVY_SIEGE_TANK_FACTORY: 9,
        BOOSTER_SIEGE_TANK_FACTORY: 10,
        CANNON_SIEGE_TANK_FACTORY: 11,
        HEAVY_BOOSTER_SIEGE_TANK_FACTORY: 12,
        BOOSTER_CANNON_SIEGE_TANK_FACTORY: 13,
    },
    GENERATOR: {
        BASIC: 0,
        POWER_PLANT: 1
    },
    HOUSE: {
        BASIC: 0,
        LARGE_HOUSE: 1
    }
};

export const BuildingDetails = {
    WALL: {
        BASIC: {
            variant: BuildingVariantTypes.WALL.BASIC,
            name: "Basic Wall",
            description: "Simple defensive structure.",
            cost: 50,
            size: BuildingSizes.WALL.size,
            next: [BuildingVariantTypes.WALL.BOULDER, BuildingVariantTypes.WALL.MICRO_GENERATOR]
        },
        BOULDER: {
            variant: BuildingVariantTypes.WALL.BOULDER,
            name: "Boulder",
            description: "Stronger than a wall.",
            cost: 80,
            size: BuildingSizes.WALL.size,
            next: [BuildingVariantTypes.WALL.SPIKE]
        },
        SPIKE: {
            variant: BuildingVariantTypes.WALL.SPIKE,
            name: "Spike",
            description: "Stronger than a boulder.",
            cost: 120,
            size: BuildingSizes.WALL.size,
            next: []
        },
        MICRO_GENERATOR: {
            variant: BuildingVariantTypes.WALL.MICRO_GENERATOR,
            name: "Micro Generator",
            description: "Generates power slowly over time.",
            cost: 100,
            size: BuildingSizes.WALL.size,
            next: []
        },
    },
    SIMPLE_TURRET: {
        BASIC: {
            variant: BuildingVariantTypes.SIMPLE_TURRET.BASIC,
            name: "Simple Turret",
            description: "Automatically attacks enemy units.",
            cost: 150,
            range: 350,
            size: BuildingSizes.SIMPLE_TURRET.size,
            next: [BuildingVariantTypes.SIMPLE_TURRET.RAPID_TURRET, BuildingVariantTypes.SIMPLE_TURRET.HEAVY_TURRET]
        },
        RAPID_TURRET: {
            variant: BuildingVariantTypes.SIMPLE_TURRET.RAPID_TURRET,
            name: "Rapid Turret",
            description: "Higher fire rate, lower damage.",
            cost: 200,
            range: 350,
            size: BuildingSizes.SIMPLE_TURRET.size,
            next: [BuildingVariantTypes.SIMPLE_TURRET.GATLING_TURRET]
        },
        GATLING_TURRET: {
            variant: BuildingVariantTypes.SIMPLE_TURRET.GATLING_TURRET,
            name: "Gatling Turret",
            description: "Fires rapidly at close range.",
            cost: 300,
            range: 350,
            size: BuildingSizes.SIMPLE_TURRET.size,
            next: []
        },
        HEAVY_TURRET: {
            variant: BuildingVariantTypes.SIMPLE_TURRET.HEAVY_TURRET,
            name: "Heavy Turret",
            description: "Heavy shots with massive damage.",
            cost: 500,
            range: 350,
            size: BuildingSizes.SIMPLE_TURRET.size,
            next: []
        }
    },
    SNIPER_TURRET: {
        BASIC: {
            variant: BuildingVariantTypes.SNIPER_TURRET.BASIC,
            name: "Sniper Turret",
            description: "High damage, long range, slow fire rate.",
            cost: 200,
            range: 400,
            size: BuildingSizes.SNIPER_TURRET.size,
            next: [BuildingVariantTypes.SNIPER_TURRET.SEMI_AUTOMATIC_SNIPER, BuildingVariantTypes.SNIPER_TURRET.HEAVY_SNIPER]
        },
        SEMI_AUTOMATIC_SNIPER: {
            variant: BuildingVariantTypes.SNIPER_TURRET.SEMI_AUTOMATIC_SNIPER,
            name: "Semi-Automatic",
            description: "Higher fire rate.",
            cost: 250,
            range: 450,
            size: BuildingSizes.SNIPER_TURRET.size,
            next: []
        },
        HEAVY_SNIPER: {
            variant: BuildingVariantTypes.SNIPER_TURRET.HEAVY_SNIPER,
            name: "Heavy Sniper",
            description: "High damage, long range, slow fire rate.",
            cost: 250,
            range: 450,
            size: BuildingSizes.SNIPER_TURRET.size,
            next: [BuildingVariantTypes.SNIPER_TURRET.TRAPPER, BuildingVariantTypes.SNIPER_TURRET.ANTI_TANK_GUN]
        },
        ANTI_TANK_GUN: {
            variant: BuildingVariantTypes.SNIPER_TURRET.ANTI_TANK_GUN,
            name: "Anti-Tank Gun",
            description: "Huge damage, slow fire rate.",
            cost: 400,
            range: 450,
            size: BuildingSizes.SNIPER_TURRET.size,
            next: []
        },
        TRAPPER: {
            variant: BuildingVariantTypes.SNIPER_TURRET.TRAPPER,
            name: "Trapper",
            description: "Fires long-lasting traps.",
            cost: 550,
            range: 450,
            size: BuildingSizes.SNIPER_TURRET.size,
            next: []
        },
    },
    BARRACKS: {
        BASIC: {
            variant: BuildingVariantTypes.BARRACKS.BASIC,
            name: "Barracks",
            description: "Trains Soldiers.",
            cost: 150,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.GREATER_BARRACKS, BuildingVariantTypes.BARRACKS.TANK_FACTORY]
        },
        GREATER_BARRACKS: {
            variant: BuildingVariantTypes.BARRACKS.GREATER_BARRACKS,
            name: "Greater Barracks",
            description: "Trains soldiers at a faster rate.",
            cost: 200,
            size: BuildingSizes.BARRACKS.size,
            next: []
        },
        TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.TANK_FACTORY,
            name: "Tank Factory",
            description: "Produces Tanks over time.",
            cost: 200,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.HEAVY_TANK_FACTORY, BuildingVariantTypes.BARRACKS.BOOSTER_TANK_FACTORY]
        },
        HEAVY_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.HEAVY_TANK_FACTORY,
            name: "H. Tank Factory",
            description: "Produces Heavy Tanks.",
            cost: 250,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.CANNON_TANK_FACTORY, BuildingVariantTypes.BARRACKS.SIEGE_TANK_FACTORY]
        },
        BOOSTER_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.BOOSTER_TANK_FACTORY,
            name: "B. Tank Factory",
            description: "Produces Booster Engine Tanks.",
            cost: 250,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.HEAVY_BOOSTER_TANK_FACTORY, BuildingVariantTypes.BARRACKS.BOOSTER_CANNON_TANK_FACTORY]
        },
        CANNON_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.CANNON_TANK_FACTORY,
            name: "C. Tank Factory",
            description: "Produces Cannon Tanks.",
            cost: 300,
            size: BuildingSizes.BARRACKS.size,
            next: []
        },
        SIEGE_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.SIEGE_TANK_FACTORY,
            name: "Siege Factory",
            description: "Produces Siege Tanks.",
            cost: 300,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.HEAVY_SIEGE_TANK_FACTORY, BuildingVariantTypes.BARRACKS.BOOSTER_SIEGE_TANK_FACTORY]
        },
        HEAVY_BOOSTER_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.HEAVY_BOOSTER_TANK_FACTORY,
            name: "H.B. Tank Factory",
            description: "Produces strong, heavily armored Booster Engine Tanks.",
            cost: 300,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.BOOSTER_SIEGE_TANK_FACTORY]
        },
        BOOSTER_CANNON_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.BOOSTER_CANNON_TANK_FACTORY,
            name: "B.C. Tank Factory",
            description: "Produces Booster Engine Cannon Tanks.",
            cost: 300,
            size: BuildingSizes.BARRACKS.size,
            next: []
        },
        HEAVY_SIEGE_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.HEAVY_SIEGE_TANK_FACTORY,
            name: "H. Siege Factory",
            description: "Produces Heavy Armor Siege Tanks.",
            cost: 350,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.CANNON_SIEGE_TANK_FACTORY, BuildingVariantTypes.BARRACKS.LIGHT_BOOSTER_SIEGE_TANK_FACTORY]
        },
        BOOSTER_SIEGE_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.BOOSTER_SIEGE_TANK_FACTORY,
            name: "B. Siege Factory",
            description: "Produces Booster Engine Siege Tanks.",
            cost: 350,
            size: BuildingSizes.BARRACKS.size,
            next: [BuildingVariantTypes.BARRACKS.HEAVY_BOOSTER_SIEGE_TANK_FACTORY, BuildingVariantTypes.BARRACKS.BOOSTER_CANNON_SIEGE_TANK_FACTORY]
        },
        CANNON_SIEGE_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.CANNON_SIEGE_TANK_FACTORY,
            name: "C. Siege Factory",
            description: "Produces Cannon Siege Tanks.",
            cost: 400,
            size: BuildingSizes.BARRACKS.size,
            next: []
        },
        HEAVY_BOOSTER_SIEGE_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.HEAVY_BOOSTER_SIEGE_TANK_FACTORY,
            name: "H.B. Siege Factory",
            description: "Produces strong, heavily armored Booster Engine Siege Tanks.",
            cost: 400,
            size: BuildingSizes.BARRACKS.size,
            next: []
        },
        BOOSTER_CANNON_SIEGE_TANK_FACTORY: {
            variant: BuildingVariantTypes.BARRACKS.BOOSTER_CANNON_SIEGE_TANK_FACTORY,
            name: "B.C. Siege Factory",
            description: "Produces Booster Engine Cannon Siege Tanks.",
            cost: 400,
            size: BuildingSizes.BARRACKS.size,
            next: []
        },
    },
    GENERATOR: {
        BASIC: {
            variant: BuildingVariantTypes.GENERATOR.BASIC,
            name: "Generator",
            description: "Basic power supply.",
            cost: 100,
            size: BuildingSizes.GENERATOR.size,
            next: [BuildingVariantTypes.GENERATOR.POWER_PLANT]
        },
        POWER_PLANT: {
            variant: BuildingVariantTypes.GENERATOR.POWER_PLANT,
            name: "Power Plant",
            description: "Increased energy output.",
            cost: 200,
            size: BuildingSizes.GENERATOR.size,
            next: []
        }
    },
    HOUSE: {
        BASIC: {
            variant: BuildingVariantTypes.HOUSE.BASIC,
            name: "House",
            description: "Increases population limit.",
            cost: 120,
            size: BuildingSizes.HOUSE.size,
            next: [BuildingVariantTypes.HOUSE.LARGE_HOUSE]
        },
        LARGE_HOUSE: {
            variant: BuildingVariantTypes.HOUSE.LARGE_HOUSE,
            name: "Large House",
            description: "Increases population limit.",
            cost: 150,
            size: BuildingSizes.HOUSE.size,
            next: []
        },
    }
};

export const BulletTypes = {
    BASIC: 0,
    TRAPPER: 1
}

export const BulletDetails = {
    SIMPLE_TURRET: {
        BASIC: {
            type: BulletTypes.BASIC,
            speed: 500,
            size: 10
        },
        RAPID_TURRET: {
            type: BulletTypes.BASIC,
            speed: 500,
            size: 10
        },
        GATLING_TURRET: {
            type: BulletTypes.BASIC,
            speed: 600,
            size: 8
        },
        HEAVY_TURRET: {
            type: BulletTypes.BASIC,
            speed: 200,
            size: 20
        }
    },
    SNIPER_TURRET: {
        BASIC: {
            type: BulletTypes.BASIC,
            speed: 800,
            size: 10
        },
        SEMI_AUTOMATIC_SNIPER: {
            type: BulletTypes.BASIC,
            speed: 800,
            size: 10
        },
        HEAVY_SNIPER: {
            type: BulletTypes.BASIC,
            speed: 900,
            size: 12
        },
        ANTI_TANK_GUN: {
            type: BulletTypes.BASIC,
            speed: 1000,
            size: 12
        },
        TRAPPER: {
            type: BulletTypes.TRAPPER,
            speed: 300,
            size: 20
        },
    }
};

export const UnitTypes = {
    SOLDIER: 0,
    TANK: 1,
    SIEGE_TANK: 2,
    COMMANDER: 3,
    TRI_COMMANDER: 4,
};

export const UnitVariantTypes = {
    SOLDIER: {
        BASIC: 0,
        LIGHT_ARMOR: 1,
    },
    TANK: {
        BASIC: 0,
        HEAVY_ARMOR: 1,
        BOOSTER_ENGINE: 2,
        CANNON: 3,
        HEAVY_ARMOR_BOOSTER_ENGINE: 4,
        BOOSTER_ENGINE_CANNON: 5
    },
    SIEGE_TANK: {
        BASIC: 0,
        HEAVY_ARMOR: 1,
        BOOSTER_ENGINE: 2,
        CANNON: 3,
        HEAVY_ARMOR_BOOSTER_ENGINE: 4,
        BOOSTER_ENGINE_CANNON: 5
    },
    COMMANDER: {
        BASIC: 0,
    },
    TRI_COMMANDER: {
        BASIC: 0,
    }
};

export const UnitDetails = {
    SOLDIER: {
        BASIC: {
            variant: UnitVariantTypes.SOLDIER.BASIC,
            size: 18,
        },
        LIGHT_ARMOR: {
            variant: UnitVariantTypes.SOLDIER.LIGHT_ARMOR,
            size: 18,
        },
    },
    TANK: {
        BASIC: {
            variant: UnitVariantTypes.TANK.BASIC,
            size: 28,
        },
        HEAVY_ARMOR: {
            variant: UnitVariantTypes.TANK.HEAVY_ARMOR,
            size: 28,
        },
        BOOSTER_ENGINE: {
            variant: UnitVariantTypes.TANK.BOOSTER_ENGINE,
            size: 28,
        },
        CANNON: {
            variant: UnitVariantTypes.TANK.CANNON,
            size: 28,
        },
        HEAVY_ARMOR: {
            variant: UnitVariantTypes.TANK.LIGHT_ARMOR,
            size: 28,
        },
        HEAVY_ARMOR_BOOSTER_ENGINE: {
            variant: UnitVariantTypes.TANK.HEAVY_ARMOR_BOOSTER_ENGINE,
            size: 28,
        },
        BOOSTER_ENGINE_CANNON: {
            variant: UnitVariantTypes.TANK.BOOSTER_ENGINE_CANNON,
            size: 28,
        }
    },
    SIEGE_TANK: {
        BASIC: {
            variant: UnitVariantTypes.SIEGE_TANK.BASIC,
            size: 38,
        },
        HEAVY_ARMOR: {
            variant: UnitVariantTypes.SIEGE_TANK.HEAVY_ARMOR,
            size: 38,
        },
        BOOSTER_ENGINE: {
            variant: UnitVariantTypes.SIEGE_TANK.BOOSTER_ENGINE,
            size: 38,
            next: []
        },
        CANNON: {
            variant: UnitVariantTypes.SIEGE_TANK.CANNON,
            size: 38,
            next: []
        },
        HEAVY_ARMOR_BOOSTER_ENGINE: {
            variant: UnitVariantTypes.SIEGE_TANK.HEAVY_ARMOR_BOOSTER_ENGINE,
            size: 38,
        },
        BOOSTER_ENGINE_CANNON_SIEGE_TANK: {
            variant: UnitVariantTypes.SIEGE_TANK.BOOSTER_ENGINE_CANNON_SIEGE_TANK,
            size: 38,
        }
    },
    COMMANDER: {
        BASIC: {
            variant: UnitVariantTypes.COMMANDER.BASIC,
            name: "Commander",
            description: "Powerful unit, you can only have 1",
            cost: 5000,
            size: 40,
        },
    },
    TRI_COMMANDER: {
        BASIC: {
            variant: UnitVariantTypes.TRI_COMMANDER.BASIC,
            name: "Anti-Tank Commander",
            description: "",
            cost: 5000,
            size: 40,
        },
    },
};

export const UnitBulletDetails = {
    TANK: {
        type: UnitTypes.TANK,
        CANNON: {
            variant: UnitVariantTypes.TANK.CANNON,
            type: BulletTypes.BASIC,
            speed: 500,
            size: 6
        },
        BOOSTER_ENGINE_CANNON: {
            variant: UnitVariantTypes.TANK.BOOSTER_ENGINE_CANNON,
            type: BulletTypes.BASIC,
            speed: 500,
            size: 6
        }
    },
    SIEGE_TANK: {
        type: UnitTypes.SIEGE_TANK,
        CANNON: {
            variant: UnitVariantTypes.SIEGE_TANK.CANNON,
            type: BulletTypes.BASIC,
            speed: 500,
            size: 8
        },
        BOOSTER_ENGINE_CANNON: {
            variant: UnitVariantTypes.SIEGE_TANK.BOOSTER_ENGINE_CANNON,
            type: BulletTypes.BASIC,
            speed: 500,
            size: 8
        }
    },
    COMMANDER: {
        type: UnitTypes.COMMANDER,
        BASIC: {
            variant: UnitVariantTypes.COMMANDER.BASIC,
            type: BulletTypes.BASIC,
            speed: 700,
            size: 12
        },
    }
}

export function getAvailableUnitUpgrades (unitType, unitVariant) {
    // Find the key corresponding to the unitType
    const unitKey = Object.keys(UnitTypes).find(key => UnitTypes[key] === unitType);

    // Retrieve upgrade details for the unitType
    const details = Object.values(UnitDetails[unitKey])[unitVariant];
    let availableUpgrades = [];
    details.next.forEach(unit => {
        availableUpgrades.push(Object.values(UnitDetails[unitKey])[unit]);
    });

    return availableUpgrades;
}

export function getUnitDetails (unitType, unitVariant) {
    const unitKey = Object.keys(UnitTypes).find(key => UnitTypes[key] === unitType);
    const details = Object.values(UnitDetails[unitKey])[unitVariant];
    return details;
}

export function getBulletDetails (buildingType, buildingVariant) {
    // Find the key corresponding to the buildingType
    const buildingKey = Object.keys(BuildingTypes).find(key => BuildingTypes[key] === buildingType);
    const details = Object.values(BulletDetails[buildingKey])[buildingVariant];
    return details;
}

export function getUnitBulletDetails (unitType, unitVariant) {
    // Find the key corresponding to the unitType in UnitBulletDetails
    const unitKey = Object.keys(UnitBulletDetails).find(
        key => UnitBulletDetails[key].type === unitType
    );

    // Ensure the unit type exists in UnitBulletDetails
    if (unitKey) {
        const unitDetails = UnitBulletDetails[unitKey];

        // Now find the variant that matches the provided unitVariant
        const variantKey = Object.keys(unitDetails).find(
            key => unitDetails[key].variant === unitVariant
        );

        // If a variant is found, return its details
        if (variantKey) {
            const bulletDetail = unitDetails[variantKey];
            return bulletDetail;
        }
    }

    return null; // Handle the case where the unit or variant doesn't exist
}


export function getAvailableBuildingUpgrades (buildingType, buildingVariant) {
    // Find the key corresponding to the buildingType
    const buildingKey = Object.keys(BuildingTypes).find(key => BuildingTypes[key] === buildingType);

    // Retrieve upgrade details for the buildingType
    const details = Object.values(BuildingDetails[buildingKey])[buildingVariant];
    let availableUpgrades = [];
    details.next.forEach(building => {
        availableUpgrades.push(Object.values(BuildingDetails[buildingKey])[building]);
    });

    return availableUpgrades;
}

export function getBuildingDetails (buildingType, buildingVariant = 0) {
    // Find the key corresponding to the buildingType
    const buildingKey = Object.keys(BuildingTypes).find(key => BuildingTypes[key] === buildingType);

    // Retrieve upgrade details for the buildingType and upgradeLevel
    const details = Object.values(BuildingDetails[buildingKey])[buildingVariant];
    return details;
}

export function calculateRequiredXP(level, baseXP = 50){
    return Math.round(baseXP * Math.pow(level, 1.1));
}

export function getColorForLevel(level) {
    // Ensure the level is between 0 and 100
    level = Math.min(100, Math.max(0, level));
  
    // Calculate the gradient ratio
    const gradientRatio = level / 100;
  
    const colors = [
        "#60eaff", "#a0c7f9", "#61b0ff", "#9e82f6", "#61ffb0", "#7aff60", 
        "#7bdc6a", "#3fc6a8", "#ffda48", "#ffb061", "#d88166", "#ff6a4d", 
        "#ff605f", "#d16aa5", "#ff6ef1"
    ];
  
    // Calculate the index and the ratio between two colors
    const numStops = colors.length;
    const stopIndex = Math.floor(gradientRatio * (numStops - 1));
    const nextStopIndex = Math.min(stopIndex + 1, numStops - 1);
    const stopRatio = (gradientRatio * (numStops - 1)) - stopIndex;
  
    // Extract the RGB values from the two closest colors
    const getColorRgb = (hex) => {
        const bigint = parseInt(hex.slice(1), 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255,
        };
    };

    const color1 = getColorRgb(colors[stopIndex]);
    const color2 = getColorRgb(colors[nextStopIndex]);
  
    // Interpolate between the two colors
    const r = Math.round(color1.r + (color2.r - color1.r) * stopRatio);
    const g = Math.round(color1.g + (color2.g - color1.g) * stopRatio);
    const b = Math.round(color1.b + (color2.b - color1.b) * stopRatio);

    // Adjust colors to ensure better contrast with white text
    const adjustForContrast = (r, g, b) => {
        // If the color is too light, darken it slightly
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b);
        if (luminance > 200) {  // Bright colors
            r = Math.max(0, r - 30); // Darken slightly
            g = Math.max(0, g - 30);
            b = Math.max(0, b - 30);
        }
        return { r, g, b };
    };

    const adjustedColor = adjustForContrast(r, g, b);
  
    // Return the new color as a hex code
    return `#${((1 << 24) + (adjustedColor.r << 16) + (adjustedColor.g << 8) + adjustedColor.b).toString(16).slice(1)}`;
}

export function darkenColor (hex, percent) {
    // Convert HEX to RGB
    let r = 0, g = 0, b = 0;

    if (hex.length === 4) { // 3 digits
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) { // 6 digits
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
    }

    // Darken each color component
    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));

    // Convert RGB back to HEX
    return rgbToHex(r, g, b);
}

function rgbToHex (r, g, b) {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
