import Player from "../Player.js";
import SkinCache from "../../components/SkinCache.js";

export default class NeutralBase extends Player {
    constructor (id, position = { x: 0, y: 0 }, health = 1000, ownerId = null, gamemode = 0) {
        super();
        this.id = id;
        this.ownerID = null;
        this.defaultName = "Neutral";
        this.name = this.defaultName;
        this.nameWidth = null;
        this.defaultColor = "#CCCCCC";
        this.color = this.defaultColor;
        this.position = position;
        this.health = { current: health, max: 1000 };
        this.targetHealth = health; // Target health value for animation

        // Check if this is the central neutral base (position 0,0) in Small Bases mode
        const isCentralBase = position.x === 0 && position.y === 0;
        const isSmallBasesMode = gamemode === 1;

        if (isCentralBase && isSmallBasesMode) {
            this.buildingRadius = {
                max: 400,
                min: 82
            }
            this.coreRadius = { max: 80 }; // Normal core radius value
        } else {
            this.buildingRadius = {
                max: 260,
                min: 82
            }
            this.coreRadius = { max: this.buildingRadius.min - 2 };
        }
        this.buildings = [];
        this.borderRotation = 0;
        this.hasSpawnProtection = false;
    }

    update (deltaTime) {
        super.updateHealth(deltaTime);
        super.updateBullets(deltaTime);
        super.updateBuildings(deltaTime);
    }

    reset () {
        this.ownerID = null;
        this.color = this.defaultColor;
        this.name = this.defaultName;
        this.skin = null;
        this.setHealth(this.health.max);
        this.nameWidth = null; // Reset the name width
        this.buildings.forEach(building => building.setColor(this.defaultColor));
        this.bullets.forEach(bullet => bullet.setColor(this.defaultColor));
    }

    setOwner (player) {
        this.ownerID = player.id;
        this.color = player.color;
        this.name = player.name;
        this.nameWidth = null; // Reset the name width
        this.buildings.forEach(building => building.setColor(this.color));
        this.bullets.forEach(bullet => bullet.setColor(this.color));
       
        // Handle skin asynchronously
        if (player.skin) {
            this.skin = player.skin;
        } else {
            player.getSkin().then(() => {
                this.skin = player.skin;
            }).catch(error => {
                console.error("Error loading skin for player:", error);
            });
        }
    }

    clear () {
        this.buildings = [];
        this.bullets = [];
    }
}