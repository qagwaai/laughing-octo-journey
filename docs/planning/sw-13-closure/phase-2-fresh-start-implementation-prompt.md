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
- Ship 1 renders through its own component instance and canvas
- Ship 2 renders through a different component instance and canvas
- All visual properties (camera, meshes, state) are **completely isolated** per ship

### Design Questions (Answer Before Coding)
1. **Q: How do we test that two ships have different scenes?**  
   **A:** Screenshot Ship 1 (color X, position Y) → Switch → Screenshot Ship 2 (color Z, position W). Both should be visually distinct.

2. **Q: Where do THREE.js objects live?**  
  **A:** **Inside the per-ship component instance and its `ShipSceneContext`**, not in any shared host. Each ship instance owns its complete rendering state.

3. **Q: What happens on context switch?**  
  **A:** The UI switches between already-instantiated ship components. The newly shown ship component resumes its own scene/canvas pipeline, and the previously shown ship component is hidden and paused.

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
  canvas: HTMLCanvasElement;
  
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
  initializeRendering(): ShipSceneRenderingState { }
  
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
1. **Routing:** Receive one ship identity and display mode from parent/navigation state
2. **Context Lifecycle:** Own one `ShipSceneContext` for that ship instance
3. **Canvas Management:** Create and retain this ship instance's canvas and renderer
4. **Event Delegation:** Handle keyboard/mouse events for this ship instance only when visible
5. **Test API:** Expose test utilities for e2e

### Component Fields (Delete Old Global Scene Objects)
```typescript
export class ShipExteriorBareSceneComponent {
  // This component instance owns one ship scene. There is no shared host canvas.
  
  // Keep:
  readonly sceneCanvas = viewChild<ElementRef>('sceneCanvas');
  readonly showDebugOverlay = signal(false);
  
  // NEW:
  readonly context = new ShipSceneContext(contextKey, initialState);
  private renderingState: ShipSceneRenderingState | null = null;
  readonly isVisible = signal(false);
}
```

### Component Lifecycle

**ngOnInit:**
- Receive or resolve the ship identity for this component instance
- Construct one `ShipSceneContext` with data only (DO NOT initialize rendering yet)

**ngAfterViewInit:**
- Call `context.initializeRendering()`
- Store as `renderingState`
- Start animation loop for this component instance only when visible

**On Visibility Change (effect):**
```typescript
private readonly onVisibilityChange = effect(() => {
  const renderingState = this.renderingState;
  if (!renderingState) return;

  if (this.isVisible()) {
    this.context.resume();
    renderingState.renderer.render(renderingState.scene, renderingState.camera);
    return;
  }

  this.context.pause();
});
```

**Animation Loop:**
- Runs per component instance, but performs work only while that instance is visible and not paused
- Calls `renderingState.orbitControls.update()` if not paused
- Calls `renderingState.cube.rotation` update if not paused

**ngOnDestroy:**
- Dispose this component instance's rendering state
- Stop this component instance's animation loop

---

## Part 4: Implementation Checklist

### Phase 2a: Data Structure Redesign
- [ ] Add `ShipSceneRenderingState` interface
- [ ] Update `ShipSceneContext` with rendering methods
- [ ] Do NOT initialize rendering in constructor

### Phase 2b: Component Rewrite
- [ ] Remove any shared-host scene/camera/renderer/cube assumptions
- [ ] Add per-instance `renderingState` field
- [ ] Rewrite activation logic to visibility-driven pause/resume per component instance
- [ ] Rewrite animation loop to use per-instance `renderingState`
- [ ] Add rendering initialization on first component mount

### Phase 2c: Context Rendering Initialization
- [ ] Implement `ShipSceneContext.initializeRendering()`
- [ ] Create scene, camera, renderer, and canvas per component instance/context
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
- ✓ Click "View Exterior" on Ship 1 → Ship 1 component/canvas shows **blue cube**
- ✓ Set Ship 2 active, click "View Exterior" → Ship 2 component/canvas shows **different color cube**
- ✓ Debug overlay shows different ship ID on each switch
- ✓ Switch back to Ship 1 → Shows **blue cube again** in Ship 1's original component instance
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
3. **Instance Isolation:** Each ship component instance owns its THREE.js objects and canvas; there is no shared renderer host
4. **Animation Scope:** Only animate the active context's rendering state
5. **Disposal:** Clean up rendering objects on context dispose (prevent memory leaks)
6. **Test-Driven:** E2E must verify two ships show different scenes
7. **No Shortcuts:** Don't try to reuse a single scene, renderer, or canvas across ships (defeats architecture)

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
