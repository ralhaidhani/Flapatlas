import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  AssistantCapabilityMode,
  buildGroundedSystemInstruction,
  NOT_AVAILABLE_FALLBACK,
} from './src/engine/assistantGrounding';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('fetch failed');
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      model: 'gemini-4-hydrogen',
    });
  });

  // Detect locally installed per-system anatomical GLB files in /public/models/ (avoids 404 console spam)
  app.get('/api/models/status', (_req, res) => {
    const modelsDir = path.resolve(__dirname, isProduction ? 'dist/models' : 'public/models');
    try {
      if (!fs.existsSync(modelsDir)) {
        res.json({ availableFiles: [], files: [], totalMB: 0 });
        return;
      }
      const entries = fs
        .readdirSync(modelsDir)
        .filter((name) => /\.(glb|gltf)$/i.test(name))
        .map((name) => {
          const stat = fs.statSync(path.join(modelsDir, name));
          return {
            fileName: name,
            url: `/models/${name}`,
            sizeMB: Number((stat.size / (1024 * 1024)).toFixed(2)),
          };
        });
      const totalMB = Number(entries.reduce((acc, f) => acc + f.sizeMB, 0).toFixed(2));
      res.json({
        availableFiles: entries.map((e) => e.fileName),
        files: entries,
        totalMB,
      });
    } catch {
      res.json({ availableFiles: [], files: [], totalMB: 0 });
    }
  });

  // Grounded "Ask FlapAtlas" endpoint — answers strictly from supplied dataset context
  app.post('/api/ask', async (req, res) => {
    const {
      question,
      contextRecords,
      vesselRecords,
      mode = 'qa',
      history,
      allowedDefectLocations,
    } = req.body as {
      question?: string;
      contextRecords?: Array<Record<string, unknown>>;
      vesselRecords?: Array<Record<string, unknown>>;
      mode?: AssistantCapabilityMode;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      allowedDefectLocations?: Array<{ id: string; label: string }>;
    };

    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'A question is required.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'Ask FlapAtlas requires GEMINI_API_KEY in Settings > Secrets. All offline 3D atlas, Flap Advisor, simulator, and case planning tools remain fully available.',
      });
      return;
    }

    const flapsCtx = Array.isArray(contextRecords) ? contextRecords.slice(0, 6) : [];
    const vesselsCtx = Array.isArray(vesselRecords) ? vesselRecords.slice(0, 4) : [];
    const recentHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.text === 'string' &&
              m.text.trim().length > 0
          )
      : [];

    const safeMode: AssistantCapabilityMode =
      mode === 'compare' ||
      mode === 'technique' ||
      mode === 'alternatives' ||
      mode === 'quiz' ||
      mode === 'advisor-parse'
        ? mode
        : 'qa';

    const systemInstruction = buildGroundedSystemInstruction(safeMode);

    try {
      const ai = createGeminiClient(apiKey);

      if (safeMode === 'advisor-parse') {
        const locs = Array.isArray(allowedDefectLocations)
          ? allowedDefectLocations.slice(0, 30)
          : [];

        const advisorPrompt = [
          'ALLOWED DEFECT LOCATION IDs (pick the single closest id):',
          JSON.stringify(locs, null, 2),
          '',
          'ALLOWED CHECKBOX VALUES:',
          '- depth: "Superficial" | "Full-thickness" | "Deep / cavitary"',
          '- missingTissues: ["Skin","Subcutaneous fat","Fascia","Muscle","Bone","Tendon","Nerve","Mucosa / lining","Composite (through-and-through)"]',
          '- woundCharacteristics: ["Exposed bone","Exposed tendon","Exposed hardware","Exposed vessels / dura / implant","Radiated field","Infection / osteomyelitis","Dead space","Contaminated / chronic wound","Active malignancy"]',
          '- functionalGoals: ["Thin / pliable coverage","Bulk / volume","Sensation","Motor function","Color / texture match","Durability","Weight-bearing surface","Contour"]',
          '- recipientVesselStatus: "Available" | "Zone of injury" | "Previous radiation" | "Vein graft likely"',
          '- patientFactors: ["High BMI","Smoker","Diabetes","Peripheral vascular disease","Prior abdominal surgery","Prior surgery at donor site","Anticoagulation","Age > 70 / frail","Scar concealment priority"]',
          '- mobilizationPreference: "Any" | "Local / Regional preferred" | "Free flap acceptable" | "Short OR time"',
          '',
          'CLINICAL SCENARIO TO STRUCTURE:',
          question.trim(),
        ].join('\n');

        const response = await withExponentialBackoff(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: advisorPrompt,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: {
                    type: Type.STRING,
                    description:
                      'One concise clinical sentence summarizing the extracted defect parameters.',
                  },
                  locationId: {
                    type: Type.STRING,
                    description: 'Exact matching id from ALLOWED DEFECT LOCATION IDs.',
                  },
                  lengthCm: { type: Type.NUMBER },
                  widthCm: { type: Type.NUMBER },
                  depth: { type: Type.STRING },
                  boneLengthCm: { type: Type.NUMBER },
                  missingTissues: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  woundCharacteristics: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  functionalGoals: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  recipientVesselStatus: { type: Type.STRING },
                  patientFactors: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  mobilizationPreference: { type: Type.STRING },
                },
                required: ['summary', 'locationId', 'lengthCm', 'widthCm', 'depth'],
              },
            },
          })
        );

        const rawText = (response.text ?? '{}').trim();
        let advisorInput: unknown = null;
        try {
          advisorInput = JSON.parse(rawText);
        } catch {
          res.status(502).json({
            error: 'Could not parse structured Flap Advisor JSON from AI response.',
          });
          return;
        }

        res.json({
          answer:
            typeof (advisorInput as { summary?: string }).summary === 'string'
              ? `${(advisorInput as { summary: string }).summary}\n\nClick "Apply to Flap Advisor" below to run the transparent rule-based ranking engine. For education and reference only — not a substitute for clinical judgment or preoperative imaging.`
              : 'Scenario structured for Flap Advisor. Click "Apply to Flap Advisor" to run the rule-based engine.',
          advisorScenario: advisorInput,
          usedRecordIds: flapsCtx.map((r) => String(r.id ?? '')).filter(Boolean),
          usedVesselIds: vesselsCtx.map((v) => String(v.id ?? '')).filter(Boolean),
        });
        return;
      }

      const historyBlock =
        recentHistory.length > 0
          ? [
              'RECENT CONVERSATION CONTEXT:',
              ...recentHistory.map((m) => `${m.role.toUpperCase()}: ${m.text}`),
              '',
            ].join('\n')
          : '';

      const prompt = [
        'CONTEXT RECORDS — FLAPS (sole source of truth):',
        JSON.stringify(flapsCtx, null, 2),
        '',
        ...(vesselsCtx.length > 0
          ? ['CONTEXT RECORDS — VESSELS (sole source of truth):', JSON.stringify(vesselsCtx, null, 2), '']
          : []),
        historyBlock,
        'USER QUESTION:',
        question.trim(),
      ]
        .filter(Boolean)
        .join('\n');

      const response = await withExponentialBackoff(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const answer = response.text?.trim() || NOT_AVAILABLE_FALLBACK;
      res.json({
        answer,
        usedRecordIds: flapsCtx.map((r) => String(r.id ?? '')).filter(Boolean),
        usedVesselIds: vesselsCtx.map((v) => String(v.id ?? '')).filter(Boolean),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upstream AI request failed.';
      const status =
        message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY')
            ? 403
            : 500;
      const friendly =
        status === 429
          ? 'Rate limit reached on the Gemini API. Wait briefly and retry, or continue using offline FlapAtlas tools.'
          : status === 403
            ? 'Gemini API key permission error. Please check your key in Settings > Secrets.'
            : message;
      res.status(status).json({ error: friendly });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: !disableHmr,
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FlapAtlas 3D server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
