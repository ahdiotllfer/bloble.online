import Renderable from "../components/Renderable.js";
import Building from "./Building.js";
import Unit from "./Unit.js";
import ThemeManager from "../components/managers/ThemeManager.js";
import SkinCache from "../components/SkinCache.js";

export default class Player extends Renderable {
    constructor (id, name = "blobl.io", color, skinID = 0, position = { x: 0, y: 0 }, health = 2000, hasSpawnProtection = true, maxBuildingRadius = 350, gamemode = 0) {
        super();
        this.isVisible = true;
        this.isClient = false; // Indicates whether this player instance is the client player
        this.id = id;
        this.capturedNeutralIds = []; // Holds id's of captured neutrals
        this.name = name;
        this.nameWidth = null;
        this.color = color;
        this.skin = null; // Initially no skin
        this.skinID = skinID; // The skin ID to fetch
        this.skinLoaded = false;
        this.position = position;
        this.health = { current: health, max: 2000 };
        this.targetHealth = health; // Target health value for animation
        this.springVelocity = 0;
        this.springDamping = 0.1;
        this.springStiffness = 0.005;
        // Set building radius based on gamemode
        if (gamemode === 1) { // Small Bases mode
            this.buildingRadius = {
                max: maxBuildingRadius,
                min: 80
            }
            this.coreRadius = { max: 78 }; // min - 2 = 80 - 2 = 78
        } else {
            this.buildingRadius = {
                max: maxBuildingRadius,
                min: 120
            }
            this.coreRadius = { max: this.buildingRadius.min - 2 }; // Normal core radius
        }
        console.log(`Player ${this.id} building radius: max=${this.buildingRadius.max}, min=${this.buildingRadius.min}`);

        this.buildingCache = null;
        this.buildingCacheTimestamp = 0;
        this.buildings = [];
        this.bullets = [];
        this.unitBullets = [];
        this.units = [];
        this.spawningUnits = [];
        this.borderRotation = 0;
        this.hasSpawnProtection = hasSpawnProtection;
        this.spawnProtectionRadius = this.buildingRadius.max + 145;

        this._loadSkin(skinID);
    }
    // Method to load the skin asynchronously
    async _loadSkin (skinID) {
        if (skinID > 0) {
            try {
                const { image } = await SkinCache.getSkin(skinID);
                if (image) {
                    this.skin = image;
                    this.skinLoaded = true;
                }
            } catch (error) {
                console.error(`Error loading skin for skinID ${skinID}:`, error);
                this.skinLoaded = false;
            }
        }
    }

    async getSkin () {
        if (!this.skinLoaded) {
            return this._loadSkin(this.skinID).then(() => {
                return this.skin; // Resolve with the skin once loaded
            }).catch(error => {
                console.error("Failed to load skin:", error);
                throw new Error("Skin loading failed");
            });
        } else {
            return Promise.resolve(this.skin); // Return a resolved promise if already loaded
        }
    }

    setBuildingCache (building) {
        this.buildingCache = building;
        this.buildingCacheTimestamp = Date.now();
    }

    clearBuildingCache () {
        this.buildingCache = null;
        this.buildingCacheTimestamp = 0; // Clear the timestamp
    }

    getBuildingCache () {
        return this.buildingCache;
    }

    addCapturedNeutral (neutral) {
        this.capturedNeutralIds.push(neutral.id);
    }

    removeSpawnProtection () {
        this.hasSpawnProtection = false;
    }

    setHealth (health) {
        this.targetHealth = health;
    }

    addBullet (bullet) { //! Just used for trapper bullets currently
        this.bullets.push(bullet);
    }

    spawnBullet (bullet, targetPosition, object) {
        if (object instanceof Building) {
            //! Normal turrets get rotation updates from the server
            //! To handle turrets with multiple guns
            this.bullets.push(bullet);
        } else if (object instanceof Unit) {
            const unit = object;
            unit.setCannonTargetPoint(targetPosition);
            this.unitBullets.push(bullet);
        }
        bullet.setTargetPosition(targetPosition);
        object.triggerRecoil();
    }

    markUnitForRemoval (unitID) {
        let index = this.units.findIndex(unit => unit.id === unitID);
        if (index !== -1) {
            this.units[index].markForRemoval();
            return
        }
        index = this.spawningUnits.findIndex(unit => unit.id === unit.id);
        this.spawningUnits[index].markForRemoval();
    }

    markBuildingForRemoval (buildingID, callback = () => { }) {
        const index = this.buildings.findIndex(building => building.id === buildingID);
        if (index !== -1) {
            callback(this.buildings[index]);
            this.buildings[index].markForRemoval(); // Mark the building for removal
            return;
        }
    }

    markBulletForRemoval (bulletID) {
        const bullet = this.getBullet(bulletID);
        if (bullet) {
            bullet.markForRemoval();
        }
    }

    spawnUnit (unit, targetPosition) {
        unit.setTargetPoint(targetPosition);
        this.spawningUnits.push(unit);
    }

    addUnit (unit) {
        this.units.push(unit);
    }

    getUnit (unitID) {
        // First, check if the unit is in the regular units array
        let unit = this.units.find(unit => unit.id === unitID);
        if (unit != null) {
            return unit;
        }
        // If not found, check the spawning units array
        unit = this.spawningUnits.find(unit => unit.id === unitID);
        return unit || null;
    }

    getBullet (bulletID) {
        // Try to find the bullet in the normal bullets array first
        let bullet = this.bullets.find(bullet => bullet.id === bulletID);

        // If not found in normal bullets, try the unitBullets array
        if (!bullet) {
            bullet = this.unitBullets.find(bullet => bullet.id === bulletID);
        }

        // Return the found bullet, or null if not found in either array
        return bullet || null;
    }
    removeUnit (unitID) {
        // First, try to remove the unit from the regular units array
        let index = this.units.findIndex(unit => unit.id === unitID);
        if (index !== -1) {
            this.units.splice(index, 1);
            return;
        }

        // If not found, try to remove the unit from the spawning units array
        index = this.spawningUnits.findIndex(unit => unit.id === unitID);
        if (index !== -1) {
            this.spawningUnits.splice(index, 1);
        }
    }

    addBuilding (building) {
        // Calculate the direction vector from the player to the building
        const directionX = building.position.x - this.position.x;
        const directionY = building.position.y - this.position.y;

        // Calculate the inverted position by reversing the direction and scaling it
        const invertedPosition = {
            x: this.position.x + directionX * 1.5,
            y: this.position.y + directionY * 1.5
        };

        building.setTargetPoint(invertedPosition);

        if (this.isClient) { //? Needs to be set before the building is added
            //? Needs to be initialized after targetPoint set!
            building.initPolygon();
        }

        this.buildings.push(building);
        // Sort buildings by distance to the HQ
        this.buildings.sort((a, b) => {
            const distanceA = Math.hypot(a.position.x - this.position.x, a.position.y - this.position.y);
            const distanceB = Math.hypot(b.position.x - this.position.x, b.position.y - this.position.y);
            return distanceB - distanceA; // Sort in descending order (farthest first)
        });
    }

    upgradeBuildings (buildingIDs, buildingVariant) {
        buildingIDs.forEach(buildingID => {
            const index = this.buildings.findIndex(building => building.id === buildingID);
            if (index !== -1) {
                this.buildings[index].setUpgrade(buildingVariant);
            }
        });
    }

    removeBuilding (buildingID, callback = () => { }) {
        const index = this.buildings.findIndex(building => building.id === buildingID);
        if (index !== -1) {
            callback(this.buildings[index].type);
            this.buildings.splice(index, 1);
        }
    }

    updateHealth (deltaTime) {
        const springForce = -this.springStiffness * (this.health.current - this.targetHealth);
        this.springVelocity += springForce * deltaTime;
        this.springVelocity *= 1 - this.springDamping;
        this.health.current += this.springVelocity * deltaTime;

        // Clamp the health to ensure it doesn't go below 0 or above the target
        this.health.current = Math.min(this.health.current, this.targetHealth);
        this.health.current = Math.max(this.health.current, 0);
    }

    updateBullets (deltaTime) {
        // Update bullets
        this.bullets = this.bullets.reduce((remainingBullets, bullet) => {
            const canRemove = bullet.update(deltaTime);

            if (!canRemove) {
                remainingBullets.push(bullet); // Keep the bullet if it can’t be removed
            }
            return remainingBullets;
        }, []);
    }

    updateBuildings (deltaTime) {
        this.buildings = this.buildings.reduce((remainingBuildings, building) => {
            const canRemove = building.update(deltaTime);

            if (!canRemove) {
                remainingBuildings.push(building); // Keep the building if it can’t be removed
            }
            return remainingBuildings;
        }, []);
    }

    update (deltaTime) {
        this.updateHealth(deltaTime);
        this.updateBullets(deltaTime);
        this.updateBuildings(deltaTime);

        // Update spawning units
        this.spawningUnits = this.spawningUnits.reduce((remainingUnits, unit) => {
            const canRemove = unit.update(deltaTime);

            if (canRemove) {
                return remainingUnits; // Do not add this unit back, it will be removed
            }

            if (unit.hasLeftBarracks()) {
                this.units.unshift(unit); // Move the unit to the units array
                return remainingUnits; // Do not add to spawningUnits
            }

            remainingUnits.push(unit); // Keep the unit in spawning units
            return remainingUnits;
        }, []);

        // Update units
        this.units = this.units.reduce((remainingUnits, unit) => {
            const canRemove = unit.update(deltaTime);

            if (!canRemove) {
                remainingUnits.push(unit); // Keep the unit if it can’t be removed
            }
            return remainingUnits;
        }, []);

        this.unitBullets = this.unitBullets.reduce((remainingBullets, bullet) => {
            const canRemove = bullet.update(deltaTime);

            if (!canRemove) {
                remainingBullets.push(bullet); // Keep the bullet if it can’t be removed
            }
            return remainingBullets;
        }, []);

        if (this.isClient && this.buildingCache) {
            // Check if the building cache is older than 500 milliseconds and clear it if so
            if (Date.now() - this.buildingCacheTimestamp > 500) {
                this.clearBuildingCache();
            }
        }
    }


    render (context, camera, deltaTime) {
        // Translate the player's position according to the camera
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;

        const circleBorder = (radius, color, rotation) => {
            const lineWidth = 6;
            const circumference = 2 * Math.PI * (radius - lineWidth / 2);
            const dashCount = circumference / 60; // Number of dashes in the circle
            const dashSize = circumference / (dashCount * 2); // Each dash and gap are equal
            context.save();
            context.setLineDash([dashSize, dashSize]);
            context.translate(screenX, screenY); // Translate to the center of the circle
            context.rotate(rotation); // Rotate around the center
            context.beginPath();
            context.arc(0, 0, radius - lineWidth / 2, 0, 2 * Math.PI);
            context.lineWidth = lineWidth;
            context.strokeStyle = color;
            context.stroke();
            context.closePath();
            context.restore();
        }

        const baseCore = () => {
            // Calculate the radius based on the player's health
            const maxHealth = this.health.max;
            const maxRadius = this.coreRadius.max;

            const healthRadius = (this.health.current / maxHealth) * maxRadius;

            // Draw the filled circle with the scaled radius
            context.beginPath();
            context.arc(screenX, screenY, healthRadius, 0, 2 * Math.PI, false);
            context.fillStyle = this.color;
            context.fill();
            context.closePath();

            // Set the stroke style and draw the border
            context.strokeStyle = "#666666";
            context.lineWidth = 4; // Set the width of the border
            context.stroke();

            if (this.skin) {
                // Draw skin
                let imageSize = healthRadius * 2 - 3; // -3 to account for border width
                imageSize = Math.max(0, imageSize); // Ensure imageSize is non-negative

                // Create a circular clipping path
                context.save(); // Save the current state
                context.beginPath();
                context.arc(screenX, screenY, imageSize / 2, 0, Math.PI * 2); // Circle centered at (screenX, screenY)
                context.clip(); // Apply clipping

                // Draw the image within the circular path
                context.drawImage(this.skin, screenX - imageSize / 2, screenY - imageSize / 2, imageSize, imageSize);

                // Restore the context to remove clipping
                context.restore();
            }

            // Draw the player's name
            let maxWidth = this.buildingRadius.min * 2; // Maximum width allowed for the text
            // Calculate the font size based on the circle's radius and text length
            let fontSize = Math.min(healthRadius * 0.5, 48);

            context.font = `900 ${fontSize}px 'Ubuntu', sans-serif`;

            if (!this.nameWidth) {
                this.nameWidth = context.measureText(this.name).width;
            }

            const textWidth = this.nameWidth;

            // If the text width exceeds the maximum width, reduce the font size
            if (textWidth > maxWidth) {
                fontSize *= maxWidth / textWidth;
                context.font = `900 ${fontSize}px 'Ubuntu', sans-serif`;
            }

            context.fillStyle = "white";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(this.name, screenX, screenY);

            // Set stroke style and draw text border
            context.strokeStyle = "#666666";
            context.lineWidth = Math.max(fontSize * 0.06);


            context.strokeText(this.name, screenX, screenY);
        };

        // Update rotation angle
        this.borderRotation += deltaTime * 1 / 20000;

        if (this.hasSpawnProtection) {
            const protectionColor = ThemeManager.currentThemeProperties.protectionColor;
            circleBorder(this.spawnProtectionRadius, protectionColor, this.borderRotation);
        }

        const borderColor = ThemeManager.currentThemeProperties.lineColor;
        circleBorder(this.buildingRadius.min + 8, borderColor, this.borderRotation);
        circleBorder(this.buildingRadius.max, borderColor, this.borderRotation);
        baseCore();


        // Render the player's buildings
        this.buildings.forEach(building => {
            building.render(context, camera, deltaTime);
        });

        if (this.buildingCache) {
            this.buildingCache.render(context, camera, deltaTime);
        }

        context.closePath();
    }

    renderSpawningUnits (context, camera, deltaTime) {
        this.spawningUnits.forEach(unit => {
            unit.render(context, camera, deltaTime);
        });
    }

    renderUnits (context, camera, deltaTime) {
        this.units.forEach(unit => {
            unit.render(context, camera, deltaTime);
        });
    }

    renderUnitBullets (context, camera, deltaTime) {
        this.unitBullets.forEach(bullet => {
            bullet.render(context, camera, deltaTime);
        });
    }

    renderBullets (context, camera, deltaTime) {
        this.bullets.forEach(bullet => {
            bullet.render(context, camera, deltaTime);
        });
    }

    getBuilding (buildingID) {
        return this.buildings.find(building => building.id === buildingID) || null;
    }

    getWorldPosition (camera) {
        return {
            x: this.position.x - camera.x,
            y: this.position.y - camera.y
        };
    }

    setAsClientPlayer () {
        this.isClient = true;
    }
}
