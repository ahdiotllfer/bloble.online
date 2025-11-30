import Viewport from "./Viewport.js";
import { QueueType, Renderer } from "./Renderer.js";
import Camera from "./Camera.js";
import Toolbar from "./Toolbar.js";
import NetworkManager from "./managers/NetworkManager.js";
import EventManager from "./managers/EventManager.js";
import InputManager from "./managers/InputManager.js";
import GameManager from "./managers/GameManager.js";
import UIManager from "./managers/UIManager.js";
import { BuildingManager, Buildings } from "./managers/BuildingManager.js";
import Player from "../entities/Player.js";
import Leaderboard from "./Leaderboard.js";
import { BuildingVariantTypes, UnitVariantTypes } from "../network/constants.js";
import UnitMananger from "./managers/UnitManager.js";
import ThemeManager from "./managers/ThemeManager.js";
import Bush from "../entities/Bush.js";
import Rock from "../entities/Rock.js"
import MiniMap from "./MiniMap.js";
import TriCommander from "../entities/units/TriCommander.js";
import Commander from "../entities/units/Commander.js";
import SkinCache from "./SkinCache.js";
import Tank from "../entities/units/Tank.js";
import SiegeTank from "../entities/units/SiegeTank.js";
import Soldier from "../entities/units/Soldier.js";

export default class Core {
    constructor (loadBalancerAddress, requiredServerVersion) {
        this.requiredServerVersion = requiredServerVersion;
        SkinCache.initializeFromLocalStorage();
        this.initializeProperties();
        this.initializeManagers(loadBalancerAddress);
        this.createCanvas();
        this.initalizeEventManager();
        this.initializeToolbar();
        this.initLeaderboard();
        this.initMinimap();
        this.networkManager.connect();
        this.launchGame();
        this.initMenuBackground();
    }

    initMenuBackground () {
        let color = "#ff605f";
        let player = new Player(-1, "(〃￣ω￣〃)ゞ", color, 0, { x: 840, y: 0 }, 2000, false, 350);
        player.removeSpawnProtection();
        player.addBuilding(new Buildings.House(color, { x: 610, y: 100 }, BuildingVariantTypes.HOUSE.BASIC));
        player.addBuilding(new Buildings.House(color, { x: 650, y: 160 }, BuildingVariantTypes.HOUSE.LARGE_HOUSE));
        player.addBuilding(new Buildings.SimpleTurret(color, { x: 640, y: -200 }, BuildingVariantTypes.SIMPLE_TURRET.HEAVY_TURRET));
        player.addBuilding(new Buildings.Barracks(color, { x: 840, y: -348 }, BuildingVariantTypes.BARRACKS.BOOSTER_CANNON_TANK_FACTORY));
        player.addBuilding(new Buildings.Barracks(color, { x: 940, y: -335 }, BuildingVariantTypes.BARRACKS.BASIC));
        player.addBuilding(new Buildings.Barracks(color, { x: 1010, y: -305 }, BuildingVariantTypes.BARRACKS.GREATER_BARRACKS));


        let unit = new Tank(color, {x:840, y:-438}, UnitVariantTypes.TANK.BOOSTER_ENGINE_CANNON);
        unit.rotation = 4.5;
        player.addUnit(unit);

        unit = new Soldier(color, {x:930, y:-410}, UnitVariantTypes.SOLDIER.BASIC);
        unit.rotation = 4.5;
        player.addUnit(unit);

        unit = new Soldier(color, {x:970, y:-405}, UnitVariantTypes.SOLDIER.BASIC);
        unit.rotation = 2.6;
        player.addUnit(unit);

        unit = new Soldier(color, {x:1080, y:-378}, UnitVariantTypes.SOLDIER.BASIC);
        unit.rotation = 1.5;
        player.addUnit(unit);

        let radius = 154; // Radius of the circle
        let numberOfGenerators = 12; // Number of generators to place
        let angleIncrement = (2 * Math.PI) / numberOfGenerators; // Angle between each generator
        for (let i = 1; i < numberOfGenerators; i++) {
            const angle = i * angleIncrement;
            const x = player.position.x + radius * Math.cos(angle);
            const y = player.position.y + radius * Math.sin(angle);
            player.addBuilding(new Buildings.Generator(color, { x: x, y: y }, BuildingVariantTypes.GENERATOR.POWER_PLANT)); // Generators are positioned, not rotated
        }
        radius = 350;
        let numberOfWalls = 13;
        angleIncrement = (0.75 * Math.PI) / numberOfGenerators; // Angle between each generator
        for (let i = 1; i < numberOfWalls; i++) {
            const angle = i * angleIncrement + 21;
            const x = player.position.x + radius * Math.cos(angle);
            const y = player.position.y + radius * Math.sin(angle);
            player.addBuilding(new Buildings.Wall(player.color, { x: x, y: y }, BuildingVariantTypes.WALL.SPIKE)); // Generators are positioned, not rotated
        }

        let turret = new Buildings.SniperTurret(color, { x: 580, y: -60 }, BuildingVariantTypes.SNIPER_TURRET.SEMI_AUTOMATIC_SNIPER);
        turret.cannonWidth = 35
        turret.cannonLength = 55
        turret.size = 50
        player.addBuilding(turret);


        turret = new Buildings.SniperTurret(color, { x: 580, y: 30 }, BuildingVariantTypes.SNIPER_TURRET.TRAPPER);
        player.addBuilding(turret);

        let bush = new Bush({ x: -700, y: 350 });
        this.renderer.addToQueue(bush, QueueType.OVERLAY);
        bush = new Bush({ x: 900, y: -500 });
        this.renderer.addToQueue(bush, QueueType.OVERLAY);

        let rock = new Rock({ x: 200, y: 600 }, 50, 60);
        this.renderer.addToQueue(rock, QueueType.STATIC);
        rock = new Rock({ x: -1150, y: 0 }, 20, 220);
        this.renderer.addToQueue(rock, QueueType.STATIC);
        rock = new Rock({ x: -1200, y: 110 }, 40, -120);
        this.renderer.addToQueue(rock, QueueType.STATIC);
        rock = new Rock({ x: -1250, y: 0 }, 80, 120);
        this.renderer.addToQueue(rock, QueueType.STATIC);

        // Add the player to the render queue
        this.renderer.addToQueue(player, QueueType.PLAYER);


        let c = new Commander(player.color, { x: 1200, y: -300 }, 0, -1);
        c.setTargetPoint({x:0, y:0});
        this.renderer.addToQueue(c, QueueType.OVERLAY);
        c = new TriCommander("#60eaff", { x: -1000, y: 500 }, 0, -1);
        this.renderer.addToQueue(c, QueueType.OVERLAY);


        color = "#60eaff";

        player = new Player(-2, "(⌐⊙_⊙)", color, 0, { x: -650, y: -300 }, 2000, false, 350);
        player.removeSpawnProtection();
        radius = 154; // Radius of the circle
        numberOfGenerators = 12; // Number of generators to place
        angleIncrement = (2 * Math.PI) / numberOfGenerators; // Angle between each generator

        for (let i = 2; i < numberOfGenerators; i++) {
            const angle = i * angleIncrement;
            const x = player.position.x + radius * Math.cos(angle);
            const y = player.position.y + radius * Math.sin(angle);
            player.addBuilding(new Buildings.Generator(color, { x: x, y: y })); // Generators are positioned, not rotated
        }

        player.addBuilding(new Buildings.SimpleTurret(color, { x: -450, y: -260 }));
        player.addBuilding(new Buildings.SimpleTurret(color, { x: -450, y: -60 }, BuildingVariantTypes.SIMPLE_TURRET.RAPID_TURRET));
        player.addBuilding(new Buildings.SimpleTurret(color, { x: -520, y: -20 }, BuildingVariantTypes.SIMPLE_TURRET.GATLING_TURRET));
        player.addBuilding(new Buildings.Barracks(color, { x: -620, y: 30 }, BuildingVariantTypes.BARRACKS.CANNON_TANK_FACTORY));
        player.addBuilding(new Buildings.Barracks(color, { x: -700, y: 28 }, BuildingVariantTypes.BARRACKS.BOOSTER_CANNON_SIEGE_TANK_FACTORY));
  
        unit = new Tank(color, {x:-610, y:100}, UnitVariantTypes.TANK.CANNON);
        unit.rotation = 240;
        player.addUnit(unit);

         unit = new SiegeTank(color, {x:-720, y:110}, UnitVariantTypes.SIEGE_TANK.BOOSTER_ENGINE_CANNON);
        unit.rotation = 90;
        player.addUnit(unit);

        // Add the player to the render queue
        this.renderer.addToQueue(player, QueueType.PLAYER);
    }

    handlePlayButtonPress (playerName, equippedSkin) {
        this.networkManager.joinGame(playerName, equippedSkin)
    }

    initializeProperties () {
        this.viewport = new Viewport();
        this.camera = new Camera();
    }

    initializeToolbar () {
        const toolbarItems = [Buildings.Wall, Buildings.SimpleTurret, Buildings.Generator, Buildings.House, Buildings.SniperTurret, /*Buildings.Armory*/, Buildings.Barracks];
        const onSelectedBuilding = (buildingClass) => this.buildingManager.handleBuildingSelectionForPlacement(buildingClass);

        this.toolbar = new Toolbar(this, toolbarItems, onSelectedBuilding, this.buildingManager);
        this.toolbar.init();
    }

    initLeaderboard () {
        // Initialize the leaderboard with empty data
        this.leaderboard = new Leaderboard(this);
        this.leaderboard.renderEntries()
    }

    initMinimap () {
        this.miniMap = new MiniMap(this);
    }

    initalizeEventManager () {
        this.eventManager.init();
    }

    initializeManagers (loadBalancerAddress) {
        this.gameManager = new GameManager(this);
        this.themeManager = new ThemeManager();
        this.uiManager = new UIManager(this);
        this.networkManager = new NetworkManager(loadBalancerAddress, this);
        this.inputManager = new InputManager(this);
        this.buildingManager = new BuildingManager(this);
        this.eventManager = new EventManager(this);
        this.unitManager = new UnitMananger(this);
    }

    createCanvas () {
        this.canvas = document.createElement("canvas");
        this.context = this.canvas.getContext("2d");
        this.styleCanvas();
        this.setCanvasDimensions();

        window.addEventListener("resize", () => this.setCanvasDimensions());
        this.uiManager.DOM.game.container.appendChild(this.canvas);
        this.renderer = new Renderer(this.canvas, this.context, this.camera, this);
    }

    styleCanvas () {
        this.canvas.style.margin = "auto";
        this.canvas.style.display = "block";
    }

    setCanvasDimensions () {
        this.viewport.resize(this.canvas);
    }

    launchGame () {
        this.gameManager.startGameLoop();
    }

    handleZoom (event) {
        const direction = event.deltaY > 0 ? 1 : -1;
        direction === 1 ? this.camera.zoomOut() : this.camera.zoomIn();
        this.eventManager.updateMousePosition(this.eventManager.lastMouseEvent);
        this.buildingManager.updateBuildingPosition();
    }
}
