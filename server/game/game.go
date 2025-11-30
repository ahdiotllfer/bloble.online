package game

import (
	"log"
	"math"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type GameState struct {
	Players            map[ID]*Player
	NeutralBases       []*NeutralBase
	Bushes             []PositionInt
	Rocks              []Rock
	AvailablePositions map[PositionInt]bool
	Leaderboard        *Leaderboard
	sync.RWMutex
}

type DisconnectedPlayer struct {
	Player      *Player
	ExpiresAt   time.Time
	Fingerprint uint32
}

var (
	State = GameState{
		Players:            make(map[ID]*Player),
		AvailablePositions: make(map[PositionInt]bool),
	}
	availablePlayerIDs    *AvailableIDs
	CurrentGameMode       GameMode = MODE_FFA
	DisconnectedPlayers   = make(map[uint32]*DisconnectedPlayer)
	DisconnectedPlayersMu sync.RWMutex
)

func init() {
	go StartEventDispatcher()

	// Start the updates
	go startResourceUpdateLoop()
	go startRegenerationLoop()
	go startInactivityCheckLoop()
	go startUnitSpawnLoop()
	go startTargetingLoop()
	go startEntityUpdateLoop()
	go startProtectionCheckLoop()
	go startDisconnectedPlayerCleanupLoop()
}

func Start() {
	availablePlayerIDs = InitAvailableIDs(64)
	InitializeGameMap()
	State.Leaderboard = &Leaderboard{}

	InitializeNonSkinColors()
	loadSkins("data/skins.json")
}

func startRegenerationLoop() {
	ticker := time.NewTicker(PLAYER_HEALTH_REGENERATION_FREQUENCY * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		State.RLock()
		for _, player := range State.Players {
			if !player.Base.Health.hasMaxHealth() {
				player.Base.Health.Increment(PLAYER_HEALTH_REGENERATION)
				TriggerBaseHealthUpdateEvent(player.Base)
			}
			for _, neutral := range player.CapturedNeutralBases{
				if !neutral.Base.Health.hasMaxHealth(){
					neutral.Base.Health.Increment(PLAYER_HEALTH_REGENERATION)
					TriggerBaseHealthUpdateEvent(neutral.Base)
				}
			}
		}
		
		State.RUnlock()
	}
}

func startInactivityCheckLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		State.RLock()
		for _, player := range State.Players {
			if time.Since(player.GetLastActivity()) > PLAYER_TIMEOUT*time.Minute {
				player.MarkForRemoval()
				TriggerKickEvent(player, KICK_REASON_TIMEOUT)
			}
		}
		State.RUnlock()
	}
}

func startProtectionCheckLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		State.RLock()
		for _, player := range State.Players {
			if player.HasProtection() && time.Now().After(player.GetProtectionEndTime()) {
				player.RemoveProtection()
			}
		}
		State.RUnlock()
	}
}

func startResourceUpdateLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		State.RLock()
		for _, player := range State.Players {
			generatingPower := player.GetGenerating().Power
			player.Resources.Power.Increment(generatingPower)

			numNeutralBases := len(player.CapturedNeutralBases)

			// Calculate score increment while ensuring it doesn't go negative or overflow
			scoreIncrement := int32(generatingPower) - 1 + int32(numNeutralBases)*10 // Calculate as int32 to prevent overflow

			// Ensure the score increment is non-negative
			if scoreIncrement < 0 {
				scoreIncrement = 0 // Prevent negative score increments
			}

			// Increment the player's score safely
			player.IncrementScore(uint32(scoreIncrement)) // Cast back to uint32

			// Trigger resource update event
			TriggerResourceUpdateEvent(player)
		}
		State.RUnlock()
	}
}

func startUnitSpawnLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {

		State.RLock()
		players := make([]*Player, 0, len(State.Players)) // Create a slice of players
		for _, player := range State.Players {
			players = append(players, player)
		}
		State.RUnlock()

		for _, player := range players {

			if player.IsMarkedForRemoval() {
				continue
			}

			for _, spawning := range player.UnitSpawning {
				if spawning == nil || spawning.Barracks == nil || !spawning.Activated {
					continue
				}
				if spawning.Barracks.IsMarkedForRemoval() {
					continue
				}

				// Always decrement the frequency
				if spawning.Frequency.Current > 0 {
					decrement := uint16(1) // 1 second decrement
					spawning.Frequency.Decrement(decrement)
				}

				// Only proceed if the frequency has reached zero
				if spawning.Frequency.Get() == 0 {
					// Check and increment population
					requiredPopulation, ok := GetUnitRequiredPopulation(spawning.UnitType)
					if !ok {
						log.Println("Could not find required population for unit")
						continue
					}

					if !player.Population.IncrementUsed(requiredPopulation) {
						continue
					}

					unit, ok := player.AddUnit(spawning.UnitType, spawning.UnitVariant, spawning.Barracks)
					if !ok {
						player.Population.DecrementUsed(requiredPopulation)
						//log.Printf("Could not add unit of type %v to player %v", spawning.UnitType, player.ID)
						continue
					}
					spawning.Frequency.Reset()

					player.AddUnitBulletSpawning(unit)

					TriggerUnitSpawnEvent(unit, spawning.Barracks)
				}
			}
		}
	}
}

func startTargetingLoop() {
	duration := 100 * time.Millisecond
	ticker := time.NewTicker(duration)
	defer ticker.Stop()

	for range ticker.C {
		State.RLock()
		players := make([]*Player, 0, len(State.Players))
		for _, player := range State.Players {
			if !player.IsMarkedForRemoval() {
				players = append(players, player)
			}
		}
		neutrals := make([]*NeutralBase, 0, len(State.NeutralBases))
		neutrals = append(neutrals, State.NeutralBases...)
		State.RUnlock()

		var wg sync.WaitGroup
		wg.Add(len(players) + len(neutrals))

		// Process captured neutral bases
		for _, player := range players {
			go func(player *Player) {
				defer wg.Done()
				processPlayerTurrets(player, duration, players)
				processPlayerUnitTurrets(player, duration, players, neutrals)
			}(player)
		}

		// Process non-captured neutral bases
		for _, neutral := range neutrals {
			go func(neutral *NeutralBase) {
				defer wg.Done()
				processNeutralTurrets(neutral, duration, players)
			}(neutral)
		}
		wg.Wait()
	}
}

func processPlayerTurrets(player *Player, duration time.Duration, players []*Player) {
	player.Base.RLock()
	spawnings := make([]*BulletSpawning, 0, len(player.Base.BulletSpawning))
	spawnings = append(spawnings, player.Base.BulletSpawning...)
	player.Base.RUnlock()

	for _, spawning := range spawnings {
		if spawning.Shooter.IsMarkedForRemoval() { // Check before adding
			continue
		}

		// Always decrement the frequency
		decrement := uint16(duration.Milliseconds())
		spawning.Frequency.Decrement(decrement)

		// Only proceed if the frequency has reached zero
		if spawning.Frequency.Get() == 0 {
			turret := spawning.Shooter.GetObjectPointer().(*Building)
			turretOwner := turret.Owner

			ownerBase := turret.Owner.(*Player).Base

			// Find the closest unit and spawn bullets if in range
			closestUnit := findClosestUnitInRange(spawning, players, player)
			if closestUnit != nil {
				spawning.Frequency.Reset()
				closedUnitPosition := closestUnit.GetPosition()

				bullet, ok := ownerBase.AddBullet(spawning, closedUnitPosition, 0)
				if ok {
					TriggerTurretRotationUpdateEvent(turretOwner, turret, closedUnitPosition)
					TriggerBulletSpawnEvent(turretOwner, bullet, turret)
				} else {
					log.Println("Could not add bullet to owner")
				}
			}
		}
	}
}

func processNeutralTurrets(neutral *NeutralBase, duration time.Duration, players []*Player) {
	neutral.Base.RLock()
	spawnings := make([]*BulletSpawning, 0, len(neutral.Base.BulletSpawning))
	spawnings = append(spawnings, neutral.Base.BulletSpawning...)
	neutral.Base.RUnlock()

	for _, spawning := range spawnings {
		if spawning.Shooter.IsMarkedForRemoval() { // Check before adding
			continue
		}

		// Always decrement the frequency
		decrement := uint16(duration.Milliseconds())
		spawning.Frequency.Decrement(decrement)

		// Only proceed if the frequency has reached zero
		if spawning.Frequency.Get() == 0 {
			turret := spawning.Shooter.GetObjectPointer().(*Building)
			turretOwner := turret.Owner

			// Find the closest unit and spawn bullets if in range
			closestUnit := findClosestUnitInRange(spawning, players, neutral.CapturedBy)
			if closestUnit != nil {
				spawning.Frequency.Reset()
				closedUnitPosition := closestUnit.GetPosition()

				bullet, ok := neutral.Base.AddBullet(spawning, closedUnitPosition, 0)
				if ok {
					TriggerTurretRotationUpdateEvent(turretOwner, turret, closedUnitPosition)
					TriggerBulletSpawnEvent(turretOwner, bullet, turret)
				} else {
					log.Println("Could not add bullet to neutral base owner")
				}
			}
		}
	}
}

func processPlayerUnitTurrets(player *Player, duration time.Duration, players []*Player, neutrals []*NeutralBase) {
	player.RLock()
	unitSpawnings := make([]*BulletSpawning, 0, len(player.UnitBulletSpawning))
	unitSpawnings = append(unitSpawnings, player.UnitBulletSpawning...)
	player.RUnlock()

	for _, spawning := range unitSpawnings {
		// Check if the Turret is marked for removal
		if spawning.Shooter.IsMarkedForRemoval() {
			continue
		}

		// Always decrement the frequency
		decrement := uint16(duration.Milliseconds())
		spawning.Frequency.Decrement(decrement)

		// Only proceed if the frequency has reached zero
		if spawning.Frequency.Get() == 0 {
			unit := spawning.Shooter.GetObjectPointer().(*Unit)

			closestUnit := findClosestUnitInRange(spawning, players, player)
			if closestUnit != nil {
				spawning.Frequency.Reset()
				closestUnitPosition := closestUnit.GetPosition()
				bullet, ok := player.Base.AddBullet(spawning, closestUnitPosition, 0)
				if ok {
					TriggerUnitBulletSpawnEvent(player, bullet, unit)
				} else {
					log.Println("Could not add bullet to player")
				}
				continue
			}

			closestBuilding := findClosestBuildingInRange(spawning, player, players)
			if closestBuilding != nil {
				spawning.Frequency.Reset()
				closedBuildingPosition := closestBuilding.GetPosition()
				bullet, ok := player.Base.AddBullet(spawning, closedBuildingPosition, 0)
				if ok {
					TriggerUnitBulletSpawnEvent(player, bullet, unit)
				} else {
					log.Println("Could not add bullet to player")
				}
				continue
			}

			closestBuilding = findClosestBuildingInRangeNeutralBase(spawning, player, neutrals)
			if closestBuilding != nil {
				spawning.Frequency.Reset()
				closedBuildingPosition := closestBuilding.GetPosition()
				bullet, ok := player.Base.AddBullet(spawning, closedBuildingPosition, 0)
				if ok {
					TriggerUnitBulletSpawnEvent(player, bullet, unit)
				} else {
					log.Println("Could not add bullet to player")
				}
				continue
			}
		}
	}
}

func findClosestUnitInRange(spawning *BulletSpawning, players []*Player, excludePlayer *Player) *Unit {
	var closestUnit *Unit
	minDistance := float32(math.MaxFloat32)

	for _, otherPlayer := range players {
		if excludePlayer == otherPlayer || otherPlayer.IsMarkedForRemoval() || otherPlayer.HasProtection() {
			continue
		}

		// Lock the player to access units
		otherPlayer.RLock()
		otherPlayerUnits := make([]*Unit, 0, len(otherPlayer.Units))
		for _, otherPlayerUnit := range otherPlayer.Units {
			otherPlayerUnits = append(otherPlayerUnits, otherPlayerUnit)
		}
		otherPlayer.RUnlock()

		for _, unit := range otherPlayerUnits {
			if unit.IsMarkedForRemoval() {
				continue
			}

			// ? GetPosition doesnt use a LOCK
			turretPosition := spawning.Shooter.GetPosition()
			unitPosition := unit.GetPosition()

			distance := turretPosition.DistanceTo(unitPosition)
			if distance < minDistance && distance <= float32(spawning.Range) {
				minDistance = distance
				closestUnit = unit
			}
		}
	}
	return closestUnit
}

func findClosestBuildingInRange(spawning *BulletSpawning, player *Player, players []*Player) *Building {
	var closestBuilding *Building
	minDistance := float32(math.MaxFloat32)

	for _, otherPlayer := range players {
		if player == otherPlayer || otherPlayer.IsMarkedForRemoval() || otherPlayer.HasProtection() {
			continue
		}

		// Lock the player to access units
		otherPlayer.Base.RLock()
		otherPlayerBuildings := make([]*Building, 0, len(otherPlayer.Base.Buildings))
		for _, otherPlayerBuilding := range otherPlayer.Base.Buildings {
			otherPlayerBuildings = append(otherPlayerBuildings, otherPlayerBuilding)
		}
		otherPlayer.Base.RUnlock()

		for _, building := range otherPlayerBuildings {
			if building.IsMarkedForRemoval() {
				continue
			}

			// ? GetPosition doesnt use a LOCK
			turretPosition := spawning.Shooter.GetPosition()
			buildingPosition := building.GetPosition()

			distance := turretPosition.DistanceTo(buildingPosition)
			if distance < minDistance && distance <= float32(spawning.Range) {
				minDistance = distance
				closestBuilding = building
			}
		}
	}
	return closestBuilding
}

func findClosestBuildingInRangeNeutralBase(spawning *BulletSpawning, player *Player, neutral []*NeutralBase) *Building {
	var closestBuilding *Building
	minDistance := float32(math.MaxFloat32)

	for _, neutral := range neutral {

		// Check if the player has captured the neutral base
		if neutral.CapturedBy == player {
			continue // Skip if the player has captured this neutral base
		}

		// Lock the neutral base to access buildings
		neutral.Base.RLock()
		neutralBaseBuildings := make([]*Building, 0, len(neutral.Base.Buildings))
		for _, building := range neutral.Base.Buildings {
			neutralBaseBuildings = append(neutralBaseBuildings, building)
		}
		neutral.Base.RUnlock()

		for _, building := range neutralBaseBuildings {
			if building.IsMarkedForRemoval() {
				continue
			}

			// ? GetPosition doesnt use a LOCK
			turretPosition := spawning.Shooter.GetPosition()
			buildingPosition := building.GetPosition()

			distance := turretPosition.DistanceTo(buildingPosition)
			if distance < minDistance && distance <= float32(spawning.Range) {
				minDistance = distance
				closestBuilding = building
			}
		}
	}
	return closestBuilding
}

// hasCaptured checks if the player has captured the given neutral base
func hasCaptured(base *NeutralBase, capturedBases []*NeutralBase) bool {
	for _, capturedBase := range capturedBases {
		if capturedBase == base { // Compare pointers to check if it's the same base
			return true
		}
	}
	return false
}

func startEntityUpdateLoop() {
	duration := 50 * time.Millisecond
	ticker := time.NewTicker(duration)
	defer ticker.Stop()

	for range ticker.C {
		State.RLock()
		players := make([]*Player, 0, len(State.Players))
		for _, player := range State.Players {
			if !player.IsMarkedForRemoval() {
				players = append(players, player)
			}
		}
		neutrals := make([]*NeutralBase, 0, len(State.NeutralBases))
		neutrals = append(neutrals, State.NeutralBases...)
		State.RUnlock()

		updateEntities(players, neutrals, duration)
		checkCollisions(players, neutrals)
	}
}

func updateEntities(players []*Player, neutrals []*NeutralBase, duration time.Duration) {
	for _, player := range players {
		updateBullets(player.Base, duration)
		updateUnits(player, duration, players)
	}
	for _, neutral := range neutrals {
		updateBullets(neutral.Base, duration)
	}
}

func updateBullets(base *Base, duration time.Duration) {
	base.RLock()
	bullets := make([]*Bullet, 0, len(base.Bullets))
	for _, bullet := range base.Bullets {
		bullets = append(bullets, bullet)
	}
	base.RUnlock()

	for _, bullet := range bullets {
		if bullet.isMarkedForRemoval() {
			continue
		}

		// Skip position update if bullet is a trapper and has already reached target
		if bullet.Behavior == TrapperBullet && bullet.ReachedTargetPosition {
			// Handle stay duration countdown for trapper bullets
			if bullet.StayDuration > 0 {
				bullet.StayDuration -= duration
			}
			// Remove the trapper bullet once its stay duration has expired
			if bullet.StayDuration <= 0 {
				TriggerBulletRemoveEvent(base.Owner, bullet.ID)
				bullet.MarkForRemoval()
				base.RemoveBullet(bullet.ID)
			}
			continue
		}

		updated := bullet.UpdatePosition(duration)
		if !updated {
			// Handle normal bullet behavior
			if bullet.Behavior != TrapperBullet {
				TriggerBulletRemoveEvent(base.Owner, bullet.ID)
				bullet.MarkForRemoval()
				base.RemoveBullet(bullet.ID)
				continue
			} else {
				bullet.ReachedTargetPosition = true
				continue // No need to trigger position update for trapper bullets once they reach the target
			}
		}

		// Trigger position update event only if bullet still moves or is not a trapper bullet
		TriggerBulletPositionUpdateEvent(base.Owner, bullet)
	}
}

func updateUnits(player *Player, duration time.Duration, players []*Player) {
	// Lock the player to access units
	player.RLock()
	units := make([]*Unit, 0, len(player.Units))
	for _, unit := range player.Units {
		units = append(units, unit)
	}
	player.RUnlock()

	// Slice to hold units that have been updated
	updatedUnits := make([]*Unit, 0)
	for _, unit := range units {
		if unit.IsMarkedForRemoval() {
			continue
		}

		// Update unit position
		if unit.UpdatePosition(duration, units) {
			updatedUnits = append(updatedUnits, unit)
		}
	}

	// Trigger a single update event for all updated units
	if len(updatedUnits) > 0 {
		TriggerUnitPositionUpdatesEvent(player, updatedUnits)
	}
}

func checkCollisions(players []*Player, neutrals []*NeutralBase) {
	for _, player := range players {
		// Lock the player to access units
		player.RLock()
		units := make([]*Unit, 0, len(player.Units))
		for _, unit := range player.Units {
			units = append(units, unit)
		}
		player.RUnlock()

		player.Base.RLock()
		buildings := make([]*Building, 0, len(player.Base.Buildings))
		for _, building := range player.Base.Buildings {
			buildings = append(buildings, building)
		}
		player.Base.RUnlock()

		checkBulletCollisions(player, players, neutrals, units, buildings)

		checkBaseCollisions(player, players, units)

		checkNeutralBaseCollisions(player, neutrals, units)

		checkUnitCollisions(player, players, units)

		checkRockCollisions(units)

	}
}

func checkRockCollisions(units []*Unit) {
	for _, rock := range State.Rocks {

		for _, unit := range units {
			if unit.IsMarkedForRemoval() {
				continue
			}
			if isUnitCollidingWithRock(unit, &rock) {
				unit.MarkForRemoval()
				handleUnitDestroyed(unit)
			}
		}
	}
}

// ! TODO: Optimize this shit
func checkBulletCollisions(player *Player, players []*Player, neutrals []*NeutralBase, units []*Unit, buildings []*Building) {
	for _, otherPlayer := range players {
		// Skip self or players marked for removal
		if otherPlayer.ID == player.ID || otherPlayer.IsMarkedForRemoval() {
			continue
		}

		otherPlayer.Base.RLock()
		bullets := make([]*Bullet, 0, len(otherPlayer.Base.Bullets))
		for _, bullet := range otherPlayer.Base.Bullets {
			bullets = append(bullets, bullet)
		}
		otherPlayer.Base.RUnlock()

		for _, unit := range units {
			// Skip units that are marked for removal
			if unit.IsMarkedForRemoval() {
				continue
			}

			for _, bullet := range bullets {
				// Skip bullets that are marked for removal
				if bullet.isMarkedForRemoval() {
					continue
				}

				if isBulletCollidingWithUnit(bullet, unit) {
					unitHealth := unit.Health.Current
					bulletHealth := bullet.Health.Current * 2

					isAlive := bullet.TakeDamage(unitHealth)
					if !isAlive { // Bullet is destroyed
						TriggerBulletRemoveEvent(otherPlayer.Base.Owner, bullet.ID)
						bullet.MarkForRemoval()
						otherPlayer.Base.RemoveBullet(bullet.ID)
					}

					damage := bulletHealth
					if bullet.Behavior == AntiTankBullet && (unit.Type == TANK || unit.Type == SIEGE_TANK) {
						damage *= uint16(bullet.DamageMultiplier) // 150% damage to tanks
					}

					if bullet.Behavior == UnitBullet { // ! Only applied in bullet against unit collisions
						damage *= uint16(bullet.DamageMultiplier) // 200% against other units
					}

					isAlive = unit.TakeDamage(damage)
					if !isAlive { // Unit is destroyed
						unit.MarkForRemoval()
						handleUnitDestroyed(unit)
						break // Unit destroyed no need for more bullet checks for that unit
					}
				}
			}
		}

		for _, building := range buildings {
			// Skip units that are marked for removal
			if building.IsMarkedForRemoval() {
				continue
			}

			for _, bullet := range bullets {
				// Skip bullets that are marked for removal
				if bullet.isMarkedForRemoval() {
					continue
				}

				if !bullet.IsFiredByUnit() {
					continue
				}

				if isBulletCollidingWithBuilding(bullet, building) {
					buildingHealth := building.Health.Current
					bulletHealth := bullet.Health.Current

					isAlive := bullet.TakeDamage(buildingHealth)
					if !isAlive { // Bullet is destroyed
						TriggerBulletRemoveEvent(otherPlayer.Base.Owner, bullet.ID)
						bullet.MarkForRemoval()
						otherPlayer.Base.RemoveBullet(bullet.ID)
					}

					isAlive = building.TakeDamage(bulletHealth)
					if !isAlive { // Unit is destroyed
						building.MarkForRemoval()
						handleBuildingDestroyed(building, player.Base)
						break // Building destroyed no need for more bullet checks for that building
					}
				}
			}
		}

		for _, rock := range State.Rocks {
			for _, bullet := range bullets {
				// Skip bullets that are marked for removal
				if bullet.isMarkedForRemoval() {
					continue
				}

				if !bullet.IsFiredByUnit() {
					continue
				}

				if isBulletCollidingWithRock(bullet, &rock) {
					TriggerBulletRemoveEvent(otherPlayer.Base.Owner, bullet.ID)
					bullet.MarkForRemoval()
					otherPlayer.Base.RemoveBullet(bullet.ID)
				}
			}
		}
	}

	for _, neutral := range neutrals {

		if hasCaptured(neutral, player.CapturedNeutralBases) {
			continue
		}

		neutral.Base.RLock()
		bullets := make([]*Bullet, 0, len(neutral.Base.Bullets))
		for _, bullet := range neutral.Base.Bullets {
			bullets = append(bullets, bullet)
		}
		neutral.Base.RUnlock()

		for _, unit := range units {
			// Skip units that are marked for removal
			if unit.IsMarkedForRemoval() {
				continue
			}

			for _, bullet := range bullets {
				// Skip bullets that are marked for removal
				if bullet.isMarkedForRemoval() {
					continue
				}

				if isBulletCollidingWithUnit(bullet, unit) {
					unitHealth := unit.Health.Current
					bulletHealth := bullet.Health.Current

					isAlive := bullet.TakeDamage(unitHealth)
					if !isAlive { // Bullet is destroyed
						TriggerBulletRemoveEvent(neutral.Base.Owner, bullet.ID)
						bullet.MarkForRemoval()
						neutral.Base.RemoveBullet(bullet.ID)
					}

					damage := bulletHealth
					if bullet.Behavior == AntiTankBullet && unit.Type == TANK && unit.Type == SIEGE_TANK {
						damage *= uint16(bullet.DamageMultiplier) // 150% damage to tanks
					}

					isAlive = unit.TakeDamage(damage)
					if !isAlive { // Unit is destroyed
						unit.MarkForRemoval()
						handleUnitDestroyed(unit)
						break // Unit destroyed no need for more bullet checks for that unit
					}
				}
			}
		}
	}

	player.Base.RLock()
	bullets := make([]*Bullet, 0, len(player.Base.Bullets))
	for _, bullet := range player.Base.Bullets {
		bullets = append(bullets, bullet)
	}
	player.Base.RUnlock()
	for _, neutral := range neutrals {
		if hasCaptured(neutral, player.CapturedNeutralBases) {
			continue
		}
		neutral.Base.RLock()
		neutralBuildings := make([]*Building, 0, len(neutral.Base.Buildings))
		for _, neutralBuilding := range neutral.Base.Buildings {
			neutralBuildings = append(neutralBuildings, neutralBuilding)
		}
		neutral.Base.RUnlock()
		for _, building := range neutralBuildings {
			// Skip units that are marked for removal
			if building.IsMarkedForRemoval() {
				continue
			}

			for _, bullet := range bullets {
				// Skip bullets that are marked for removal
				if bullet.isMarkedForRemoval() {
					continue
				}

				if !bullet.IsFiredByUnit() {
					continue
				}

				if !bullet.IsWithinRadius(building.Position, float32(GetBuildingSize(building.Type))) {
					continue
				}

				if isBulletCollidingWithBuilding(bullet, building) {
					buildingHealth := building.Health.Current
					bulletHealth := bullet.Health.Current

					isAlive := bullet.TakeDamage(buildingHealth)
					if !isAlive { // Bullet is destroyed
						TriggerBulletRemoveEvent(player.Base.Owner, bullet.ID)
						bullet.MarkForRemoval()
						player.Base.RemoveBullet(bullet.ID)
					}

					isAlive = building.TakeDamage(bulletHealth)
					if !isAlive { // Unit is destroyed
						building.MarkForRemoval()
						handleBuildingDestroyed(building, neutral.Base)
						break // Building destroyed no need for more bullet checks for that building
					}
				}
			}
		}
	}
}

func checkBaseCollisions(player *Player, players []*Player, units []*Unit) {
	for _, otherPlayer := range players {
		// Skip  players marked for removal
		if otherPlayer.IsMarkedForRemoval() {
			continue
		}

		hasSpawnProtection := otherPlayer.HasSpawnProtection
		basePosition := otherPlayer.Base.Position

		// Same player checks own units if left spawn protection
		if otherPlayer.ID == player.ID {
			if hasSpawnProtection {
				for _, unit := range units {
					if !unit.IsWithinRadius(IntToFloat(basePosition), float32(PLAYER_SPAWN_PROTECTION_RADIUS-unit.Size)) {
						player.RemoveProtection()
						break
					}
				}
			}
			continue
		}

		// Lock the player to access buildings
		otherPlayer.Base.RLock()
		otherBuildings := make([]*Building, 0, len(otherPlayer.Base.Buildings))
		for _, building := range otherPlayer.Base.Buildings {
			otherBuildings = append(otherBuildings, building)
		}
		otherPlayer.Base.RUnlock()

		for _, unit := range units {
			if unit.IsMarkedForRemoval() {
				continue
			}

			unitSize := float32(unit.Size)

			isNearBase := unit.IsWithinRadius(IntToFloat(basePosition), (PLAYER_SPAWN_PROTECTION_RADIUS + unitSize))

			// Check if the unit entered enemy protection zone
			if hasSpawnProtection {
				if isNearBase {
					unit.MarkForRemoval()
					handleUnitDestroyed(unit)
					continue
				}
			}

			if !isNearBase {
				continue
			}

			// Check if unit is colliding with the core
			coreRadius := PLAYER_MAX_CORE_RADIUS
			if CurrentGameMode == MODE_SMALL_BASES {
				coreRadius = PLAYER_SMALL_BASES_CORE_RADIUS
			}
			otherPlayerHealth := otherPlayer.Base.Health.Current
			isNearCore := unit.IsWithinRadius(IntToFloat(basePosition), (float32(otherPlayerHealth)/PLAYER_INITIAL_HEALTH)*float32(coreRadius)+unitSize)
			if isNearCore {
				unitHealth := unit.Health.Current
				unitIsAlive := unit.TakeDamage(otherPlayerHealth)
				otherPlayerIsAlive := otherPlayer.Base.TakeDamage(unitHealth)

				if !otherPlayerIsAlive {
					// Calculate the score and power increment
					scoreIncrement := (otherPlayer.Score / 100) * 50
					powerIncrement := math.Min((float64(otherPlayer.Score)/100)*10, 6000)

					// Apply the increments
					player.IncrementScore(scoreIncrement)
					player.IncrementKills(1)
					player.Resources.Power.Increment(uint16(powerIncrement))

					// Mark the other player for removal and trigger the kill event
					otherPlayer.MarkForRemoval()
					TriggerPlayerKilledEvent(otherPlayer, player)
				} else {
					// Update the health
					TriggerBaseHealthUpdateEvent(otherPlayer.Base)
				}

				if !unitIsAlive {
					unit.MarkForRemoval()
					handleUnitDestroyed(unit)
					continue
				}
			}

			// Check collision with buildings
			for _, building := range otherBuildings {
				if building.IsMarkedForRemoval() {
					continue
				}

				if isUnitCollidingWithBuilding(unit, building) {
					unitAlive, buildingAlive := handleUnitBuildingCollision(unit, building)
					if !buildingAlive {
						player.IncrementScore(uint32(building.Health.Max))
						building.MarkForRemoval()
						handleBuildingDestroyed(building, otherPlayer.Base)
					}

					if !unitAlive {
						unit.MarkForRemoval()
						handleUnitDestroyed(unit)
						break // Break out if the unit is destroyed
					}
				}
			}
		}
	}
}

func checkNeutralBaseCollisions(player *Player, neutrals []*NeutralBase, units []*Unit) {
	for _, neutral := range neutrals {
		basePosition := neutral.Base.Position

		if neutral.CapturedBy == player {
			continue
		}

		// Lock the neutral to access buildings
		neutral.Base.RLock()
		neutralBuildings := make([]*Building, 0, len(neutral.Base.Buildings))
		for _, building := range neutral.Base.Buildings {
			neutralBuildings = append(neutralBuildings, building)
		}
		neutral.Base.RUnlock()

		for _, unit := range units {
			if unit.IsMarkedForRemoval() {
				continue
			}

			unitSize := float32(unit.Size)

			isNearBase := unit.IsWithinRadius(IntToFloat(basePosition), (NEUTRAL_BASE_MAX_BUILDING_RADIUS + 100 + unitSize))
			if !isNearBase {
				continue
			}

			// Check if unit is colliding with the core
			neutralBaseHealth := neutral.Base.Health.Current
			isNearCore := unit.IsWithinRadius(IntToFloat(basePosition), (float32(neutralBaseHealth)/NEUTRAL_BASE_INITIAL_HEALTH)*NEUTRAL_BASE_MAX_CORE_RADIUS+unitSize)
			if isNearCore {
				unitHealth := unit.Health.Current
				unitIsAlive := unit.TakeDamage(neutralBaseHealth)
				neutralBaseIsAlive := neutral.Base.TakeDamage(unitHealth)

				if !neutralBaseIsAlive {
					handleNeutralBaseCaptured(player, neutral)
					break
				} else {
					// Update the health
					TriggerBaseHealthUpdateEvent(neutral.Base)
				}

				if !unitIsAlive {
					unit.MarkForRemoval()
					handleUnitDestroyed(unit)
					continue
				}
			}

			// Check collision with buildings
			for _, building := range neutralBuildings {
				if building.IsMarkedForRemoval() {
					continue
				}

				if isUnitCollidingWithBuilding(unit, building) {
					unitAlive, buildingAlive := handleUnitBuildingCollision(unit, building)
					if !buildingAlive {
						player.IncrementScore(uint32(building.Health.Max))
						building.MarkForRemoval()
						handleBuildingDestroyed(building, neutral.Base)
					}

					if !unitAlive {
						unit.MarkForRemoval()
						handleUnitDestroyed(unit)
						break // Break out if the unit is destroyed
					}
				}
			}
		}
	}
}

func applyExplosionDamage(unit *Unit) {
	//damage := unit.Health.Max
	damage := uint16(100)
	explosionRadius := float32(unit.ExplosionRadius)
	offset := float32(1.2)

	State.RLock()
	players := make([]*Player, 0, len(State.Players))
	for _, player := range State.Players {
		if !player.IsMarkedForRemoval() {
			players = append(players, player)
		}
	}
	neutrals := make([]*NeutralBase, 0, len(State.NeutralBases))
	for _, neutral := range State.NeutralBases {
		//f !neutral.IsMarkedForRemoval() {
		neutrals = append(neutrals, neutral)
		//}
	}
	State.RUnlock()

	for _, player := range players {
		if player.IsMarkedForRemoval() {
			continue
		}

		// Skip friendly damage
		if player.ID == unit.Player.ID {
			continue
		}

		// Lock the player to access units
		player.RLock()
		otherUnits := make([]*Unit, 0, len(player.Units))
		for _, unit := range player.Units {
			otherUnits = append(otherUnits, unit)
		}
		otherBuildings := make([]*Building, 0, len(player.Base.Buildings))
		for _, building := range player.Base.Buildings {
			otherBuildings = append(otherBuildings, building)
		}
		player.RUnlock()

		// Damage nearby units
		for _, otherUnit := range otherUnits {
			if otherUnit.IsMarkedForRemoval() {
				continue
			}
			if unit.IsWithinRadius(otherUnit.Position, explosionRadius*offset) {
				isAlive := otherUnit.TakeDamage(damage)
				if !isAlive {
					otherUnit.MarkForRemoval()
					unit.Player.IncrementScore(uint32(otherUnit.Health.Max) / 10)
					handleUnitDestroyed(otherUnit)
				}
			}
		}

		isNearBase := unit.IsWithinRadius(IntToFloat(player.Base.Position), float32(UNIT_DETECTION_RADIUS))

		// Damage nearby buildings
		if isNearBase {
			for _, otherBuilding := range otherBuildings {
				if otherBuilding.IsMarkedForRemoval() {
					continue
				}
				if unit.IsWithinRadius(otherBuilding.Position, explosionRadius*offset) {
					isAlive := otherBuilding.TakeDamage(damage)
					if !isAlive {
						otherBuilding.MarkForRemoval()
						unit.Player.IncrementScore(uint32(otherBuilding.Health.Max))
						handleBuildingDestroyed(otherBuilding, player.Base)
					}
				}
			}

			coreRadius := PLAYER_MAX_CORE_RADIUS
			if CurrentGameMode == MODE_SMALL_BASES {
				coreRadius = PLAYER_SMALL_BASES_CORE_RADIUS
			}
			basePosition := player.Base.Position
			otherPlayerHealth := player.Base.Health.Get()
			isNearCore := unit.IsWithinRadius(IntToFloat(basePosition), (float32(otherPlayerHealth)/PLAYER_INITIAL_HEALTH)*float32(coreRadius)+explosionRadius)
			if isNearCore {
				isAlive := player.Base.TakeDamage(damage)
				TriggerBaseHealthUpdateEvent(player.Base)
				if !isAlive {
					player.MarkForRemoval()
					unit.Player.IncrementScore((player.Score / 100) * 50)
					unit.Player.IncrementKills(1)

					// Calculate the score and power increment
					scoreIncrement := (player.Score / 100) * 50
					powerIncrement := math.Min((float64(player.Score)/100)*10, 6000)

					// Apply the increments
					unit.Player.IncrementScore(scoreIncrement)
					unit.Player.Resources.Power.Increment(uint16(powerIncrement))

					TriggerPlayerKilledEvent(player, unit.Player)
				}
			}
		}
	}
}

func checkUnitCollisions(player *Player, players []*Player, units []*Unit) {
	for _, otherPlayer := range players {
		// Skip self or players marked for removal
		if otherPlayer.ID == player.ID || otherPlayer.IsMarkedForRemoval() {
			continue
		}
		// Lock the player to access units
		otherPlayer.RLock()
		otherUnits := make([]*Unit, 0, len(otherPlayer.Units))
		for _, otherPlayerUnit := range otherPlayer.Units {
			otherUnits = append(otherUnits, otherPlayerUnit)
		}
		otherPlayer.RUnlock()

		for _, unit := range units {
			if unit.IsMarkedForRemoval() {
				continue
			}
			for _, otherUnit := range otherUnits {
				if otherUnit.IsMarkedForRemoval() {
					continue
				}

				if isUnitCollidingWithUnit(unit, otherUnit) {
					unit1IsAlive, unit2IsAlive := handleUnitCollision(unit, otherUnit)
					if !unit2IsAlive {
						player.IncrementScore(uint32(otherUnit.Health.Max) / 10)
						otherUnit.MarkForRemoval()
						handleUnitDestroyed(otherUnit)
					}
					if !unit1IsAlive {
						otherPlayer.IncrementScore(uint32(unit.Health.Max) / 10)
						unit.MarkForRemoval()
						handleUnitDestroyed(unit)
						break // If own unit is destroyed break out
					}
				}
			}
		}
	}
}

func isBulletCollidingWithUnit(bullet *Bullet, unit *Unit) bool {

	bulletPos := bullet.Position
	unitPos := unit.Position

	if !bullet.IsWithinRadius(unitPos, float32(unit.Size+bullet.Size)) {
		return false
	}

	// Lock the bullet and unit to update polygons
	bullet.Polygon.SetCenter(bulletPos)
	bulletPolygon := bullet.Polygon

	unit.Polygon.SetCenter(unitPos)
	//! Rotation is already set on targetPosition update
	unitPolygon := unit.Polygon

	// Check if the bullet's polygon intersects with the unit's polygon
	return DoPolygonsIntersect(bulletPolygon, unitPolygon)
}

func isBulletCollidingWithRock(bullet *Bullet, rock *Rock) bool {
	if !bullet.IsWithinRadius(rock.Polygon.Center, float32(rock.Size)) {
		return false
	}

	bullet.Polygon.SetCenter(bullet.Position)
	bulletPolygon := bullet.Polygon

	// Check if the bullet's polygon intersects with the rock's polygon
	return DoPolygonsIntersect(bulletPolygon, rock.Polygon)
}

func isUnitCollidingWithRock(unit *Unit, rock *Rock) bool {
	if !unit.IsWithinRadius(rock.Polygon.Center, float32(rock.Size+unit.Size)) {
		return false
	}

	unit.Polygon.SetCenter(unit.Position)
	unitPolygon := unit.Polygon

	// Check if the rock's polygon intersects with the unit's polygon
	return DoPolygonsIntersect(unitPolygon, rock.Polygon)
}

func isBulletCollidingWithBuilding(bullet *Bullet, building *Building) bool {

	if !bullet.IsWithinRadius(building.Position, float32(GetBuildingSize(building.Type)+bullet.Size)) {
		return false
	}

	bullet.Polygon.SetCenter(bullet.Position)
	bulletPolygon := bullet.Polygon

	buildingPolygon := building.Polygon

	// Check if the bullet's polygon intersects with the unit's polygon
	return DoPolygonsIntersect(bulletPolygon, buildingPolygon)
}

func isUnitCollidingWithBuilding(unit *Unit, building *Building) bool {
	if !unit.IsWithinRadius(building.Position, float32(GetBuildingSize(building.Type)+unit.Size)) {
		return false
	}

	unit.Polygon.SetCenter(unit.Position)
	//! Rotation is already set on targetPosition update
	unitPolygon := unit.Polygon

	buildingPolygon := building.Polygon

	return DoPolygonsIntersect(unitPolygon, buildingPolygon)
}

func isUnitCollidingWithUnit(unit1, unit2 *Unit) bool {

	if !unit1.IsWithinRadius(unit2.Position, float32(unit1.Size+unit2.Size)) {
		return false
	}

	unit1.Polygon.SetCenter(unit1.Position)
	//! Rotation is already set on targetPosition update
	unit1Polygon := unit1.Polygon

	unit2.Polygon.SetCenter(unit2.Position)
	//! Rotation is already set on targetPosition update
	unit2Polygon := unit2.Polygon

	// Check if the polygons intersect
	return DoPolygonsIntersect(unit1Polygon, unit2Polygon)
}

func handleNeutralBaseCaptured(player *Player, neutral *NeutralBase) {
	if neutral.CapturedBy != nil {
		neutral.CapturedBy.RemoveCapturedNeutralBase(neutral)
	}
	neutral.Captured(player)
	player.AddCapturedNeutralBase(neutral)
	TriggerNeutralBaseCaptured(neutral)
}

func handleUnitBuildingCollision(unit *Unit, building *Building) (bool, bool) {
	unitHealth := unit.Health.Current
	buildingHealth := building.Health.Current

	isUnitAlive := unit.TakeDamage(buildingHealth)
	isBuildingAlive := building.TakeDamage(unitHealth)

	return isUnitAlive, isBuildingAlive
}

func handleUnitCollision(unit1, unit2 *Unit) (bool, bool) {
	// Capture the IDs before potential swapping
	originalUnit1 := unit1.ID
	originalUnit2 := unit2.ID

	// Ensure consistent locking order
	if unit1.ID > unit2.ID {
		unit1, unit2 = unit2, unit1
	}

	unit1Health := unit1.Health.Current
	unit2Health := unit2.Health.Current

	// Apply damage
	isAliveUnit1 := unit1.TakeDamage(unit2Health)
	isAliveUnit2 := unit2.TakeDamage(unit1Health)

	// Return the alive status in the original order
	if originalUnit1 > originalUnit2 {
		// If the original unit1 was swapped with unit2, return the result for the swapped unit1
		return isAliveUnit2, isAliveUnit1
	}
	return isAliveUnit1, isAliveUnit2
}

func handleUnitDestroyed(unit *Unit) {
	// ! Quick dirty implementation
	if unit.Type == TANK && unit.Variant == CANNON_TANK || unit.Type == SIEGE_TANK && unit.Variant == CANNON_SIEGE_TANK {
		unit.Player.RemoveUnitBulletSpawning(unit)
	}

	unitID := unit.ID
	ok := unit.Player.RemoveUnit(unit.ID)
	if ok {
		requiredPopulation, ok := GetUnitRequiredPopulation(unit.Type)
		if !ok {
			log.Println("Could not find the required population for unit (handleUnitDestroyed)")
			return
		}
		unit.Player.Population.DecrementUsed(requiredPopulation)
		TriggerUnitRemoveEvent(unit.Player, unitID)
	} else {
		//! Is already removed
	}
}

func handleBuildingDestroyed(building *Building, base *Base) {
	ok := base.RemoveBuilding(building.ID)
	if ok {
		TriggerBuildingRemovedEvent(base, building)
	}
}

func AddPlayer(conn *websocket.Conn, permission Permission, name []byte, color []byte, skinID ID, fingerprint uint32) (*Player, bool) {
	State.Lock()
	defer State.Unlock()

	for _, player := range State.Players {
		if player.Conn == conn {
			log.Println("Connection has already added a player")
			return nil, false
		}
	}

	initialPower := uint16(PLAYER_INITIAL_POWER)
	maxPower := uint16(PLAYER_MAX_POWER)
	if permission == PERMISSION_ADMIN {
		// ! OP power for me :)
		initialPower = uint16(60000)
		maxPower = uint16(60000)
	}

	player := &Player{
		Conn:              conn,
		Permission:        permission,
		Name:              [12]byte{},
		Fingerprint:       fingerprint,
		SkinID:            skinID,
		StartTime:         time.Now(),
		Kills:             0,
		Camera:            NewCamera(),
		Units:             make(map[ID]*Unit),
		AvailableUnitIDs:  InitAvailableIDs(128),
		Population:        Population{Capacity: PLAYER_INITIAL_POPULATION, Used: 0},
		UnitSpawningLimit: Capacity{Current: 0, Max: 5},
		Resources: Resources{
			Power: Resource{
				Current:  initialPower,
				Capacity: maxPower,
			},
		},
		Generating: Generating{
			Power: 1, // 1 per sec
		},
		HasSpawnProtection:     true,
		HasCommander:           false,
		SpawnProtectionEndTime: time.Now().Add(PLAYER_SPAWN_PROTECTION_TIME * time.Minute),
		LastActivity:           time.Now(),
		RemoveFlag:             false,
		SuspiciousCounter:      0.0, // Initial suspicious counter is 0
		SuspicionDecayRate:     1.0, // Decay rate per update, adjust as needed
		SuspicionThreshold:     5.0, // Threshold where suspicion triggers action
	}

	player.Base = &Base{
		Owner:     player, // Reference back to the player
		Color:     color,
		Health:    Health{Current: PLAYER_INITIAL_HEALTH, Max: PLAYER_INITIAL_HEALTH},
		Buildings: make(map[ID]*Building),
		Bullets:   make(map[ID]*Bullet),
		BuildingLimits: map[BuildingType]BuildingLimit{
			WALL:          {0, 9999},
			SIMPLE_TURRET: {0, 9999},
			SNIPER_TURRET: {0, 9999},
			BARRACKS:      {0, 9999},
			GENERATOR:     {0, 9999},
			HOUSE:         {0, 64}},
		AvailableBuildingIDs: InitAvailableIDs(256),
		AvailableBulletIDs:   InitAvailableIDs(256),
	}

	// Truncate the player name if it's longer than 12 bytes
	if len(name) > 12 {
		log.Println("Player name exceeds maximum length and will be truncated")
		name = name[:12] // Truncate name to 12 bytes
	}

	copy(player.Name[:], name)

	player.Base.Position = FindFreePosition()
	player.Camera.Position = player.Base.Position
	player.Camera.UpdateBounds()

	if player.Base.GetPosition() == (PositionInt{}) {
		log.Println("No available positions for player")
		return nil, false
	}

	playerID, ok := availablePlayerIDs.getNextAvailableID()
	if !ok {
		log.Println("No available player IDs")
		return nil, false
	}

	player.ID = playerID
	State.Players[player.ID] = player

	return player, true
}

func RemovePlayer(conn *websocket.Conn) (ID, uint32, uint32, time.Duration, bool) {
	State.Lock()
	defer State.Unlock()

	var playerID ID
	var player *Player

	if conn == nil {
		return 0, 0, 0, 0, false // Player not found
	}

	// Find the player associated with the connection
	for id, p := range State.Players {
		if p.Conn == conn {
			playerID = id
			player = p
			break
		}
	}

	if player == nil {
		return 0, 0, 0, 0, false // Player not found
	}

	playerName := string(player.Name[:])
	// Trim trailing null bytes
	for i := len(playerName) - 1; i >= 0 && playerName[i] == 0; i-- {
		playerName = playerName[:i]
	}

	// Check if this is a kick (marked for removal) or a normal disconnect
	if player.IsMarkedForRemoval() {
		// This is a kick or game over - remove immediately
		playerBasePosition := player.Base.Position
		MarkPositionAvailable(playerBasePosition)

		// Lock the player and player base
		player.Lock()
		playerScore := player.Score
		playtime := player.GetPlayDuration()
		kills := player.GetKills()

		// Clean up player resources
		// Remove units
		for unitID := range player.Units {
			delete(player.Units, unitID) // Remove unit from map
		}
		player.Unlock()

		player.Base.Lock()
		// Remove buildings
		for buildingID := range player.Base.Buildings {
			delete(player.Base.Buildings, buildingID) // Remove building from map
		}
		// Remove bullets
		for bulletID := range player.Base.Bullets {
			delete(player.Base.Bullets, bulletID) // Remove bullet from map
		}
		player.Base.Unlock()

		for _, base := range player.CapturedNeutralBases {
			base.Captured(nil)
		}

		// Return player ID to available pool
		availablePlayerIDs.returnID(playerID)

		// Remove player from the State.Players map
		delete(State.Players, playerID)
		log.Printf("Player kicked/left permanently: %s (ID: %d)", playerName, playerID)

		return playerID, playerScore, kills, playtime, true // Player successfully removed
	} else {
		// This is a disconnect - preserve player state for reconnection
		DisconnectedPlayersMu.Lock()
		DisconnectedPlayers[player.Fingerprint] = &DisconnectedPlayer{
			Player:      player,
			ExpiresAt:   time.Now().Add(PLAYER_RECONNECTION_WINDOW * time.Second),
			Fingerprint: player.Fingerprint,
		}
		DisconnectedPlayersMu.Unlock()

		// Remove from active players but keep the data
		delete(State.Players, playerID)
		log.Printf("Player disconnected (reconnection available): %s (ID: %d)", playerName, playerID)

		return playerID, 0, 0, 0, true // Player disconnected, not permanently removed
	}
}

func GetPlayerByConn(conn *websocket.Conn) (*Player, bool) {
	State.RLock()
	defer State.RUnlock()
	for _, player := range State.Players {
		if player.Conn == conn {
			return player, true
		}
	}

	return nil, false
}

func startDisconnectedPlayerCleanupLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		DisconnectedPlayersMu.Lock()
		now := time.Now()
		for fingerprint, disconnectedPlayer := range DisconnectedPlayers {
			if now.After(disconnectedPlayer.ExpiresAt) {
				// Remove expired disconnected player
				playerName := string(disconnectedPlayer.Player.Name[:])
				// Trim trailing null bytes
				for i := len(playerName) - 1; i >= 0 && playerName[i] == 0; i-- {
					playerName = playerName[:i]
				}
				log.Printf("Reconnection window expired for player: %s", playerName)

				// Clean up the player's resources
				MarkPositionAvailable(disconnectedPlayer.Player.Base.Position)
				delete(DisconnectedPlayers, fingerprint)
			}
		}
		DisconnectedPlayersMu.Unlock()
	}
}

func GetPlayerMaxBuildingRadius() int16 {
	if CurrentGameMode == MODE_SMALL_BASES {
		return 250
	}
	return PLAYER_MAX_BUILDING_RADIUS
}
