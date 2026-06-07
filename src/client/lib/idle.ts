// 浏览器空闲调度：把非关键工作延后到首屏绘制完成后
// - window.requestIdleCallback 在空闲时触发
// - 降级到 setTimeout(fn, 1) 确保兼容性
type IdleRequest = (cb: () => void, opts?: { timeout: number }) => number;

const ric: IdleRequest =
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
    ? (cb, opts) => window.requestIdleCallback(() => cb(), opts)
    : (cb) => setTimeout(cb, 1) as unknown as number;

export const scheduleIdle = (cb: () => void, timeout = 2000) => ric(cb, { timeout });
