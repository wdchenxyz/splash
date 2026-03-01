package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/term"
)

const (
	defaultBoxCols  = 60
	defaultBoxRows  = 20
	minimumBoxSize  = 2
	renderTimeout   = 10 * time.Second
	exitCodeFailure = 1
	enterAltScreen  = "\x1b[?1049h"
	leaveAltScreen  = "\x1b[?1049l"
	yellowFG        = "\x1b[33m"
	resetStyle      = "\x1b[0m"
)

type config struct {
	imagePaths []string
	boxCols    int
	boxRows    int
}

type stringListFlag []string

func (f *stringListFlag) String() string {
	return strings.Join(*f, ",")
}

func (f *stringListFlag) Set(value string) error {
	for _, p := range strings.Split(value, ",") {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			*f = append(*f, trimmed)
		}
	}
	return nil
}

var imageExtensions = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
	".bmp": true, ".webp": true, ".tiff": true, ".tif": true,
	".svg": true, ".ico": true, ".avif": true,
}

func isImageFile(name string) bool {
	return imageExtensions[strings.ToLower(filepath.Ext(name))]
}

func collectImagesFromDir(dir string) ([]string, error) {
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("resolve dir %q: %w", dir, err)
	}
	info, err := os.Stat(absDir)
	if err != nil {
		return nil, fmt.Errorf("invalid dir %q: %w", absDir, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%q is not a directory", absDir)
	}

	entries, err := os.ReadDir(absDir)
	if err != nil {
		return nil, fmt.Errorf("read dir %q: %w", absDir, err)
	}

	var paths []string
	for _, e := range entries {
		if e.IsDir() || !isImageFile(e.Name()) {
			continue
		}
		paths = append(paths, filepath.Join(absDir, e.Name()))
	}
	return paths, nil
}

func parseConfig() (config, error) {
	var imagePaths stringListFlag
	var imageDirs stringListFlag
	flag.Var(&imagePaths, "image", "image path (repeat flag or pass comma-separated list)")
	flag.Var(&imageDirs, "image-dir", "directory of images (repeat flag or pass comma-separated list)")
	boxCols := flag.Int("box-cols", defaultBoxCols, "fixed image box width in terminal cells")
	boxRows := flag.Int("box-rows", defaultBoxRows, "fixed image box height in terminal cells")
	flag.Parse()

	// Collect images from --image-dir flags
	for _, dir := range imageDirs {
		dirImages, err := collectImagesFromDir(dir)
		if err != nil {
			return config{}, err
		}
		if len(dirImages) == 0 {
			return config{}, fmt.Errorf("no image files found in %q", dir)
		}
		imagePaths = append(imagePaths, dirImages...)
	}

	if len(imagePaths) == 0 {
		return config{}, errors.New("missing required flag --image or --image-dir")
	}
	if *boxCols < minimumBoxSize || *boxRows < minimumBoxSize {
		return config{}, fmt.Errorf("invalid box size: --box-cols and --box-rows must be >= %d", minimumBoxSize)
	}

	absPaths := make([]string, 0, len(imagePaths))
	for _, p := range imagePaths {
		absPath, err := filepath.Abs(p)
		if err != nil {
			return config{}, fmt.Errorf("resolve image path %q: %w", p, err)
		}
		if _, err := os.Stat(absPath); err != nil {
			return config{}, fmt.Errorf("invalid image path %q: %w", absPath, err)
		}
		absPaths = append(absPaths, absPath)
	}

	return config{imagePaths: absPaths, boxCols: *boxCols, boxRows: *boxRows}, nil
}

func ensureChafaAvailable() error {
	if _, err := exec.LookPath("chafa"); err != nil {
		return errors.New("chafa is not installed or not in PATH")
	}
	return nil
}

func renderWithChafa(path string, cols, rows int) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), renderTimeout)
	defer cancel()

	size := fmt.Sprintf("%dx%d", cols, rows)
	cmd := exec.CommandContext(
		ctx,
		"chafa",
		"--size", size,
		"--view-size", size,
		"--scale", "max",
		"--align", "mid,center",
		"--relative", "off",
		"--animate", "off",
		path,
	)

	out, err := cmd.CombinedOutput()
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return "", fmt.Errorf("chafa timed out after %s", renderTimeout)
		}
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("chafa render failed: %s", msg)
	}

	if len(out) == 0 {
		return "", errors.New("chafa returned empty output")
	}
	return string(out), nil
}

func drawScreen(cfg config, contents []string, renderErrs []error) {
	const boxTopRow = 7
	const boxLeftCol = 1
	const boxGap = 4
	const boxesPerRow = 3

	var b strings.Builder
	b.WriteString("\x1b[2J\x1b[H")
	b.WriteString("Chafa Image TUI\n\n")
	fmt.Fprintf(&b, "Images: %d | box=%dx%d cells | layout=3 per row\n", len(cfg.imagePaths), cfg.boxCols, cfg.boxRows)
	b.WriteString("[r] reload  [q] quit\n\n")

	for i := range cfg.imagePaths {
		boxRow := i / boxesPerRow
		boxCol := i % boxesPerRow
		top := boxTopRow + boxRow*(cfg.boxRows+3)
		left := boxLeftCol + boxCol*(cfg.boxCols+2+boxGap)

		b.WriteString(renderYellowBorderAt(top, left, cfg.boxCols, cfg.boxRows))
		b.WriteString(cursorPosition(top-1, left))
		fmt.Fprintf(&b, "[%d] %s", i+1, filepath.Base(cfg.imagePaths[i]))

		if renderErrs[i] == nil {
			b.WriteString(cursorPosition(top+1, left+1))
			b.WriteString(contents[i])
			if !strings.HasSuffix(contents[i], "\n") {
				b.WriteByte('\n')
			}
		}
	}

	rowsUsed := (len(cfg.imagePaths) + boxesPerRow - 1) / boxesPerRow
	statusRow := boxTopRow + rowsUsed*(cfg.boxRows+3)
	b.WriteString(cursorPosition(statusRow, 1))
	for i, err := range renderErrs {
		if err == nil {
			continue
		}
		fmt.Fprintf(&b, "Image %d (%s) error: %s\n", i+1, filepath.Base(cfg.imagePaths[i]), err.Error())
		statusRow++
		b.WriteString(cursorPosition(statusRow, 1))
	}

	b.WriteString(cursorPosition(statusRow, 1))

	fmt.Print(normalizeNewlinesForRawTTY(b.String()))
}

func renderYellowBorderAt(topRow, leftCol, cols, rows int) string {
	var b strings.Builder
	b.WriteString(cursorPosition(topRow, leftCol))
	b.WriteString(yellowFG)
	b.WriteRune('┌')
	b.WriteString(strings.Repeat("─", cols))
	b.WriteRune('┐')
	b.WriteString(resetStyle)

	for i := 0; i < rows; i++ {
		b.WriteString(cursorPosition(topRow+1+i, leftCol))
		b.WriteString(yellowFG)
		b.WriteRune('│')
		b.WriteString(resetStyle)
		b.WriteString(strings.Repeat(" ", cols))
		b.WriteString(yellowFG)
		b.WriteRune('│')
		b.WriteString(resetStyle)
	}

	b.WriteString(cursorPosition(topRow+rows+1, leftCol))
	b.WriteString(yellowFG)
	b.WriteRune('└')
	b.WriteString(strings.Repeat("─", cols))
	b.WriteRune('┘')
	b.WriteString(resetStyle)

	return b.String()
}

func cursorPosition(row, col int) string {
	return fmt.Sprintf("\x1b[%d;%dH", row, col)
}

func normalizeNewlinesForRawTTY(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.ReplaceAll(s, "\n", "\r\n")
}

func renderAndDraw(cfg config) {
	contents := make([]string, len(cfg.imagePaths))
	errs := make([]error, len(cfg.imagePaths))
	for i, path := range cfg.imagePaths {
		contents[i], errs[i] = renderWithChafa(path, cfg.boxCols, cfg.boxRows)
	}
	drawScreen(cfg, contents, errs)
}

func runLoop(cfg config) error {
	stdinFD := int(os.Stdin.Fd())
	if !term.IsTerminal(stdinFD) {
		return errors.New("stdin is not a terminal")
	}

	oldState, err := term.MakeRaw(stdinFD)
	if err != nil {
		return fmt.Errorf("enable raw input mode: %w", err)
	}
	defer term.Restore(stdinFD, oldState)

	fmt.Print(enterAltScreen)
	defer fmt.Print(leaveAltScreen)

	renderAndDraw(cfg)

	reader := bufio.NewReader(os.Stdin)
	for {
		b, err := reader.ReadByte()
		if err != nil {
			return fmt.Errorf("read input: %w", err)
		}

		switch b {
		case 'q', 'Q', 3:
			return nil
		case 'r', 'R':
			renderAndDraw(cfg)
		}
	}
}

func main() {
	cfg, err := parseConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		os.Exit(exitCodeFailure)
	}
	if err := ensureChafaAvailable(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(exitCodeFailure)
	}

	if err := runLoop(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "run TUI: %v\n", err)
		os.Exit(exitCodeFailure)
	}
}
