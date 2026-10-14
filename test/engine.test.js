const { describe, it } = require('node:test');
const assert = require('node:assert');
const { AkariEngine } = require('../src/akari-engine.js');

describe('ZenAkari Engine Tests', () => {
  it('initializes grid with walls and open pathways', () => {
    const engine = new AkariEngine(5, 5, [
      { r: 1, c: 1, count: 1 },
      { r: 3, c: 3, count: null }
    ]);

    assert.strictEqual(engine.width, 5);
    assert.strictEqual(engine.height, 5);
    assert.strictEqual(engine.isWall(1, 1), true);
    assert.strictEqual(engine.getWallCount(1, 1), 1);
    assert.strictEqual(engine.isWall(3, 3), true);
    assert.strictEqual(engine.getWallCount(3, 3), null);
    assert.strictEqual(engine.isWall(0, 0), false);
    assert.strictEqual(engine.getCell(0, 0), 'empty');
  });

  it('cycles cell state through empty -> lantern -> dot -> empty', () => {
    const engine = new AkariEngine(3, 3);
    assert.strictEqual(engine.getCell(1, 1), 'empty');

    assert.strictEqual(engine.toggleCell(1, 1), 'lantern');
    assert.strictEqual(engine.getCell(1, 1), 'lantern');

    assert.strictEqual(engine.toggleCell(1, 1), 'dot');
    assert.strictEqual(engine.getCell(1, 1), 'dot');

    assert.strictEqual(engine.toggleCell(1, 1), 'empty');
    assert.strictEqual(engine.getCell(1, 1), 'empty');
  });

  it('casts orthogonal illumination rays stopped by walls and edges', () => {
    // 3x3 grid with wall in center
    const engine = new AkariEngine(3, 3, [
      { r: 1, c: 1, count: null }
    ]);

    // Place lantern at top-middle (0, 1)
    engine.setCell(0, 1, 'lantern');
    const illum = engine.calculateIllumination();

    // Top-left (0, 0), top-middle (0, 1), top-right (0, 2) should be lit
    assert.strictEqual(illum.litCount[0][0], 1);
    assert.strictEqual(illum.litCount[0][1], 1);
    assert.strictEqual(illum.litCount[0][2], 1);

    // Center (1, 1) is a wall, so not lit
    assert.strictEqual(illum.litCount[1][1], 0);

    // Bottom-middle (2, 1) is blocked by center wall, so not lit
    assert.strictEqual(illum.litCount[2][1], 0);
  });

  it('detects line-of-sight conflict when two lanterns see each other', () => {
    const engine = new AkariEngine(4, 4);

    engine.setCell(0, 0, 'lantern');
    engine.setCell(0, 3, 'lantern'); // Same row, unobstructed

    const illum = engine.calculateIllumination();
    assert.strictEqual(illum.conflicts.size, 2);
    assert.strictEqual(illum.conflicts.has('0,0'), true);
    assert.strictEqual(illum.conflicts.has('0,3'), true);
    assert.strictEqual(illum.isComplete, false);
  });

  it('validates numbered stone wall satisfaction and violation', () => {
    const engine = new AkariEngine(3, 3, [
      { r: 1, c: 1, count: 2 }
    ]);

    let illum = engine.calculateIllumination();
    let status = illum.wallStatuses.get('1,1');
    assert.strictEqual(status.satisfied, false);
    assert.strictEqual(status.current, 0);

    // Place 1 lantern
    engine.setCell(0, 1, 'lantern');
    illum = engine.calculateIllumination();
    status = illum.wallStatuses.get('1,1');
    assert.strictEqual(status.satisfied, false);
    assert.strictEqual(status.current, 1);

    // Place 2nd lantern (at 1, 0)
    engine.setCell(1, 0, 'lantern');
    illum = engine.calculateIllumination();
    status = illum.wallStatuses.get('1,1');
    assert.strictEqual(status.satisfied, true);
    assert.strictEqual(status.current, 2);

    // Place 3rd lantern (at 1, 2) -> exceeds count 2
    engine.setCell(1, 2, 'lantern');
    illum = engine.calculateIllumination();
    status = illum.wallStatuses.get('1,1');
    assert.strictEqual(status.satisfied, false);
    assert.strictEqual(status.violated, true);
  });

  it('solves a simple 3x3 Akari board via solver', () => {
    // 3x3 board with center wall having count 2
    // corners and center:
    // . L .
    // L W .
    // . . L
    const engine = new AkariEngine(3, 3, [
      { r: 1, c: 1, count: 2 }
    ]);

    const sol = engine.solve();
    assert.ok(sol, 'Solver should return a solution');

    // Apply solution to engine and verify completion
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (!engine.isWall(r, c)) {
          engine.setCell(r, c, sol[r][c]);
        }
      }
    }

    const illum = engine.calculateIllumination();
    assert.strictEqual(illum.isComplete, true);
    assert.strictEqual(illum.conflicts.size, 0);
    assert.strictEqual(illum.unlitCells, 0);
  });

  it('provides deductive hints for wall 0 and forced wall placements', () => {
    const engine = new AkariEngine(3, 3, [
      { r: 0, c: 0, count: 0 },
      { r: 2, c: 2, count: 2 }
    ]);

    // Hint on empty board should suggest dotting neighbors of 0
    let hint = engine.getHint();
    assert.strictEqual(hint.type, 'dot');
    assert.strictEqual(hint.action, 'dot');

    // Apply dots to neighbors of 0
    engine.setCell(0, 1, 'dot');
    engine.setCell(1, 0, 'dot');

    // Wall at (2, 2) is a corner wall requiring 2 lanterns, and it only has 2 neighbors!
    hint = engine.getHint();
    assert.strictEqual(hint.type, 'lantern');
    assert.strictEqual(hint.action, 'lantern');
  });

  it('verifies that all 50 handcrafted levels exist across 5 packs and are structurally valid', () => {
    const { AKARI_PACKS, AKARI_LEVELS } = require('../src/levels.js');
    assert.strictEqual(AKARI_PACKS.length, 5);
    assert.strictEqual(AKARI_LEVELS.length, 50);

    for (const lvl of AKARI_LEVELS) {
      assert.ok(lvl.id >= 1 && lvl.id <= 50);
      assert.ok(lvl.width >= 5 && lvl.width <= 9);
      assert.ok(lvl.height >= 5 && lvl.height <= 9);
      assert.ok(Array.isArray(lvl.walls));
      assert.ok(lvl.walls.length > 0);

      // Verify each wall is within bounds
      for (const w of lvl.walls) {
        assert.ok(w.r >= 0 && w.r < lvl.height);
        assert.ok(w.c >= 0 && w.c < lvl.width);
        if (w.count !== null && w.count !== undefined) {
          assert.ok(w.count >= 0 && w.count <= 4);
        }
      }

      // Initialize engine on level
      const eng = new AkariEngine(lvl.width, lvl.height, lvl.walls);
      assert.strictEqual(eng.width, lvl.width);
      assert.strictEqual(eng.height, lvl.height);
    }
  });
});
