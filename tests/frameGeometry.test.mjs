import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameGeometry, stackCanvas, stackReferenceIndex } from '../src/lib/frameGeometry.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test('square borders use each end of the long image side, with no crop or stretch', () => {
  const landscape = frameGeometry(1200, 800, 5, 'width', 'square');
  assert.deepEqual(landscape, { width: 1320, height: 1320, x: 60, y: 260, imageWidth: 1200, imageHeight: 800 });
  const portrait = frameGeometry(800, 1200, 5, 'width', 'square');
  assert.deepEqual(portrait, { width: 1320, height: 1320, x: 260, y: 60, imageWidth: 800, imageHeight: 1200 });
});

test('zero border still pads a fixed canvas, while original remains unchanged', () => {
  assert.deepEqual(frameGeometry(1200, 800, 0, 'width', 'square'), {
    width: 1200, height: 1200, x: 0, y: 200, imageWidth: 1200, imageHeight: 800
  });
  assert.deepEqual(frameGeometry(800, 1200, 5, 'width', 'original'), {
    width: 880, height: 1280, x: 40, y: 40, imageWidth: 800, imageHeight: 1200
  });
  assert.equal(frameGeometry(800, 1200, 5, 'height', 'original').x, 60);
  assert.equal(frameGeometry(1200, 800, 5, 'overall', 'original').x, 40);
});

test('stack follows the tallest portrait even when it is added after landscapes', () => {
  const sizes = [{ width: 1200, height: 800 }, { width: 800, height: 1000 }, { width: 800, height: 1200 }];
  assert.equal(stackReferenceIndex(sizes.slice(0, 1)), 0);
  assert.equal(stackReferenceIndex(sizes), 2);
  assert.equal(stackReferenceIndex(sizes.slice(0, 2)), 1);
  assert.equal(stackReferenceIndex([]), -1);
});

test('mixed stack exports share dimensions and center intact photos with landscape letterboxing', () => {
  const sizes = [{ width: 1200, height: 800, percent: 5 }, { width: 800, height: 1200, percent: 5 }];
  const canvas = stackCanvas(sizes, 2 / 3);
  assert.deepEqual(canvas, { width: 880, height: 1320 });
  const landscape = frameGeometry(1200, 800, 5, 'width', 'stack', canvas);
  const portrait = frameGeometry(800, 1200, 5, 'width', 'stack', canvas);
  for (const g of [landscape, portrait]) {
    assert.equal(g.width, 880);
    assert.equal(g.height, 1320);
    close(g.x * 2 + g.imageWidth, g.width);
    close(g.y * 2 + g.imageHeight, g.height);
  }
  assert.ok(landscape.y > landscape.x * 5);
  close(landscape.imageWidth / landscape.imageHeight, 1.5);
  close(portrait.imageWidth / portrait.imageHeight, 2 / 3);
});

test('different resolutions and per-photo percentages retain common canvas and minimum border', () => {
  const sizes = [{ width: 4032, height: 3024, percent: 0 }, { width: 600, height: 900, percent: 30 }];
  const canvas = stackCanvas(sizes, 2 / 3);
  for (const photo of sizes) {
    const g = frameGeometry(photo.width, photo.height, photo.percent, 'overall', 'stack', canvas);
    assert.equal(g.width, canvas.width);
    assert.equal(g.height, canvas.height);
    assert.ok(g.x >= 0 && g.y >= 0);
    close(g.imageWidth / g.imageHeight, photo.width / photo.height);
    const minimumBorder = Math.max(g.imageWidth, g.imageHeight) * photo.percent / 100;
    assert.ok(g.x + 0.000001 >= minimumBorder && g.y + 0.000001 >= minimumBorder);
  }
});
