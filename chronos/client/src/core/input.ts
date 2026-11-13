/**
 * Keyboard + mouse input. Uses `KeyboardEvent.code` (physical keys), so
 * ZQSD on AZERTY and WASD on QWERTY both work without remapping.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  private dragging = false;
  pointerLocked = false;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      // Typing in a text field (dialogue) must not move the hero.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "F3" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === element;
    });
    element.addEventListener("mousedown", () => (this.dragging = true));
    window.addEventListener("mouseup", () => (this.dragging = false));
    window.addEventListener("mousemove", (e) => {
      // With pointer lock, every movement turns the camera; otherwise drag to look.
      if (this.pointerLocked || this.dragging) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    element.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.wheel += e.deltaY;
      },
      { passive: false },
    );
  }

  requestPointerLock(): void {
    try {
      const p = this.element.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch(() => undefined);
    } catch {
      /* Pointer lock unavailable (e.g. headless): drag-to-look still works. */
    }
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** True once per key press. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Call at the end of every frame. */
  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
