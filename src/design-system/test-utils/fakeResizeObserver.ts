export class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  trigger(size: { width: number; height: number }) {
    this.callback([{ contentRect: size } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}
