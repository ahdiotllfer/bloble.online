package game

import (
	"log"
	"math"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type MovementPackage struct {
	Timestamp      time.Time     // Timestamp of the movement
	TargetPosition PositionInt   // The target position for the movement
	UnitPositions  []PositionInt // The positions of the units being moved
	UnitIds        []byte
}

type Player struct {
	// Identification & Connection
	ID           ID
	Conn         *websocket.Conn
	Permission   Permission
	Name         [12]byte
	Fingerprint  uint32       // Used for reconnection
	LastActivity time.Time    // Used for timeout
	LastResync   time.Time
	SkinID       ID

	// Statistics
	StartTime time.Time // For playtime
	Kills     uint32
	/* XP is calculated based on the score at the end of the run */

	// Game State
	Score                  uint32
	Population             Population
	Resources              Resources
	Generating             Generating
	CapturedNeutralBases   []*NeutralBase
	Base                   *Base
	SpawnProtectionEndTime time.Time
	HasSpawnProtection     bool

	// Unit
	AvailableUnitIDs   *AvailableIDs
	Units              map[ID]*Unit
	UnitSpawning       []*UnitSpawning
	UnitBulletSpawning []*BulletSpawning
	UnitSpawningLimit  Capacity
	HasCommander       bool

	// Script prevention
	LastBuildingAction  time.Time // Timestamp of the last building upgraded/placed
	BuildingActionCount uint32    // Counter to track the number of building actions
	LastMovementPackage MovementPackage

	//! Currently only for unit movement
	// Suspicion Handling
	SuspiciousCounter  float32 // Counter to track suspicious activity
	SuspicionDecayRate float32 // Rate at which the suspicion counter decreases over time
	SuspicionThreshold float32 // Threshold at which suspicious action is triggered

	// Camera
	Camera Camera

	// Flags & Conditions
	RemoveFlag bool // Flag to mark unit for removal

	// Synchronization
	sync.RWMutex
}

func (p *Player) UpdateSuspicion() bool {

	// Check if the suspicion threshold is exceeded
	if p.SuspiciousCounter >= p.SuspicionThreshold {
		return true
	}

	// Decay the suspicion counter over time
	p.SuspiciousCounter -= p.SuspicionDecayRate
	if p.SuspiciousCounter < 0 {
		p.SuspiciousCounter = 0
	}

	return false
}

func (p *Player) HandleSuspiciousBehavior() {
	// Increase the suspicion counter based on detected suspicious behavior
	p.SuspiciousCounter++
}

// Building Script prevention
func (p *Player) CanPerformBuildingAction() bool {
	now := time.Now()

	// Define thresholds for the prevention system
	const maxActionsPerSecond = 10    // Max building actions allowed per second
	const timeThreshold = time.Second // Time window for building action spamming

	// Check if the last action timestamp has fallen outside the time window
	if now.Sub(p.LastBuildingAction) >= timeThreshold {
		// Reset the counter and timestamp to start a new window
		p.BuildingActionCount = 0
		p.LastBuildingAction = now
	}

	// Check if the player has exceeded the action limit within the window
	if p.BuildingActionCount >= maxActionsPerSecond {
		return false // Deny action due to spamming
	}

	// Increment the action counter (and allow the action)
	p.BuildingActionCount++
	return true
}

func (p *Player) GetBase() *Base {
	return p.Base
}

func (p *Player) IsMarkedForRemoval() bool {
	return p.RemoveFlag
}

func (p *Player) MarkForRemoval() {
	p.RemoveFlag = true
}

// GetUnitSpawningForBarrack returns the active UnitSpawning for a specific barrack if it's activated.
func (p *Player) GetUnitSpawningForBarrack(barrack *Building) *UnitSpawning {
	p.RLock() // Lock for thread safety during read operation
	defer p.RUnlock()

	for _, unitSpawn := range p.UnitSpawning {
		if unitSpawn.Barracks == barrack {
			return unitSpawn
		}
	}
	return nil // Return nil if no active spawning is found for the barrack
}

func (p *Player) GetGenerating() Generating {
	p.RLock()
	defer p.RUnlock()
	return p.Generating
}

func (p *Player) SetLastActivity() {
	p.Lock()
	defer p.Unlock()
	p.LastActivity = time.Now()
}

func (p *Player) GetLastActivity() time.Time {
	p.RLock()
	defer p.RUnlock()
	return p.LastActivity
}

func (p *Player) HasProtection() bool {
	return p.HasSpawnProtection
}

func (p *Player) GetProtectionEndTime() time.Time {
	p.RLock()
	defer p.RUnlock()
	return p.SpawnProtectionEndTime
}

func (p *Player) AddCapturedNeutralBase(neutralBase *NeutralBase) {
	p.Population.IncrementCapacity(NEUTRAL_BASE_POPULATION)
	p.Lock()
	defer p.Unlock()
	p.CapturedNeutralBases = append(p.CapturedNeutralBases, neutralBase)
}

func (p *Player) RemoveCapturedNeutralBase(neutralBase *NeutralBase) {
	p.Population.DecrementCapacity(NEUTRAL_BASE_POPULATION)

	p.Lock()
	defer p.Unlock()

	for i, base := range p.CapturedNeutralBases {
		if base == neutralBase {

			for _, building := range neutralBase.Base.Buildings {
				p.Base.decrementBuildingLimit(building.Type)
			}

			// Remove the base by slicing the array
			p.CapturedNeutralBases = append(p.CapturedNeutralBases[:i], p.CapturedNeutralBases[i+1:]...)
			break // Exit after removing the base
		}
	}
}

func (p *Player) GetCapturedNeutralBase(id ID) (*NeutralBase, bool) {
	p.RLock()
	defer p.RUnlock()
	for _, base := range p.CapturedNeutralBases {
		if base.ID == id {
			return base, true
		}
	}
	return nil, false
}

func (p *Player) RemoveProtection() {
	p.Lock()
	defer p.Unlock()
	if p.HasSpawnProtection {
		p.HasSpawnProtection = false
		p.SpawnProtectionEndTime = time.Time{}
		TriggerRemoveSpawnProtectionEvent(p)
	}
}

func (p *Player) IncrementScore(value uint32) {
	p.Lock()
	p.Score += uint32(value)
	p.Unlock()
	changes, changed := State.Leaderboard.Update(State.Players)
	if changed {
		TriggerLeaderboardUpdateEvent(&changes)
	}
}

func (p *Player) IncrementKills(value uint32) {
	p.Lock()
	defer p.Unlock()
	p.Kills += value
}

func (p *Player) AddCommander() (*Unit, bool) {
	unitID, ok := p.AvailableUnitIDs.getNextAvailableID()
	if !ok {
		//log.Println("No available unit IDs")
		return nil, false
	}

	unitStats, ok := GetUnitStats(COMMANDER, 0)
	if !ok {
		log.Println("Unit stats not found for unit:", COMMANDER)
		return nil, false
	}

	polygon, ok := GetUnitPolygon(COMMANDER, 0)
	if !ok {
		log.Println("Unit polygon not found for unit:", COMMANDER)
		return nil, false
	}
	// Create the unit
	unit := &Unit{
		Player:         p,
		ID:             unitID,
		Type:           COMMANDER,
		Variant:        0,
		Position:       IntToFloat(p.Base.Position),
		Polygon:        polygon,
		TargetPosition: IntToFloat(p.Base.Position),
		TargetRotation: UnitTargetRotation{float32(0), false},
		Health:         unitStats.Health,
		Size:           unitStats.Size,
		Speed:          unitStats.Speed,

		ExplosionRadius: int(unitStats.ExplosionRadius),
	}
	p.Lock()
	// Add the unit to the player's list of units
	p.Units[unitID] = unit

	p.HasCommander = true
	p.Unlock()

	p.AddUnitBulletSpawning(unit)

	return unit, true
}

func (p *Player) AddUnit(unitType UnitType, unitVariant UnitVariant, barracks *Building) (*Unit, bool) {
	unitID, ok := p.AvailableUnitIDs.getNextAvailableID()
	if !ok {
		//log.Println("No available unit IDs")
		return nil, false
	}

	unitStats, ok := GetUnitStats(unitType, unitVariant)
	if !ok {
		log.Println("Unit stats not found for unit:", unitType)
		return nil, false
	}

	unitTargetPosition := CalculateUnitSpawnPosition(barracks)

	polygon, ok := GetUnitPolygon(unitType, unitVariant)
	if !ok {
		log.Println("Unit polygon not found for unit:", unitType)
		return nil, false
	}

	// Calculate the direction vector and rotation angle
	dx := unitTargetPosition.X - barracks.Position.X
	dy := unitTargetPosition.Y - barracks.Position.Y
	targetRotation := math.Atan2(float64(dy), float64(dx)) // Angle in radians

	// Create the unit
	unit := &Unit{
		Player:          p,
		ID:              unitID,
		Type:            unitType,
		Variant:         unitVariant,
		Position:        barracks.Position,
		Polygon:         polygon,
		TargetPosition:  unitTargetPosition,
		TargetRotation:  UnitTargetRotation{float32(targetRotation), false},
		Health:          unitStats.Health,
		Size:            unitStats.Size,
		Speed:           unitStats.Speed,
		ExplosionRadius: int(unitStats.ExplosionRadius),
	}

	p.Lock()
	// Add the unit to the player's list of units
	p.Units[unitID] = unit
	p.Unlock()

	return unit, true
}

func (p *Player) RemoveUnit(unitID ID) bool {
	p.RLock()
	// Retrieve the unit
	unit, ok := p.Units[unitID]
	p.RUnlock()
	if !ok {
		return false // Unit not found
	}

	// Remove the unit from the player's list of units
	p.Lock()
	if unit.Type == COMMANDER {
		p.HasCommander = false
	}
	delete(p.Units, unitID)
	p.Unlock()

	p.AvailableUnitIDs.returnID(unitID)

	return true // Unit was successfully removed
}

func (p *Player) AddUnitSpawning(barracks *Building, setActive bool) bool {
	// Get unit spawning data based on barracks variant
	unitSpawning, ok := GetUnitSpawning(barracks.Variant)
	if !ok {
		log.Println("Could not add UnitSpawning to player")
		return false
	}

	// Check if unit spawning can be activated
	if p.UnitSpawningLimit.HasMaxCapacity() {
		// If the limit is reached, force the unit spawning to be inactive
		setActive = false
	}

	spawning := &UnitSpawning{
		Barracks:    barracks,
		UnitType:    unitSpawning.UnitType,
		UnitVariant: unitSpawning.UnitVariant,
		Frequency:   unitSpawning.Frequency,
		Activated:   setActive,
	}

	// If the spawning is activated, increment the limit
	if setActive {
		p.UnitSpawningLimit.Increment(1)
	}

	// Add the UnitSpawning instance to the player's list
	p.Lock()
	p.UnitSpawning = append(p.UnitSpawning, spawning)
	p.Unlock()
	return true
}

func (p *Player) RemoveUnitSpawning(barracks *Building) {
	var wasActive bool

	// Create a new slice to store updated UnitSpawning entries
	var updatedUnitSpawning []*UnitSpawning

	p.Lock()
	// Iterate through player's UnitSpawning list
	for _, s := range p.UnitSpawning {
		// Check if Barracks pointer matches
		if s.Barracks == barracks {
			wasActive = s.Activated
			// Skip this UnitSpawning entry (effectively removing it)
			continue
		}

		// Add UnitSpawning entry to updated slice
		updatedUnitSpawning = append(updatedUnitSpawning, s)
	}

	// Update player's UnitSpawning list with the filtered slice
	p.UnitSpawning = updatedUnitSpawning
	p.Unlock()

	if wasActive {
		p.UnitSpawningLimit.Decrement(1)
	}
}

func (p *Player) ToggleUnitSpawning(building *Building) bool {
	unitSpawning := p.GetUnitSpawningForBarrack(building)
	if unitSpawning == nil {
		return false
	}
	if unitSpawning.Activated {
		if p.UnitSpawningLimit.Get() == 0 {
			return false
		}
		p.UnitSpawningLimit.Decrement(1)
	} else {
		if p.UnitSpawningLimit.HasMaxCapacity() {
			return false
		}
		p.UnitSpawningLimit.Increment(1)
	}

	unitSpawning.Activated = !unitSpawning.Activated
	return true
}

func (p *Player) AddUnitBulletSpawning(unit *Unit) bool {
	bulletSpawning, ok := GetBulletSpawning(unit.Type, unit.Variant)
	if !ok {
		return false
	}

	// Create a new BulletSpawning instance
	spawning := &BulletSpawning{
		Shooter: unit,
		Frequency: SpawnFrequency{
			Current:  bulletSpawning.Frequency.Current,
			Original: bulletSpawning.Frequency.Original,
		},
		Range: bulletSpawning.Range,
	}

	// Add the BulletSpawning instance to the base's list
	p.Lock()
	p.UnitBulletSpawning = append(p.UnitBulletSpawning, spawning)
	p.Unlock()

	return true
}

func (p *Player) RemoveUnitBulletSpawning(unit *Unit) {
	p.Lock()
	defer p.Unlock()
	// Create a new slice to store updated UnitBulletSpawning entries
	var updatedBulletSpawning []*BulletSpawning

	// Iterate through base's UnitSpawning list
	for _, s := range p.UnitBulletSpawning {
		// Check if Unit pointer matches
		if shooterUnit, ok := s.Shooter.GetObjectPointer().(*Unit); ok {
			// If the Turret matches, skip this BulletSpawning entry (effectively removing it)
			if shooterUnit == unit {
				continue
			}
		}
		// Add BulletSpawning entry to updated slice
		updatedBulletSpawning = append(updatedBulletSpawning, s)
	}

	// Update player's UnitBulletSpawning list with the filtered slice
	p.UnitBulletSpawning = updatedBulletSpawning
}

func (p *Player) GetScore() uint32 {
	return p.Score
}

func (p *Player) GetKills() uint32 {
	return p.Kills
}

func (p *Player) GetPlayDuration() time.Duration {
	return time.Since(p.StartTime)
}

func (p *Player) GetObjectPointer() interface{} {
	return p // or return the relevant pointer
}

func (p *Player) GetID() ID {
	return p.ID
}
