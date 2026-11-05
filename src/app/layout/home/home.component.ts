import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardPageComponent } from '../../features/dashboard/components/dashboard-page/dashboard-page.component';

/** Início: o gestor vê o resumo do dia; os demais perfis, a tela de boas-vindas. */
@Component({
  selector: 'app-home',
  imports: [DashboardPageComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private route = inject(ActivatedRoute);
  readonly isManager = inject(AuthService).isManager;
  title = this.route.snapshot.data['title'] ?? 'Bem-vindo(a)!';
  description = this.route.snapshot.data['description'] ?? 'Uma nova forma de gerenciar suas rotas.';
}
