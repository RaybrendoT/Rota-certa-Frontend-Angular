import { effect, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Mesma chave lida pelo script do index.html, que aplica o tema antes do Angular carregar (sem piscar). */
const THEME_KEY = 'rotacerta.theme';

/**
 * Modo claro/escuro do painel: aplica `data-theme` no <html>, onde ficam as variáveis de cor
 * (src/styles.scss). Sem escolha salva, segue o tema do sistema operacional.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(initialTheme());

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
    });
  }

  toggle(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
    try {
      localStorage.setItem(THEME_KEY, this.theme());
    } catch {
      // Sem storage (aba anônima/bloqueado): a escolha vale só nesta sessão.
    }
  }
}

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Sem storage: cai no tema do sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
