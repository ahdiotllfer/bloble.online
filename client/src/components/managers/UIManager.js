import { BuildingTypes, calculateRequiredXP, getAvailableBuildingUpgrades, getColorForLevel, Servers, UnitTypes } from "../../network/constants.js";
import Network from "../../network/Network.js";
import SkinCache from "../SkinCache.js";
import { BuildingManager } from "./BuildingManager.js";
import ThemeManager from "./ThemeManager.js";
import UnitManager from "./UnitManager.js";

/*
    TODO:
        - Make a general show function instead of 20 seperate ones
          ->func(element, show)
        - Maybe seperate some functionality of the UIManager in smaller Parts
          see MiniMap.js / Leaderboard.js (originally part of UIManager)
*/

export default class UIManager {
    constructor (core) {
        this.core = core;
        this.loadingOverlay = null;
        this.selectedRegion = "";
        this.timerInterval = null;
        this.lastSendMessage = "";
        this.isDraggingChat = false;
        this.isChatInputFocused = false;
        this.upgradePreviewRotation = 0;
        this.upgradeCostElements = []; // Stores elements for later updates
        this.selectedUpgradeTab = 0;
        this.upgradePanelOpen = false;
        this.selectedGamemode = 0; // 0 = FFA, 1 = Small Bases

        this.initializeUIElements();
        this.addLoginDialogButtonListener();
        this.addPlayButtonListener();
        this.addContinueButtonListener();
        this.addMenuDialogButtonListener();
        this.addSkinPreviewButtonListener();
        this.addSkinLibraryButtonListener();
        this.addSettingsPanelListener();
        this.addChatButtonElementListener();
        this.makeChatBoxDraggable();
        this.addGamemodeSelectionListener();
    }

    initializeUIElements () {
        const elementSelectors = {
            // Menu-related elements
            menu: {
                screen: "menu-container",
                playButton: "play-button",
                menuButton: "menu-button",
                playerNameInput: "player-name",
                regionSelect: "region-select",
            },

            // Game UI elements
            game: {
                container: "game-container",
                over: {
                    container: "game-over-container",
                    content: "game-over-content", // ! Look this up
                    killedBy: "killed-by-container", // ! Look this up
                    continueButton: "continue-button",
                },
                toolbar: "toolbar-container",
                upgrades: {
                    container: "upgrade-container",
                    list: "upgrade-list",
                    destroyButton: "destroy-button",
                    exitButton: "upgrade-container-exit",
                    tabs: "upgrade-tabs",
                },
                resources: {
                    container: "resource-container",
                    power: "power",
                    shield: "shield",
                },
                miniMap: "minimap-container",
                leaderboard: "leaderboard-container",
                metrics: "game-metrics",
            },

            // Chat UI
            chat: {
                container: "chat",
                messages: "chat-messages",
                input: "chat-message-input",
                button: "chat-button",
            },

            // Game settings
            settings: {
                button: "#game-settings .slider button",
                panel: "#game-settings .settings",
                exitButton: "game-settings-exit",
                themeSelect: "theme-select",
            },

            // Account 
            account: {
                discordLoginButton: "discord-login-button",
                guestButton: "guest-button",
                accountButton: "account-button",
                loginDialog: "login-dialog",
                handle: "account-handle",
                statsContainer: "stats-container",
                progression: {
                    progressIcon: "#level-progression .progress-icon",
                    progressBar: "#level-progression .progress-bar",
                    progressText: "#level-progression .progress-text"
                }
            },

            // Skins
            skins: {
                libraryList: "skin-container",
                previewButton: "skin-preview",
                libraryDialog: "skin-library-dialog",
                libraryExit: "skin-library-exit",
                carousel: {
                    prevButton: "skin-carousel-prev",
                    nextButton: "skin-carousel-next",
                },
            },
        };

        // Initialize the dom property
        this.DOM = {};


        // Recursively initialize elements into `this.DOM`
        const initializeElements = (selectors, parent) => {
            Object.entries(selectors).forEach(([key, value]) => {
                if (typeof value === "string") {
                    parent[key] = value.startsWith("#") || value.includes(" ")
                        ? document.querySelector(value)
                        : document.getElementById(value);
                } else if (typeof value === "object" && value !== null) {
                    parent[key] = {};
                    initializeElements(value, parent[key]);
                }
            });
        };


        initializeElements(elementSelectors, this.DOM);

        this.menuOpen = false;

        this.showGameUIElements(false);
        this.showGameUIElements(false);

        this._populateGlobalLeaderboard();

        // Add event listeners for chat input focus and blur
        if (this.DOM.chat.input) {
            this.DOM.chat.input.addEventListener("focus", () => {
                this.core.camera.enableControls(false);
                this.isChatInputFocused = true;
            });
            this.DOM.chat.input.addEventListener("blur", () => {
                this.core.camera.enableControls(true);
                this.isChatInputFocused = false;
            });
        }

        if (this.DOM.game.upgrades.exitButton) {
            this.DOM.game.upgrades.exitButton.addEventListener("click", () => {
                this.core.buildingManager.deselectBuildings();
                this.hideUpgrades();
            });
        }

        // Retrieve saved color, player name, and region from local storage
        const savedPlayerName = localStorage.getItem("playerName");
        const savedRegion = localStorage.getItem("selectedRegion");

        if (savedRegion) {
            this.selectedRegion = savedRegion;
        }

        if (savedPlayerName) {
            this.DOM.menu.playerNameInput.value = savedPlayerName;
        }

        this.updateResources();

        // Populate theme selection dropdown and apply the saved theme
        this.populateThemeSelect();

        this.DOM.settings.themeSelect.value = ThemeManager.currentTheme;

        this.setupRegionSelect();
    }

    async _populateSkinLibrary () {
        const userData = this.core.networkManager.userData;
        if (!userData) {
            console.warn("No user data present.");
            return;
        }

        const addSkin = (skinData) => {
            let div = document.querySelector(`.skin-list-item[data-skin-id='${skinData.id}']`);

            if (!div) {
                // If the skin is not already in the list, create a new entry
                div = document.createElement("div");
                div.classList.add("skin-list-item");
                div.setAttribute("data-skin-id", skinData.id);

                const skinDetails = document.createElement("div");
                skinDetails.classList.add("skin-details");

                const skinTitle = document.createElement("h1");
                skinTitle.textContent = skinData.name;

                const skinImage = document.createElement("img");
                skinImage.src = `./assets/skins/veteran/${skinData.name}.webp`;
                skinImage.setAttribute("loading", "lazy");

                skinDetails.appendChild(skinTitle);
                skinDetails.appendChild(skinImage);

                div.appendChild(skinDetails);
            }

            // Check if the skin is unlocked or level-locked
            const isEquipped = skinData.id === userData.skins.equipped;
            const isUnlocked = skinData.requiredLevel && skinData.requiredLevel <= userData.progression.level;

            let button = div.querySelector("button");
            let levelLocked = div.querySelector(".skin-level-locked");

            if (isUnlocked || isEquipped) {
                // Show the button if the skin is unlocked or equipped
                if (!button) {
                    // If the button doesn't exist, create it
                    button = document.createElement("button");
                    button.textContent = isEquipped ? "Deselect" : "Select";
                    button.classList.toggle("selected", isEquipped);

                    button.addEventListener("click", () => {
                        const isSelected = button.classList.contains("selected");

                        // Deselect all other buttons first
                        const allButtons = this.DOM.skins.libraryList.querySelectorAll(".selected");
                        allButtons.forEach(btn => {
                            btn.classList.remove("selected");
                            btn.textContent = "Select";
                        });

                        if (isSelected) {
                            userData.skins.equipped = 0;
                            localStorage.setItem("equippedSkin", 0);
                            this.updateAccount();
                        } else {
                            userData.skins.equipped = skinData.id;
                            localStorage.setItem("equippedSkin", Number(skinData.id));
                            this.updateAccount();
                        }

                        button.classList.toggle("selected", !isSelected);
                        button.textContent = isSelected ? "Select" : "Deselect";
                    });

                    div.appendChild(button);
                } else {
                    // Update the existing button state
                    button.classList.toggle("selected", isEquipped);
                    button.textContent = isEquipped ? "Deselect" : "Select";
                }

                // Remove the "Level Locked" message if it's there
                if (levelLocked) {
                    levelLocked.remove();
                }
            } else {
                // If the skin is level-locked, show the "Level Locked" message and hide the button
                if (!levelLocked) {
                    levelLocked = document.createElement("div");
                    levelLocked.classList.add("skin-level-locked");

                    const lockImage = document.createElement("img");
                    lockImage.src = "./assets/icons/lock.svg";

                    const requiredLevel = document.createElement("p");
                    requiredLevel.innerText = `Level ${skinData.requiredLevel}`;

                    levelLocked.appendChild(lockImage);
                    levelLocked.appendChild(requiredLevel);

                    div.appendChild(levelLocked);
                }

                // Remove the button if it exists
                if (button) {
                    button.remove();
                }
            }

            // Append the skin item div to the library list (if it's a new entry)
            if (!div.parentElement) {
                this.DOM.skins.libraryList.appendChild(div);
            }
        };

        const veteranSkins = SkinCache.getAllSkinsByCategory("veteran");
        veteranSkins.forEach(skinData => {
            addSkin(skinData);
        });

        //! TODO: Remove when all veteran skins are implemented
        const lastSkin = veteranSkins[veteranSkins.length - 1];
        for (let i = lastSkin.requiredLevel + 5; i <= 100; i += 5) {
            const skinData = {
                id: "soon-" + i,
                name: "Soon!",
                requiredLevel: i,
            };
            addSkin(skinData);
        }
    }

    async _populateGlobalLeaderboard () {
        return; // Not implemented yet
        try {
            const response = await fetch("https://leaderboard.blobl.io");

            // Check if the response is ok (status code 200-299)
            if (!response.ok) {
                throw new Error("Network response was not ok " + response.statusText);
            }

            const leaderboardData = await response.json();

            this.globalLeaderboard = leaderboardData;
            const leaderboard = document.getElementById("global-leaderboard");
            leaderboard.innerHTML = "<h2>This Week's Champions</h2>";
            leaderboardData.forEach((entry, index) => {
                const container = document.createElement("p");

                const rankSpan = document.createElement("span");
                rankSpan.classList.add("rank");
                rankSpan.textContent = `${index + 1}.`;

                const nameSpan = document.createElement("span");
                nameSpan.classList.add("name");
                nameSpan.textContent = entry.name;

                const scoreSpan = document.createElement("span");
                scoreSpan.classList.add("score");
                scoreSpan.textContent = entry.score;

                container.appendChild(rankSpan);
                container.appendChild(nameSpan);
                container.appendChild(scoreSpan);
                leaderboard.appendChild(container);
                leaderboard.style.display = "flex";
            });
        } catch (error) {
            console.error("Failed to fetch leaderboard:", error);
        }
    }

    addLoginDialogButtonListener () {
        if (this.DOM.account.accountButton) {
            this.DOM.account.accountButton.addEventListener("click", () => {
                if (this.core.networkManager.loggedIn) {
                    this.core.networkManager.logout();
                } else {
                    this.showLoginDialog(true);
                }
            });
        }

        if (this.DOM.account.guestButton) {
            this.DOM.account.guestButton.addEventListener("click", () => {
                this.showLoginDialog(false);
            });
        }

        if (this.DOM.account.discordLoginButton) {
            this.DOM.account.discordLoginButton.addEventListener("click", () => {
                const clientId = "1297630936254386287";
                const redirectUri = encodeURIComponent("https://auth.blobl.io/discord/callback");
                const scope = encodeURIComponent("identify");
                const gameServer = encodeURIComponent(this.core.networkManager.network.serverAddress);

                const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${gameServer}`;
                window.location.href = oauthUrl;
            });
        }
    }

    async updateAccount () {
        const MAX_LEVEL = 40;

        // Default values in case userData is null or incomplete
        const defaultUserData = {
            discord: { username: "quest" },
            progression: { level: 1, xp: 0 },
            skins: { equipped: null, unlocked: [] },
            statistics: { highscore: 0, playtime: 0, kills: 0 }
        };

        // Helper function to ensure properties exist and are correctly initialized
        const ensureProperty = (obj, path, defaultValue) => {
            const keys = path.split('.');
            let current = obj;

            // Traverse the path and ensure the properties exist
            for (let key of keys) {
                if (!current[key]) {
                    current[key] = key === keys[keys.length - 1] ? defaultValue : {};
                }
                current = current[key];
            }
            return current;
        };

        // Get userData, falling back to defaultUserData if it's missing or null
        const userData = this.core.networkManager.userData || defaultUserData;

        // Ensure all necessary properties are initialized
        ensureProperty(userData, 'discord', { username: 'quest' });
        ensureProperty(userData, 'progression', { level: 1, xp: 0 });
        ensureProperty(userData, 'skins', { equipped: null, unlocked: [] });
        ensureProperty(userData, 'statistics', { highscore: 0, playtime: 0, kills: 0 });

        // Ensure progression values are valid numbers
        if (typeof userData.progression.level !== 'number') {
            userData.progression.level = 1;
        }
        if (typeof userData.progression.xp !== 'number') {
            userData.progression.xp = 0;
        }

        // Ensure skins.unlocked is an array
        if (!Array.isArray(userData.skins.unlocked)) {
            userData.skins.unlocked = [];
        }

        // Update the username
        const username = userData.discord?.username || 'Unknown User';
        this.DOM.account.handle.textContent = `@${username}`;

        // Handle progression data safely
        const level = userData.progression?.level || 1;
        let userXP = userData.progression?.xp || 0;

        // Cap the level and XP at MAX_LEVEL
        if (level > MAX_LEVEL) {
            level = MAX_LEVEL;
            userXP = 0; // Ensure XP doesn't exceed when max level is reached
        }

        const requiredXP = level < MAX_LEVEL ? calculateRequiredXP(level) : 0;
        const progressBarColor = getColorForLevel(level);
        const progressPercentage = level < MAX_LEVEL ? Math.max(10, requiredXP ? (userXP / requiredXP) * 100 : 0) : 100;

        this.DOM.account.progression.progressIcon.textContent = level;
        this.DOM.account.progression.progressIcon.style.backgroundColor = progressBarColor;
        this.DOM.account.progression.progressText.textContent =
            level < MAX_LEVEL ? `${userXP} / ${requiredXP} XP` : `Max Level`;
        this.DOM.account.progression.progressBar.style.width = `${progressPercentage}%`;
        this.DOM.account.progression.progressBar.style.backgroundColor = progressBarColor;

        // Fetch the equipped skin from SkinCache
        const equipped = userData.skins.equipped;

        if (equipped) {
            const skinImageData = await SkinCache.getSkin(equipped);
            if (skinImageData && skinImageData.image) {
                // Create the image element
                const img = document.createElement('img');
                img.src = skinImageData.image.src;

                // Clear any existing content inside the preview button
                this.DOM.skins.previewButton.innerHTML = '';

                // Append the image to the preview button
                this.DOM.skins.previewButton.appendChild(img);

                // Create and append the "+" text in the button
                const plusDiv = document.createElement('div');
                plusDiv.textContent = '+';
                this.DOM.skins.previewButton.appendChild(plusDiv);
            }
        } else {
            // Clear any existing content inside the preview button
            this.DOM.skins.previewButton.innerHTML = '<p>Skins</p>';
            // Create and append the "+" text in the button
            const plusDiv = document.createElement('div');
            plusDiv.textContent = '+';
            this.DOM.skins.previewButton.appendChild(plusDiv);
        }

        // Clear previous stats
        this.DOM.account.statsContainer.innerHTML = '';

        // Format playtime from seconds
        const formatPlaytime = (playtimeInSeconds) => {
            if (!playtimeInSeconds) return "0m";
            const hours = Math.floor(playtimeInSeconds / 3600);
            const minutes = Math.floor((playtimeInSeconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        };

        const formatScore = (score) => {
            if (score >= 1_000_000) {
                return (score / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
            } else if (score >= 1_000) {
                return (score / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
            }
            return score.toString();
        };

        // Create and append stats dynamically
        const statsData = [
            { label: 'Highscore', value: formatScore(userData.statistics?.highscore) || "0" },
            { label: 'Playtime', value: formatPlaytime(userData.statistics?.playtime) },
            { label: 'Total Kills', value: userData.statistics?.kills || "0" }
        ];

        statsData.forEach(stat => {
            const statDiv = document.createElement('div');

            const label = document.createElement('p');
            label.textContent = `${stat.label}:`;
            statDiv.appendChild(label);

            const value = document.createElement('p');
            value.textContent = stat.value;
            statDiv.appendChild(value);

            this.DOM.account.statsContainer.appendChild(statDiv);
        });
    }

    updateAccountButton () {
        if (this.DOM.account.accountButton) {
            if (this.core.networkManager.loggedIn) {
                // Clear any existing classes before setting the "Logout" state
                this.DOM.account.accountButton.classList.remove("login");
                this.DOM.account.accountButton.textContent = "Logout";
            } else {
                this.DOM.account.accountButton.classList.add("login");
                this.DOM.account.accountButton.textContent = "Login";
            }
            this.DOM.account.accountButton.style.display = "block";
        }
    }

    async setupRegionSelect () {
        // Populate the region-select dropdown with the servers from the Servers object
        Object.keys(Servers).forEach(regionKey => {
            const option = document.createElement("option");
            option.value = Servers[regionKey];
            option.textContent = regionKey;
            this.DOM.menu.regionSelect.appendChild(option);
        });


        // Determine the best server if no region is selected
        if (!this.selectedRegion) {
            const serverPings = await Promise.all(
                Object.values(Servers).map(async (url) => {
                    console.log(url)
                    const ping = await Network.pingServer(url); // Ping each server
                    return { url, ping };
                })
            );

            // Find the server with the minimum ping
            const bestServer = serverPings.reduce((min, server) => server.ping < min.ping ? server : min, { ping: Infinity });
            this.selectedRegion = bestServer.url;
            localStorage.setItem("selectedRegion", this.selectedRegion);
        }

        this.DOM.menu.regionSelect.value = this.selectedRegion;

        // Set event listener for region selection
        this.DOM.menu.regionSelect.addEventListener("change", (event) => {
            this.selectedRegion = event.target.value;
            localStorage.setItem("selectedRegion", this.selectedRegion);
            window.location.reload(); // Reload the page to apply the new region
        });
    }

    populateThemeSelect () {
        if (!this.DOM.settings.themeSelect) return;

        // Clear existing options
        this.DOM.settings.themeSelect.innerHTML = "";

        // Populate the dropdown with available themes
        Object.keys(this.core.themeManager.themeProperties).forEach(themeKey => {
            const option = document.createElement("option");
            option.value = themeKey;
            option.textContent = themeKey.charAt(0).toUpperCase() + themeKey.slice(1);
            this.DOM.settings.themeSelect.appendChild(option);
        });

        // Set the saved theme as selected
        if (this.theme) {
            this.DOM.settings.themeSelect.value = this.theme;
        }
    }

    animatePreview (previewCanvas, renderable) {
        const context = previewCanvas.getContext("2d");
        let animationFrameId; // Store the animation frame ID
        const scale = 0.8;
        const rotationSpeed = 0.001; // Adjust this value to control the rotation speed
        let lastTime = 0; // Initialize lastTime to 0

        renderable.rotationAngle = this.upgradePreviewRotation; // Initialize rotation angle for the building

        const animate = (currentTime) => {
            // Calculate deltaTime (time difference between frames)
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            // Update rotation angle using deltaTime
            this.upgradePreviewRotation += rotationSpeed;
            renderable.rotationAngle = this.upgradePreviewRotation;

            // Clear the previous frame
            context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

            // Save the current context state
            context.save();
            context.lineJoin = "round";
            context.lineCap = "round";
            // Translate context to the center of the canvas
            context.translate(previewCanvas.width / 2, previewCanvas.height / 2);

            // Rotate the context
            context.rotate(this.upgradePreviewRotation);

            // Apply the scale
            context.scale(scale, scale);

            // Translate context back to the top-left corner
            context.translate(-previewCanvas.width / 2, -previewCanvas.height / 2);

            // Render the building
            renderable.render(context, { x: -previewCanvas.width / 2, y: -previewCanvas.height / 2 }, deltaTime);

            // Restore the original context state
            context.restore();



            // Request the next frame
            animationFrameId = requestAnimationFrame(animate);
        };

        // Start the animation
        animate(0); // Start with currentTime as 0

        // Method to stop the animation
        previewCanvas.stopAnimation = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };
    }

    showCoreUpgrades (onUpgradeSelect) {
        const upgradeHotkeys = ["Q", "E", "T"];

        // Inline helper to fetch available upgrades based on type
        const getAvailableUpgrades = () => {
            //! Get available upgrades for the core from constants.js

            // Test data for available upgrades
            const options = [
                {
                    name: "Commander",
                    description: "Powerful unit, you can only have 1",
                    cost: 7000,
                    unitType: UnitTypes.COMMANDER
                },
                {
                    name: "Repair",
                    description: "Repair your base and restore health.",
                    cost: 6000,
                    unitType: null // No unit type associated
                },
            ];

            // Filter options based on the gameManager"s state
            return options.filter(option => {
                if (option.unitType === UnitTypes.COMMANDER) {
                    return !this.core.gameManager.hasCommander;
                }
                return true; // Include other options
            });
        };


        // Inline helper to create and append upgrade items to the list
        const createUpgradeItem = (upgradeInfo, index) => {
            const upgradeItem = document.createElement("div");
            upgradeItem.classList.add("upgrade-item");

            const preview = document.createElement("canvas");
            preview.classList.add("preview");
            preview.width = 80;
            preview.height = 80;

            let renderable;
            if (upgradeInfo.unitType) {
                const UnitClass = UnitManager.getUnitClassByType(upgradeInfo.unitType);
                renderable = new UnitClass(this.core.gameManager.player.color, { x: 0, y: 0 }, 0);
            }

            if (renderable) {
                this.animatePreview(preview, renderable);
            }

            const description = document.createElement("div");
            description.classList.add("description");

            description.innerHTML = `
                <p class="header">${upgradeInfo.name}</p>
                <p class="text">${upgradeInfo.description}</p>
                <p class="hotkey">[${upgradeHotkeys[index]}]</p>
                <p class="cost">${upgradeInfo.cost} Power</p>
            `;
            this.upgradeCostElements.push({ cost: upgradeInfo.cost, element: description.querySelector(".cost") });

            upgradeItem.appendChild(preview);
            upgradeItem.appendChild(description);

            upgradeItem.addEventListener("click", () => {
                onUpgradeSelect(upgradeInfo);
            });

            this.DOM.game.upgrades.list.appendChild(upgradeItem);

            this._updateCost();
        };

        // Inline helper to handle "no upgrades" or "coming soon" messages
        const handleEmptyUpgrades = (availableUpgrades) => {
            if (availableUpgrades.length === 0) {
                const noUpgradesItem = document.createElement("div");
                noUpgradesItem.classList.add("upgrade-item", "coming-soon");
                noUpgradesItem.innerHTML = "<p>No upgrades available</p>";
                this.DOM.game.upgrades.list.appendChild(noUpgradesItem);
            }
        };

        // Start processing
        const availableUpgrades = getAvailableUpgrades();

        // Set the building name in the header
        document.querySelector("#upgrade-container h1").textContent = "Headquarters";

        // Stop and clear previous animations, then clear the upgrade list
        this.hideUpgrades();
        this.DOM.game.upgrades.list.innerHTML = "";


        // Populate available upgrades
        availableUpgrades.forEach((upgradeInfo, index) => createUpgradeItem(upgradeInfo, index));

        // Handle cases with no or fewer upgrades than expected
        handleEmptyUpgrades(availableUpgrades);

        this.DOM.game.upgrades.destroyButton.style.display = "none";

        // Show the upgrade container
        this.DOM.game.upgrades.container.style.display = "flex";
    }

    showUpgrades (building, onUpgradeSelect, onDestroyClicked) {
        const isArmory = BuildingTypes.ARMORY === building.type;
        const isBarracks = BuildingTypes.BARRACKS === building.type;
        const upgradeHotkeys = ["Q", "E", "T"];

        // Inline helper to fetch available upgrades based on type
        const getAvailableUpgrades = () => {
            /* if (isArmory) {
                 const unitType = this.selectedUpgradeTab;
                 const currentUpgrade = this.core.gameManager.unitUpgrades[unitType] || 0;
                 return getAvailableUnitUpgrades(unitType, currentUpgrade);
             }*/
            return getAvailableBuildingUpgrades(building.type, building.variant);
        };

        // Inline helper to create and append upgrade items to the list
        const createUpgradeItem = (upgradeInfo, index) => {
            const upgradeItem = document.createElement("div");
            upgradeItem.classList.add("upgrade-item");

            const preview = document.createElement("canvas");
            preview.classList.add("preview");
            preview.width = 80;
            preview.height = 80;

            let renderable;
            if (isArmory) {
                const unitType = this.selectedUpgradeTab;
                const UnitClass = UnitManager.getUnitClassByType(unitType);
                renderable = new UnitClass(building.color, { x: 0, y: 0 }, upgradeInfo.variant);
            } else {
                const BuildingClass = BuildingManager.getBuildingClassByType(building.type);
                renderable = new BuildingClass(building.color, { x: 0, y: 0 }, upgradeInfo.variant);
            }

            if (renderable) {
                this.animatePreview(preview, renderable);
            }

            const description = document.createElement("div");
            description.classList.add("description");

            description.innerHTML = `
                <p class="header">${upgradeInfo.name}</p>
                <p class="text">${upgradeInfo.description}</p>
                <p class="hotkey">[${upgradeHotkeys[index]}]</p>
                <p class="cost">${upgradeInfo.cost} Power</p>
            `;
            this.upgradeCostElements.push({ cost: upgradeInfo.cost, element: description.querySelector(".cost") });

            upgradeItem.appendChild(preview);
            upgradeItem.appendChild(description);

            upgradeItem.addEventListener("click", () => {
                const upgradeData = isArmory
                    ? { unitType: this.selectedUpgradeTab, unitVariant: upgradeInfo.variant }
                    : { buildingVariant: upgradeInfo.variant, cost: upgradeInfo.cost };
                onUpgradeSelect(upgradeData);
            });

            this.DOM.game.upgrades.list.appendChild(upgradeItem);

            this._updateCost();
        };

        // Inline helper to handle "no upgrades" or "coming soon" messages
        const handleEmptyUpgrades = (availableUpgrades) => {
            if (isArmory && availableUpgrades.length < 2) {
                for (let i = 0; i < 2 - availableUpgrades.length; i++) {
                    const comingSoonItem = document.createElement("div");
                    comingSoonItem.classList.add("upgrade-item", "coming-soon");
                    comingSoonItem.innerHTML = "<p>In the lab—upgrades incoming!</p>";
                    this.DOM.game.upgrades.list.appendChild(comingSoonItem);
                }
            } else if (availableUpgrades.length === 0) {
                const noUpgradesItem = document.createElement("div");
                noUpgradesItem.classList.add("upgrade-item", "coming-soon");
                noUpgradesItem.innerHTML = "<p>No upgrades available</p>";
                this.DOM.game.upgrades.list.appendChild(noUpgradesItem);
            }
        };

        const availableUpgrades = getAvailableUpgrades();

        // Define a list of names that should not be pluralized
        const nonPluralizable = new Set(["Barracks"]);

        // Determine the building label
        const buildingLabel = nonPluralizable.has(building.name)
            ? building.name
            : building.count === 1
                ? building.name
                : `${building.name}s`;

        // Update the header, showing the count only if it"s greater than 1
        document.querySelector("#upgrade-container h1").textContent =
            building.count > 1 ? `${buildingLabel} (${building.count})` : buildingLabel;

        // Stop and clear previous animations, then clear the upgrade list
        this.hideUpgrades();
        this.DOM.game.upgrades.list.innerHTML = "";

        // Populate upgrade tabs for armory or clear if not an armory
        if (isBarracks && building.count === 1) {
            this._populateBarrackActivationSettings(building, onUpgradeSelect);
        } else {
            this._clearUpgradeTabsElement();
        }

        // Populate available upgrades
        availableUpgrades.forEach((upgradeInfo, index) => {
            // Check if upgradeInfo is defined and has a valid structure
            if (upgradeInfo && (upgradeInfo.baseCost || upgradeInfo.cost)) {
                // Ensure a valid base cost
                const baseCost = upgradeInfo.baseCost ?? upgradeInfo.cost; // Use baseCost if available, fallback to cost
                const calculatedCost = baseCost * building.count;
                const upgradeInfoCopy = { ...upgradeInfo, cost: calculatedCost }; // Create a copy with updated cost
                createUpgradeItem(upgradeInfoCopy, index);
            } else {
                console.warn(`Invalid upgradeInfo at index ${index}:`, upgradeInfo);
            }
        });
        // Handle cases with no or fewer upgrades than expected
        handleEmptyUpgrades(availableUpgrades);

        // Set up the destroy button with a new click handler
        this.DOM.game.upgrades.destroyButton.removeEventListener("click", this.destroyClickHandler);
        this.destroyClickHandler = () => onDestroyClicked();
        this.DOM.game.upgrades.destroyButton.addEventListener("click", this.destroyClickHandler);

        // Show the upgrade container
        this.DOM.game.upgrades.container.style.display = "flex";
    }

    updateBarrackActivationTab (tab = null) {
        const tabContainer = this.DOM.game.upgrades.tabs;
        const amountActive = this.core.gameManager.activeBarracks.current;
        const maxActive = this.core.gameManager.activeBarracks.max;

        // If no tab is passed, get the first tab in the container
        if (!tab && tabContainer) {
            // Look for the tab that has the correct data-type attribute
            tab = tabContainer.querySelector(".tab[data-type='barracks-activation-toggle']");
        }

        if (tab) {
            tab.innerHTML = `
                <p class="text">${amountActive}/${maxActive} Activated</p>
                <p class="hotkey">[F]</p>
            `;
        }
    }

    _populateBarrackActivationSettings (building, onUpgradeSelect) {
        let amountActive = this.core.gameManager.activeBarracks.current;
        let maxActive = this.core.gameManager.activeBarracks.max;

        const tabContainer = this.DOM.game.upgrades.tabs;
        tabContainer.innerHTML = ""; // Clear existing tabs

        this.selectedUpgradeTab = 0; // Deselect tab

        const tab = document.createElement("div");
        tab.classList.add("tab");
        tab.setAttribute("data-type", "barracks-activation-toggle");
        tab.classList.toggle("selected", building.activated);
        tab.innerHTML = `
        <p class="text">${amountActive}/${maxActive} Activated</p>
        <p class="hotkey">[F]</p>`;

        // Add click listener for changing selected upgrade tab
        const tabClickHandler = () => {
            let updated = false;

            // Update active amount and toggle tab selection
            if (amountActive < maxActive && !building.activated) {
                amountActive++;
                this.core.gameManager.increaseActiveBarracks(1);
                tab.classList.add("selected");
                updated = true;
            } else if (building.activated) {
                // If the building is already activated, toggle it off
                amountActive--;
                this.core.gameManager.decreaseActiveBarracks(1);
                tab.classList.remove("selected");
                updated = true;
            }

            // Only proceed if the tab was updated (status changed)
            if (updated) {
                // Toggle the building"s activation state
                building.activated = !building.activated;

                // Trigger the upgrade selection handler
                onUpgradeSelect();
            }
        };

        tab.addEventListener("click", tabClickHandler);
        tabContainer.appendChild(tab);
    }

    _clearUpgradeTabsElement () {
        const tabContainer = this.DOM.game.upgrades.tabs;
        tabContainer.innerHTML = ""; // Clear existing tabs
    }

    _updateCost () {
        this.upgradeCostElements.forEach(i => {
            const { cost, element } = i;
            if (cost > this.core.gameManager.resources.power.current) {
                element.style.color = "red";
            } else {
                element.style.color = "white";
            }
        });
    }

    hideUpgrades () {
        if (this.DOM.game.upgrades.container.style.display === "none") return;
        this.upgradeCostElements = []; // Clear


        // Make the destroy button visible in case it got set to none (see showCoreUpgrades())
        this.DOM.game.upgrades.destroyButton.style.display = "flex";


        // Stop and remove previous animations
        Array.from(this.DOM.game.upgrades.list.querySelectorAll("canvas")).forEach(canvas => {
            if (canvas.stopAnimation) {
                canvas.stopAnimation();
            }
        });

        // Clone the tab container and replace it to remove event listeners
        const tabContainerClone = this.DOM.game.upgrades.tabs.cloneNode();
        this.DOM.game.upgrades.tabs.parentNode.replaceChild(tabContainerClone, this.DOM.game.upgrades.tabs);
        this.DOM.game.upgrades.tabs = tabContainerClone; // Update reference

        this.DOM.game.upgrades.container.style.display = "none"; // Hide the panel
    }

    addChatMessage (username, message, color, player = null) {
        if (!this.DOM.chat.messages) return;

        // Create a new chat message div
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");

        // Create and set username span
        const usernameSpan = document.createElement("span");
        usernameSpan.classList.add("name");
        usernameSpan.textContent = username;
        usernameSpan.style.color = color;
        if (player) {
            usernameSpan.style.cursor = "pointer";
            // Add click event listener to usernameSpan
            usernameSpan.addEventListener("click", () => this.handleUsernameClick(player));
        }

        // Create and set message span
        const messageSpan = document.createElement("span");
        messageSpan.classList.add("text");
        messageSpan.textContent = message;

        // Append username and message spans to message div
        messageDiv.appendChild(usernameSpan);
        messageDiv.appendChild(messageSpan);

        // Append the new message div to the chat messages container
        this.DOM.chat.messages.appendChild(messageDiv);

        // Ensure no more than 15 messages are shown
        this.limitChatMessages(15);

        // Scroll to the bottom to show the latest message
        this.DOM.chat.messages.scrollTop = this.DOM.chat.messages.scrollHeight;
    }

    // Helper method to limit the number of chat messages displayed
    limitChatMessages (maxMessages) {
        const messages = this.DOM.chat.messages.querySelectorAll(".message");
        if (messages.length > maxMessages) {
            // Remove the oldest message
            this.DOM.chat.messages.removeChild(messages[0]);
        }
    }

    handleUsernameClick (player) {
        this.core.camera.setPosition(player.position, true);
    }

    addChatButtonElementListener () {
        if (!this.DOM.chat.button || !this.DOM.chat.input) return;

        this.DOM.chat.button.addEventListener("click", () => {
            const message = this.DOM.chat.input.value.trim();
            if (message === this.lastSendMessage) {
                this.DOM.chat.input.value = ""; // Clear input
                this.addChatMessage("System", "Stop Spamming!");
                this.disableChatButtonElementForSeconds(5); // Disable button for 5 seconds

            } else if (message) {
                this.DOM.chat.input.value = ""; // Clear input
                this.core.networkManager.sendChatMessage(message);
                this.lastSendMessage = message;
                this.disableChatButtonElementForSeconds(5); // Disable button for 5 seconds
            }
        });

        this.DOM.chat.input.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                event.preventDefault(); // Prevent default enter key behavior
                this.DOM.chat.button.click(); // Trigger chat button click
            }
        });
    }

    disableChatButtonElementForSeconds (seconds) {
        if (!this.DOM.chat.button) return;

        this.DOM.chat.button.disabled = true;
        let timeRemaining = seconds;
        const originalText = this.DOM.chat.button.textContent;

        const updateTimer = () => {
            if (timeRemaining > 0) {
                this.DOM.chat.button.textContent = `${timeRemaining}s`;
                timeRemaining -= 1;
            } else {
                clearInterval(this.timerInterval);
                this.DOM.chat.button.disabled = false;
                this.DOM.chat.button.textContent = originalText;
            }
        };

        updateTimer(); // Update immediately
        this.timerInterval = setInterval(updateTimer, 1000); // Update every second
    }

    addPlayButtonListener () {
        if (!this.DOM.menu.playButton) return;

        this.DOM.menu.playButton.addEventListener("click", () => {
            const playerName = this.extractPlayerName();
            localStorage.setItem("playerName", playerName);
            const equippedSkin = this.core.networkManager.userData?.skins?.equipped || 0;
            if (hcaptcha.getResponse() != '') {
                this.core.handlePlayButtonPress(playerName, equippedSkin, hcaptcha.getResponse());
            }
        });
    }

    addContinueButtonListener () {
        if (!this.DOM.game.over.continueButton) return;
        this.DOM.game.over.continueButton.addEventListener("click", () => {
            this.showGameOverContainer(false);
            this.showMenuUIElements(true);
        });
    }

    addMenuDialogButtonListener () {
        const dialogButton = document.getElementById("menu-dialog-button");
        if (dialogButton) {
            dialogButton.addEventListener("click", () => {
                this.hideMenuDialog();
            });
        }
    }

    addSkinPreviewButtonListener () {
        if (this.DOM.skins.previewButton) {
            this.DOM.skins.previewButton.addEventListener("click", () => {
                if (this.core.networkManager.loggedIn) {
                    this._populateSkinLibrary();
                    this.showSkinLibraryDialog(true);
                } else {
                    this.showLoginDialog(true);
                }
            });
        }
    }

    addSkinLibraryButtonListener () {
        if (this.DOM.skins.libraryExit) {
            this.DOM.skins.libraryExit.addEventListener("click", () => {
                this.showSkinLibraryDialog(false);
            });
        }

        const updateCarouselButtons = (list, updatedScrollLeft) => {
            const totalScrollWidth = list.scrollWidth - list.clientWidth; // Total scrollable width
            const currentScrollPosition = updatedScrollLeft; // Current scroll position

            // Check and update the prevButton class
            if (currentScrollPosition <= 100) {
                this.DOM.skins.carousel.prevButton.classList.add("end");
            } else {
                this.DOM.skins.carousel.prevButton.classList.remove("end");
            }

            // Check and update the nextButton class
            if (currentScrollPosition >= totalScrollWidth) {
                this.DOM.skins.carousel.nextButton.classList.add("end");
            } else {
                this.DOM.skins.carousel.nextButton.classList.remove("end");
            }
        }

        if (this.DOM.skins.carousel.prevButton) {
            this.DOM.skins.carousel.prevButton.addEventListener("click", () => {
                const list = this.DOM.skins.libraryList;
                const itemWidth = list.children[0].offsetWidth * 3;
                const updatedScrollLeft = list.scrollLeft - itemWidth;
                list.scrollLeft = updatedScrollLeft;

                updateCarouselButtons(list, updatedScrollLeft);

            });
        }

        if (this.DOM.skins.carousel.nextButton) {
            this.DOM.skins.carousel.nextButton.addEventListener("click", () => {
                const list = this.DOM.skins.libraryList;
                const itemWidth = list.children[0].offsetWidth * 3;
                const updatedScrollLeft = list.scrollLeft + itemWidth;
                list.scrollLeft = updatedScrollLeft;

                updateCarouselButtons(list, updatedScrollLeft);
            });
        }
    }

    addSettingsPanelListener () {
        if (this.DOM.settings.button) {
            this.DOM.settings.button.addEventListener("click", () => {
                this.showGameSettingsButton(false)
                this.showGameSettingsPanel(true)
            });
        }

        if (this.DOM.settings.exitButton) {
            this.DOM.settings.exitButton.addEventListener("click", () => {
                this.showGameSettingsButton(true)
                this.showGameSettingsPanel(false)
            });
        }

        this.DOM.settings.themeSelect.addEventListener("change", (event) => {
            this.core.themeManager.applyTheme(event.target.value);
        });
    }

    extractPlayerName () {
        const defaultNames = ["◕‿↼", "•◡•", "(ㆆ _ ㆆ)", "ಠ╭╮ಠ", "(• ε •)",
            "⇀‸↼‶", "◔̯◔", "◉‿◉", "•`_´•", "-_-",
            "⌐■_■", "•_•", "ಠ_ರೃ", "´◔ ω◔`", "♥‿♥", "⊙＿⊙'", "⊙ω⊙", "> _ <"
        ];
        let playerName = this.DOM.menu.playerNameInput.value.trim();

        if (!playerName) {
            // Pick a random name from the defaultNames array
            playerName = defaultNames[Math.floor(Math.random() * defaultNames.length)];
        } else {
            // Limit to 12 bytes
            const encoder = new TextEncoder();
            let encodedName = encoder.encode(playerName);

            if (encodedName.length > 12) {
                playerName = playerName.slice(0, 12); // Initial cut to 12 characters
                encodedName = encoder.encode(playerName);
                while (encodedName.length > 12 && playerName.length > 0) {
                    playerName = playerName.slice(0, -1); // Trim from the end
                    encodedName = encoder.encode(playerName);
                }
            }
        }

        return playerName;
    }

    showMenuContainer (show) {
        this.core.camera.enableControls(!show)
        this.DOM.menu.screen.style.display = show ? "flex" : "none";
    }

    showGameOverContainer (show) {
        this.core.camera.enableControls(!show)
        this.DOM.game.over.container.style.display = show ? "flex" : "none";
    }

    showChat (show) {
        this.DOM.chat.container.style.display = show ? "flex" : "none";
    }

    showToolbar (show) {
        this.DOM.game.toolbar.style.display = show ? "flex" : "none";
    }

    showResource (show) {
        this.DOM.game.resources.container.style.display = show ? "flex" : "none";
        this.showSpawnProtectionTimer(show);
    }

    showLeaderboard (show) {
        this.DOM.game.leaderboard.style.display = show ? "flex" : "none";
    }

    showSkinLibraryDialog (show) {
        this.DOM.skins.libraryDialog.style.display = show ? "flex" : "none";
    }

    showConnectingOverlay (show) {
        if (show) {
            // Show overlay
            if (!this.loadingOverlay) {
                this.createConnectingOverlay();
            }
        } else {
            // Hide overlay
            this.removeConnectingOverlay();
        }
    }

    createConnectingOverlay () {
        if (this.loadingOverlay) return;

        this.loadingOverlay = document.createElement("div");
        this.loadingOverlay.classList.add("loading-overlay");

        const text = "Connecting...";
        for (let i = 0; i < text.length; i++) {
            const letterSpan = document.createElement("span");
            letterSpan.textContent = text[i];
            this.loadingOverlay.appendChild(letterSpan);
        }

        document.body.insertBefore(this.loadingOverlay, document.body.firstChild);

        const letters = this.loadingOverlay.querySelectorAll("span");
        letters.forEach((letter, index) => {
            letter.style.animationDelay = `${index * 0.1}s`;
            letter.classList.add("wave-animation");
        });
    }

    removeConnectingOverlay () {
        if (this.loadingOverlay && this.loadingOverlay.parentNode) {
            this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
            this.loadingOverlay = null;
        }
    }

    showMenuUIElements (show) {
        this.menuOpen = show;
        this.showMenuContainer(show);
    }

    showGameUIElements (show) {
        this.menuOpen = !show;
        this.showLeaderboard(show);
        this.showToolbar(show);
        this.showResource(show);
        this.showChat(show);
        this.showMetrics(show);
        this.showMiniMap(show);
    }

    showGameOverUIElements (show) {
        this.hideUpgrades();
        this.showGameOverContainer(show);
    }

    showMenuDialog (title, message1, message2 = "", message3 = "", buttonText = "Okay") {
        const dialog = document.getElementById("menu-dialog");
        const dialogTitle = dialog.querySelector("h2");
        const dialogMessages = dialog.querySelectorAll("p");
        const dialogButton = document.getElementById("menu-dialog-button");

        if (dialog) {
            //! Just keep the html content for now
            //   dialogTitle.textContent = title;
            //  dialogMessages[0].textContent = message1;
            //  dialogMessages[1].innerHTML = message2;
            //   dialogMessages[2].innerHTML = message3;
            //   dialogButton.textContent = buttonText;
            dialog.style.display = "flex";
        }
    }

    hideMenuDialog () {
        const dialog = document.getElementById("menu-dialog");
        if (dialog) {
            dialog.style.display = "none";
        }
    }

    updateResources () {
        const { power, protectionTime } = this.core.gameManager.resources;
        const protectionTimeDisplay = protectionTime.current > 0
            ? `${protectionTime.current}min`
            : "<1min";

        this.DOM.game.resources.power.innerHTML = `Power: <span>${power.current}/${power.max}</span>`;
        this.DOM.game.resources.shield.innerHTML = `Protection: <span>${protectionTimeDisplay}</span>`;


        this._updateCost(); // Update the upgrade panel
    }

    showSpawnProtectionTimer (show) {
        if (!this.DOM.game.resources.shield) return;
        this.DOM.game.resources.shield.style.display = show ? "flex" : "none";
    }

    showMetrics (show) {
        this.DOM.game.metrics.style.display = show ? "flex" : "none";
    }

    showGameSettingsButton (show) {
        this.DOM.settings.button.style.display = show ? "flex" : "none";
    }

    showGameSettingsPanel (show) {
        this.DOM.settings.panel.style.display = show ? "flex" : "none";
    }

    showMiniMap (show) {
        this.DOM.game.miniMap.style.display = show ? "flex" : "none";
    }

    showLoginDialog (show) {
        this.DOM.account.loginDialog.style.display = show ? "flex" : "none";
    }

    formatTime (timestamp) {
        if (!timestamp) return "0s";
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    updateGameOverStats (killerName, score) {
        const { time } = this.core.gameManager.stats;
        document.getElementById("game-over-killed-by").textContent = killerName;
        document.getElementById("game-over-time-survived").textContent = this.formatTime(time);
        document.getElementById("game-over-score").textContent = score || 0;
    }

    gameOver (killer, score) {
        this.core.camera.setPosition(killer.position, true);
        this.core.camera.setZoom(0.75);

        this.updateGameOverStats(killer.name, score);

        this.showGameUIElements(false);
        this.showGameOverUIElements(true);
    }

    kicked (reason, score) {
        this.core.camera.setZoom(0.75);

        let killedBy = reason;
        if (reason === "Scripting") {
            killedBy = "your pathetic code.";
        }

        this.updateGameOverStats(killedBy, score);

        this.showGameUIElements(false);
        this.showGameOverUIElements(true);
    }

    makeChatBoxDraggable () {
        const chatElement = document.getElementById("chat");
        const moveButton = document.getElementById("chat-move-button");

        if (!chatElement || !moveButton) return;

        let startX, startY, initialX, initialY;

        const handleMouseDown = (e) => {
            if (!this.isDraggingChat) return;

            startX = e.clientX;
            startY = e.clientY;
            initialX = chatElement.offsetLeft;
            initialY = chatElement.offsetTop;

            chatElement.classList.add("dragging");

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        };

        const handleMouseMove = (e) => {
            if (!this.isDraggingChat) return;

            const currentX = e.clientX;
            const currentY = e.clientY;

            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            chatElement.style.left = `${initialX + deltaX}px`;
            chatElement.style.top = `${initialY + deltaY}px`;
        };

        const handleMouseUp = () => {
            if (this.isDraggingChat) {
                this.isDraggingChat = false;
                chatElement.classList.remove("dragging");

                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            }
        };

        const handleMouseDownOnMoveButton = (e) => {
            this.isDraggingChat = true; // Enable dragging
            moveButton.classList.add("active");
            handleMouseDown(e); // Start dragging
        };

        const handleMouseUpOnMoveButton = () => {
            if (this.isDraggingChat) {
                this.isDraggingChat = false;
                moveButton.classList.remove("active");
            }
        };

        moveButton.addEventListener("mousedown", handleMouseDownOnMoveButton);
        document.addEventListener("mouseup", handleMouseUpOnMoveButton);

        // Prevent dragging when clicking outside the move button
        chatElement.addEventListener("mousedown", (e) => {
            if (!this.isDraggingChat) return;
            e.preventDefault();
            handleMouseDown(e);
        });
    }

    setServerRebootAlert (minutes) {
        // Calculate the end time based on the current time and the specified minutes
        const endTime = Date.now() + minutes * 60 * 1000;

        // Function to update the alert text content
        const updateAlertText = (alertElement) => {
            const updateText = () => {
                const timeLeftMs = Math.max(0, endTime - Date.now()); // Time in milliseconds
                const timeLeftSec = Math.ceil(timeLeftMs / 1000); // Time in seconds

                const minutesLeft = Math.floor(timeLeftSec / 60); // Minutes left
                const secondsLeft = timeLeftSec % 60; // Seconds left

                // Create the message based on the time left
                let message;
                if (minutesLeft > 0) {
                    message = `Grab a snack, server's rebooting in ${minutesLeft}m ${secondsLeft}s! 🍪`;
                } else {
                    message = `Server's about to reboot in ${secondsLeft}s! ⏳`;
                }

                alertElement.textContent = message;

                if (timeLeftMs <= 0) {
                    clearInterval(alertElement.intervalId);
                    if (alertElement.parentNode) {
                        alertElement.parentNode.removeChild(alertElement);
                    }
                }
            };

            // Update the alert text immediately
            updateText();

            // Set an interval to update the text every second
            alertElement.intervalId = setInterval(updateText, 1000); // Every second
        };

        // Check if there""s already an alert
        let existingAlert = document.querySelector(".info-alert");

        if (existingAlert) {
            // Clear existing interval if any
            if (existingAlert.intervalId) {
                clearInterval(existingAlert.intervalId);
            }

            // Update the existing alert text content
            updateAlertText(existingAlert);
        } else {
            // Create the new alert element
            existingAlert = document.createElement("div");
            existingAlert.className = "info-alert";

            // Insert the alert element as the first child of the gameContainer
            const gameContainer = this.DOM.game.container;
            if (gameContainer) {
                if (gameContainer.firstChild) {
                    gameContainer.insertBefore(existingAlert, gameContainer.firstChild);
                } else {
                    gameContainer.appendChild(existingAlert);
                }

                // Set the initial text content
                updateAlertText(existingAlert);
            } else {
                console.error("Game container element is not found.");
            }
        }
    }

    updateMetrics () {
        if (!this.DOM.game.metrics) return;
        const { fps, bandwidthReceived } = this.core.gameManager.metrics;
        this.DOM.game.metrics.innerText = `${fps} FPS | ${bandwidthReceived}`
    }

    addGamemodeSelectionListener () {
        const gamemodeElements = document.querySelectorAll("#gamemode-select .gamemode");
        gamemodeElements.forEach((element, index) => {
            if (element.classList.contains("disabled")) return; // Skip disabled modes
            element.addEventListener("click", () => {
                // Remove selected class from all
                gamemodeElements.forEach(el => el.classList.remove("selected"));
                // Add selected to clicked
                element.classList.add("selected");
                // Set selectedGamemode
                this.selectedGamemode = index;

                // If already connected, switch to the appropriate server for this gamemode
                if (this.core.networkManager.network.serverAddress) {
                    this.switchServerForGamemode(index);
                }
            });
        });
    }

    switchServerForGamemode (gamemodeIndex) {
        // Get the appropriate server for this gamemode
        const serverKeys = Object.keys(Servers);
        const serverKey = serverKeys[gamemodeIndex] || serverKeys[0]; // Fallback to first server
        const newServerAddress = Servers[serverKey];

        // If it's a different server, switch to it
        if (newServerAddress && newServerAddress !== this.core.networkManager.network.serverAddress) {
            console.log(`Switching server for gamemode ${gamemodeIndex} to ${newServerAddress}`);

            // Set flag to prevent automatic reconnection
            this.core.networkManager.isSwitchingServers = true;

            // Disconnect from current server
            if (this.core.networkManager.network.worker) {
                this.core.networkManager.network.worker.postMessage({ type: 'disconnect' });
            }

            // Update the server address
            this.core.networkManager.network.serverAddress = newServerAddress;

            // Show connecting overlay and connect to new server after a short delay to allow disconnect to complete
            this.core.uiManager.showConnectingOverlay(true);
            setTimeout(() => {
                this.core.networkManager.network.connect(this.selectedGamemode);
            }, 500); // 500ms delay
        }
    }
}