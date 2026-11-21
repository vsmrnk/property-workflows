# Пропозиція: impl-document-parsing

## Why

Реалізуємо зріз 4 — AI-парсинг документа з підтвердженням людиною (специфікація `add-document-parsing`, канонічна
`openspec/specs/document-parsing`; вимога PM solomchaak/property-workflows-spec#59, golden cases
solomchaak/property-workflows-spec#40).

## What Changes

AC з `openspec/specs/`, які покриває зміна:

- `document-parsing`: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07,
  AC-DOCAI-08, AC-DOCAI-09, AC-DOCAI-10, AC-DOCAI-11, AC-DOCAI-12, AC-DOCAI-13, AC-DOCAI-14, AC-DOCAI-15,
  AC-DOCAI-16.

Нові залежності (ADR 0004): `ai@7.0.162`, `@openrouter/ai-sdk-provider@3.1.0`, `zod@4.6.7`, `server-only@0.0.1`.
Нова міграція: таблиця збережених записів документа рану з RLS і функцією запису.
