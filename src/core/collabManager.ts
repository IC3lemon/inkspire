import { io, Socket } from 'socket.io-client';
import { IStroke, IFrame, ILayerDef } from '../types/animationTypes';

export interface RoomState {
  fps: number;
  layers: ILayerDef[];
  frames: IFrame[];
}

export class CollabManager {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  readonly userName: string;

  onRoomState: ((state: RoomState) => void) | null = null;
  onRemoteStroke: ((frameIdx: number, layerIdx: number, stroke: IStroke) => void) | null = null;
  onFullSync: ((state: RoomState) => void) | null = null;
  onPeersChanged: ((count: number) => void) | null = null;

  private peers = new Map<string, string>();
  private latencySamples: number[] = [];
  avgLatencyMs = 0;

  constructor(userName?: string) {
    this.userName = userName ?? 'User ' + Math.floor(Math.random() * 9000 + 1000);
  }

  get isConnected() { return this.socket?.connected ?? false; }
  get connectedRoom() { return this.roomId; }
  get peerCount() { return this.peers.size; }

  connect(roomId: string) {
    this.roomId = roomId;
    this.socket = io();

    this.socket.on('connect', () => {
      this.socket!.emit('join-room', { roomId, userName: this.userName });
      this.startLatencyPing();
    });

    this.socket.on('room-state', (state: RoomState) => {
      this.onRoomState?.(state);
    });

    this.socket.on('stroke', (data: { frameIdx: number; layerIdx: number; stroke: IStroke }) => {
      this.onRemoteStroke?.(data.frameIdx, data.layerIdx, data.stroke);
    });

    this.socket.on('frame-state-sync', (state: RoomState) => {
      this.onFullSync?.(state);
    });

    this.socket.on('user-joined', (data: { id: string; name: string }) => {
      this.peers.set(data.id, data.name);
      this.onPeersChanged?.(this.peers.size);
    });

    this.socket.on('user-left', (data: { id: string }) => {
      this.peers.delete(data.id);
      this.onPeersChanged?.(this.peers.size);
    });

    this.socket.on('pong-latency', (sentAt: number) => {
      const rtt = performance.now() - sentAt;
      this.latencySamples.push(rtt / 2);
      if (this.latencySamples.length > 20) this.latencySamples.shift();
      this.avgLatencyMs = Math.round(
        this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
      );
    });
  }

  private startLatencyPing() {
    window.setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping-latency', performance.now());
      }
    }, 2000);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.roomId = null;
    this.peers.clear();
  }

  emitStroke(frameIdx: number, layerIdx: number, stroke: IStroke) {
    this.socket?.emit('stroke', { frameIdx, layerIdx, stroke });
  }

  emitFullSync(fps: number, layers: ILayerDef[], frames: IFrame[]) {
    this.socket?.emit('frame-state-sync', { fps, layers, frames });
  }
}
