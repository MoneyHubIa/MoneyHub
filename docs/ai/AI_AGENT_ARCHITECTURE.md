# AI Agent Architecture

## Purpose

The MoneyHub AI assistant explains financial data, summarizes periods, suggests goals, and helps users understand indicators.

## Components

- **AI Controller:** receives authenticated user requests.
- **AI Service:** validates intent and orchestrates response generation.
- **Context Builder:** retrieves only authorized, relevant financial data.
- **LLM Adapter:** isolates provider-specific API calls.
- **Audit Repository:** stores conversations, messages, and context metadata.

## Data Boundary

The LLM never receives database credentials or direct query access. It receives only minimized context assembled by backend services for the authenticated user.
