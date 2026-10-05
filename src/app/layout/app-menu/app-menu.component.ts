import { Component, computed, inject, signal } from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIcon, MatIconModule} from '@angular/material/icon';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatSidenavModule} from '@angular/material/sidenav';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {MatListModule} from '@angular/material/list';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AuthService} from '../../core/services/auth.service';
import {ConfigService} from '../../core/services/config.service';
import {ROLE_LABELS} from '../../core/models/auth.model';

const SIDEBAR_COLLAPSED_KEY = 'rotacerta.sidebarCollapsed';

@Component({
  selector: 'app-app-menu',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatExpansionModule,
    MatTooltipModule
  ],
  templateUrl: './app-menu.component.html',
  styleUrl: './app-menu.component.scss'
})
export class AppMenuComponent {
  readonly auth = inject(AuthService);
  /** Django admin (login próprio, de superusuário/staff) — aberto em nova aba pelo gerente. */
  readonly adminUrl = inject(ConfigService).getAdminUrl();

  /** Recolhido = barra estreita só com os ícones (continuam clicáveis, nome no tooltip). */
  readonly collapsed = signal(readCollapsedPreference());

  toggleSidebar(): void {
    this.collapsed.update(value => !value);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.collapsed()));
    } catch {
      // Sem storage (aba anônima/bloqueado): o estado vale só nesta sessão.
    }
  }

  readonly userName = computed(() => this.auth.person()?.name ?? '');
  readonly userRole = computed(() => {
    const person = this.auth.person();
    if (!person) return '';
    // Gerente é global: não faz sentido anexar o nome da empresa "sede" da conta dele.
    const companyName = person.role === 'GERENTE' ? null : person.company_name;
    return [ROLE_LABELS[person.role], companyName].filter(Boolean).join(' · ');
  });
  readonly userInitials = computed(() =>
    this.userName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('')
  );
}

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}
