# StudyLens AI

AI study companion (Multimodal AI Hackathon 2026 · Track D) that tutors, quizzes and tracks mastery using only the student's uploaded course materials.

## Core flow
Upload (PDF / PPTX / VTT·SRT·TXT transcripts / notes / diagram images) → extract text in the browser with page, slide or timestamp → scanned pages & images are described by a vision model → chunks indexed with full-text search and organised into topics, subtopics and prerequisites → AI Tutor retrieves passages and answers with `[S#]` citations (or says "I couldn't verify this from your uploaded materials.") → Adaptive Quiz generates MCQs from retrieved passages and verifies each answer key (verbatim evidence quote + independent solver) → Bayesian Knowledge Tracing updates per-topic mastery → recommendations on Dashboard & Insights.

## Setup
Runs on Lovable Cloud (auth, database, file storage) and Lovable AI (no API key to manage). Sign up with email or Google, then use **Study Library → Load demo course** to try everything with clearly labelled demo material.

## Evaluation
The Evaluation page runs a fixed answerable/unanswerable test set against the demo course and scores faithfulness, answer relevancy, context precision and context recall with an AI judge. Unrun tests display "not run". A seeded simulated-student evaluation checks mastery convergence and question repetition.

## Tests
`bunx vitest run` — mastery model and simulation rules.
