// @ts-nocheck
"use client";
import EventEmitter from "eventemitter3";

class WebSocketService {
  private socket: WebSocket | null = null;
  private transactionSocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectDelay = 2500;
  private reconnectDelayMax = 4500;
  private randomizationFactor = 0.5;
  private emitter = new EventEmitter();
  private subscribedRooms: Set<string> = new Set();
  private transactions: Set<string> = new Set();

  constructor() {
    this.connect();

    // Listen for beforeunload event to close WebSocket connections
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.disconnect.bind(this));
    }
  }

  async connect() {
    if (this.socket && this.transactionSocket) {
      return;
    }

    try {
      if (typeof document !== "undefined") {
        if (window.socket || window.transactionSocket) {
          return;
        }
        this.socket = new WebSocket(process.env.NEXT_PUBLIC_DATASTREAM as string);
        this.transactionSocket = new WebSocket(
          process.env.NEXT_PUBLIC_DATASTREAM as string
        );

        window.socket = this.socket;
        window.transactionSocket = this.transactionSocket;

        this.socket.onopen = () => {
          console.log("Connected to WebSocket server");
          this.reconnectAttempts = 0;
          this.resubscribeToRooms();
        };

        this.socket.onclose = () => {
          console.log("Disconnected from WebSocket server");
          this.socket = null;
          window.socket = null;
          this.reconnect();
        };

        this.socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case "message":
              // Keep track of transactions, don't send duplicates
              if (message.data?.tx && this.transactions.has(message.data.tx)) {
                return;
              } else if (message.data?.tx) {
                this.transactions.add(message.data.tx);
              }
              if (message.room.includes('price:')) {
                this.emitter.emit(`price-by-token:${message.data.token}`, message.data);
              }
              this.emitter.emit(message.room, message.data);
              break;
          }
        };

        this.transactionSocket.onopen = () => {
          console.log("Connected to Transaction WebSocket server");
          this.reconnectAttempts = 0;
          this.resubscribeToRooms();
        };

        this.transactionSocket.onclose = () => {
          console.log("Disconnected from Transaction WebSocket server");
          this.transactionSocket = null;
          window.transactionSocket = null;
          this.reconnect();
        };

        this.transactionSocket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case "message":
              // Keep track of transactions, don't send duplicates
              if (message.data?.tx && this.transactions.has(message.data.tx)) {
                return;
              } else if (message.data?.tx) {
                this.transactions.add(message.data.tx);
              }
              this.emitter.emit(message.room, message.data);
              break;
          }
        };
      } else {
        return;
      }
    } catch (e) {
      console.error(e);
      this.reconnect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.transactionSocket) {
      this.transactionSocket.close();
      this.transactionSocket = null;
    }
    this.subscribedRooms.clear();
    this.transactions.clear();
  }

  reconnect() {
    console.log("Reconnecting to WebSocket server");
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.reconnectDelayMax
    );
    const jitter = delay * this.randomizationFactor;
    const reconnectDelay = delay + Math.random() * jitter;

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, reconnectDelay);
  }

  joinRoom(room: string) {
    this.subscribedRooms.add(room);
    const socket = room.includes("transaction")
      ? this.transactionSocket
      : this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "join", room }));
    }
  }

  leaveRoom(room: string) {
    this.subscribedRooms.delete(room);
    const socket = room.includes("transaction")
      ? this.transactionSocket
      : this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "leave", room }));
    }
  }

  on(room: string, listener: (data: any) => void) {
    this.emitter.on(room, listener);
  }

  off(room: string, listener: (data: any) => void) {
    this.emitter.off(room, listener);
  }

  getSocket() {
    return this.socket;
  }

  private resubscribeToRooms() {
    if (
      this.socket &&
      this.socket.readyState === WebSocket.OPEN &&
      this.transactionSocket &&
      this.transactionSocket.readyState === WebSocket.OPEN
    ) {
      for (const room of this.subscribedRooms) {
        const socket = room.includes("transaction")
          ? this.transactionSocket
          : this.socket;
        socket.send(JSON.stringify({ type: "join", room }));
      }
    }
  }
}

const service = new WebSocketService();

export default service;
