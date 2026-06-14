# Coding Conventions & AI Guidance

## Component Patterns

### Standalone Components

All components are standalone (no NgModules). Use this pattern:

```typescript
@Component({
  selector: 'app-my-component',
  templateUrl: './my-component.html',
  styleUrls: ['./my-component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ /* other standalone components, directives */ ],
})
export class MyComponent {
  private service = inject(MyService);
  
  // Signals for state
  protected data = signal<Data | null>(null);
  protected derived = computed(() => /* ... */);
}
```

### Key Conventions

1. **OnPush Change Detection** - All components use `ChangeDetectionStrategy.OnPush`
2. **Signal-based State** - Prefer `signal()`, `computed()`, `effect()` over `@Input()` setters or `ngOnChanges`
3. **`inject()` over Constructor DI** - Use `inject()` for service injection in standalone components
4. **`protected` for template-exposed properties** - Properties accessed in templates use `protected` visibility
5. **`private` for internal services** - Service references are `private`

## File Naming

| Type | Pattern | Example |
| --- | --- | --- |
| Component | `kebab-case.ts` | `guarded-left-menu.ts` |
| Service | `*.service.ts` | `session.service.ts` |
| Model/Type | `*.ts` or `*.locale.ts` | `mission.locale.ts` |
| Vitest test | `*.vitest.ts` | `market-hub.vitest.ts` |
| E2E test | `*.spec.ts` | `market-hub-by-location.spec.ts` |
| Template | `kebab-case.html` | `guarded-left-menu.html` |
| Styles | `kebab-case.css` | `guarded-left-menu.css` |

## i18n Conventions

- Locale files: `src/app/i18n/locales/en.ts` (base), `it.ts` (override)
- Access via `locale` proxy: `locale.menu.label.save`
- When changing UI text driven by i18n, update **both** `en.ts` and `it.ts`
- English is the base locale; other locales merge on top via `mergeLocale()`

## Socket Event Naming

- Requests: `{noun}Request` → `shipListRequest`
- Responses: `{noun}Response` → `shipListResponse`
- Event names use camelCase
- Payload types match event names in `src/app/model/`

## Directory Structure Conventions

```
src/app/
  component/    # Reusable components (both 3D nodes and UI)
  guards/       # Route guards
  i18n/         # Localization
  mission/      # Mission definitions, gate logic
  model/        # TypeScript interfaces/types
  page/         # Route-level page components
  scene/        # 3D scene root components
  services/     # Injectable services
```

## AI-Specific Guidance (from AGENTS.md)

### Multi-Replace Edit Safety

When using batched multi-replace tools:
- Per-item failures are NOT transactional — other items may have applied
- Do NOT blindly retry the whole batch (causes duplicate edits)
- Grep for the new symbol to confirm what landed
- Retry only items that did not apply
- Validate with `npm run build` — duplicate-member errors only show at `ngc` build time

### Line Ending Awareness

- Workspace uses CRLF on Windows
- Long multi-line SEARCH anchors can fail due to `\r` mismatch
- Shrink SEARCH anchors to smallest unique snippet if replacement fails

### Template Error Detection

- `tsc --noEmit` does NOT catch Angular template errors
- Use `npm run build 2>&1 | grep -E "error TS|Error"` to validate templates
- Angular Language Service can lag behind edits — trust `npm run build` over LSP errors

### Validation Checklist After Edits

1. Run focused impacted tests (fast feedback)
2. `npm run test:ci` for broader regression confidence  
3. Relevant Playwright specs for user-flow changes
4. `npm run build` after editing templates or types used in templates

## What NOT to Do

- Do NOT add Jest configs or Jest APIs
- Do NOT use RxJS where signals suffice
- Do NOT guess socket contracts — check OpenAPI first
- Do NOT make broad refactors — prefer minimal, targeted edits
- Do NOT remove `CUSTOM_ELEMENTS_SCHEMA` — required for Three.js elements