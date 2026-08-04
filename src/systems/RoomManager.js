import { ROOMS } from '../data/rooms.js';

// Tracks the current room index and alive-enemy count. GameScene calls
// registerEnemy() for each spawned enemy and onEnemyDied() on death.
// When aliveEnemies hits 0 the room is "cleared" and we emit 'room-cleared'.
//
// Events emitted on the scene:
//   'room-start'   (index1Based, total, roomSpec)
//   'room-cleared' (roomSpec)

export class RoomManager {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.aliveEnemies = 0;
    this.cleared = false;
  }

  get total()   { return ROOMS.length; }
  get current() { return ROOMS[this.index]; }
  get isLast()  { return this.index >= ROOMS.length - 1; }

  // Called by GameScene.loadRoom() once per room load
  setRoom(spec) {
    // Matched by id, not by object identity. `indexOf` needs the caller to hand
    // back the very same object this module imported, which is one assumption
    // more than it needs: anything that passes a copy of a spec — a modifier
    // that tweaks a room, a test, or the dev server serving two instances of
    // rooms.js after an edit — gets index -1 and silently loses room tracking,
    // taking the HUD's "CHAMBER n/4" and the end-of-room routing with it.
    this.index = ROOMS.findIndex((r) => r.id === spec.id);
    this.aliveEnemies = 0;
    this.cleared = false;
  }

  registerEnemy() {
    this.aliveEnemies += 1;
  }

  onEnemyDied() {
    this.aliveEnemies = Math.max(0, this.aliveEnemies - 1);
    if (this.aliveEnemies === 0 && !this.cleared) {
      this.cleared = true;
      this.scene.events.emit('room-cleared', this.current);
    }
  }
}
