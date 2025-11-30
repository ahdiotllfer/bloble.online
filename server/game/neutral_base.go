package game

import (
	"log"
	"math"
	"sync"
)

type NeutralBase struct {
	CapturedBy *Player
	ID         ID
	Base       *Base
	sync.RWMutex
}

func (n *NeutralBase) GetBase() *Base {
	return n.Base
}

func (n *NeutralBase) Captured(player *Player) {
	n.Base.Health.Reset()
	if player != nil {
		n.Clear()
		PopulateNeutralBase(n)
	}

	n.Lock()
	n.CapturedBy = player
	n.Unlock()
}

func (n *NeutralBase) Clear() {
	// Clear the Buildings map and return used IDs to available pool
	for id := range n.Base.Buildings {
		n.Base.RemoveBuilding(id)
	}
	n.Base.Buildings = make(map[ID]*Building)

	// Clear the Bullets map and return used IDs to available pool
	for id := range n.Base.Bullets {
		n.Base.RemoveBullet(id)
	}
}

func (n *NeutralBase) GetObjectPointer() interface{} {
	return n // or return the relevant pointer
}

func (n *NeutralBase) GetID() ID {
	return n.ID
}

func PopulateNeutralBase(neutral *NeutralBase) {
	spikeWallRadius := NEUTRAL_BASE_MAX_BUILDING_RADIUS
	numWalls := 22
	if CurrentGameMode == MODE_SMALL_BASES && neutral.Base.Position.X == 0 && neutral.Base.Position.Y == 0 {
		spikeWallRadius = 400 // Bigger radius for central base but not too big
		numWalls = 35         // More walls for the bigger central base
	}
	const (
		fullCircleAngle = 2 * math.Pi
	)

	// Place walls
	angleIncrementWalls := fullCircleAngle / float64(numWalls)
	for i := 0; i < numWalls; i++ {
		angle := float64(i) * angleIncrementWalls
		radius := float64(spikeWallRadius)

		buildingX := float32(neutral.Base.Position.X) + float32(math.Round(radius*math.Cos(angle)))
		buildingY := float32(neutral.Base.Position.Y) + float32(math.Round(radius*math.Sin(angle)))
		position := PositionFloat{X: buildingX, Y: buildingY}

		buildingID, ok := neutral.Base.AvailableBuildingIDs.getNextAvailableID()
		if !ok {
			log.Println("No available building IDs for neutral base")
			return
		}
		buildingType := WALL
		buildingVariant := SPIKE
		polygon, ok := GetBuildingPolygon(buildingType)
		if !ok {
			log.Println("Polygon not found! %PopulateNeutralBase")
			return
		}
		polygon.SetCenter(position)

		// Calculate distance between base position and desired building position
		dx := float64(position.X - float32(neutral.Base.Position.X))
		dy := float64(position.Y - float32(neutral.Base.Position.Y))

		rotationAngle := math.Atan2(dy, dx)
		polygon.SetRotation(rotationAngle)

		building := &Building{
			ID:       buildingID,
			Type:     buildingType,
			Variant:  buildingVariant,
			Position: position,
			Polygon:  polygon,
			Health:   GetInitialHealth(buildingType, buildingVariant),
		}
		neutral.Lock()
		neutral.Base.Buildings[buildingID] = building
		neutral.Unlock()
	}
}
