package main

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type model struct {
	selected int
}

func initialModel() model {
	return model{selected: 0}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "left", "h":
			m.selected = (m.selected + 2) % 3
		case "right", "l":
			m.selected = (m.selected + 1) % 3
		}
	}
	return m, nil
}

func renderColorBox(label string, bg lipgloss.Color, selected bool) string {
	borderColor := lipgloss.Color("#3A3A3A")
	if selected {
		borderColor = lipgloss.Color("#F8F8F8")
	}

	style := lipgloss.NewStyle().
		Width(18).
		Height(7).
		Align(lipgloss.Center, lipgloss.Center).
		Background(bg).
		Foreground(lipgloss.Color("#111111")).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor)

	return style.Render(label)
}

func (m model) View() string {
	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#EDEDED")).
		Render("Color Box TUI")

	red := renderColorBox("RED", lipgloss.Color("#FF6B6B"), m.selected == 0)
	green := renderColorBox("GREEN", lipgloss.Color("#6BFF95"), m.selected == 1)
	blue := renderColorBox("BLUE", lipgloss.Color("#6BA8FF"), m.selected == 2)

	row := lipgloss.JoinHorizontal(lipgloss.Top, red, "  ", green, "  ", blue)
	help := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#A0A0A0")).
		Render("[h/left] prev  [l/right] next  [q] quit")

	return fmt.Sprintf("%s\n\n%s\n\n%s\n", title, row, help)
}

func main() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Println("error:", strings.TrimSpace(err.Error()))
	}
}
