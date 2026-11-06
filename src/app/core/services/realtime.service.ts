import { inject, Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

/** Mensagem do servidor em /ws/stream/ (route_event, boarding_status, vehicle_location, notification...). */
export interface StreamMessage {
  type: string;
  [key: string]: unknown;
}

export type StreamStatus = 'offline' | 'connecting' | 'live';

/** O servidor fecha com 4001 quando o token falta, é inválido ou expirou. */
const CLOSE_UNAUTHORIZED = 4001;
const PING_MS = 25_000;
const MAX_RETRY_MS = 30_000;

/**
 * Conexão única com o WebSocket do backend, compartilhada por quem precisar.
 * Abre no primeiro `connect()`, fecha quando o último consumidor chama `release()`,
 * reconecta com espera crescente e renova o access token quando ele expira.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigService);

  readonly status = signal<StreamStatus>('offline');
  private readonly messages$ = new Subject<StreamMessage>();
  readonly messages: Observable<StreamMessage> = this.messages$.asObservable();

  private socket: WebSocket | null = null;
  private users = 0;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  connect(): void {
    this.users += 1;
    if (this.users === 1) this.open();
  }

  release(): void {
    this.users = Math.max(0, this.users - 1);
    if (this.users === 0) this.close();
  }

  private open(): void {
    const token = this.auth.accessToken;
    if (!token || this.users === 0) {
      this.status.set('offline');
      return;
    }
    this.status.set('connecting');
    const socket = new WebSocket(`${this.config.getStreamUrl()}?token=${encodeURIComponent(token)}`);
    this.socket = socket;

    socket.onmessage = (event) => {
      let message: StreamMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'connected') {
        this.status.set('live');
        this.retry = 0;
        return;
      }
      if (message.type !== 'pong') this.messages$.next(message);
    };

    socket.onopen = () => {
      this.pingTimer = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('{"type":"ping"}'), PING_MS);
    };

    socket.onclose = (event) => {
      this.clearPing();
      if (this.socket !== socket) return; // fechado de propósito ou substituído
      this.socket = null;
      this.status.set('offline');
      if (this.users === 0) return;
      if (event.code === CLOSE_UNAUTHORIZED && this.auth.refreshToken) {
        this.auth.refreshAccessToken().subscribe({
          next: () => this.scheduleReconnect(0),
          error: () => this.scheduleReconnect(),
        });
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(delay?: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const wait = delay ?? Math.min(MAX_RETRY_MS, 1000 * 2 ** this.retry);
    this.retry += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, wait);
  }

  private close(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.clearPing();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.status.set('offline');
    this.retry = 0;
  }

  private clearPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}
