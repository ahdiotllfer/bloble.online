import { MessageTypes } from "./constants.js";

export default class Message {
    constructor (type, payload) {
        this.type = type;
        this.payload = payload;
    }

    encodeMessage () {
        const typeByte = this.type;
        const payloadBytes = this.payload;

        // Combine type byte and payload bytes into a single Uint8Array
        const messageBytes = new Uint8Array(1 + payloadBytes.length);
        messageBytes[0] = typeByte; // First byte: Message type
        messageBytes.set(payloadBytes, 1); // Copy payload bytes starting from the second byte

        return messageBytes;
    }

    static createJoinMessage (name, equippedSkin, fingerprint, token, gamemode) {
        // Truncate the name if it exceeds 12 characters
        name = name.slice(0, 12);

        // Encode the name as bytes
        const nameBytes = new TextEncoder().encode(name);

        const tokenBytes = new TextEncoder().encode(`\u{1F512}${token}\u{1F513}`);

        // Convert equippedSkin to a single byte
        const skinByte = new Uint8Array(1); // Create a single byte array
        skinByte[0] = equippedSkin;

        // Convert gamemode to a single byte
        const gamemodeByte = new Uint8Array(1);
        gamemodeByte[0] = gamemode;

        // Convert the fingerprint to a 4-byte Uint8Array (32-bit integer)
        const fingerprintBytes = new Uint8Array(4);
        fingerprintBytes[0] = (fingerprint >> 24) & 0xFF; // Most significant byte
        fingerprintBytes[1] = (fingerprint >> 16) & 0xFF;
        fingerprintBytes[2] = (fingerprint >> 8) & 0xFF;
        fingerprintBytes[3] = fingerprint & 0xFF; // Least significant byte

        // Calculate the total payload size (name length + 1 byte for skin + 1 byte for gamemode + 4 bytes for fingerprint)
        const payload = new Uint8Array(nameBytes.length + 1 + 1 + fingerprintBytes.length + tokenBytes.length);

        // Copy the name bytes starting from the first byte
        payload.set(nameBytes, 0);

        // Copy the skin byte
        payload.set(skinByte, nameBytes.length);

        // Copy the gamemode byte
        payload.set(gamemodeByte, nameBytes.length + 1);

        // Append the fingerprint bytes
        payload.set(fingerprintBytes, nameBytes.length + 1 + 1);

        payload.set(tokenBytes, nameBytes.length + 1 + 1 + fingerprintBytes.length);

        // Return the message with the appropriate type and payload
        return new Message(0, payload);
    }


    static createRequestResyncMessage () {
        const payload = new Uint8Array(1);
        return new Message(MessageTypes.CLIENT_REQUEST_RESYNC, payload);
    }

    static createRequestSkinDataMessage () {
        const payload = new Uint8Array(1);
        return new Message(MessageTypes.CLIENT_REQUEST_SKIN_DATA, payload);
    }

    static createPlaceBuildingMessage (buildingType, position) {
        // Create a buffer to hold the payload
        // 1 byte for buildingType, 4 bytes for x (float32), and 4 bytes for y (float32)
        const payload = new Uint8Array(1 + 4 + 4);

        // Set the buildingType in the first byte
        payload[0] = buildingType;

        // Create a DataView for writing float32 values into the buffer
        const dataView = new DataView(payload.buffer);

        // Set the x position as a float32 (4 bytes)
        dataView.setFloat32(1, position.x, false); // false for big-endian
        // Set the y position as a float32 (4 bytes)
        dataView.setFloat32(5, position.y, false); // false for big-endian

        // Return the message object with the payload
        return new Message(MessageTypes.CLIENT_PLACE_BUILDING, payload);
    }

    static createRemoveBuildingsMessage(buildingIDs, neutralBaseID = null) {
        if (!Array.isArray(buildingIDs) || buildingIDs.length === 0) {
            throw new Error("buildingIDs must be a non-empty array");
        }
    
        // Determine if neutralBaseID is provided (it can be 0, so explicitly check for null/undefined)
        const isNeutralBaseProvided = neutralBaseID !== null && neutralBaseID !== undefined;
    
        // Calculate the payload length:
        // 1 byte for the flag, buildingIDs length, and 1 byte for neutralBaseID if provided
        const payloadLength = buildingIDs.length + (isNeutralBaseProvided ? 2 : 1);
        const payload = new Uint8Array(payloadLength); // Create the array with the correct length
    
        let offset = 0;
    
        // Set the flag byte: 0 means no neutralBaseID, 1 means neutralBaseID is included
        payload[offset++] = isNeutralBaseProvided ? 1 : 0;
    
        // If neutralBaseID is provided, store it in the next byte
        if (isNeutralBaseProvided) {
            payload[offset++] = neutralBaseID;
        }
    
        // Fill the payload with building IDs starting at the current offset
        buildingIDs.forEach((buildingID) => {
            payload[offset++] = buildingID; // Store each buildingID starting from the current offset
        });
    
        return new Message(MessageTypes.CLIENT_REMOVE_BUILDINGS, payload);
    }

    static createUpgradeBuildingsMessage(buildingIDs, buildingVariant, neutralBaseID = null) {
        if (!Array.isArray(buildingIDs) || buildingIDs.length === 0) {
            throw new Error("buildingIDs must be a non-empty array");
        }
    
        // Determine if neutralBaseID is provided (it can be 0, so explicitly check for null/undefined)
        const isNeutralBaseProvided = neutralBaseID !== null && neutralBaseID !== undefined;
    
        // Calculate the payload length:
        // 1 byte for the flag, buildingIDs length, 1 byte for neutralBaseID if provided, and 1 byte for buildingVariant
        const payloadLength = buildingIDs.length + (isNeutralBaseProvided ? 2 : 1) + 1;
        const payload = new Uint8Array(payloadLength); // Create the array with the correct length
    
        let offset = 0;
    
        // Set the flag byte: 0 means no neutralBaseID, 1 means neutralBaseID is included
        payload[offset++] = isNeutralBaseProvided ? 1 : 0;
    
        // If neutralBaseID is provided, store it in the next byte
        if (isNeutralBaseProvided) {
            payload[offset++] = neutralBaseID;
        }
    
        // Store buildingVariant
        payload[offset++] = buildingVariant;
    
        // Fill the payload with building IDs starting at the current offset
        buildingIDs.forEach((buildingID) => {
            payload[offset++] = buildingID; // Store each buildingID starting from the current offset
        });
    
        return new Message(MessageTypes.CLIENT_UPGRADE_BUILDINGS, payload);
    }

    static createMoveUnitsMessage (units, targetPosition) {
        const payload = new Uint8Array(1 + units.length + 4); // 4 bytes for position
        payload[0] = units.length;
        payload[1] = (targetPosition.x >> 8) & 0xFF; // High byte of x
        payload[2] = targetPosition.x & 0xFF;        // Low byte of x
        payload[3] = (targetPosition.y >> 8) & 0xFF; // High byte of y
        payload[4] = targetPosition.y & 0xFF;        // Low byte of y

        // Set unit IDs in payload
        for (let i = 0; i < units.length; i++) {
            payload[5 + i] = units[i].id;
        }

        return new Message(MessageTypes.CLIENT_MOVE_UNITS, payload);
    }

    static createToggleUnitSpawning (barracksID, neutralBaseID = null) {
        const payloadLength = neutralBaseID !== null ? 2 : 1;
        const payload = new Uint8Array(payloadLength);

        payload[0] = barracksID;
        if (neutralBaseID) {
            payload[1] = neutralBaseID;
        }

        return new Message(MessageTypes.TOGGLE_UNIT_SPAWNING, payload);
    }

    static createChatMessageMessage (text) {
        // Truncate the name if it exceeds 64 characters
        text = text.slice(0, 64);
        const textBytes = new TextEncoder().encode(text);
        const payload = new Uint8Array(textBytes.length);
        payload.set(textBytes);
        return new Message(MessageTypes.SEND_CHAT_MESSAGE, payload);
    }

    static createCameraUpdateMessage (cameraPosition, zoomLevel) {
        // Create a buffer to hold the payload
        // 2 bytes for x (Int16), 2 bytes for y (Int16), and 1 byte for zoom level (Int8)
        const payload = new Uint8Array(5); // 5 bytes total

        // Create a DataView for writing values into the buffer
        const dataView = new DataView(payload.buffer);

        // Set the camera position x as Int16 (2 bytes)
        dataView.setInt16(0, cameraPosition.x);
        // Set the camera position y as Int16 (2 bytes)
        dataView.setInt16(2, cameraPosition.y);

        const scaledZoom = zoomLevel * 10;  // 0.5 _. 5, 1.5 -> 15
        dataView.setUint8(4, scaledZoom);

        return new Message(MessageTypes.CLIENT_CAMERA_UPDATE, payload);
    }

    static createBuyCommanderMessage () {
        const payload = new Uint8Array(0)
        return new Message(MessageTypes.BUY_COMMANDER, payload);
    }

    static createBuyRepairMessage () {
        const payload = new Uint8Array(0)
        return new Message(MessageTypes.BUY_REPAIR, payload);
    }


}
