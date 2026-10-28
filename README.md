# FoodLabel Decoder

FoodLabel Decoder is a React web app for a laptop-based hackathon demo. It reads separate photos of a food package's nutrition panel, ingredients list, and optional front-of-pack claims, then compares the transcribed evidence with the project's documented rules.

## Start the app

Use one terminal for the API and another for the web app:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Open the local address printed by Vite. The project works without a cloud API key using Tesseract.js in the browser. With a Gemini API key configured, uploaded photos are sent from the browser through the local API to Google's Gemini API for visual transcription. If the cloud reader is not configured or fails, the app falls back to local Tesseract OCR.

## Optional Gemini vision reading

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Copy `backend/.env.example` to `backend/.env`.
3. Put your key in `backend/.env` as `GEMINI_API_KEY=...`. Keep that file private: `.env` is ignored by Git, and the key is only read by the backend.
4. Restart `npm run dev` in `backend/`.

The browser calls the local `/api/ocr` route. The backend sends only the selected package image to Gemini using `gemini-3.5-flash-lite`; the key is never sent to the browser. Gemini is prompted to transcribe only the requested panel into a structured response and mark uncertain segments. It does not determine whether a food is healthy or whether a claim is true. The app's separate rules interpret the resulting text, and the user can review or correct the transcription.

Cloud reading changes the privacy behavior: when Gemini is configured, images are sent to Google. Review Google's current [Gemini API terms](https://ai.google.dev/gemini-api/terms) and [pricing and data-use details](https://ai.google.dev/gemini-api/docs/pricing) before using it. The Gemini free tier may use submitted content to improve Google products; eligibility, limits, and charges depend on the current Google account and model terms. The app shows this behavior beside the upload controls. Without a key, image reading stays in the browser.

## What the result means

OCR is still fallible. Vision models can misread small print or infer text that is not present, so the transcription is shown for review and uncertain passages are called out. Nutrition quantities, serving bases, and claim decisions must be checked against the package. The app is a prototype, not a validated nutrition, health, or legal-compliance service.

`backend/src/fssaiRules.js` contains versioned claim evidence records. The user-supplied Kaggle dataset at `backend/data/packaged_foods_india.csv` can help find candidate matching products and compare recognized names; it is not an authoritative source for claim rules, a trained health model, or proof that a package claim is true. Confirm the dataset's original URL and licence before redistribution.
