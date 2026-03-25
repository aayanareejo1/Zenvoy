export class PerformanceMonitor {
  static marks = {};

  static startMark(name) {
    this.marks[name] = Date.now();
  }

  static endMark(name, threshold = 1000) {
    const duration = Date.now() - this.marks[name];
    if (duration > threshold) {
      console.warn(`⚠️ ${name} took ${duration}ms (threshold: ${threshold}ms)`);
    } else {
      console.log(`✓ ${name} took ${duration}ms`);
    }
    delete this.marks[name];
  }
}
