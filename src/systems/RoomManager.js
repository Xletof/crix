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
    this.index = ROOMS.indexOf(spec);
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
