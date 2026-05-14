package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
)

const defaultModel = "MiniMax-M2.7"

type MinimaxClient struct {
	apiKey  string
	baseURL string
	http    *http.Client
	log     *slog.Logger
}

func NewMinimaxClient(apiKey, baseURL string, log *slog.Logger) *MinimaxClient {
	return &MinimaxClient{
		apiKey:  apiKey,
		baseURL: baseURL,
		http:    &http.Client{Timeout: 120 * time.Second},
		log:     log,
	}
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatRequest struct {
	Model          string          `json:"model"`
	Messages       []message       `json:"messages"`
	MaxTokens      int             `json:"max_tokens"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type chatResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Model   string `json:"model"`
	Content []struct {
		Type   string `json:"type"`
		Text   string `json:"text,omitempty"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	BaseResp struct {
		StatusCode int    `json:"status_code"`
		StatusMsg  string `json:"status_msg"`
	} `json:"base_resp"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatResponse struct {
	Text        string           `json:"text"`
	Suggestions []SuggestionItem `json:"suggestions,omitempty"`
}

type SuggestionItem struct {
	Type    string `json:"type"`
	Title   string `json:"title"`
	Details string `json:"details,omitempty"`
}

type ImproveGoalRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type ImproveProjectRequest struct {
	GoalTitle       string   `json:"goal_title"`
	GoalDescription string   `json:"goal_description"`
	ProjectTitle    string   `json:"project_title"`
	ProjectDesc     string   `json:"project_description"`
	OtherProjects   []string `json:"other_projects"`
}

type ImproveResponse struct {
	Suggestion string `json:"suggestion"`
	Reasoning  string `json:"reasoning,omitempty"`
}

func (c *MinimaxClient) ImproveGoalTitle(ctx context.Context, req ImproveGoalRequest) (ImproveResponse, error) {
	prompt := fmt.Sprintf(`You are a goal coaching assistant. Improve the following goal title.

Current title: "%s"
Description: "%s"

Improve the title to be more specific, achievable, and well-defined. The title should be concise (5-10 words) and clear.

Return ONLY JSON with the improved title and brief reasoning:
{"suggestion": "Improved title here", "reasoning": "Why this is better"}`, req.Title, req.Description)

	return c.improve(ctx, prompt)
}

func (c *MinimaxClient) ImproveGoalDescription(ctx context.Context, req ImproveGoalRequest) (ImproveResponse, error) {
	prompt := fmt.Sprintf(`You are a goal coaching assistant. Improve the following goal description.

Current title: "%s"
Current description: "%s"

Improve the description to provide more context, motivation, and success criteria. Be specific about what success looks like.

Return ONLY JSON with the improved description and brief reasoning:
{"suggestion": "Improved description here", "reasoning": "Why this is better"}`, req.Title, req.Description)

	return c.improve(ctx, prompt)
}

func (c *MinimaxClient) ImproveProject(ctx context.Context, req ImproveProjectRequest) (ImproveResponse, error) {
	otherProjects := ""
	if len(req.OtherProjects) > 0 {
		otherProjects = "\nOther projects in this goal:\n- " + strings.Join(req.OtherProjects, "\n- ")
	}

	prompt := fmt.Sprintf(`You are a planning assistant. Improve the following project.

Goal: %s
Goal description: %s

Current project: %s
Project description: %s%s

Improve the project title and description to be more specific and actionable. Consider how this project contributes to the overall goal and how it relates to other projects.

Return ONLY JSON:
{"suggestion": "Improved project title|Improved project description", "reasoning": "Why this is better"}`, req.GoalTitle, req.GoalDescription, req.ProjectTitle, req.ProjectDesc, otherProjects)

	return c.improve(ctx, prompt)
}

func (c *MinimaxClient) improve(ctx context.Context, prompt string) (ImproveResponse, error) {
	reqBody := chatRequest{
		Model:     defaultModel,
		Messages:  []message{{Role: "user", Content: prompt}},
		MaxTokens: 1024,
		ResponseFormat: &responseFormat{Type: "json_object"},
	}

	text, err := c.doChat(ctx, reqBody)
	if err != nil {
		return ImproveResponse{}, err
	}

	result, err := parseJSONResponse[ImproveResponse](text)
	if err != nil {
		return ImproveResponse{}, fmt.Errorf("improve: %w", err)
	}
	return result, nil
}

func (c *MinimaxClient) doChat(ctx context.Context, reqBody chatRequest) (string, error) {
	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/messages", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	var ar chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}

	if ar.BaseResp.StatusCode != 0 {
		return "", fmt.Errorf("minimax: %s", ar.BaseResp.StatusMsg)
	}

	return extractText(ar.Content), nil
}

func extractText(content []struct {
	Type   string `json:"type"`
	Text   string `json:"text,omitempty"`
}) string {
	var text string
	for _, c := range content {
		if c.Type == "text" {
			text += c.Text
		}
	}
	return text
}

func parseJSONResponse[T any](text string) (T, error) {
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start == -1 || end == -1 || end <= start {
		return *new(T), fmt.Errorf("no JSON in response")
	}

	var result T
	if err := json.Unmarshal([]byte(text[start:end+1]), &result); err != nil {
		return *new(T), fmt.Errorf("parse: %w", err)
	}
	return result, nil
}

type GoalContext struct {
	Goal     domain.Goal     `json:"goal"`
	Projects []domain.Project `json:"projects"`
	Tasks    []domain.Task   `json:"tasks"`
}

func (c *MinimaxClient) Chat(ctx context.Context, gc GoalContext, messages []ChatMessage) (ChatResponse, error) {
	systemPrompt := buildSystemPrompt(gc)

	var msgs []message
	msgs = append(msgs, message{Role: "user", Content: systemPrompt})

	for _, m := range messages {
		role := "user"
		if m.Role == "assistant" {
			role = "assistant"
		}
		msgs = append(msgs, message{Role: role, Content: m.Content})
	}

	reqBody := chatRequest{
		Model:     defaultModel,
		Messages:  msgs,
		MaxTokens: 2048,
		ResponseFormat: &responseFormat{Type: "json_object"},
	}

	c.log.InfoContext(ctx, "minimax chat request", slog.String("goal_id", gc.Goal.ID.String()))

	text, err := c.doChat(ctx, reqBody)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("chat: %w", err)
	}

	suggestions := extractSuggestions(text)

	return ChatResponse{
		Text:        text,
		Suggestions: suggestions,
	}, nil
}

func buildSystemPrompt(gc GoalContext) string {
	var sb strings.Builder
	sb.WriteString("You are Echo, an AI planning assistant. You help users break down goals into projects and tasks.\n\n")
	sb.WriteString("Current Context:\n")
	sb.WriteString("Goal: " + gc.Goal.Title + "\n")
	if gc.Goal.Description != "" {
		sb.WriteString("Description: " + gc.Goal.Description + "\n")
	}
	if gc.Goal.TargetDate != nil {
		sb.WriteString("Target date: " + gc.Goal.TargetDate.Format("2006-01-02") + "\n")
	}

	if len(gc.Projects) > 0 {
		sb.WriteString("\nProjects:\n")
		for _, p := range gc.Projects {
			sb.WriteString("- " + p.Title + " (" + string(p.Status) + ")\n")
		}
	}

	if len(gc.Tasks) > 0 {
		sb.WriteString("\nTasks:\n")
		for _, t := range gc.Tasks {
			status := string(t.Status)
			sched := ""
			if t.ScheduledDate != nil {
				sched = " scheduled " + t.ScheduledDate.Format("2006-01-02 15:04")
			}
			sb.WriteString("- [" + status + "] " + t.Title + sched + "\n")
		}
	}

	sb.WriteString(`\nGuidelines:
- Be concise and helpful
- When suggesting new projects/tasks, format as JSON in your response like this:
  {"suggestions":[{"type":"project","title":"Project Name","details":"optional details"},{"type":"task","title":"Task Name","details":"for project X"}]}
- If no suggestions, just respond conversationally
- All responses should be in the user's language (Russian if user writes in Russian)
`)
	return sb.String()
}

func extractSuggestions(text string) []SuggestionItem {
	result, err := parseJSONResponse[struct {
		Suggestions []SuggestionItem `json:"suggestions"`
	}](text)
	if err != nil {
		return nil
	}
	return result.Suggestions
}

type TaskSuggestion struct {
	Title   string `json:"title"`
	Details string `json:"details"`
}

func (c *MinimaxClient) SuggestTasks(ctx context.Context, goalID uuid.UUID, projectTitle string) ([]TaskSuggestion, error) {
	prompt := fmt.Sprintf(`Suggest 3-5 tasks for the project "%s".
Return JSON: {"tasks":[{"title":"Task name","details":"brief description"}]}`, projectTitle)

	reqBody := chatRequest{
		Model:     defaultModel,
		Messages:  []message{{Role: "user", Content: prompt}},
		MaxTokens: 1024,
	}

	text, err := c.doChat(ctx, reqBody)
	if err != nil {
		return nil, err
	}

	result, err := parseJSONResponse[struct {
		Tasks []TaskSuggestion `json:"tasks"`
	}](text)
	if err != nil {
		return nil, nil
	}
	return result.Tasks, nil
}

func (c *MinimaxClient) Decompose(ctx context.Context, goal domain.Goal) (Suggestion, error) {
	prompt := buildDecomposePrompt(goal)

	reqBody := chatRequest{
		Model:     defaultModel,
		Messages:  []message{{Role: "user", Content: prompt}},
		MaxTokens: 4096,
		ResponseFormat: &responseFormat{Type: "json_object"},
	}

	c.log.InfoContext(ctx, "minimax decompose", slog.String("goal_id", goal.ID.String()))

	text, err := c.doChat(ctx, reqBody)
	if err != nil {
		return Suggestion{}, fmt.Errorf("decompose: %w", err)
	}

	c.log.InfoContext(ctx, "minimax response", slog.String("goal_id", goal.ID.String()), slog.String("text", text))

	jsonBytes, err := extractJSON(text)
	if err != nil {
		return Suggestion{}, fmt.Errorf("extract json: %w", err)
	}

	var suggestion Suggestion
	if err := json.Unmarshal(jsonBytes, &suggestion); err != nil {
		return Suggestion{}, fmt.Errorf("parse: %w", err)
	}

	return suggestion, nil
}

func buildDecomposePrompt(goal domain.Goal) string {
	var sb strings.Builder
	sb.WriteString("You are a planning assistant. Decompose the following goal into projects and tasks.\n\n")
	sb.WriteString("Goal: " + goal.Title + "\n")
	if goal.Description != "" {
		sb.WriteString("Description: " + goal.Description + "\n")
	}
	if goal.TargetDate != nil {
		sb.WriteString("Target: " + goal.TargetDate.Format("2006-01-02") + "\n")
	}
	sb.WriteString("\nReturn ONLY JSON:\n{\"projects\":[{\"title\":\"Project\",\"target_date\":\"YYYY-MM-DD\",\"tasks\":[{\"title\":\"Task\",\"due_date\":\"YYYY-MM-DD\"}]}]}")
	return sb.String()
}

func extractJSON(text string) ([]byte, error) {
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start == -1 || end == -1 || end <= start {
		return nil, fmt.Errorf("no JSON")
	}
	return []byte(text[start : end+1]), nil
}