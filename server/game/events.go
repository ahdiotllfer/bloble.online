package game

import (
	"log"
)

// EventType defines the type of event
type EventType int

// Possible event types
const (
	ResourceUpdate EventType = iota
	UnitSpawn
	UnitPositionUpdates
	UnitsRotationUpdate
	TurretRotationUpdate
	BaseHealthUpdate
	NeutralBaseCaptured
	PlayerKilled
	UnitRemove
	BuildingRemoved
	BuildingPlaced
	BulletSpawn
	UnitBulletSpawn
	BulletRemove
	BulletPositionUpdate
	LeaderboardUpdate
	RemoveSpawnProtection
	Kick
	// Add more event types as needed
)

type LeaderboardUpdateEvent struct {
	Changes *[]LeaderboardEntry
}

type UnitBulletSpawnEvent struct {
	Player *Player
	Bullet *Bullet
	Unit   *Unit
}

type BulletSpawnEvent struct {
	Owner  Owner
	Bullet *Bullet
	Turret *Building
}

type BulletRemoveEvent struct {
	Owner    Owner
	BulletID ID
}

type BulletPositionUpdateEvent struct {
	Owner  Owner
	Bullet *Bullet
}

type UnitSpawnEvent struct {
	Player   *Player
	Unit     *Unit
	Barracks *Building
}

type UnitPositionUpdatesEvent struct {
	Player *Player
	Units  []*Unit
}

type UnitsTargetPointUpdateEvent struct {
	Player      *Player
	Units       []*Unit
	TargetPoint PositionInt
}

type UnitRemoveEvent struct {
	Player *Player
	UnitID ID
}

type BuildingRemovedEvent struct {
	Base     *Base
	Building *Building
}

type BuildingPlacedEvent struct {
	Base     *Base
	Building *Building
}

type PlayerKilledEvent struct {
	Player *Player
	Killer *Player
}

type RemoveSpawnProtectionEvent struct {
	Player *Player
}

type NeutralBaseCapturedEvent struct {
	NeutralBase *NeutralBase
}

type KickEvent struct {
	Player *Player
	Reason byte
}

type TurretRotationUpdateEvent struct {
	Owner          Owner
	Turret         *Building
	TargetPosition PositionFloat
}

// Event represents an event
type Event struct {
	Type    EventType
	Payload interface{}
}

var (
	eventListeners []chan Event
	eventChan      = make(chan Event)
)

// StartEventDispatcher starts the event dispatcher
func StartEventDispatcher() {
	for event := range eventChan {
		dispatchEvent(event)
	}
}

// AddListener adds a listener for events
func AddListener(listener chan Event) {
	eventListeners = append(eventListeners, listener)
}

// dispatchEvent dispatches an event to all listeners
func dispatchEvent(event Event) {
	for _, listener := range eventListeners {
		listener <- event
	}
}

func TriggerResourceUpdateEvent(player *Player) {
	eventChan <- Event{Type: ResourceUpdate, Payload: player}
}

func TriggerUnitSpawnEvent(unit *Unit, barracks *Building) {
	event := &UnitSpawnEvent{
		Unit:     unit,
		Barracks: barracks,
	}
	eventChan <- Event{Type: UnitSpawn, Payload: event}
}

func TriggerUnitPositionUpdatesEvent(player *Player, units []*Unit) {
	// Create a batch event with all updated units
	event := &UnitPositionUpdatesEvent{
		Player: player,
		Units:  units,
	}
	// Send the batch event
	eventChan <- Event{Type: UnitPositionUpdates, Payload: event}
}
func TriggerUnitsRotationUpdateEvent(player *Player, units []*Unit) {
	event := &UnitsTargetPointUpdateEvent{
		Player: player,
		Units:  units,
	}
	eventChan <- Event{Type: UnitsRotationUpdate, Payload: event}
}

func TriggerUnitRemoveEvent(player *Player, unitID ID) {
	event := &UnitRemoveEvent{
		Player: player,
		UnitID: unitID,
	}
	eventChan <- Event{Type: UnitRemove, Payload: event}
}

func TriggerBuildingRemovedEvent(base *Base, building *Building) {
	event := &BuildingRemovedEvent{
		Base:     base,
		Building: building,
	}
	eventChan <- Event{Type: BuildingRemoved, Payload: event}
}

func TriggerBuildingPlacedEvent(base *Base, building *Building) {
	event := &BuildingPlacedEvent{
		Base:     base,
		Building: building,
	}
	eventChan <- Event{Type: BuildingPlaced, Payload: event}
}

func TriggerBaseHealthUpdateEvent(base *Base) {
	eventChan <- Event{Type: BaseHealthUpdate, Payload: base}
}

func TriggerPlayerKilledEvent(player *Player, killer *Player) {

	event := &PlayerKilledEvent{
		Player: player,
		Killer: killer,
	}
	eventChan <- Event{Type: PlayerKilled, Payload: event}
}

func TriggerUnitBulletSpawnEvent(player *Player, bullet *Bullet, unit *Unit) {
	event := &UnitBulletSpawnEvent{
		Player: player,
		Bullet: bullet,
		Unit:   unit,
	}
	eventChan <- Event{Type: UnitBulletSpawn, Payload: event}
}

func TriggerBulletSpawnEvent(owner Owner, bullet *Bullet, turret *Building) {
	event := &BulletSpawnEvent{
		Owner:  owner,
		Bullet: bullet,
		Turret: turret,
	}
	eventChan <- Event{Type: BulletSpawn, Payload: event}
}

func TriggerBulletRemoveEvent(owner Owner, bulletID ID) {
	event := &BulletRemoveEvent{
		Owner:    owner,
		BulletID: bulletID,
	}
	eventChan <- Event{Type: BulletRemove, Payload: event}
}

func TriggerBulletPositionUpdateEvent(owner Owner, bullet *Bullet) {
	event := &BulletPositionUpdateEvent{
		Owner:  owner,
		Bullet: bullet,
	}
	eventChan <- Event{Type: BulletPositionUpdate, Payload: event}
}

func TriggerTurretRotationUpdateEvent(owner Owner, turret *Building, targetPosition PositionFloat) {
	event := &TurretRotationUpdateEvent{
		Owner:          owner,
		Turret:         turret,
		TargetPosition: targetPosition,
	}
	eventChan <- Event{Type: TurretRotationUpdate, Payload: event}
}

func TriggerLeaderboardUpdateEvent(changes *[]LeaderboardEntry) {
	event := &LeaderboardUpdateEvent{
		Changes: changes,
	}
	eventChan <- Event{Type: LeaderboardUpdate, Payload: event}
}

func TriggerRemoveSpawnProtectionEvent(player *Player) {
	event := &RemoveSpawnProtectionEvent{
		Player: player,
	}
	eventChan <- Event{Type: RemoveSpawnProtection, Payload: event}
}

func TriggerNeutralBaseCaptured(neutral *NeutralBase) {
	event := &NeutralBaseCapturedEvent{
		NeutralBase: neutral,
	}
	eventChan <- Event{Type: NeutralBaseCaptured, Payload: event}
}

func TriggerKickEvent(player *Player, reason byte) {
	playerName := string(player.Name[:])
	// Trim trailing null bytes
	for i := len(playerName) - 1; i >= 0 && playerName[i] == 0; i-- {
		playerName = playerName[:i]
	}

	var reasonStr string
	switch reason {
	case KICK_REASON_TIMEOUT:
		reasonStr = "timeout"
	case KICK_REASON_SCRIPTING:
		reasonStr = "scripting"
	default:
		reasonStr = "unknown"
	}

	log.Printf("Illegal event: Player %s kicked for %s", playerName, reasonStr)

	event := &KickEvent{
		Player: player,
		Reason: reason,
	}
	eventChan <- Event{Type: Kick, Payload: event}
}
