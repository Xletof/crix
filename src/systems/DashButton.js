import Phaser from 'phaser';

export class DashButton {
  constructor(scene, opts) {
    this.scene = scene;
    this.x = opts.x;
    this.y = opts.y;
    this.radius = opts.radius || 42;
    this.onPress = opts.onPress || (() => {});
    this.isReady = opts.isReady || (() => true);

    this.image = scene.add.image(this.x, this.y, 'dash-btn').setDepth(40);
    this.gauge = scene.add.graphics().setDepth(41);

    this.pointerId = null;

    scene.input.on('pointerdown', this.handleDown, this);
    scene.input.on('pointerup', this.handleUp, this);
  }

  containsPoint(x, y) {
    return Math.hypot(x - this.x, y - this.y) <= this.radius;
  }

  handleDown(pointer) {
    if (this.pointerId !== null) return;
    if (!this.containsPoint(pointer.x, pointer.y)) return;
    if (!this.isReady()) return;
    this.pointerId = pointer.id;
    this.image.setScale(1.1);
    this.onPress();
  }

  handleUp(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.pointerId = null;
    this.image.setScale(1);
  }

  drawGauge(charges, maxCharges, rechargeRatio) {
    this.gauge.clear();
    this.image.setTexture(charges > 0 ? 'dash-btn' : 'dash-btn-off');
    
    // Draw charge segments around the rim
    const gap = 0.15;
    const segmentAngle = (Math.PI * 2) / maxCharges - gap;
    
    for (let i = 0; i < maxCharges; i++) {
      const startAngle = -Math.PI / 2 + i * ((Math.PI * 2) / maxCharges);
      const endAngle = startAngle + segmentAngle;
      
      const isCharged = i < charges;
      const color = isCharged ? 0x40ffc8 : 0x304555;
      
      this.gauge.lineStyle(5, color, 1);
      this.gauge.beginPath();
      this.gauge.arc(this.x, this.y, this.radius - 3, startAngle, endAngle, false);
      this.gauge.strokePath();
    }

    // Draw loading gauge on the active recharging segment
    if (charges < maxCharges) {
      const startAngle = -Math.PI / 2 + charges * ((Math.PI * 2) / maxCharges);
      const progressAngle = startAngle + segmentAngle * rechargeRatio;
      
      this.gauge.lineStyle(5, 0xffffff, 0.85);
      this.gauge.beginPath();
      this.gauge.arc(this.x, this.y, this.radius - 3, startAngle, progressAngle, false);
      this.gauge.strokePath();
    }
  }

  shutdown() {
    this.scene.input.off('pointerdown', this.handleDown, this);
    this.scene.input.off('pointerup', this.handleUp, this);
    this.image.destroy();
    this.gauge.destroy();
  }
}
