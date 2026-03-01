# splash

Minimal terminal TUI that renders a local image using Chafa.

## Requirements

- Go 1.24+
- `chafa` available in `PATH`

## Run

```bash
go mod tidy
go run . --image /path/to/image1.jpg --image /path/to/image2.jpg --image /path/to/image3.jpg --box-cols 60 --box-rows 20
```

Flags:

- `--image`: image path (required, repeatable)
  - Repeatable: `--image a.png --image b.png --image c.png`
  - Comma-separated also works: `--image a.png,b.png,c.png`

Fixed box options:

- `--box-cols`: fixed image box width in terminal cells (default `60`)
- `--box-rows`: fixed image box height in terminal cells (default `20`)
- The image render target stays fixed even when the terminal is resized.
- Layout is fixed to `3` boxes per row.

## Controls

- `r`: reload all images
- `q` or `Ctrl+C`: quit
