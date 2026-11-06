import { Component, computed, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { DashboardAlertGroup, DashboardAlertItem, DashboardAlertKind, DashboardAlerts } from '../../models/dashboard-summary';

interface GroupView {
  icon: string;
  title: (count: number) => string;
  tone: 'danger' | 'warning' | 'info';
  /** Tela relacionada ao grupo. */
  link: string;
  linkLabel: string;
  queryParams?: Record<string, string>;
}

const GROUPS: Record<DashboardAlertKind, GroupView> = {
  incidents: {
    icon: 'report',
    title: (n) => (n === 1 ? '1 incidente registrado' : `${n} incidentes registrados`),
    tone: 'danger',
    link: '/eventos-rota',
    linkLabel: 'Abrir ocorrências de incidente',
    queryParams: { tipo: 'incident' },
  },
  delays: {
    icon: 'schedule',
    title: (n) => (n === 1 ? '1 rota atrasada' : `${n} rotas atrasadas`),
    tone: 'warning',
    link: '/eventos-rota',
    linkLabel: 'Abrir ocorrências de atraso',
    queryParams: { tipo: 'delay' },
  },
  unassigned: {
    icon: 'no_crash',
    title: (n) => (n === 1 ? '1 rota sem veículo ou motorista' : `${n} rotas sem veículo ou motorista`),
    tone: 'warning',
    link: '/rotas',
    linkLabel: 'Abrir rotas',
  },
  address_reviews: {
    icon: 'home_pin',
    title: (n) => (n === 1 ? '1 endereço para aprovar' : `${n} endereços para aprovar`),
    tone: 'info',
    link: '/enderecos',
    linkLabel: 'Abrir aprovação de endereços',
  },
};

/** Painel "Precisa da sua atenção" da tela inicial do gestor. */
@Component({
  selector: 'app-dashboard-alerts',
  standalone: true,
  imports: [MatIconModule, RouterLink],
  templateUrl: './dashboard-alerts.component.html',
  styleUrl: './dashboard-alerts.component.scss',
})
export class DashboardAlertsComponent {
  readonly alerts = input.required<DashboardAlerts>();

  readonly groups = computed(() => this.alerts().groups.filter((group) => group.count > 0));

  /** Itens que cada grupo mostra antes de expandir. */
  readonly previewSize = 5;
  private readonly expanded = signal(new Set<string>());

  isExpanded(group: DashboardAlertGroup): boolean {
    return this.expanded().has(group.kind);
  }

  toggle(group: DashboardAlertGroup): void {
    const next = new Set(this.expanded());
    if (!next.delete(group.kind)) next.add(group.kind);
    this.expanded.set(next);
  }

  visibleItems(group: DashboardAlertGroup): DashboardAlertItem[] {
    return this.isExpanded(group) ? group.items : group.items.slice(0, this.previewSize);
  }

  view(group: DashboardAlertGroup): GroupView {
    return GROUPS[group.kind];
  }

  itemLink(group: DashboardAlertGroup, item: DashboardAlertItem): string[] {
    if (group.kind === 'address_reviews') return ['/enderecos'];
    return ['/rotas', String(item.route_id), 'editar'];
  }

  itemTitle(group: DashboardAlertGroup, item: DashboardAlertItem): string {
    return group.kind === 'address_reviews' ? item.person_name ?? 'Colaborador' : item.route_name ?? 'Rota';
  }

  itemDetail(group: DashboardAlertGroup, item: DashboardAlertItem): string {
    switch (group.kind) {
      case 'incidents':
        return [`às ${item.time}`, item.description].filter(Boolean).join(' · ');
      case 'delays':
        return item.reason === 'overdue'
          ? `turno das ${item.time}: passou do horário sem chegada registrada`
          : [`atraso informado às ${item.time}`, item.description].filter(Boolean).join(' · ');
      case 'unassigned':
        return [item.reason === 'no_vehicle' ? 'sem veículo' : 'veículo sem motorista', item.time ? `turno das ${item.time}` : 'rota avulsa']
          .join(' · ');
      case 'address_reviews':
        return item.time ? `enviado em ${this.dateTime(item.time)}` : 'aguardando aprovação';
    }
  }

  private dateTime(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Manaus',
    }).format(new Date(iso));
  }
}
