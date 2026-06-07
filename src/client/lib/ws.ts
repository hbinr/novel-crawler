// WebSocket 客户端 — 自动重连，事件 fanout
import type { LogLine, Task, Chapter, Notification, WSClientMsg, WSServerMsg } from "@shared/types.ts";

type Handler<T> = (msg: T) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = {
    log: new Set<Handler<LogLine>>(),
    task: new Set<Handler<Task>>(),
    chapter: new Set<Handler<Chapter>>(),
    notification: new Set<Handler<Notification>>(),
    open: new Set<Handler<void>>(),
  };
  private retry = 0;
  private taskFilter: number | null = null;

  constructor() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.url = `${proto}://${location.host}/ws`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener("open", () => {
      this.retry = 0;
      this.listeners.open.forEach((h) => h());
      if (this.taskFilter != null) this.send({ type: "subscribe", taskId: this.taskFilter });
    });
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WSServerMsg;
        if (msg.type === "log") this.listeners.log.forEach((h) => h(msg.line));
        else if (msg.type === "task") this.listeners.task.forEach((h) => h(msg.task));
        else if (msg.type === "chapter") this.listeners.chapter.forEach((h) => h(msg.chapter));
        else if (msg.type === "notification")
          this.listeners.notification.forEach((h) => h(msg.notification));
      } catch {
        /* ignore */
      }
    });
    ws.addEventListener("close", () => {
      this.ws = null;
      const wait = Math.min(1000 * 2 ** this.retry, 15000);
      this.retry++;
      setTimeout(() => this.connect(), wait);
    });
    ws.addEventListener("error", () => ws.close());
  }

  private send(msg: WSClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  subscribeTask(id: number | null) {
    this.taskFilter = id;
    if (id == null) this.send({ type: "unsubscribe", taskId: 0 });
    else this.send({ type: "subscribe", taskId: id });
  }

  onLog(h: Handler<LogLine>) {
    this.listeners.log.add(h);
    return () => this.listeners.log.delete(h);
  }
  onTask(h: Handler<Task>) {
    this.listeners.task.add(h);
    return () => this.listeners.task.delete(h);
  }
  onChapter(h: Handler<Chapter>) {
    this.listeners.chapter.add(h);
    return () => this.listeners.chapter.delete(h);
  }
  onNotification(h: Handler<Notification>) {
    this.listeners.notification.add(h);
    return () => this.listeners.notification.delete(h);
  }
  onOpen(h: Handler<void>) {
    this.listeners.open.add(h);
    return () => this.listeners.open.delete(h);
  }
}

export const ws = new WSClient();
