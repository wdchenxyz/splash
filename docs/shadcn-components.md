# shadcn Components Reference

## Currently Registered (6)

These replace the old hand-built browser components:

| Component | Registration | Adapter? |
|---|---|---|
| Card | `shadcnComponents.Card` | No |
| Heading | `shadcnComponents.Heading` | No |
| Spinner | `shadcnComponents.Spinner` | No |
| Badge | `ShadcnBadge` | Yes — maps `label` to `text` |
| ProgressBar | `ShadcnProgress` | Yes — maps `progress` (0-1) to `value` (0-100) |
| Table | `ShadcnTable` | Yes — maps `{header,key}[]` columns + object rows to `string[]` + `string[][]` |

## Available but Not Registered (30)

To add any of these, register in `src/app/index.tsx`:

```ts
ComponentName: shadcnComponents.ComponentName,
```

If the prop names differ from what specs send, add an adapter in `src/app/components/shadcn-adapters.tsx`.

### Layout

| Component | Props | Notes |
|---|---|---|
| Stack | `direction`, `gap`, `align`, `justify` | Flex container, similar to Box |
| Grid | `columns` (1-6), `gap` | CSS grid layout |
| Separator | `orientation` | Simpler than current Divider (no title support) |

### Navigation

| Component | Props | Notes |
|---|---|---|
| Tabs | `defaultValue`, `value` | Tab navigation, children define tab panels |
| Accordion | `type` (single/multiple) | Collapsible sections |
| Collapsible | `defaultOpen` | Single expandable section |
| Pagination | `totalPages`, `page` | Page navigation |

### Overlay

| Component | Props | Notes |
|---|---|---|
| Dialog | `title`, `description`, `openPath` | Modal dialog |
| Drawer | `title`, `description`, `openPath` | Bottom sheet |
| Tooltip | `content` | Hover-activated tooltip |
| Popover | — | Click-triggered popover |
| DropdownMenu | `label`, `items` | Menu with items array |

### Content

| Component | Props | Notes |
|---|---|---|
| Text | `variant` (body/caption/muted/lead/code) | Different model than current Text (uses variants instead of bold/italic flags) |
| Image | `alt`, `width`, `height` | Image element |
| Avatar | `src`, `name`, `size` | User profile picture |
| Alert | `title`, `message`, `type` | Banner notification, similar to Callout |
| Carousel | — | Horizontal scrolling container |

### Feedback

| Component | Props | Notes |
|---|---|---|
| Skeleton | `width`, `height`, `rounded` | Loading placeholder |

### Input Controls

| Component | Props | Notes |
|---|---|---|
| Button | `label`, `variant`, `disabled` | Emits `press` event |
| Link | `label`, `href` | Anchor element |
| Input | `label`, `name`, `type`, `placeholder`, `value`, `checks` | Text field with validation |
| Textarea | `rows` | Multi-line input |
| Select | `options`, `value`, `checks` | Dropdown |
| Checkbox | `label`, `name`, `checked` | Toggle |
| Radio | `options`, `value` | Button group |
| Switch | `checked` | Toggle switch |
| Slider | `min`, `max`, `step` | Range input |
| Toggle | `pressed`, `variant` | Toggle button |
| ToggleGroup | `items`, `type`, `value` | Button group |
| ButtonGroup | `selected` | Multiple buttons |

## Notes

- All shadcn components require Tailwind CSS (loaded via Play CDN in `browser-server.ts`)
- shadcn CSS variables (dark theme) are defined in the HTML template's `<style>` block
- These are browser-only — the tmux renderer uses `@json-render/ink` components separately
- Input controls emit events (`change`, `submit`, `focus`, `blur`) which require action handling not currently implemented in the direct renderer
