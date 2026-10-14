/**
 * ZenAkari Engine
 * Pure logic engine for Akari (Light Up / 美術館) grid puzzle.
 * Handles board state, raycasting illumination, constraint validation,
 * deductive logic hints, and solution verification.
 */

class AkariEngine {
  constructor(width, height, walls = []) {
    this.width = width;
    this.height = height;
    // walls: array of { r, c, count: null | 0 | 1 | 2 | 3 | 4 }
    this.walls = new Map();
    for (const w of walls) {
      this.walls.set(`${w.r},${w.c}`, w.count !== undefined ? w.count : null);
    }
    // grid state: 'empty' | 'lantern' | 'dot'
    this.grid = Array.from({ length: height }, () => Array(width).fill('empty'));
  }

  isWall(r, c) {
    return this.walls.has(`${r},${c}`);
  }

  getWallCount(r, c) {
    if (!this.isWall(r, c)) return null;
    return this.walls.get(`${r},${c}`);
  }

  getCell(r, c) {
    if (r < 0 || r >= this.height || c < 0 || c >= this.width) return null;
    if (this.isWall(r, c)) return 'wall';
    return this.grid[r][c];
  }

  setCell(r, c, val) {
    if (this.isWall(r, c)) return false;
    if (r < 0 || r >= this.height || c < 0 || c >= this.width) return false;
    this.grid[r][c] = val;
    return true;
  }

  toggleCell(r, c, mode = 'cycle') {
    if (this.isWall(r, c)) return null;
    const cur = this.grid[r][c];
    let next;
    if (mode === 'lantern') {
      next = cur === 'lantern' ? 'empty' : 'lantern';
    } else if (mode === 'dot') {
      next = cur === 'dot' ? 'empty' : 'dot';
    } else {
      // cycle: empty -> lantern -> dot -> empty
      if (cur === 'empty') next = 'lantern';
      else if (cur === 'lantern') next = 'dot';
      else next = 'empty';
    }
    this.grid[r][c] = next;
    return next;
  }

  clear() {
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (!this.isWall(r, c)) {
          this.grid[r][c] = 'empty';
        }
      }
    }
  }

  // Calculate raycasting illumination and conflicts
  calculateIllumination() {
    // litCount[r][c] = number of lanterns illuminating (r, c)
    const litCount = Array.from({ length: this.height }, () => Array(this.width).fill(0));
    // litDirections[r][c] = { up: bool, down: bool, left: bool, right: bool, center: bool }
    const litSources = Array.from({ length: this.height }, () => Array.from({ length: this.width }, () => []));
    const conflicts = new Set();
    const lanterns = [];

    // Find all lanterns
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (this.grid[r][c] === 'lantern') {
          lanterns.push({ r, c });
        }
      }
    }

    const DIRS = [
      { dr: -1, dc: 0, name: 'up' },
      { dr: 1, dc: 0, name: 'down' },
      { dr: 0, dc: -1, name: 'left' },
      { dr: 0, dc: 1, name: 'right' }
    ];

    // Raycast from each lantern
    for (const l of lanterns) {
      litCount[l.r][l.c]++;
      litSources[l.r][l.c].push({ r: l.r, c: l.c });

      for (const d of DIRS) {
        let nr = l.r + d.dr;
        let nc = l.c + d.dc;
        while (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width && !this.isWall(nr, nc)) {
          litCount[nr][nc]++;
          litSources[nr][nc].push({ r: l.r, c: l.c });

          // If another lantern is encountered in line of sight, both are in conflict!
          if (this.grid[nr][nc] === 'lantern') {
            conflicts.add(`${l.r},${l.c}`);
            conflicts.add(`${nr},${nc}`);
          }
          nr += d.dr;
          nc += d.dc;
        }
      }
    }

    // Check wall constraints
    const wallStatuses = new Map();
    for (const [key, reqCount] of this.walls.entries()) {
      const [wr, wc] = key.split(',').map(Number);
      if (reqCount === null) {
        wallStatuses.set(key, { count: null, current: 0, satisfied: true, violated: false });
        continue;
      }

      let adjacentLanterns = 0;
      let adjacentEmpty = 0;
      for (const d of DIRS) {
        const ar = wr + d.dr;
        const ac = wc + d.dc;
        if (ar >= 0 && ar < this.height && ac >= 0 && ac < this.width && !this.isWall(ar, ac)) {
          if (this.grid[ar][ac] === 'lantern') adjacentLanterns++;
          else if (this.grid[ar][ac] === 'empty') adjacentEmpty++;
        }
      }

      const satisfied = adjacentLanterns === reqCount;
      const violated = adjacentLanterns > reqCount || (adjacentLanterns + adjacentEmpty < reqCount);

      wallStatuses.set(key, {
        count: reqCount,
        current: adjacentLanterns,
        empty: adjacentEmpty,
        satisfied,
        violated
      });
    }

    // Check unlit path cells
    let unlitCells = 0;
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (!this.isWall(r, c) && litCount[r][c] === 0) {
          unlitCells++;
        }
      }
    }

    const isComplete =
      conflicts.size === 0 &&
      unlitCells === 0 &&
      Array.from(wallStatuses.values()).every(w => w.satisfied || w.count === null);

    return {
      litCount,
      litSources,
      conflicts,
      wallStatuses,
      unlitCells,
      lanternsCount: lanterns.length,
      isComplete
    };
  }

  // Get deductive hint
  getHint() {
    const illum = this.calculateIllumination();
    const DIRS = [
      { dr: -1, dc: 0, name: 'North' },
      { dr: 1, dc: 0, name: 'South' },
      { dr: 0, dc: -1, name: 'West' },
      { dr: 0, dc: 1, name: 'East' }
    ];

    // Hint 1: Address active conflicts first
    if (illum.conflicts.size > 0) {
      const firstConflict = Array.from(illum.conflicts)[0];
      const [r, c] = firstConflict.split(',').map(Number);
      return {
        type: 'conflict',
        r,
        c,
        message: `Two lanterns shine directly on each other at row ${r + 1}, column ${c + 1}. Lanterns cannot share an unblocked line of sight!`
      };
    }

    // Hint 2: Wall with 0 that has open neighbors
    for (const [key, status] of illum.wallStatuses.entries()) {
      if (status.count === 0 && status.empty > 0) {
        const [wr, wc] = key.split(',').map(Number);
        for (const d of DIRS) {
          const ar = wr + d.dr;
          const ac = wc + d.dc;
          if (ar >= 0 && ar < this.height && ac >= 0 && ac < this.width && this.grid[ar][ac] === 'empty') {
            return {
              type: 'dot',
              r: ar,
              c: ac,
              action: 'dot',
              message: `Stone wall 0 at (${wr + 1}, ${wc + 1}) cannot have any adjacent lanterns. Mark (${ar + 1}, ${ac + 1}) with a dot.`
            };
          }
        }
      }
    }

    // Hint 3: Wall that is already satisfied with remaining empty neighbors
    for (const [key, status] of illum.wallStatuses.entries()) {
      if (status.count !== null && status.satisfied && status.empty > 0) {
        const [wr, wc] = key.split(',').map(Number);
        for (const d of DIRS) {
          const ar = wr + d.dr;
          const ac = wc + d.dc;
          if (ar >= 0 && ar < this.height && ac >= 0 && ac < this.width && this.grid[ar][ac] === 'empty') {
            return {
              type: 'dot',
              r: ar,
              c: ac,
              action: 'dot',
              message: `Wall ${status.count} at (${wr + 1}, ${wc + 1}) is already satisfied! Mark remaining neighbor (${ar + 1}, ${ac + 1}) with a dot.`
            };
          }
        }
      }
    }

    // Hint 4: Wall forced to place lanterns in all remaining empty neighbors
    for (const [key, status] of illum.wallStatuses.entries()) {
      if (status.count !== null && !status.satisfied && status.count - status.current === status.empty && status.empty > 0) {
        const [wr, wc] = key.split(',').map(Number);
        for (const d of DIRS) {
          const ar = wr + d.dr;
          const ac = wc + d.dc;
          if (ar >= 0 && ar < this.height && ac >= 0 && ac < this.width && this.grid[ar][ac] === 'empty') {
            return {
              type: 'lantern',
              r: ar,
              c: ac,
              action: 'lantern',
              message: `Wall ${status.count} at (${wr + 1}, ${wc + 1}) needs ${status.count - status.current} more lantern(s) with exactly ${status.empty} open spot(s). Place a lantern at (${ar + 1}, ${ac + 1})!`
            };
          }
        }
      }
    }

    // Hint 5: Unlit cell that can only be illuminated by a single candidate spot
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (!this.isWall(r, c) && illum.litCount[r][c] === 0) {
          // Find all empty cells that could illuminate (r, c)
          const candidates = [];
          if (this.grid[r][c] === 'empty') candidates.push({ r, c });

          for (const d of DIRS) {
            let nr = r + d.dr;
            let nc = c + d.dc;
            while (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width && !this.isWall(nr, nc)) {
              if (this.grid[nr][nc] === 'empty') {
                candidates.push({ r: nr, c: nc });
              }
              nr += d.dr;
              nc += d.dc;
            }
          }

          if (candidates.length === 1) {
            const cand = candidates[0];
            return {
              type: 'lantern',
              r: cand.r,
              c: cand.c,
              action: 'lantern',
              message: `Unlit cell at (${r + 1}, ${c + 1}) can only receive light from (${cand.r + 1}, ${cand.c + 1}). Place a lantern there!`
            };
          }
        }
      }
    }

    // Fallback: Use solver to find one correct placement from solution
    const solution = this.solve();
    if (solution) {
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          if (!this.isWall(r, c) && solution[r][c] === 'lantern' && this.grid[r][c] !== 'lantern') {
            return {
              type: 'lantern',
              r,
              c,
              action: 'lantern',
              message: `Deduction reveals a lantern should shine at row ${r + 1}, column ${c + 1}.`
            };
          }
        }
      }
    }

    return {
      type: 'info',
      message: 'Keep illuminating dark pathway cells and observe numbered stone walls!'
    };
  }

  // Backtracking solver
  solve() {
    const emptyCells = [];
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (!this.isWall(r, c)) {
          emptyCells.push({ r, c });
        }
      }
    }

    // Save current state
    const originalGrid = this.grid.map(row => [...row]);

    // Fast validator check during search
    const canPlaceLantern = (r, c) => {
      // Check orthogonal line of sight for other lanterns
      const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of DIRS) {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width && !this.isWall(nr, nc)) {
          if (this.grid[nr][nc] === 'lantern') return false;
          nr += dr;
          nc += dc;
        }
      }

      // Check adjacent walls do not exceed their count
      for (const [dr, dc] of DIRS) {
        const wr = r + dr;
        const wc = c + dc;
        if (wr >= 0 && wr < this.height && wc >= 0 && wc < this.width && this.isWall(wr, wc)) {
          const count = this.getWallCount(wr, wc);
          if (count !== null) {
            let adjLanterns = 1; // including this new one
            for (const [ddr, ddc] of DIRS) {
              const ar = wr + ddr;
              const ac = wc + ddc;
              if (ar >= 0 && ar < this.height && ac >= 0 && ac < this.width && !this.isWall(ar, ac)) {
                if (!(ar === r && ac === c) && this.grid[ar][ac] === 'lantern') {
                  adjLanterns++;
                }
              }
            }
            if (adjLanterns > count) return false;
          }
        }
      }
      return true;
    };

    // Check if an unlit cell can still be lit by remaining undecided cells
    const backtrack = (idx) => {
      // Check current wall violations
      for (const [key, count] of this.walls.entries()) {
        if (count === null) continue;
        const [wr, wc] = key.split(',').map(Number);
        let lanterns = 0;
        let available = 0;
        const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of DIRS) {
          const ar = wr + dr;
          const ac = wc + dc;
          if (ar >= 0 && ar < this.height && ac >= 0 && ac < this.width && !this.isWall(ar, ac)) {
            if (this.grid[ar][ac] === 'lantern') lanterns++;
            else if (this.grid[ar][ac] === 'empty') available++;
          }
        }
        if (lanterns > count || lanterns + available < count) return null;
      }

      if (idx === emptyCells.length) {
        const illum = this.calculateIllumination();
        if (illum.isComplete) {
          return this.grid.map(row => [...row]);
        }
        return null;
      }

      const { r, c } = emptyCells[idx];

      // Option 1: Try placing lantern
      if (canPlaceLantern(r, c)) {
        this.grid[r][c] = 'lantern';
        const res = backtrack(idx + 1);
        if (res) return res;
      }

      // Option 2: Leave empty (no lantern)
      this.grid[r][c] = 'empty';
      const res2 = backtrack(idx + 1);
      if (res2) return res2;

      return null;
    };

    // Reset grid for solving
    this.clear();
    const solution = backtrack(0);

    // Restore original grid
    this.grid = originalGrid;
    return solution;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AkariEngine };
}
