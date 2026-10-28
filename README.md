# FoodLabel Decoder

FoodLabel Decoder is a React web app for a laptop-based hackathon demo. Users upload package photos, the browser reads them locally, and a local JavaScript API interprets the extracted label text.

## Current web demo

The web flow accepts separate nutrition, ingredient, and optional front-of-pack photos. It tries multiple orientations and contrast treatments with Tesseract.js in the browser, then lets the presenter inspect or correct the extracted text. Photos stay in the browser; extracted text is sent to the local Express API. The app does not call a cloud AI service.

From the project root, start the API in one terminal with `cd backend; npm install; npm run dev`, then start the web app in another with `cd frontend; npm install; npm run dev`. Open the local address printed by Vite.

This is a recognition prototype, not a guaranteed package reader. OCR confidence is only a model estimate, and values must be checked against the package. The current web OCR uses Tesseract.js plus local preprocessing; it has not yet been validated against a representative, manually transcribed package set. It does not use a learned food-health model or a complete FSSAI rule database. Incomplete or uncertain evidence must not be presented as a factual health or compliance conclusion.

## Intended product behavior

1. Read nutrition, ingredients, and front-of-pack claims from separate package photos on-device.
2. Show extracted text for correction before trusting the analysis.
3. Explain recognized ingredients and evaluate only claims that have a documented evidence rule.
4. Withhold conclusions when the image extraction is incomplete or uncertain.

The claim set is intended for India first. Applicable FSSAI Advertising and Claims rules and food-additive references need to be versioned and shown beside each applicable result. No barcode entry or barcode lookup is part of the current upload flow.

## Project folders

- `frontend/` — active React + Vite web application and in-browser OCR
- `backend/` — local JavaScript Express API, ingredient profile, and claim-rule prototype

The next milestone is to compare extraction against a manually checked package-photo set, improve field-level confidence and table parsing, then encode and cite the applicable claim rules. Existing score weights are prototype choices, not an official or validated food-label standard.
