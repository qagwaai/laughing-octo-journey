---
name: prepare-web-3d-assets
description: Inspect, refine, optimize, and validate GLB/glTF assets for this Angular Three application using Blender, glTF Transform, and KTX-Software. Use for generated model imports, web-ready quality tiers, texture or geometry compression, and asset performance investigations.
---

# Prepare web 3D assets

## Scope and safeguards

- Distinguish inspection/planning from permission to process assets or change application code. Ask about unresolved visual, device, storage, or performance decisions using selectable questions with free-text input, one question at a time.
- Inspect the worktree first. Preserve user renames and source files; write derivatives to distinct paths. Never overwrite originals or a user's existing derivative.
- Process locally. Do not upload models/textures to online optimizers or enable remote resource fetching without approval.
- Inspect existing loaders and dependencies before adding tooling. Do not reinstall available tools. Add dependencies only when needed and authorized; use pinned development tooling when adopting a reproducible project pipeline.
- Keep machine-specific installation paths in local configuration, not in this skill. Resolve executables from PATH, explicit user-provided paths, or environment overrides.
- Keep intermediate files in session storage or an approved non-deployed working directory. Delete only intermediates created by this task.

## 1. Discover tools and define budgets

Use PowerShell on Windows. Check installed versions and command help before selecting flags:

```powershell
Get-Command blender, gltf-transform, toktx, ktx -ErrorAction SilentlyContinue
gltf-transform --version
gltf-transform help resize
gltf-transform help meshopt
gltf-transform help etc1s
gltf-transform help validate
```

Optional local conventions: `BLENDER_EXE` is a full executable path; `KTX_BIN` is the directory containing KTX executables. If an executable is absent from PATH, check the user's supplied location before declaring it missing. For example:

```powershell
if ($env:BLENDER_EXE) {
  & $env:BLENDER_EXE --version
}
if ($env:KTX_BIN) {
  $env:PATH = "$env:KTX_BIN;$env:PATH"
  toktx --version
}
```

Environment changes apply only to that shell process. Set KTX's PATH in the same command session that performs texture encoding. Do not change system-wide PATH.

Roles:

- **Blender:** rendered comparison, geometry/UV/material refinement, normal baking, and poster rendering.
- **glTF Transform CLI:** inspection, resizing, cleanup, geometry compression, texture encoding orchestration, and glTF validation. Its `validate` command avoids a separate validator installation initially.
- **KTX-Software:** local KTX2/Basis encoding; check compatibility with the selected CLI version.
- **Actual application/browser:** decoder compatibility, appearance, responsiveness, and performance. A Blender render alone is not runtime validation.

Before processing, define target devices, viewport/panel size, triangle and draw-call budgets, transfer budget, texture dimensions, memory budget, and loading/fallback behavior. Scene-specific targets belong in the task's approved plan, not global defaults.

## 2. Inspect sources before choosing transformations

Run `gltf-transform inspect` and `gltf-transform validate` against the selected source. Capture validation output and explicitly resolve or report errors and warnings. Unsupported extension warnings are not proof that compressed content is valid.

Record:

- File bytes and SHA-256 (`Get-FileHash -Algorithm SHA256`).
- Scenes, nodes, transforms, bounds, primitives, materials, skins, and animations.
- Actual triangle count, vertex/index counts and types, and geometry bytes.
- Texture dimensions, format, embedded bytes, assigned material slots, and color-space semantics.
- Compression extensions used/required, external dependencies, normal/emissive maps, and double-sided materials.

Use a read-only GLB parser if the CLI report does not expose required measurements. Header/buffer checks alone are not full validation; label that limitation.

Separate bottlenecks:

- **Geometry-heavy:** consider suitable existing remeshes, simplification, welding where valid, quantization, and one geometry codec.
- **Texture-heavy:** resize and encode textures; further polygon reduction may barely change transfer size.
- **Draw-call-heavy:** consider material reuse and instancing where appropriate, without destroying independently animated or interactive parts.
- **GPU-heavy:** examine decoded buffers, texture allocation, pixel ratio, shadows, overdraw, and postprocessing, not only download size.

For an RGBA8 texture, estimate base allocation as `width * height * 4`; a full mip chain adds approximately one third. Label this an estimate: compressed formats, device support, and renderer allocation differ. `renderer.info.memory` reports counts, not GPU bytes.

## 3. Visually establish the baseline

Open the selected source/remesh in Blender when appearance or geometry needs review. Compare variants using the same camera, framing, lights, and material setup at the intended display size.

- Check silhouette, thin cranes/railings, cavities, seams, normals, material channels, and back-face requirements.
- Verify actual node separation before proposing machinery animation. A single mesh may contain many disconnected surfaces but does not expose independent parts automatically.
- If UVs/topology changed, rebake detail as needed. Never attach an original normal map to remeshed UVs merely because the filenames match.
- Missing emissive maps mean painted orange/white areas do not automatically glow.
- Do not regenerate a design if an existing remesh meets the geometry budget and only texture/encoding work remains.

## 4. Create derivatives with explicit steps

Prefer an inspectable sequence over blindly running all default optimizations. Recheck help for installed versions. Select **Meshopt or Draco**, not both for the same geometry. Compression alone does not reduce triangle count; inspect quantization's visual effects.

Example geometry/texture-size experiment below assumes approved source and output locations, an existing scratch directory, and nonexistent output files. Replace the illustrative paths before execution. Stop immediately on each failed command:

```powershell
gltf-transform resize '.\source\rig.glb' '.\scratch\rig-2k.glb' --width 2048 --height 2048
if ($LASTEXITCODE -ne 0) { throw 'Texture resizing failed.' }

gltf-transform meshopt '.\scratch\rig-2k.glb' '.\scratch\rig-meshopt.glb'
if ($LASTEXITCODE -ne 0) { throw 'Geometry compression failed.' }

gltf-transform validate '.\scratch\rig-meshopt.glb'
if ($LASTEXITCODE -ne 0) { throw 'Derivative validation failed.' }
```

Then evaluate KTX2 encoding, with the KTX executable directory available in that same process:

- ETC1S is a size-oriented starting point for suitable color textures.
- UASTC is a higher-quality candidate for normal maps and other artifact-sensitive data.
- Inspect metallic/roughness maps for compression artifacts rather than assuming every non-normal map tolerates ETC1S.
- Preserve sRGB for base color/emissive and linear semantics for normal/metallic/roughness/occlusion.
- Use installed command help to select texture slots/patterns and quality settings. Do not indiscriminately recompress all maps with one setting.
- JPEG/WebP reduce transfer size but generally decode to uncompressed GPU textures. KTX2/Basis can reduce GPU allocation, depending on the runtime transcode target.

Reinspect and validate every final variant. Compare actual renders before accepting a smaller file. Record source/output hashes, exact commands, tool versions, sizes, and visual trade-offs in the approved asset documentation. Keep reusable pipeline scripts only when the task warrants them.

## 5. Integrate with the repository safely

Consult these existing surfaces before implementation:

- [Route definitions](../../../src/app/routed.routes.ts) and [shared canvas host](../../../src/app/app.component.html).
- [Scene visibility policy](../../../src/app/services/scene-visibility.service.ts).
- [Existing GLTFLoader usage](../../../src/app/scene/ship-exterior/ship-scene-context.ts).
- [Build asset configuration](../../../angular.json).
- [Testing policy](../../../docs/testing-policy.md).

Integration requirements:

- Configure the selected Meshopt/Draco decoder and `KTX2Loader` as needed; detect renderer support for KTX2. Merely having codec packages installed does not wire the loader.
- Self-host required decoder/transcoder JS/WASM, verify deployed URLs/CSP, and include those bytes and startup costs in the loading budget.
- Respect the existing shared canvas and renderer ownership. Do not create a nested canvas for a scene or change global camera/DPR/exposure without scoped restoration.
- Load only the selected quality tier, not all variants. Keep navigation usable while loading; expose failures through repository-standard logging and localized status rather than silent fallback.
- Define resource/cache ownership. Guard late async completions after navigation, release owned resources/listeners, and avoid disposing shared assets still in use.
- Respect reduced motion, document visibility, and scene occlusion. Demand rendering is ineffective if hidden animation continuously invalidates frames.
- Inspect production output: files in `public` may be copied even when never requested. Exclude non-runtime originals/intermediates through an approved storage/build decision.
- Do not commit files over GitHub's ordinary 100 MiB limit as regular Git blobs. Obtain approval for source relocation, LFS, or alternative storage; do not silently remove assets.

## 6. Verify and report

Acceptance requires both appearance and measured performance:

1. Final GLB validation, correct material slots, and intended decoder extensions.
2. Real optimized-asset rendering in the application, including texture/decoder requests.
3. Cold-cache transfer/loading measurements with recorded network conditions.
4. Frame intervals, draw calls, triangles, and estimated resource bytes on documented hardware, viewport, panel split, and DPR.
5. Loading failures, static fallback, reduced motion, resizing, and route re-entry.
6. Repeated mount/unmount without monotonically growing owned resources or listeners.
7. Production artifact inspection confirming source/intermediate exclusion.

For code changes, run focused Vitest tests and relevant deterministic Playwright flows. After template or template-bound type changes, also run `npm run build`. Use explicit readiness assertions; use Playwright Clock `fastForward()` for timer-driven flows rather than processing every animation frame. Keep hardware performance measurements separate from variable-speed CI correctness tests.

Conclude with an input/output comparison, commands/tool versions, validation performed, unresolved limitations, and recommended runtime variant. Do not report structural inspection as visual validation, or proposed budgets as achieved performance.
