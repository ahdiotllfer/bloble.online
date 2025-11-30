package network

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"server/game"
	"sync"
	"time"
	"strings"

	"github.com/gorilla/websocket"
)

// UserData represents the data associated with a user.
type UserData struct {
	ClientIP    string
	Fingerprint *uint32
	Role        string         `json:"role"`
	Discord     DiscordDetails `json:"discord"`
	Skins       SkinDetails    `json:"skins"`
}

type DiscordDetails struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type SkinDetails struct {
	Unlocked []int `json:"unlocked"`
}

// UserConnection holds user data associated with a WebSocket connection.
type UserConnection struct {
	UserData UserData        // The user data
	Conn     *websocket.Conn // WebSocket connection
}

var (
	connectionMutex    sync.Mutex
	activeConnections  = make(map[*websocket.Conn]UserConnection) // Map to hold WebSocket connections
	ipIndex            = make(map[string][]UserConnection)        // Index multiple connections by IP
	ipFingerprintIndex = make(map[string]map[uint32]struct{})     // Map to index fingerprints by IP
	playingDiscordIds  = make(map[string]struct{})                // Map to index fingerprints by IP
)

func isDiscordAccountAlreadyPlaying(discordId string) bool {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	_, exists := playingDiscordIds[discordId]
	return exists
}

func AddPlayingDiscordAccount(discordId string) {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	playingDiscordIds[discordId] = struct{}{}
}

func RemovePlayingDiscordAccount(discordId string) {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()
	delete(playingDiscordIds, discordId)
}

func StoreUserData(conn *websocket.Conn, userData UserData) bool {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()
	ipParts := strings.Split(userData.ClientIP, ".")
	ipPrefix := strings.Join(ipParts[:3], ".")
	
	connectionCount := 0
	for ip, connections := range ipIndex {
		if strings.HasPrefix(ip, ipPrefix) {
			connectionCount += len(connections)
		}
	}
	log.Printf("prefix:%s, connectionCount:%d", ipPrefix, connectionCount)
	// if connections, exists := ipIndex[userData.ClientIP]; exists && len(connections) == 1 {
	// 	log.Printf("Connection rejected: IP %s already has 2 connections", userData.ClientIP)
	// 	return false
	// }
	//if connectionCount >= 1 {
	//	log.Printf("Connection rejected: IP prefix %s.* already has %d connections", ipPrefix, connectionCount)
	//	return false
	//}

	// Store the connection in activeConnections map
	activeConnections[conn] = UserConnection{
		UserData: userData,
		Conn:     conn,
	}

	// Index the connection by IP
	ipIndex[userData.ClientIP] = append(ipIndex[userData.ClientIP], activeConnections[conn])

	return true
}


// GetUserDataByConn retrieves the UserData for a given WebSocket connection.
func GetUserDataByConn(conn *websocket.Conn) (UserData, bool) {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	// Retrieve user data based on the connection
	if userConn, exists := activeConnections[conn]; exists {
		return userConn.UserData, true
	}
	return UserData{}, false
}

// GetUserDataByIP retrieves all UserData for a given IP.
func GetUserDataByIP(ip string) ([]UserData, bool) {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	// Find the UserConnections by IP
	if userConns, exists := ipIndex[ip]; exists {
		// Extract and return all UserData for the given IP
		var userDataList []UserData
		for _, userConn := range userConns {
			userDataList = append(userDataList, userConn.UserData)
		}
		return userDataList, true
	}
	return nil, false
}

// RemoveUserConnection removes the connection and the associated IP index.
func RemoveUserConnection(conn *websocket.Conn) {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	// If the connection exists in activeConnections, remove it
	if userConn, exists := activeConnections[conn]; exists {
		// Remove the connection from the ipIndex map (multiple connections per IP)
		userConns := ipIndex[userConn.UserData.ClientIP]
		for i, uConn := range userConns {
			if uConn.Conn == conn {
				// Remove the connection from the slice
				ipIndex[userConn.UserData.ClientIP] = append(userConns[:i], userConns[i+1:]...)
				break
			}
		}

		// Remove the connection from the activeConnections map
		delete(activeConnections, conn)

		// Remove the fingerprint from the ipFingerprintIndex if needed
		if userConn.UserData.Fingerprint != nil {
			delete(ipFingerprintIndex[userConn.UserData.ClientIP], *userConn.UserData.Fingerprint)
		}
	}
}

// AddFingerprintForConn adds a fingerprint for the provided connection and updates the IP index.
func AddFingerprintForConn(conn *websocket.Conn, fingerprint uint32) error {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	// Get the user data for the provided connection
	userConn, exists := activeConnections[conn]
	if !exists {
		return fmt.Errorf("connection not found")
	}

	// Set the fingerprint in the user data
	userConn.UserData.Fingerprint = &fingerprint

	// Update the activeConnections map with the new UserData
	activeConnections[conn] = userConn

	// Index the fingerprint for this IP
	if userConn.UserData.ClientIP != "" {
		if ipFingerprintIndex[userConn.UserData.ClientIP] == nil {
			ipFingerprintIndex[userConn.UserData.ClientIP] = make(map[uint32]struct{})
		}
		// Add the fingerprint to the IP's fingerprint index
		ipFingerprintIndex[userConn.UserData.ClientIP][fingerprint] = struct{}{}
	}

	return nil
}

// IsFingerprintUsedForIP checks if the fingerprint has already been used for the given clientIP.
func IsFingerprintUsedForIP(clientIP string, fingerprint uint32) bool {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	// Check if the fingerprint exists in the ipFingerprintIndex for the given IP
	if fingerprints, exists := ipFingerprintIndex[clientIP]; exists {
		_, used := fingerprints[fingerprint]
		return used
	}
	return false
}

// ClearFingerprintForConn clears the fingerprint for the provided connection and updates the IP index.
func ClearFingerprintForConn(conn *websocket.Conn) error {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	// Get the user data for the provided connection
	userConn, exists := activeConnections[conn]
	if !exists {
		return fmt.Errorf("connection not found")
	}

	// If the fingerprint exists, remove it from the ipFingerprintIndex
	if userConn.UserData.Fingerprint != nil {
		// Get the current fingerprint and remove it from the IP's fingerprint index
		fingerprint := *userConn.UserData.Fingerprint
		if userConn.UserData.ClientIP != "" {
			if ipFingerprints, exists := ipFingerprintIndex[userConn.UserData.ClientIP]; exists {
				delete(ipFingerprints, fingerprint)
			}
		}
		// Clear the fingerprint in the UserData
		userConn.UserData.Fingerprint = nil

		// Update the activeConnections map with the modified UserData
		activeConnections[conn] = userConn
	}

	return nil
}

func AddUnlockedSkinsLocally(conn *websocket.Conn, newSkinIDs []int) bool {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	// Retrieve the UserConnection from activeConnections map
	if userConn, exists := activeConnections[conn]; exists {
		// Loop over each new skin ID to check and append it if not already unlocked
		for _, newSkinID := range newSkinIDs {
			// Check if the skin ID already exists in the Unlocked slice
			found := false
			for _, skin := range userConn.UserData.Skins.Unlocked {
				if skin == newSkinID {
					// The skin is already unlocked, skip this skin
					found = true
					break
				}
			}

			// If the skin is not already unlocked, add it to the Unlocked slice
			if !found {
				userConn.UserData.Skins.Unlocked = append(userConn.UserData.Skins.Unlocked, newSkinID)
			}
		}

		// Update the activeConnections map with the modified UserConnection
		activeConnections[conn] = userConn
		return true
	}

	return false
}

func MapRoleToPermission(role string) game.Permission {
	switch role {
	case "admin":
		return game.PERMISSION_ADMIN
	case "moderator":
		return game.PERMISSION_MODERATOR
	default:
		return game.PERMISSION_NONE
	}
}

type UserStatsPayload struct {
	UserId string `json:"userId"`
	Data   struct {
		Score    int `json:"score"`
		XP       int `json:"xp"`
		Kills    int `json:"kills"`
		Playtime int `json:"playtime"`
	} `json:"data"`
}

func ScoreToXP(score uint32) uint32 {
	return score / 1000
}

// Send the progression update request
func UpdateUserStats(userId string, score uint32, kills uint32, playtime time.Duration) ([]int, bool) {
	// Validate input
	if userId == "" {
		return nil, false
	}

	// Convert playtime to seconds (playtime is given in Duration, so convert to seconds)
	playtimeSeconds := int(playtime.Seconds()) // Convert to seconds

	// Construct the payload
	payload := UserStatsPayload{
		UserId: userId,
		Data: struct {
			Score    int `json:"score"`
			XP       int `json:"xp"`
			Kills    int `json:"kills"`
			Playtime int `json:"playtime"`
		}{
			Score:    int(score),
			XP:       int(ScoreToXP(score)),
			Kills:    int(kills),
			Playtime: playtimeSeconds, // Transmitting playtime in seconds
		},
	}

	// Convert the payload to JSON
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal JSON: %v", err)
		return nil, false
	}

	// Create the HTTP request
	req, err := http.NewRequest(http.MethodPost, "https://auth.blobl.io/api/user/update/stats", bytes.NewBuffer(jsonPayload))
	if err != nil {
		log.Printf("Failed to create HTTP request: %v", err)
		return nil, false
	}

	req.Header.Set("Content-Type", "application/json")

	// Use an HTTP client with a timeout
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("HTTP request failed: %v", err)
		return nil, false
	}
	defer resp.Body.Close()

	// Handle the response
	if resp.StatusCode != http.StatusOK {
		log.Printf("Failed to update progression: %s", resp.Status)
		return nil, false
	}

	// Parse the response body to get the newly unlocked skins
	var response struct {
		Message            string `json:"message"`
		NewlyUnlockedSkins []int  `json:"newlyUnlockedSkins"`
	}

	// Decode the JSON response
	err = json.NewDecoder(resp.Body).Decode(&response)
	if err != nil {
		log.Printf("Failed to parse response JSON: %v", err)
		return nil, false
	}

	// Return the newly unlocked skins
	return response.NewlyUnlockedSkins, true
}
