package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"server/game"
	"server/network"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

var PORT string

// Handler to return player count
func playerCountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	// Respond with the current player count
	response := map[string]int{"player_count": len(game.State.Players)}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func serverRebootHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Parse the query parameters
	query := r.URL.Query()
	minutesLeftStr := query.Get("minutesLeft")
	if minutesLeftStr == "" {
		http.Error(w, "Missing 'minutesLeft' query parameter", http.StatusBadRequest)
		return
	}

	// Convert minutesLeft to an integer
	minutesLeft, err := strconv.Atoi(minutesLeftStr)
	if err != nil || minutesLeft <= 0 {
		http.Error(w, "Invalid 'minutesLeft' query parameter", http.StatusBadRequest)
		return
	}

	// Broadcast reboot alert
	network.BroadcastRebootAlert(byte(minutesLeft))

	network.SERVER_REBOOTING = true
}

// CORS Middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Allow requests from specific origins
		if origin == "https://bloble.online" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			
		} else {
			log.Printf("cors middleware err", origin)
		}

		// Handle OPTIONS requests
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Pass the request to the next handler
		next.ServeHTTP(w, r)
	})
}

func getClientIP(r *http.Request) string {
	// Log the client's IP address
	clientIP := r.Header.Get("X-Real-IP")
	if clientIP == "" {
		clientIP = r.Header.Get("X-Forwarded-For")
	}
	if clientIP == "" {
		clientIP = r.RemoteAddr
	}
	return clientIP
}

func wsEndpoint(w http.ResponseWriter, r *http.Request) {
       origine := r.Header.Get("Origin")
       // Allow only requests from ...
	   log.Printf(origine)
       if origine != "https://bloble.online" {
       		http.Error(w, "Forbidden", http.StatusForbidden)
			log.Printf("origin forbidden: %", origine)
         	return
       }
	   

	var userData network.UserData

	userData.ClientIP = getClientIP(r)
	log.Printf(getClientIP(r))

	// Pass the request to the WebSocket handler
	network.WsEndpoint(w, r, userData)
}

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Error loading .env file: %v", err)
	}

	// Parse command line arguments for game mode and port
	args := os.Args[1:]
	modeStr := "ffa" // default mode
	portStr := ""    // default to environment variable

	for _, arg := range args {
		if strings.HasPrefix(arg, "--mode=") {
			modeStr = strings.TrimPrefix(arg, "--mode=")
		} else if strings.HasPrefix(arg, "-mode=") {
			modeStr = strings.TrimPrefix(arg, "-mode=")
		} else if strings.HasPrefix(arg, "--port=") {
			portStr = strings.TrimPrefix(arg, "--port=")
		} else if strings.HasPrefix(arg, "-port=") {
			portStr = strings.TrimPrefix(arg, "-port=")
		}
	}

	// Set game mode based on argument
	switch strings.ToLower(modeStr) {
	case "smallbases", "small_bases", "small":
		game.CurrentGameMode = game.MODE_SMALL_BASES
		log.Printf("Game mode set to: Small Bases")
	case "ffa", "freeforall":
		game.CurrentGameMode = game.MODE_FFA
		log.Printf("Game mode set to: FFA")
	default:
		game.CurrentGameMode = game.MODE_FFA
		log.Printf("Unknown mode '%s', defaulting to FFA", modeStr)
	}

	// Get the port from command line argument or environment variable
	if portStr != "" {
		PORT = portStr
		log.Printf("Port set from command line argument: %s\n", PORT)
	} else {
		PORT = os.Getenv("PORT")
		if PORT == "" {
			PORT = "14882" // Default port
			log.Printf("Port not specified. Defaulting to port %s\n", PORT)
		} else {
			log.Printf("Port set from environment variable: %s\n", PORT)
		}
	}

	game.Start()

	// Define WebSocket endpoint handlers with session checks
	http.HandleFunc("/", wsEndpoint)
	http.HandleFunc("/ffa1", wsEndpoint)
	http.HandleFunc("/ffa2", wsEndpoint)

	http.HandleFunc("/playercount", playerCountHandler)
	http.HandleFunc("/reboot", serverRebootHandler)

	// Log server start
	address := fmt.Sprintf("0.0.0.0:%s", PORT)
	log.Printf("Blobl.io Server starting on %s\n", address)

	// Start the server
	if err := http.ListenAndServe("0.0.0.0:"+PORT, nil); err != nil {
		log.Fatal(err)
	}
}
