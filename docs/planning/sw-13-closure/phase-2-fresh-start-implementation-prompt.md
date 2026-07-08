# Phase 2 Fresh Start Implementation Prompt
## SW-13: Ship Exterior Bare Scene Component (Greenfield Rebuild)

**Date:** 2026-06-30  
**Status:** Architecture Reset — Starting Fresh  
**GATE Target:** GATE 3 (Visual Verification: Distinct Scenes Per Ship)

---

## Part 1: Architecture Design (DO NOT SKIP THIS)

### Core Requirement
**Each player-character's ship must render in its own isolated THREE.js scene.**

When a player switches ships:
- Scene A (Ship 1) is removed from renderer
- Scene B (Ship 2) is rendered to the same canvas
- All visual properties (camera, meshes, state) are **completely isolated** per ship

### Design Questions (Answer Before Coding)
1. **Q: How do we test that two ships have different scenes?**  
   **A:** Screenshot Ship 1 (color X, position Y) → Switch → Screenshot Ship 2 (color Z, position W). Both should be visually distinct.

2. **Q: Where do THREE.js objects live?**  
   **A:** **Inside `ShipSceneContext`**, not in the component. Each context owns its complete rendering state.

3. **Q: What happens on context switch?**  
   **A:** Component gets active context → renders its scene to canvas. Old scene is detached, new scene is attached.

4. **Q: How does pause state survive a switch?**  
   **A:** Each context tracks its own `isPaused` signal. Switch to Ship 1 (paused) → switch to Ship 2 (not paused) → switch back to Ship 1 (still paused).

---

## Part 2: Data Structure Design

### ShipSceneContextState (Data Layer — stays as is)
```typescript
export interface ShipSceneContextState {
  playerName: string;
  characterId: string;
  shipId: string;
  camera?: ShipSceneCameraState;
  world?: ShipSceneWorldState;
}
```

### NEW: ShipSceneRenderingState (Rendering Layer — ADD THIS)
```typescript
export interface ShipSceneRenderingState {
  // THREE.js object ownership
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  // Mesh/Geometry/Material
  cube: THREE.Mesh;
  
  // Camera controls
  orbitControls: OrbitCameraControls;
  
  // Local signals (per-ship)
  isPausedLocal: Signal<boolean>;
  cubeColorLocal: Signal<number>;
  
  // Animation
  animationFrameId: number | null;
}
```

### Updated ShipSceneContext
```typescript
export class ShipSceneContext {
  private state: ShipSceneContextState;
  private renderingState: ShipSceneRenderingState | null = null;
  
  // Constructor initializes data, NOT rendering
  constructor(contextKey: string, initialState: ShipSceneContextState) { }
  
  // NEW: Initialize rendering for this context
  initializeRendering(canvas: HTMLCanvasElement): ShipSceneRenderingState { }
  
  // NEW: Get rendering state
  getRenderingState(): ShipSceneRenderingState | null { }
  
  // NEW: Dispose rendering (cleanup on logout)
  disposeRendering(): void { }
  
  // Existing methods
  getState(): ShipSceneContextState { }
  setState(update: Partial<ShipSceneContextState>): void { }
  pause(): void { }
  resume(): void { }
}
```

---

## Part 3: Component Architecture

### Component Responsibilities (ONLY These)
1. **Routing:** Subscribe to active ship ID from navigation/registry
2. **Context Lifecycle:** Request rendering state from active context
3. **Canvas Management:** Attach/detach scenes to canvas on switch
4. **Event Delegation:** Pass keyboard/mouse events to active context
5. **Test API:** Expose test utilities for e2e

### Component Fields (Delete Old Global Scene Objects)
```typescript
export class ShipExteriorBareSceneComponent {
  // Remove: private scene, camera, renderer, cube, animationFrameId, cameraControls
  
  // Keep:
  readonly sceneCanvas = viewChild<ElementRef>('sceneCanvas');
  readonly registry = new ShipSceneRegistry();
  readonly activeContextKey = signal<string | null>(null);
  readonly showDebugOverlay = signal(false);
  
  // NEW:
  private activeRenderingState: ShipSceneRenderingState | null = null;
}
```

### Component Lifecycle

**ngOnInit:**
- Request ship list via socket
- Create contexts with data (DO NOT initialize rendering yet)
- Activate first ship

**ngAfterViewInit:**
- Get canvas reference
- Call `activeContext.initializeRendering(canvas)`
- Store as `activeRenderingState`
- Start animation loop for active context

**On Context Switch (effect):**
```typescript
private readonly onActiveContextChange = effect(() => {
  const activeKey = this.activeContextKey();
  if (!activeKey) return;
  
  const activeContext = this.registry.getActiveContext();
  if (!activeContext) return;
  
  const canvas = this.sceneCanvas()?.nativeElement;
  if (!canvas) return;
  
  // Get or initialize rendering for this context
  let renderingState = activeContext.getRenderingState();
  if (!renderingState) {
    renderingState = activeContext.initializeRendering(canvas);
  }
  
  // Swap rendering state
  this.activeRenderingState = renderingState;
  
  // Re-attach scene to renderer (canvas already set during init)
  this.renderer?.render(renderingState.scene, renderingState.camera);
});
```

**Animation Loop:**
- Only runs for active context's rendering state
- Calls `activeRenderingState.orbitControls.update()` if not paused
- Calls `activeRenderingState.cube.rotation` update if not paused

**ngOnDestroy:**
- Dispose all contexts' rendering states
- Stop animation loop

---

## Part 4: Implementation Checklist

### Phase 2a: Data Structure Redesign
- [ ] Add `ShipSceneRenderingState` interface
- [ ] Update `ShipSceneContext` with rendering methods
- [ ] Do NOT initialize rendering in constructor

### Phase 2b: Component Rewrite
- [ ] Remove component's global scene/camera/renderer/cube fields
- [ ] Add `activeRenderingState` field
- [ ] Rewrite `initializeScene()` → `onContextSwitch()` effect
- [ ] Rewrite animation loop to use `activeRenderingState`
- [ ] Add rendering initialization on first context activation

### Phase 2c: Context Rendering Initialization
- [ ] Implement `ShipSceneContext.initializeRendering(canvas)`
- [ ] Create scene, camera, renderer per context
- [ ] Create cube with deterministic color per shipId
- [ ] Create OrbitCameraControls for this context
- [ ] Store all objects in `ShipSceneRenderingState`

### Phase 2d: Multi-Ship Testing
- [ ] E2E: Switch Ship 1 → verify color X and position Y
- [ ] E2E: Switch Ship 2 → verify color Z and position W
- [ ] E2E: Switch back to Ship 1 → verify original state preserved
- [ ] E2E: Pause Ship 1 → switch Ship 2 → switch back Ship 1 → verify pause state

### Phase 2e: Disposal & Cleanup
- [ ] Implement `ShipSceneContext.disposeRendering()`
- [ ] Clean up geometries, materials, renderer
- [ ] Remove event listeners per context
- [ ] Handle logout (dispose all contexts)

---

## Part 5: Visual Verification (GATE 3)

**Success Criteria:**
- ✓ Player has 2 ships
- ✓ Click "View Exterior" on Ship 1 → Canvas shows **blue cube**
- ✓ Set Ship 2 active, click "View Exterior" → Canvas shows **different color cube**
- ✓ Debug overlay shows different ship ID on each switch
- ✓ Switch back to Ship 1 → Shows **blue cube again**
- ✓ Pause on Ship 1 → Switch to Ship 2 (not paused) → Switch back Ship 1 (still paused)

**What to Screenshot:**
1. `ship-1-initial.png` — Ship 1 exterior, blue cube
2. `ship-2-active.png` — Ship 2 exterior, different color cube
3. `ship-1-return.png` — Back to Ship 1, blue cube visible again

---

## Part 6: Code Organization (Reuse These)

**Keep from Previous Attempt:**
- `src/app/scene/ship-exterior/orbit-camera-controls.ts` ✓
- `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.html` ✓
- `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.css` ✓
- `src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api.ts` ✓
- E2E test structure (adapt for new requirements)

**Rebuild:**
- `src/app/scene/ship-exterior/ship-scene-context.ts` (add rendering ownership)
- `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts` (complete rewrite)

---

## Part 7: Testing Strategy

### Unit Tests (vitest)
- [ ] `ShipSceneContext.initializeRendering()` creates distinct scenes
- [ ] `ShipSceneContext.getRenderingState()` returns correct state
- [ ] Context pause state persists across switches

### E2E Tests (Playwright)
- [ ] Phase 2 Visual (A→B→A): Different cube colors per ship
- [ ] Phase 3 Rendering: Canvas renders with WebGL context
- [ ] Multi-ship Interaction: Pause, switch, resume cycle

---

## Part 8: CRITICAL REMINDERS

1. **Design First:** Do not code until you can answer all questions in Part 1
2. **Read Memory:** Check `/memories/repo/ship-exterior-view-architecture.md` before starting
3. **Context Isolation:** Each context owns its THREE.js objects, NOT the component
4. **Animation Scope:** Only animate the active context's rendering state
5. **Disposal:** Clean up rendering objects on context dispose (prevent memory leaks)
6. **Test-Driven:** E2E must verify two ships show different scenes
7. **No Shortcuts:** Don't try to reuse single scene across ships (defeats architecture)

---

## Part 9: Expected Timeline

- **Design review:** 15 min (questions in Part 1)
- **Data structure refactor:** 30 min
- **Component rewrite:** 60 min
- **Rendering initialization:** 45 min
- **Testing & validation:** 30 min
- **Total:** ~3 hours

---

## Success Definition

**GATE 3 PASS = Two distinct scenes per ship, verified visually and e2e.**

Not: "Two different colors on the same scene"  
Yes: "Two completely separate THREE.js scenes, each with own rendering pipeline"
