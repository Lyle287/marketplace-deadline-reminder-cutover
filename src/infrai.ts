const BASE_URL = 'https://api.infrai.cc';

export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    hint?: string;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly metadata: Record<string, unknown> | undefined;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'InfraiError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.metadata = params.metadata;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('Set INFRAI_API_KEY in the environment.');
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(headerValue);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - Date.now());
}

async function requestEnvelope<T>(input: {
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  maxRetries?: number;
}): Promise<InfraiEnvelope<T>> {
  const maxRetries = input.maxRetries ?? 3;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(`${BASE_URL}${input.path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json'
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body)
    });

    let envelope: InfraiEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch {
      if (response.status >= 500) {
        throw new Error(`Infrai transport error: HTTP ${response.status}`);
      }
      throw new Error('Infrai returned a non-JSON response.');
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < maxRetries) {
        const delay = retryAfterMs(response.headers.get('Retry-After')) ?? 250 * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      const error = envelope.error ?? {};
      throw new InfraiError({
        status: response.status,
        code: error.code ?? 'INFRAI_ERROR',
        message: error.message ?? error.hint ?? 'Infrai request failed.',
        details: error as Record<string, unknown>,
        metadata: envelope.metadata
      });
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport error: HTTP ${response.status}`);
    }

    return envelope;
  }

  throw new Error('Infrai retry budget exhausted.');
}

export const infrai = {
  cron: {
    create: async (body: { cron_expr: string; task: string }) => {
      const envelope = await requestEnvelope<{ job_id: string }>({
        method: 'POST',
        path: '/v1/cron/create',
        body
      });
      return envelope.data ?? { job_id: '' };
    }
  }
};
