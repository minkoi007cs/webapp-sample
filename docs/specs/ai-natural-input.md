# Natural Language Data Input (AI Parser) – Feature Specification

## Purpose
Allow users to input **free text or voice commands** to create structured records in the system (expenses, assets, events, tasks, etc.). The system converts natural language into structured data that can be saved in the database, reducing the need for manual form entry.

---

## 1. Input Methods
### Text Input
- Component: `NaturalInputBox`
- Action: Paste or type free text.

### Voice Input
- Component: `VoiceInputButton` (integrated in `NaturalInputBox`)
- Implementation: Browser **SpeechRecognition API** (`webkitSpeechRecognition`).
- Flow: Voice → Speech-to-Text → Natural Language Parser → Structured Data Preview.

---

## 2. Natural Language Parsing
### Stage 1 – Rule Parsing (Local)
Detect structured elements before/after AI processing to improve accuracy.
- **Money Parsing**: `MoneyParserService` handles Vietnamese formats ("triệu", "tr", "k", "rưỡi").
- **Date Normalization**: Handled via AI with current date/time context provided in the prompt.

### Stage 2 – AI Intent Parsing
User message + application context is sent to OpenAI (`gpt-4o`).
- **Supported Intents**: `create_expense`, `create_income`, `create_asset`, `update_asset`, `create_event`, `create_task`, `create_note`.
- **Unknown Intent**: Returns `intent: "unknown"` with a `clarification` message.

---

## 3. Context Injection
The AI prompt includes dynamic context from the database:
- **Categories**: Existing family categories (2-level tree: root groups + leaf categories); no per-category “type” field.
- **Family Members**: Names of users in the family (mapping "vợ", "chồng", "con").
- **Assets**: Names of existing assets for maintenance/updates.
- **Dynamic Context**: Current Date, Day of Week, and Time.

---

## 4. AI Response Format
Strict JSON schema required:
```json
{
  "intent": "string",
  "confidence": "number",
  "data": "object",
  "clarification": "string"
}
```

---

## 5. Confirmation UI
- Component: `ParsedPreviewModal`
- Features:
  - Preview detected fields (Amount, Category, Date, etc.).
  - Manual Edit: Users can correct any field before saving.
  - Submit: Maps the confirmed data to the appropriate domain API (e.g., `/api/v1/expenses`).

---

## 6. Architecture & Maintenance
### Backend
- `NaturalInputService`: Orchestrates prompt building, OpenAI calls, and retry logic.
- `MoneyParserService`: Utility for Vietnamese currency normalization.
- `NaturalInputController`: API Gateway for parsing.

### Frontend
- `NaturalInputBox`: Main input UI with voice support.
- `ParsedPreviewModal`: Review and Edit interface.

---

## 7. Error Handling & Performance
- **Retries**: Automatic 1-retry logic for OpenAI failures or malformed JSON.
- **Logging**: All parsing results (Input, Intent, Confidence) are logged to the console for future fine-tuning.
- **Context Fetching**: Efficiently fetches category/user/asset lists per request.

---

## 8. Development Roadmap
- [ ] Cache context data (in-memory hoặc bảng DB) nếu cần tối ưu.
- [ ] Log user corrections (from `ParsedPreviewModal`) to a database table for model fine-tuning.
- [ ] Add more local rule-based parsing for dates and bank accounts.
