import Network from "../../network/Network.js";
import Message from "../../network/Message.js";
import { BuildingTypes, BuildingVariantTypes, MessageTypes, UnitTypes, UnitVariantTypes, getBulletDetails } from "../../network/constants.js";
import Player from "../../entities/Player.js";
import NeutralBase from "../../entities/objective/NeutralBase.js";
import { QueueType } from "../Renderer.js";
import Particle from "../../entities/effects/Particle.js";
import Bullet from "../../entities/Bullet.js";
import { BuildingManager } from "./BuildingManager.js";
import UnitManager from "./UnitManager.js";
import Explosion from "../../entities/effects/Explosion.js";
import Bush from "../../entities/Bush.js";
import Rock from "../../entities/Rock.js";
import SkinCache from "../SkinCache.js";

export default class NetworkManager {
    constructor (serverAddress, core) {
        this.network = new Network(serverAddress);
        this.core = core;
        this.setupEventListeners();

        // Initialize bandwidth metrics
        this.startTime = performance.now();
        this.dataReceived = 0;

        // Initialize resource update timeout
        this.lastPing = null;

        // Initialize login status and user data
        this.loggedIn = false;
        this.userData = null;

        // Store the gamemode used for connection
        this.connectedGamemode = null;

        // Flag to prevent automatic reconnection during server switching
        this.isSwitchingServers = false;

        // Use async initialization for login status
        this.initialize();


        // Monitor bandwidth every second
        this.monitorBandwidth();
    }

    async initialize () {
        await this.checkLoginStatus();

        if (this.loggedIn) {
            await this.getUserData();
        }
    }

    async getUserData () {
        try {
            const response = await fetch("https://auth.blobl.io/user", {
                method: "GET",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Failed to request user data");
            }

            const data = await response.json();

            this.userData = data;
            if (this.userData) {
                // Ensure skins and unlocked properties exist before accessing them
                const equippedSkin = Number(localStorage.getItem("equippedSkin")) || 0;
                if (this.userData.skins && Array.isArray(this.userData.skins.unlocked) && this.userData.skins.unlocked.includes(equippedSkin)) {
                    this.userData.skins.equipped = equippedSkin;
                }
            }
            this.core.uiManager.updateAccount();

        } catch (error) {
            console.error("Error getting user data:", error);
        }
    }

    async checkLoginStatus () {
        try {
            const response = await fetch("https://auth.blobl.io/check", {
                method: "GET",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Failed to verify login status");
            }

            const data = await response.json();
            if (data.loggedIn) {
                this.loggedIn = true;
            } else {
                console.log("User is not logged in.")
            }
        } catch (error) {
            console.error("Error checking login status:", error);
            // Handle errors appropriately, such as showing a login page
        }
        this.core.uiManager.updateAccountButton();
    }

    async logout () {
        try {
            const response = await fetch('https://auth.blobl.io/logout', {
                method: 'POST',
                credentials: 'include' // Ensure cookies are sent with the request
            });

            if (response.ok) {
                //this.loggedIn = false;
                //this.userData = null;
                //this.core.uiManager.updateAccount();
                //this.core.uiManager.updateAccountButton();
                // ! Forces the server to reload the UserData and cleares the discord id 
                window.location.reload();
            } else {
                console.error("Failed to log out.");
            }
        } catch (error) {
            console.error("Error during logout:", error);
        }
    }

    monitorBandwidth () {
        setInterval(() => {
            const currentTime = performance.now();
            const elapsedTime = (currentTime - this.startTime) / 1000; // in seconds
            this.startTime = currentTime;

            const bandwidthReceived = this.dataReceived / elapsedTime; // bytes per second
            const bandwidthSent = this.dataSent / elapsedTime; // bytes per second

            // Convert to kilobytes per second and megabytes per second
            const bandwidthReceivedKBps = bandwidthReceived / 1024;
            const bandwidthReceivedMBps = bandwidthReceivedKBps / 1024;
            const bandwidthSentKBps = bandwidthSent / 1024;
            const bandwidthSentMBps = bandwidthSentKBps / 1024;

            // Determine whether to display in bytes, kilobytes, or megabytes
            const bandwidthReceivedDisplay = bandwidthReceivedMBps > 1
                ? `${bandwidthReceivedMBps.toFixed(2)} MBps`
                : (bandwidthReceivedKBps > 1
                    ? `${bandwidthReceivedKBps.toFixed(2)} KBps`
                    : `${bandwidthReceived.toFixed(0)} Bps`);
            const bandwidthSentDisplay = bandwidthSentMBps > 1
                ? `${bandwidthSentMBps.toFixed(2)} MBps`
                : (bandwidthSentKBps > 1
                    ? `${bandwidthSentKBps.toFixed(2)} KBps`
                    : `${bandwidthSent.toFixed(0)} Bps`);

            // Update metrics
            this.core.gameManager.metrics.bandwidthReceived = bandwidthReceivedDisplay;
            this.core.gameManager.metrics.bandwidthSent = bandwidthSentDisplay;

            // Reset counters for the next interval
            this.dataReceived = 0;
            this.dataSent = 0;

            // Update UI with metrics
            this.core.uiManager.updateMetrics();
        }, 1000); // every 1 second
    }

    connect () {
        this.core.uiManager.showConnectingOverlay(true);
        const gamemode = this.core.uiManager.selectedGamemode;
        this.connectedGamemode = gamemode; // Store the gamemode for reconnection
        this.network.connect(gamemode);
    }

    reconnect () {
        // Disconnect if connected
        if (this.network.worker) {
            this.network.worker.postMessage({ type: 'disconnect' });
        }
        // Then reconnect with the same gamemode that was used for initial connection
        this.core.uiManager.showConnectingOverlay(true);
        const gamemode = this.connectedGamemode || 0; // Default to FFA if not set
        this.network.connect(gamemode);
    }

    // Set up event listeners for network events
    setupEventListeners () {
        this.network.addEventListener("open", () => this.handleNetworkOpen());
        this.network.addEventListener("error", (error) => this.handleNetworkError(error));
        this.network.addEventListener("message", (message) => this.handleNetworkMessage(message));
        this.network.addEventListener("close", () => this.handleNetworkClose());
    }

    // Handle successful connection to the server
    handleNetworkOpen () {
        console.log("Connected to server.");
        this.core.uiManager.showConnectingOverlay(false);
        this.core.uiManager.showMenuUIElements(true);
        this.core.uiManager.showGameUIElements(false);
    }

    // Handle network errors
    handleNetworkError (error) {
        console.error("Network error:", error);
        this.core.uiManager.showConnectingOverlay(true);
        this.core.uiManager.showMenuUIElements(true);
        this.core.uiManager.showGameUIElements(false);
        this.core.camera.enableControls(false);
    }

    // Handle network close
    handleNetworkClose () {
        console.log("Disconnected from server.");
        this.core.uiManager.showConnectingOverlay(true);
        this.core.uiManager.showMenuUIElements(true);
        this.core.uiManager.showGameUIElements(false);
        this.core.camera.enableControls(false);

        // Don't automatically reconnect if we're switching servers
        if (!this.isSwitchingServers) {
            // Attempt automatic reconnection after a short delay
            setTimeout(() => {
                console.log("Attempting automatic reconnection...");
                this.reconnect();
            }, 2000); // 2 second delay before attempting reconnection
        } else {
            // Reset the flag after a short delay
            setTimeout(() => {
                this.isSwitchingServers = false;
            }, 100);
        }
    }

    // Handle messages received from the server
    handleNetworkMessage (message) {
        this.dataReceived += message.bytes; // Track the size of the message received    

        const { type, payload } = message;

        // Reset ping for RESOURCE_UPDATE
        if (type === MessageTypes.RESOURCE_UPDATE) {
            this.resetLastPing();
        }

        // Define a map of message types to their handlers
        const messageHandlers = new Map([
            [MessageTypes.GAME_STATE, () => {
                this.handleGameState(payload);
                this.core.uiManager.showConnectingOverlay(false);
            }],
            [MessageTypes.INITIAL_PLAYER_DATA, () => {
                this.handleInitialPlayerData(payload);
                this.core.gameManager.startProtectionTimer();
                this.core.uiManager.showMenuUIElements(false);
                this.core.uiManager.showGameUIElements(true);
                this.core.camera.enableControls(true);
                this.core.miniMap.minimize();
            }],
            [MessageTypes.RESOURCE_UPDATE, () => this.handleResourceUpdate(payload)],
            [MessageTypes.UNITS_POSITION_UPDATE, () => this.handleUnitsPositionUpdate(payload)],
            [MessageTypes.UNITS_ROTATION_UPDATE, () => this.handleUnitsRotationUpdate(payload)],
            [MessageTypes.REMOVE_UNIT, () => this.handleRemoveUnit(payload)],
            [MessageTypes.SPAWN_UNIT, () => this.handleSpawnUnit(payload)],
            [MessageTypes.PLAYER_JOINED, () => this.handlePlayerJoined(payload)],
            [MessageTypes.PLAYER_LEFT, () => this.handlePlayerLeft(payload)],
            [MessageTypes.KILLED, () => this.handleKilled(payload)],
            [MessageTypes.KICK_NOTIFICATION, () => this.handleKickNotification(payload)],
            [MessageTypes.BASE_HEALTH_UPDATE, () => this.handleBaseHealthUpdate(payload)],
            [MessageTypes.BUILDING_PLACED, () => this.handleBuildingPlaced(payload)],
            [MessageTypes.BUILDINGS_UPGRADED, () => this.handleBuildingsUpgraded(payload)],
            [MessageTypes.BUILDINGS_REMOVED, () => this.handleBuildingsRemoved(payload)],
            [MessageTypes.BARRACKS_ACTIVATION_UPDATE, () => this.handleBarracksActivationUpdate(payload)],
            [MessageTypes.SPAWN_BULLET, () => this.handleSpawnBullet(payload)],
            [MessageTypes.UNIT_SPAWN_BULLET, () => this.handleUnitSpawnBullet(payload)],
            [MessageTypes.REMOVE_BULLET, () => this.handleRemoveBullet(payload)],
            [MessageTypes.BULLET_POSITION_UPDATE, () => this.handleBulletPositionUpdate(payload)],
            [MessageTypes.LEADERBOARD_UPDATE, () => this.handleLeaderboardUpdate(payload)],
            [MessageTypes.REMOVE_SPAWN_PROTECTION, () => this.handleRemoveSpawnProtection(payload)],
            [MessageTypes.CHAT_MESSAGE, () => this.handleChatMessage(payload)],
            [MessageTypes.BUILDING_PLACEMENT_FAILED, () => this.handleBuildingPlacementFailed(payload)],
            [MessageTypes.INITIAL_BULLET_STATES, () => this.handleInitialBulletStates(payload)],
            [MessageTypes.TURRET_ROTATION_UPDATE, () => this.handleTurretRotationUpdate(payload)],
            [MessageTypes.NEUTRAL_BASE_CAPTURED, () => this.handleNeutralBaseCaptured(payload)],
            [MessageTypes.SKIN_DATA, () => this.handleSkinData(payload)],
            [MessageTypes.SERVER_VERSION, () => this.handleServerVersion(payload)],
            [MessageTypes.REBOOT_ALERT, () => this.handleRebootAlert(payload)],
            [MessageTypes.ERROR, () => this.handleError(payload)],
        ]);

        // Execute the handler if it exists
        const handler = messageHandlers.get(type);
        if (handler) {
            handler();
        }
    }

    // Reset the last resource update ping timeout
    resetLastPing () {
        // Clear existing timeout if there is one
        if (this.lastPing) {
            clearTimeout(this.lastPing);
        }

        // Set a new timeout to log a message after 2 seconds
        this.lastPing = setTimeout(() => {
            console.log("No resource update received within 2 seconds (last ping).");
            this.sendResyncRequest();
        }, 2000);
    }

    handleInitialBulletStates (payload) {
        // ! Currently only receives Trapper Bullets
        const bulletDetails = getBulletDetails(BuildingTypes.SNIPER_TURRET, BuildingVariantTypes.SNIPER_TURRET.TRAPPER);
        const bulletStates = payload;
        bulletStates.forEach(state => {
            const { isPlayer, ownerID, bulletID, position } = state;
            let base = null;
            if (isPlayer) {
                base = this.core.gameManager.getPlayerById(ownerID);
            } else /*isNeutral*/ {
                base = this.core.gameManager.getNeutralById(ownerID);
            }
            if (!base) return
            const bullet = new Bullet(bulletDetails, base.color, position, bulletID);
            base.addBullet(bullet)
        });
    }

    handleSkinData (payload) {
        const { skinData } = payload;
        SkinCache.setSkinData(skinData);
    }

    handleServerVersion(payload) {
        const { version } = payload;
        const expectedVersion = localStorage.getItem('expectedServerVersion');
        const isCorrectVersion = this.core.requiredServerVersion === version;
    
        if (!isCorrectVersion) {
            console.warn(`Incompatible server version: expected ${this.core.requiredServerVersion}, but got ${version}. Reloading...`);
            SkinCache.clearSkinData();
            localStorage.setItem('expectedServerVersion', this.core.requiredServerVersion);
            window.location.reload();
        } else if (expectedVersion !== this.core.requiredServerVersion) {
            console.log('Server and client versions match, but expected version has changed. Fetching new skin data...');
            SkinCache.clearSkinData(); // Clear outdated skin data
            localStorage.setItem('expectedServerVersion', this.core.requiredServerVersion); 
            this.sendSkinDataRequest();
        } else if (SkinCache.isSkinDataEmpty()) {
            this.sendSkinDataRequest();
        }
    }

    handleRebootAlert (payload) {
        const { minutesLeft } = payload;
        this.core.uiManager.setServerRebootAlert(minutesLeft);
    }

    handleError (payload) {
        this.core.uiManager.showMenuDialog(
            "Connection Issue",
            "Oops! We couldn't connect to the server.",
            "The server might be <b>full</b> or <b>temporarily</b> down.",
            "<p>Give it another shot later. Thanks for your patience!</p>"
        );
    }

    handleChatMessage (payload) {
        const { playerID, message } = payload;
        const player = this.core.gameManager.getPlayerById(playerID);
        if (!player) return;
        this.core.uiManager.addChatMessage(player.name, message, player.color, player);
    }

    handleGameState (payload) {
        const { players, neutralBases, bushes, rocks } = payload;
        const clientPlayer = this.core.gameManager.player;
        // Reset game state and clear render queues
        this.core.gameManager.reset();
        this.core.renderer.clearQueues();

        // Helper function to add buildings to a player or neutral base
        const addBuildings = (owner, buildings) => {
            buildings.forEach(building => {
                const BuildingClass = BuildingManager.getBuildingClassByType(building.type);
                if (!BuildingClass) {
                    console.warn(`Building type '${building.type}' not defined!`);
                    return;
                }
                const newBuilding = new BuildingClass(owner.color, building.position, building.variant, building.id);
                owner.addBuilding(newBuilding);

                if (building.type === BuildingTypes.BARRACKS) {
                    newBuilding.activated = building.unitSpawningActive;
                    if (newBuilding.activated && owner.isClient) {
                        this.core.gameManager.increaseActiveBarracks(1);
                    }
                }

                if (owner.isClient) {
                    this.core.gameManager.increaseBuildingLimit(building.type);
                }
            });
        };

        // Helper function to add units to a player
        const addUnits = (player, units) => {
            units.forEach(unit => {
                const UnitClass = UnitManager.getUnitClassByType(unit.type);
                if (!UnitClass) {
                    console.warn(`Unit type '${unit.type}' not defined!`);
                    return;
                }

                const newUnit = new UnitClass(player.color, unit.position, unit.variant, unit.id);

                player.addUnit(newUnit);
                if (player.isClient && newUnit.type === UnitTypes.COMMANDER) {
                    this.core.gameManager.setCommander(true);
                }
            });
        };

        // Process each player in the game state
        players.forEach(playerData => {
            const { id, name, color, skinID, position, health, hasSpawnProtection } = playerData;
            // Calculate maxBuildingRadius based on selected gamemode
            const selectedGamemode = this.core.uiManager.selectedGamemode;
            const maxBuildingRadius = selectedGamemode === 1 ? 250 : 350; // 1 = Small Bases
            // Create new player instance
            const gamemode = this.core.uiManager.selectedGamemode;
            const newPlayer = new Player(id, name, color, skinID, position, health, hasSpawnProtection, maxBuildingRadius, gamemode);

            // Set as client player if matched
            if (clientPlayer && clientPlayer.id === id) {
                this.core.gameManager.setClientPlayer(newPlayer);
            }

            // Add buildings and units to the player
            addBuildings(newPlayer, playerData.buildings);
            addUnits(newPlayer, playerData.units);

            // If this is the client player, assign it to the gameManager
            if (!newPlayer.isClient) {
                this.core.gameManager.addPlayer(newPlayer);
            }

        });

        // Process neutral bases
        neutralBases.forEach(neutral => {
            const { id, ownerID, health, position, buildings } = neutral;

            // Create new neutral base instance
            const gamemode = this.core.uiManager.selectedGamemode;
            const newNeutral = new NeutralBase(id, position, health, ownerID, gamemode);

            if (clientPlayer && ownerID != -1) {
                if (ownerID == clientPlayer.id) {
                    newNeutral.setAsClientPlayer();
                }
            }

            // Add buildings to the neutral base
            addBuildings(newNeutral, buildings);

            this.core.gameManager.addNeutral(newNeutral);

            const player = this.core.gameManager.getPlayerById(ownerID);
            if (!player) return;

            this.core.gameManager.setNeutralCaptured(player, newNeutral);
        });

        // Process bushes 
        bushes.forEach(position => {
            this.core.gameManager.addBush(new Bush(position));
        });

        // Sort the rocks array by size, in ascending order
        rocks.sort((a, b) => b.Size - a.Size);

        // Process rocks 
        rocks.forEach(rock => {
            this.core.gameManager.addRock(new Rock(rock.position, rock.size, rock.rotation));
        });

        // Hide the connecting overlay once game state is synced
        this.core.uiManager.showConnectingOverlay(false);

        // Force a render to ensure buildings are displayed immediately
        this.core.renderer.render(0);
    }

    handleInitialPlayerData (payload) {
        const { playerID, name, color, skinID, position } = payload;
        // Calculate maxBuildingRadius based on selected gamemode
        const selectedGamemode = this.core.uiManager.selectedGamemode;
        const maxBuildingRadius = selectedGamemode === 1 ? 250 : 350; // 1 = Small Bases
        const player = new Player(playerID, name, color, skinID, position, 2000, true, maxBuildingRadius, selectedGamemode);
        player.hasSpawnProtection = true;
        this.core.gameManager.setClientPlayer(player);
        this.core.toolbar.changeColor(color);
        this.core.leaderboard.clear();
        this.core.camera.enableControls(true);
        this.core.camera.setPosition(position);
        // Zoom out effect
        this.core.camera.zoom = this.core.camera.maxZoom;
        this.core.camera.setZoom(0.75);

        this.core.gameManager.stats.time = Date.now();
    }

    handleResourceUpdate (payload) {
        const { power } = payload;
        const resources = this.core.gameManager.resources;
        resources.power.current = power;
        this.core.uiManager.updateResources();
    }

    handleSpawnUnit (payload) {
        const { isPlayer, ownerID, barracksID, unitID, unitType, unitVariant, targetPosition } = payload;
        let base = null;
        let player = null;

        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
            player = base;
        } else/*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
            player = this.core.gameManager.getPlayerById(base.ownerID);
        }

        if (!base) return;

        const UnitClass = UnitManager.getUnitClassByType(unitType);
        if (!UnitClass) {
            console.log("UnitClass not defined!");
            return;
        }
        let initialPosition = { ...player.position };

        let barracks;
        if (barracksID !== -1) {
            barracks = base.getBuilding(barracksID)
            if (barracks) {
                initialPosition = { ...barracks.position };
            }
        }

        const unit = new UnitClass(base.color, initialPosition, unitVariant, unitID)
        if (barracks) {
            player.spawnUnit(unit, targetPosition);
        } else {
            // Add without targetPosition
            //? This always handles Commander spawns, because commanders dont spawn in barracks
            //? and doesnt need the layering while spawning
            player.addUnit(unit);
        }

        if (player.isClient && unit.type === UnitTypes.COMMANDER) {
            this.core.gameManager.setCommander(true);
        }
    }

    handleUnitsPositionUpdate (payload) {
        const { playerID, units } = payload;
        const player = this.core.gameManager.getPlayerById(playerID);
        if (!player) return;

        units.forEach(unit => {
            const u = player.getUnit(unit.id);
            if (u) {
                u.setTargetPosition(unit.targetPosition);
            }
        });
    }

    handleUnitsRotationUpdate (payload) {
        const { playerID, units } = payload;
        const player = this.core.gameManager.getPlayerById(playerID);
        if (!player) return;
        units.forEach(unit => {
            const u = player.getUnit(unit.id);
            if (u) {
                u.setRotation(unit.rotation);
            }
        });
    }

    handleRemoveUnit (payload) {
        const { playerID, unitID } = payload;

        const player = this.core.gameManager.getPlayerById(playerID);
        if (!player) return;

        if (player.isClient) {
            const index = this.core.unitManager.selectedUnits.findIndex(unit => unit.id === unitID);
            if (index !== -1) {
                // Remove unit, from selected units
                this.core.unitManager.selectedUnits.splice(index, 1);
            }
        }

        const unit = player.getUnit(unitID);

        if (unit) {
            if (unit.type === UnitTypes.DRONE && unit.variant === UnitVariantTypes.DRONE.KAMIKAZE) {
                const radius = unit.details.explosionRadius;
                this.core.renderer.addToQueue(new Explosion(unit.position, player.color, radius, 1), QueueType.EFFECT);
            }
            // Calculate explosion angle based on unit's target position
            const explosionAngle = Math.atan2(unit.targetPosition.y - unit.position.y, unit.targetPosition.x - unit.position.x);
            this.core.renderer.addToQueue(new Particle(unit.position, explosionAngle, player.color, 1), QueueType.EFFECT);
            player.markUnitForRemoval(unitID);

            if (player.isClient && unit.type === UnitTypes.COMMANDER) {
                this.core.gameManager.setCommander(false);
            }

        }
    }

    handleTurretRotationUpdate (payload) {
        // ! Currently  only receives normal turret data (not unit turrets, they are still calculated locally)
        const { isPlayer, ownerID, turretID, rotation } = payload;
        let base = null;
        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
        } else /*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
        }
        if (!base) return;
        const turret = base.getBuilding(turretID);
        if (!turret) return;
        turret.setRotation(rotation);
    }

    handleNeutralBaseCaptured (payload) {
        const { neutralID, playerID, buildings } = payload;
        const neutral = this.core.gameManager.getNeutralById(neutralID);

        // If no playerID is provided, reset the neutral base
        if (playerID == null) {
            if (!neutral) return; // Exit if neutral does not exist
            neutral.reset(); // Reset the neutral base
            return;
        }

        const player = this.core.gameManager.getPlayerById(playerID);
        if (!player) return; // Exit if the player does not exist   


        // Rest health
        neutral.setHealth(neutral.health.max);

        // Set the neutral base as captured by the player
        this.core.gameManager.setNeutralCaptured(player, neutral);


        // Clear all old buildings and bullets from the neutral base
        neutral.clear(); //! Needs to be cleared after setNeutralCaptured
        //! Because before that the old buildingLimits need to reset

        // Now, add the initial buildings to the neutral base
        if (buildings) {
            buildings.forEach(building => {
                // Get the Building class by type
                const BuildingClass = BuildingManager.getBuildingClassByType(building.type);
                if (!BuildingClass) {
                    console.error("BuildingType not defined for:", building.type);
                    return;
                }
                // Create a new building if no cached building is found
                const newBuilding = new BuildingClass(player.color, building.position, building.variant, building.id);
                neutral.addBuilding(newBuilding);

                if (player.isClient) {
                    this.core.gameManager.increaseBuildingLimit(newBuilding.type);
                }
            });
        }
    }

    handlePlayerJoined (payload) {
        const { playerID, color, skinID, position, name } = payload;
        // Use default radius for now, will be corrected by game state
        const gamemode = this.core.uiManager.selectedGamemode;
        const maxBuildingRadius = gamemode === 1 ? 250 : 350; // 1 = Small Bases
        const player = new Player(playerID, name, color, skinID, position, 2000, false, maxBuildingRadius, gamemode);
        this.core.gameManager.addPlayer(player);
    }

    handlePlayerLeft (payload) {
        const { playerID } = payload;
        this.core.gameManager.removePlayer(playerID);
        this.core.leaderboard.removePlayer(playerID);
    }

    _updateUserDataLocally (score, xp, kills, playDuration) {
        const BASE_XP = 50; // Base XP needed for level 1
        const VETERAN_SKIN_BASE_ID = 99; // Starting ID for veteran skins
        const LEVEL_UNLOCK_INTERVAL = 5; // Interval for unlocking veteran skins

        let progression = this.userData.progression;
        let skins = this.userData.skins || {}; // Ensure skins is an object
        let statistics = this.userData.statistics || {}; // Ensure statistics is an object

        progression.xp += xp;

        const calculateRequiredXP = (level) => {
            return Math.round(BASE_XP * Math.pow(level, 1.1));
        };

        let requiredXP = calculateRequiredXP(progression.level);

        // Level up if XP exceeds the required XP for the current level
        while (progression.xp >= requiredXP) {
            progression.level++;
            progression.xp -= requiredXP;

            // Unlock veteran skins every `LEVEL_UNLOCK_INTERVAL` levels
            if (progression.level % LEVEL_UNLOCK_INTERVAL === 0) {
                const newSkinId = VETERAN_SKIN_BASE_ID + Math.floor(progression.level / LEVEL_UNLOCK_INTERVAL);
                skins.unlocked = skins.unlocked || []; // Ensure unlocked is an array

                // Add skin only if not already unlocked
                if (!skins.unlocked.includes(newSkinId)) {
                    skins.unlocked.push(newSkinId);
                }
            }

            // Update required XP for the next level
            requiredXP = calculateRequiredXP(progression.level);
        }

        // Update playtime safely
        if (typeof playDuration === "number" && playDuration > 0) {
            statistics.playtime = statistics.playtime || 0; // Ensure playtime exists
            statistics.playtime += playDuration;
        }

        // Update kills
        statistics.kills = (statistics.kills || 0) + kills;

        // Update high score if needed
        if (statistics.highscore === undefined || statistics.highscore < score) {
            statistics.highscore = score;
        }

        // Save changes to userData (if necessary)
        this.userData.skins = skins;
        this.userData.statistics = statistics;
        this.userData.progression = progression;

        // Trigger UI refresh
        this.core.uiManager.updateAccount();
    }

    handleKilled (payload) {
        const { killerID, score, xp, kills, playtime } = payload;
        const killer = this.core.gameManager.getPlayerById(killerID);
        if (!killer) return;
        this.core.gameManager.player = null; //? Invalidate the client player, to make GameState work correcly
        this.core.uiManager.gameOver(killer, score);

        this._updateUserDataLocally(score, xp, kills, playtime);
    }

    handleKickNotification (payload) {
        const { reason, score, xp, kills, playtime } = payload;
        this.core.uiManager.kicked(reason, score);
        console.log(payload)
        this._updateUserDataLocally(score, xp, kills, playtime);
    }

    handleBaseHealthUpdate (payload) {
        const { isPlayer, ownerID, health } = payload;
        const gameManager = this.core.gameManager;

        if (isPlayer) {
            const player = gameManager.getPlayerById(ownerID);
            if (!player) return;
            player.setHealth(health);
        } else /*isNeutral*/ {
            const neutral = gameManager.getNeutralById(ownerID);
            neutral.setHealth(health);
        }
    }

    handleBuildingPlaced (payload) {
        const { isPlayer, ownerID, buildingID, buildingType, position, unitSpawningActive } = payload;
        let base = null;
        let player = null;
        let isClient = false;

        // Determine if the base is a player or a neutral and retrieve associated objects
        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
            player = base; // Player is the base itself
            isClient = player.isClient;
        } else /*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
            player = this.core.gameManager.getPlayerById(base.ownerID);
            isClient = player.isClient;
        }

        // Check if base is valid
        if (!base) {
            console.error("Base not found for owner ID:", ownerID);
            return;
        }

        // Get the Building class by type
        const BuildingClass = BuildingManager.getBuildingClassByType(buildingType);
        if (!BuildingClass) {
            console.error("BuildingType not defined for:", buildingType);
            return;
        }

        let building;

        if (isClient) {
            // Attempt to retrieve a cached building
            const cachedBuilding = player.getBuildingCache();
            if (cachedBuilding) {
                building = cachedBuilding; // Use cached building if available
                player.clearBuildingCache(); // Clear cache after use
                building.id = buildingID; // Set a valid building ID
                building.setPosition(position); // Correct position based on client prediction
            } else {
                // Create a new building if no cached building is found
                building = new BuildingClass(player.color, position, 0, buildingID);
            }

            // Reset unit upgrades if the building is an Armory
            if (building.type === BuildingTypes.ARMORY) {
                this.core.gameManager.unitUpgrades = []; //! Reset unit upgrades
            }

        } else {
            // Handle non-Client player placements
            building = new BuildingClass(player.color, position, 0, buildingID);
        }

        if (building.type === BuildingTypes.BARRACKS) {
            building.activated = unitSpawningActive;
            if (building.activated && isClient) {
                this.core.gameManager.increaseActiveBarracks(1);
            }
        }

        // Add the building to the base (player or neutral)
        base.addBuilding(building);

        // Force a render to ensure the building is displayed immediately
        this.core.renderer.render(0);

        // Clear the building cache after a slight delay to prevent flickering
        if (isClient) {
            setTimeout(() => {
                player.clearBuildingCache();
            }, 20); // Delay of 20ms
        }
    }

    handleBuildingPlacementFailed (payload) {
        const { buildingType } = payload;
        this.core.gameManager.decreaseBuildingLimit(buildingType);
    }

    handleBuildingsUpgraded (payload) {
        const { isPlayer, ownerID, buildingIDs, buildingVariant } = payload;
        let base = null;
        let isClient = false;

        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
            isClient = base.isClient;
        } else /*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
            const owner = this.core.gameManager.getPlayerById(base.ownerID);
            if (owner) {
                isClient = owner.isClient;
            }
        }

        if (!base) return;

        base.upgradeBuildings(buildingIDs, buildingVariant);
    }

    handleBuildingsRemoved (payload) {
        const { isPlayer, ownerID, buildingIDs } = payload;
        if (isPlayer) {
            const player = this.core.gameManager.getPlayerById(ownerID);
            if (!player) return;
            const callback = player.isClient ? ((building) => {
                this.core.gameManager.decreaseBuildingLimit(building.type);
                if (building.type === BuildingTypes.ARMORY) {
                    this.core.gameManager.unitUpgrades = [];
                } else if (building.type === BuildingTypes.BARRACKS) {
                    if (building.activated) {
                        this.core.gameManager.decreaseActiveBarracks(1);
                    }
                }
            }) : () => { };

            for (const buildingID of buildingIDs) {
                player.markBuildingForRemoval(buildingID, callback);
            }

        } else /*isNeutral*/ {
            const neutral = this.core.gameManager.getNeutralById(ownerID);
            if (!neutral) return;
            let callback = () => { };
            if (neutral.ownerID) {
                const player = this.core.gameManager.getPlayerById(neutral.ownerID)
                callback = player.isClient ? ((building) => {
                    this.core.gameManager.decreaseBuildingLimit(building.type);
                    if (building.type === BuildingTypes.ARMORY) {
                        this.core.gameManager.unitUpgrades = [];
                    } else if (building.type === BuildingTypes.BARRACKS) {
                        if (building.activated) {
                            this.core.gameManager.decreaseActiveBarracks(1);
                        }
                    }
                }) : () => { };
            }

            for (const buildingID of buildingIDs) {
                neutral.markBuildingForRemoval(buildingID, callback);
            }
        }
    }

    handleBarracksActivationUpdate (payload) {
        const { isPlayer, ownerID, buildingID, isActivated } = payload;

        let base = null;
        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
        } else /*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
        }
        if (!base) return;

        const barracks = base.getBuilding(buildingID);
        if (!barracks) return;
        barracks.activated = isActivated;
    }

    handleSpawnBullet (payload) {
        const { isPlayer, ownerID, objectID, bulletID, targetPosition } = payload;
        const buildingID = objectID;
        let base = null;
        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
        } else /*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
        }
        if (!base) return;

        const turret = base.getBuilding(buildingID);
        if (!turret) return;
        const bullet = new Bullet(turret.bulletDetails, base.color, targetPosition, bulletID);
        base.spawnBullet(bullet, targetPosition, turret);
    }

    handleUnitSpawnBullet (payload) {
        const { playerID, objectID, bulletID, targetPosition } = payload;
        const unitID = objectID;
        const player = this.core.gameManager.getPlayerById(playerID);
        if (!player) return;

        const unit = player.getUnit(unitID);
        const bullet = new Bullet(unit.bulletDetails, player.color, targetPosition, bulletID);
        player.spawnBullet(bullet, targetPosition, unit);
    }

    handleRemoveBullet (payload) {
        const { isPlayer, ownerID, bulletID } = payload;
        let base = null;
        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
        } else /*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
        }
        if (!base) return;

        base.markBulletForRemoval(bulletID);
    }

    handleBulletPositionUpdate (payload) {
        const { isPlayer, ownerID, bulletID, targetPosition } = payload;
        let base = null;
        if (isPlayer) {
            base = this.core.gameManager.getPlayerById(ownerID);
        } else /*isNeutral*/ {
            base = this.core.gameManager.getNeutralById(ownerID);
        }
        if (!base) return;

        const bullet = base.getBullet(bulletID);
        if (bullet) {
            bullet.setTargetPosition(targetPosition);
        }
    }

    handleLeaderboardUpdate (payload) {
        const { changes } = payload;
        this.core.leaderboard.updateEntries(changes);
    }

    handleRemoveSpawnProtection (payload) {
        const { playerID } = payload;
        const player = this.core.gameManager.getPlayerById(playerID);
        if (!player) return;
        player.removeSpawnProtection();
        this.core.renderer.updatePlayerConnections();

        if (player.isClient) {
            this.core.uiManager.showSpawnProtectionTimer(false);
        }
    }

    // Send a message to the server
    sendMessage (message) {
        if (message instanceof Message) {
            this.network.sendMessage(message);
        } else {
            console.error("Invalid message format. Message must be an instance of the Message class.");
            // Additional error handling code here (e.g., displaying an error message)
        }
    }

    // Join the game by sending a join message to the server
    joinGame (playerName, equippedSkin) {
        const fingerprint = this.getFingerPrint();
        const gamemode = this.core.uiManager.selectedGamemode;
        const message = Message.createJoinMessage(playerName, equippedSkin, fingerprint, hcaptcha.getResponse(), gamemode);
        this.sendMessage(message);
    }

    placeBuilding (buildingType, position) {
        const message = Message.createPlaceBuildingMessage(buildingType, position);
        this.sendMessage(message);
    }

    upgradeBuildings (buildingIDs, buildingVariant, neutralBaseID = null) {
        const message = Message.createUpgradeBuildingsMessage(buildingIDs, buildingVariant, neutralBaseID)
        this.sendMessage(message);
    }

    removeBuildings (buildingIDs, neutralBaseID = null) {
        const message = Message.createRemoveBuildingsMessage(buildingIDs, neutralBaseID);
        this.sendMessage(message);
    }

    moveUnits (units, targetPosition) {
        const message = Message.createMoveUnitsMessage(units, targetPosition);
        this.sendMessage(message);
    }

    toggleUnitSpawning (barracksID, neutralBaseID = null) {
        const message = Message.createToggleUnitSpawning(barracksID, neutralBaseID);
        this.sendMessage(message);
    }

    sendCameraUpdate (position, zoomLevel) {
        const message = Message.createCameraUpdateMessage(position, zoomLevel);
        this.sendMessage(message);
    }

    sendBuyCommander () {
        const message = Message.createBuyCommanderMessage();
        this.sendMessage(message);
    }

    sendBuyRepair () {
        const message = Message.createBuyRepairMessage();
        this.sendMessage(message);
    }

    sendChatMessage (text) {
        const message = Message.createChatMessageMessage(text);
        this.sendMessage(message);
    }

    sendResyncRequest () {
        const message = Message.createRequestResyncMessage();
        this.sendMessage(message);
    }

    sendSkinDataRequest () {
        const message = Message.createRequestSkinDataMessage();
        this.sendMessage(message);
    }

    getFingerPrint () {
        const hashString = (str) => {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = (hash * 33) ^ str.charCodeAt(i);
            }
            return hash >>> 0; // Ensure positive integer result
        }

        const userAgent = navigator.userAgent;
        const screenResolution = `${screen.width}x${screen.height}`;
        const timezone = new Date().getTimezoneOffset();
        const language = navigator.language || navigator.userLanguage;
        const colorDepth = screen.colorDepth;
        const cpuClass = navigator.hardwareConcurrency || 'unknown';

        // Concatenate collected properties into a single string
        const fingerprintData = `${userAgent}||${screenResolution}||${timezone}||${language}||${colorDepth}||${cpuClass}`;

        return hashString(fingerprintData);
    }
}
