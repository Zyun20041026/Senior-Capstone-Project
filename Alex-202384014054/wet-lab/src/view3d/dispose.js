// Alex 202384014054
// Free the GPU side of a subtree that will not be shown again: geometries,
// materials and their textures, except the shared ones from mats.js once().
// A disposed three.js object is re-uploaded if it is ever drawn again, so a
// mistake here costs an upload, never a broken frame.
import { isShared } from './mats.js';

export function disposeTree(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.isLight) o.dispose(); // frees a shadow-casting light's shadow map
    if (o.geometry && !isShared(o.geometry)) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (isShared(m)) continue;
      for (const v of Object.values(m)) if (v && v.isTexture && !isShared(v)) v.dispose();
      m.dispose();
    }
  });
}
