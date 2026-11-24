// Énigme : rétablir l'énergie en faisant pivoter les connecteurs
// pour relier la source (à gauche) au bus principal (à droite).

const N = 1, E = 2, S = 4, W = 8;
const rot = (m: number) => ((m << 1) | (m >> 3)) & 15;

export class PowerPuzzle {
  private el: HTMLElement;
  private grid: HTMLElement;
  private rows = 3; private cols = 5;
  private masks: number[] = [];
  private fixedEmpty: boolean[] = [];
  private sel = 0;
  private solved = false;
  private onSolve: () => void = () => {};
  private onClose: () => void = () => {};
  private sound: (k: 'move' | 'ok' | 'back') => void = () => {};
  open = false;

  constructor(el: HTMLElement) {
    this.el = el;
    this.grid = el.querySelector('.pgrid') as HTMLElement;
    (el.querySelector('.pclose') as HTMLElement).onclick = () => this.close();
    // solution : chemin source (0,0) → sortie (2,4)
    const sol: Record<string, number> = { '0,0': W | E, '0,1': W | S, '1,1': N | E, '1,2': W | E, '1,3': W | N, '0,3': S | E, '0,4': W | S, '1,4': N | S, '2,4': N | E };
    const decoys = [N | S, N | E, E | S | W, N | S, E | W, N | E];
    let di = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const k = `${r},${c}`;
      this.masks.push(sol[k] ?? decoys[di++ % decoys.length]);
      this.fixedEmpty.push(false);
    }
    // mélange : rotations aléatoires (jamais résolu au départ)
    do { this.masks = this.masks.map((m) => { let x = m; for (let i = Math.floor(Math.random() * 4); i > 0; i--) x = rot(x); return x; }); } while (this.powered().has(this.rows * this.cols - 1));
  }

  show(onSolve: () => void, onClose: () => void, sound: (k: 'move' | 'ok' | 'back') => void) {
    this.onSolve = onSolve; this.onClose = onClose; this.sound = sound;
    this.open = true; this.el.classList.add('show');
    this.render();
  }
  close() {
    if (!this.open) return;
    this.open = false; this.el.classList.remove('show');
    this.sound('back');
    this.onClose();
  }

  /** Cases alimentées depuis la source. */
  private powered() {
    const on = new Set<number>();
    const idx = (r: number, c: number) => r * this.cols + c;
    if (!(this.masks[0] & W)) return on;
    const stack = [0]; on.add(0);
    while (stack.length) {
      const i = stack.pop()!; const r = Math.floor(i / this.cols), c = i % this.cols; const m = this.masks[i];
      const nb: [number, number, number, number][] = [[N, S, r - 1, c], [E, W, r, c + 1], [S, N, r + 1, c], [W, E, r, c - 1]];
      for (const [out, inn, rr, cc] of nb) {
        if (!(m & out) || rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) continue;
        const j = idx(rr, cc);
        if (this.masks[j] & inn && !on.has(j)) { on.add(j); stack.push(j); }
      }
    }
    return on;
  }
  private isSolved() { const last = this.rows * this.cols - 1; return this.powered().has(last) && !!(this.masks[last] & E); }

  rotate(i: number) {
    if (this.solved) return;
    this.masks[i] = rot(this.masks[i]);
    this.sel = i;
    this.sound('move');
    this.render();
    if (this.isSolved()) {
      this.solved = true;
      this.sound('ok');
      this.el.classList.add('solved');
      setTimeout(() => { this.open = false; this.el.classList.remove('show'); this.onSolve(); }, 1400);
    }
  }

  nav(d: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') {
    const r = Math.floor(this.sel / this.cols), c = this.sel % this.cols;
    if (d === 'back') return this.close();
    if (d === 'ok') return this.rotate(this.sel);
    const nr = Math.max(0, Math.min(this.rows - 1, r + (d === 'down' ? 1 : d === 'up' ? -1 : 0)));
    const nc = Math.max(0, Math.min(this.cols - 1, c + (d === 'right' ? 1 : d === 'left' ? -1 : 0)));
    this.sel = nr * this.cols + nc;
    this.sound('move');
    this.render();
  }

  private render() {
    const on = this.powered();
    this.grid.innerHTML = '';
    this.grid.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    this.masks.forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'ptile' + (on.has(i) ? ' on' : '') + (i === this.sel ? ' sel' : '');
      const seg = (dir: number, x: number, y: number) => (m & dir) ? `<line x1="50" y1="50" x2="${x}" y2="${y}"/>` : '';
      b.innerHTML = `<svg viewBox="0 0 100 100"><g>${seg(N, 50, 0)}${seg(E, 100, 50)}${seg(S, 50, 100)}${seg(W, 0, 50)}</g><circle cx="50" cy="50" r="11"/></svg>`;
      b.onclick = () => this.rotate(i);
      this.grid.appendChild(b);
    });
  }
}
