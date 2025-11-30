package game

import (
	"math"
	"math/rand"
)

func generateHexagon(center PositionInt, size float64) []PositionInt {
	vertices := make([]PositionInt, 6)

	for i := 0; i < 6; i++ {
		angle := math.Pi / 3.0 * float64(i)
		x := center.X + int16(math.Round(size*math.Cos(angle)))
		y := center.Y + int16(math.Round(size*math.Sin(angle)))
		vertices[i] = PositionInt{X: x, Y: y}
	}

	return vertices
}

// Function to determine if two positions are within a given range
func isTooClose(p1, p2 PositionInt, rangeX, rangeY int16) bool {
	return abs(p1.X-p2.X) <= rangeX && abs(p1.Y-p2.Y) <= rangeY
}

// Absolute value function for int16
func abs(x int16) int16 {
	if x < 0 {
		return -x
	}
	return x
}

func generateBushes(centers []PositionInt, neutralBases []PositionInt, radius float64, numBushes int, minDistance int16) []PositionInt {
	bushes := make([]PositionInt, 0, numBushes)

	// Function to check if a bush position is too close to any center, neutral base, or other bushes
	isFarEnough := func(bushPos PositionInt) bool {
		for _, center := range centers {
			if isTooClose(bushPos, center, minDistance, minDistance) {
				return false
			}
		}
		for _, base := range neutralBases {
			if isTooClose(bushPos, base, minDistance, minDistance) {
				return false
			}
		}
		for _, bush := range bushes {
			if isTooClose(bushPos, bush, minDistance, minDistance) {
				return false
			}
		}
		return true
	}

	for len(bushes) < numBushes {
		// Generate random angle and radius
		angle := rand.Float64() * 2 * math.Pi // Random angle
		distance := rand.Float64() * radius   // Random distance from the center

		// Calculate bush position based on angle and distance
		bushX := int16(distance * math.Cos(angle))
		bushY := int16(distance * math.Sin(angle))
		bushPos := PositionInt{X: bushX, Y: bushY}

		// Check if the bush position is far enough from all centers, neutral bases, and existing bushes
		if isFarEnough(bushPos) {
			bushes = append(bushes, bushPos)
		}
	}

	return bushes
}

type Rock struct {
	Polygon Polygon
	Size    int
}

func generateRocks(centers []PositionInt, neutralBases []PositionInt, radius float64, numRocks int, minDistance int16, polygonType PolygonType) []Rock {
	rocks := make([]Rock, 0, numRocks) // Store Rock structs

	// Function to check if a rock position is too close to any neutral or player base
	isFarEnough := func(rockPos PositionInt) bool {
		for _, base := range append(neutralBases, centers...) {
			// Check distance between rock position and the base
			if isTooClose(rockPos, base, minDistance, minDistance) {
				return false
			}
		}
		return true
	}

	// Generate large rocks first
	for len(rocks) < numRocks/2 { // Generate half as large rocks
		// Generate random angle and radius for large rocks
		angle := rand.Float64() * 2 * math.Pi
		distance := rand.Float64() * radius

		// Calculate position for the large rock
		rockX := int16(distance * math.Cos(angle))
		rockY := int16(distance * math.Sin(angle))
		rockPos := PositionInt{X: rockX, Y: rockY}

		// Check if the large rock is far enough from neutral/player bases
		if isFarEnough(rockPos) {
			// Generate a large size rock between 60 and 80
			size := rand.Intn(40) + 60 // Generates a number between 60 and 80

			// Generate polygon for large rock
			polygon := GeneratePolygon(polygonType, size, 0)
			polygon.SetRotation(rand.Float64() * 2 * math.Pi)
			polygon.Center = PositionFloat{X: float32(rockX), Y: float32(rockY)}

			// Create large rock
			rock := Rock{
				Polygon: polygon,
				Size:    size,
			}
			rocks = append(rocks, rock)

			// Generate smaller rocks around this large rock
			// Make sure small rocks are randomly scattered close to the large rock
			numSmallRocks := rand.Intn(2) + 2
			for i := 0; i < numSmallRocks; i++ {
				// Randomly generate smaller rocks close to the large rock
				angle := rand.Float64() * 2 * math.Pi
				// Vary distance randomly between 0.5 and 1.5 times the size of the large rock
				distance := rand.Float64()*1.0 + 2 // Random distance factor

				// Calculate the position of the small rock around the large rock with random offset
				smallRockX := int16(float64(rockX) + distance*float64(size)*math.Cos(angle))
				smallRockY := int16(float64(rockY) + distance*float64(size)*math.Sin(angle))

				// Generate a small size rock between 40 and 60
				smallSize := rand.Intn(40) + 20 // Generates a number between 40 and 60

				// Generate polygon for small rock
				smallPolygon := GeneratePolygon(polygonType, smallSize, 0)
				smallPolygon.SetRotation(rand.Float64() * 2 * math.Pi)
				smallPolygon.Center = PositionFloat{X: float32(smallRockX), Y: float32(smallRockY)}

				// Create small rock
				smallRock := Rock{
					Polygon: smallPolygon,
					Size:    smallSize,
				}
				rocks = append(rocks, smallRock)
			}
		}
	}

	// Generate remaining small rocks
	for len(rocks) < numRocks {
		// Generate random angle and radius for smaller rocks
		angle := rand.Float64() * 2 * math.Pi
		distance := rand.Float64() * radius

		// Calculate position for the small rock
		rockX := int16(distance * math.Cos(angle))
		rockY := int16(distance * math.Sin(angle))
		rockPos := PositionInt{X: rockX, Y: rockY}

		// Check if the small rock is far enough from neutral/player bases
		if isFarEnough(rockPos) {
			// Generate a small size rock between 40 and 60
			size := rand.Intn(40) + 60

			// Generate polygon for small rock
			polygon := GeneratePolygon(polygonType, size, 0)
			polygon.SetRotation(rand.Float64() * 2 * math.Pi)
			polygon.Center = PositionFloat{X: float32(rockX), Y: float32(rockY)}

			// Create small rock
			rock := Rock{
				Polygon: polygon,
				Size:    size,
			}
			rocks = append(rocks, rock)
		}
	}

	return rocks
}

func generateHexagonGameMap() (playerPositions, neutralPositions []PositionInt) {
	hexagonSize := 2500.0
	center := PositionInt{X: 0, Y: 0}

	// Generate player positions for the center hexagon
	playerPositions = append(playerPositions, generateHexagon(center, hexagonSize)...)

	// Keep track of generated positions to avoid duplication
	generatedPositions := make(map[PositionInt]bool)
	generatedPositions[center] = true // Mark center as generated

	// Generate positions for the surrounding hexagons
	offsets := []struct{ x, y float64 }{
		{0, hexagonSize * math.Sqrt(3)},
		{hexagonSize * 1.5, hexagonSize * math.Sqrt(3) / 2},
		{-hexagonSize * 1.5, hexagonSize * math.Sqrt(3) / 2},
		{-hexagonSize * 1.5, -hexagonSize * math.Sqrt(3) / 2},
		{hexagonSize * 1.5, -hexagonSize * math.Sqrt(3) / 2},
		{0, -hexagonSize * math.Sqrt(3)},
	}

	for _, offset := range offsets {
		hexagonCenter := PositionInt{X: int16(math.Round(offset.x)), Y: int16(math.Round(offset.y))}
		hexagonPositions := generateHexagon(hexagonCenter, hexagonSize)

		// Add player positions for the surrounded hexagon
		playerPositions = append(playerPositions, hexagonPositions...)

		// Add neutral position (center of hexagon) as neutral base
		neutralPositions = append(neutralPositions, hexagonCenter)

		// Mark the generated positions as used
		for _, pos := range hexagonPositions {
			generatedPositions[pos] = true
		}
	}

	neutralPositions = append(neutralPositions, PositionInt{X: 0, Y: 0})

	// Remove duplicates and positions too close to each other
	uniquePlayerPositions := make([]PositionInt, 0, len(playerPositions))
	seen := make(map[PositionInt]bool)

	for _, pos := range playerPositions {
		if !seen[pos] {
			// Check if the position is too close to any existing position
			isUnique := true
			for _, uniquePos := range uniquePlayerPositions {
				if isTooClose(pos, uniquePos, 1, 1) {
					isUnique = false
					break
				}
			}
			if isUnique {
				seen[pos] = true
				uniquePlayerPositions = append(uniquePlayerPositions, pos)
			}
		}
	}

	return uniquePlayerPositions, neutralPositions
}

// Helper function to initialize the game state with predefined positions
func InitializeGameMap() {

	playerPositions, neutralPositions := generateHexagonGameMap()
	// Initialize the map with all positions as available
	State.AvailablePositions = make(map[PositionInt]bool)
	for _, pos := range playerPositions {
		State.AvailablePositions[pos] = true
	}

	// Populate NeutralBases with NeutralBase instances
	State.NeutralBases = make([]*NeutralBase, len(neutralPositions))
	for i, pos := range neutralPositions {
		// Initialize the neutral base
		neutralBase := &NeutralBase{
			ID: ID(i), // IDs are assigned based on position index
		}

		health := uint16(NEUTRAL_BASE_INITIAL_HEALTH)
		if CurrentGameMode == MODE_SMALL_BASES && pos.X == 0 && pos.Y == 0 {
			health = 1000 // Central base with standard HP
		}

		neutralBase.Base = &Base{
			Owner:                neutralBase,
			Position:             pos,
			Health:               Health{Current: health, Max: health},
			Buildings:            make(map[ID]*Building),
			Bullets:              make(map[ID]*Bullet),
			AvailableBuildingIDs: InitAvailableIDs(256),
			AvailableBulletIDs:   InitAvailableIDs(256),
		}

		// Add the neutral base to the GameState
		State.NeutralBases[i] = neutralBase
	}

	// Populate each neutral base with walls
	for _, base := range State.NeutralBases {
		PopulateNeutralBase(base)
	}

	// Central neutral base health is already set correctly above

	// Generate bushes away from player and neutral base positions
	State.Bushes = generateBushes(playerPositions, neutralPositions, 8000, 30, 800)
	State.Rocks = generateRocks(playerPositions, neutralPositions, 8000, 20, 1000, ShapeHexagon)
}
