import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrai uma mensagem legível de um erro do DRF: `{ detail }`, `{ campo: [msgs] }` ou lista.
 * Respostas que não são JSON (ex.: página HTML de erro 500) caem no `fallback`.
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'Não foi possível conectar ao servidor.';
  if (error.status === 429) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';

  const body: unknown = error.error;
  if (Array.isArray(body)) {
    const messages = body.filter((item): item is string => typeof item === 'string');
    return messages.length ? messages.join(' ') : fallback;
  }
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record['detail'] === 'string') return record['detail'];
    const messages = Object.values(record)
      .flat()
      .filter((item): item is string => typeof item === 'string');
    if (messages.length) return messages.join(' ');
  }
  return fallback;
}
