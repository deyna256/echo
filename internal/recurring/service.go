package recurring

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
)

const (
	defaultDurationMinutes = 60
	defaultDaysAhead       = 90
	defaultScheduledHour   = 9
	defaultDays            = "MO,WE,FR"
)

type TemplateStore interface {
	Create(ctx context.Context, tmpl domain.RecurringTemplate) (domain.RecurringTemplate, error)
	Get(ctx context.Context, userID, id uuid.UUID) (domain.RecurringTemplate, error)
	Update(ctx context.Context, userID uuid.UUID, tmpl domain.RecurringTemplate) (domain.RecurringTemplate, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.RecurringTemplate, error)
	UpdateNextRunAt(ctx context.Context, id uuid.UUID, nextRunAt time.Time) error
}

type TaskStore interface {
	Create(ctx context.Context, task domain.Task) (domain.Task, error)
	Get(ctx context.Context, userID, id uuid.UUID) (domain.Task, error)
	Update(ctx context.Context, userID uuid.UUID, task domain.Task) (domain.Task, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	DeleteByTemplate(ctx context.Context, templateID uuid.UUID) (int64, error)
}

type Service struct {
	templateStore TemplateStore
	taskStore     TaskStore
}

func New(templateStore TemplateStore, taskStore TaskStore) *Service {
	return &Service{
		templateStore: templateStore,
		taskStore:     taskStore,
	}
}

func (s *Service) CreateTemplate(ctx context.Context, tmpl domain.RecurringTemplate, days []time.Weekday) (domain.RecurringTemplate, error) {
	tmpl.RecurrenceRule = buildRule(days)
	if tmpl.DurationMinutes == 0 {
		tmpl.DurationMinutes = defaultDurationMinutes
	}
	if tmpl.NextRunAt.IsZero() {
		tmpl.NextRunAt = time.Now()
	}

	created, err := s.templateStore.Create(ctx, tmpl)
	if err != nil {
		return created, err
	}
	if err := s.generateInstances(ctx, created, defaultDaysAhead); err != nil {
		return created, err
	}
	return s.templateStore.Get(ctx, tmpl.UserID, created.ID)
}

func (s *Service) UpdateTemplate(ctx context.Context, userID uuid.UUID, tmpl domain.RecurringTemplate, days []time.Weekday) error {
	tmpl.RecurrenceRule = buildRule(days)
	if _, err := s.templateStore.Update(ctx, userID, tmpl); err != nil {
		return err
	}
	if _, err := s.taskStore.DeleteByTemplate(ctx, tmpl.ID); err != nil {
		return err
	}
	tmpl.NextRunAt = time.Now()
	return s.generateInstances(ctx, tmpl, defaultDaysAhead)
}

func (s *Service) DeleteTemplate(ctx context.Context, userID, id uuid.UUID) error {
	if _, err := s.taskStore.DeleteByTemplate(ctx, id); err != nil {
		return err
	}
	return s.templateStore.Delete(ctx, userID, id)
}

// ParseDaysFromRule extracts weekdays from an RRULE string.
// Returns MO,WE,FR defaults on parse failure or empty result.
func ParseDaysFromRule(rule string) []time.Weekday {
	parsed, err := parseRule(rule)
	if err != nil || len(parsed.ByDay) == 0 {
		return []time.Weekday{time.Monday, time.Wednesday, time.Friday}
	}
	return parsed.ByDay
}

func (s *Service) generateInstances(ctx context.Context, tmpl domain.RecurringTemplate, daysAhead int) error {
	rule, err := parseRule(tmpl.RecurrenceRule)
	if err != nil {
		return err
	}

	until := time.Now().AddDate(0, 0, daysAhead)
	dates := generateDates(rule, tmpl.NextRunAt, 100, until)
	if len(dates) == 0 {
		return nil
	}

	scheduledHour := tmpl.NextRunAt.Hour()
	scheduledMin := tmpl.NextRunAt.Minute()
	if scheduledHour == 0 && scheduledMin == 0 {
		scheduledHour = defaultScheduledHour
	}

	for _, date := range dates {
		scheduledTime := time.Date(date.Year(), date.Month(), date.Day(), scheduledHour, scheduledMin, 0, 0, time.UTC)
		task := domain.Task{
			UserID:              tmpl.UserID,
			Title:               tmpl.Title,
			Description:         tmpl.Description,
			ScheduledDate:       &scheduledTime,
			DurationMinutes:     tmpl.DurationMinutes,
			Status:              domain.TaskStatusTodo,
			Color:               tmpl.Color,
			RecurringTemplateID: &tmpl.ID,
		}
		if _, err := s.taskStore.Create(ctx, task); err != nil {
			return fmt.Errorf("create instance: %w", err)
		}
	}

	lastDate := dates[0]
	for _, d := range dates[1:] {
		if d.After(lastDate) {
			lastDate = d
		}
	}
	return s.templateStore.UpdateNextRunAt(ctx, tmpl.ID, lastDate.AddDate(0, 0, 7))
}

type parsedRule struct {
	Freq     string
	Interval int
	ByDay    []time.Weekday
}

func parseRule(rule string) (*parsedRule, error) {
	result := &parsedRule{Freq: "WEEKLY", Interval: 1}
	for _, part := range strings.Split(rule, ";") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key, value := kv[0], kv[1]
		switch key {
		case "FREQ":
			result.Freq = value
		case "INTERVAL":
			n, err := strconv.Atoi(value)
			if err == nil && n > 0 {
				result.Interval = n
			}
		case "BYDAY":
			for _, d := range strings.Split(value, ",") {
				switch d {
				case "MO":
					result.ByDay = append(result.ByDay, time.Monday)
				case "TU":
					result.ByDay = append(result.ByDay, time.Tuesday)
				case "WE":
					result.ByDay = append(result.ByDay, time.Wednesday)
				case "TH":
					result.ByDay = append(result.ByDay, time.Thursday)
				case "FR":
					result.ByDay = append(result.ByDay, time.Friday)
				case "SA":
					result.ByDay = append(result.ByDay, time.Saturday)
				case "SU":
					result.ByDay = append(result.ByDay, time.Sunday)
				}
			}
		}
	}
	return result, nil
}

func buildRule(days []time.Weekday) string {
	if len(days) == 0 {
		return "FREQ=WEEKLY;BYDAY=" + defaultDays
	}
	dayStrs := make([]string, len(days))
	for i, d := range days {
		dayStrs[i] = dayToRRULE(d)
	}
	return "FREQ=WEEKLY;BYDAY=" + strings.Join(dayStrs, ",")
}

func dayToRRULE(d time.Weekday) string {
	switch d {
	case time.Monday:
		return "MO"
	case time.Tuesday:
		return "TU"
	case time.Wednesday:
		return "WE"
	case time.Thursday:
		return "TH"
	case time.Friday:
		return "FR"
	case time.Saturday:
		return "SA"
	case time.Sunday:
		return "SU"
	}
	return ""
}

func generateDates(rule *parsedRule, start time.Time, count int, until time.Time) []time.Time {
	var dates []time.Time
	if len(rule.ByDay) == 0 {
		rule.ByDay = []time.Weekday{start.Weekday()}
	}

	startInByDay := false
	for _, d := range rule.ByDay {
		if d == start.Weekday() {
			startInByDay = true
			break
		}
	}
	if !startInByDay && !start.After(until) {
		dates = append(dates, start)
	}

	generated := len(dates)
	current := start
	yearFromNow := time.Now().AddDate(1, 0, 0)

	for generated < count && current.Before(until) {
		for _, day := range rule.ByDay {
			next := nextDay(current, day)
			if next.After(until) || next.After(yearFromNow) {
				continue
			}
			dates = append(dates, next)
			generated++
			if generated >= count {
				break
			}
		}
		switch rule.Freq {
		case "DAILY":
			current = current.AddDate(0, 0, rule.Interval)
		case "WEEKLY":
			current = current.AddDate(0, 0, 7*rule.Interval)
		case "MONTHLY":
			current = current.AddDate(0, rule.Interval, 0)
		case "YEARLY":
			current = current.AddDate(rule.Interval, 0, 0)
		default:
			current = current.AddDate(0, 0, 7*rule.Interval)
		}
	}
	return dates
}

func nextDay(from time.Time, targetDay time.Weekday) time.Time {
	daysAhead := int(targetDay) - int(from.Weekday())
	if daysAhead < 0 {
		daysAhead += 7
	}
	return from.AddDate(0, 0, daysAhead)
}
