import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { startWith } from 'rxjs';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';
import { Route } from '../../../route/models/route';
import { RouteService } from '../../../route/service/route.service';
import { OCCURRENCE_CATEGORIES, OccurrenceType, RouteEvent } from '../../models/route-event';
import { RouteEventService } from '../../service/route-event.service';

/**
 * Registro de ocorrência pelo gestor (ex.: o motorista ligou avisando) e edição dos detalhes.
 * Sem posição do ônibus: isso só o app do motorista manda.
 */
@Component({
  selector: 'app-route-event-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './route-event-detail.component.html',
  styleUrl: './route-event-detail.component.scss'
})
export class RouteEventDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(RouteEventService);
  private routeService = inject(RouteService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  readonly categories = OCCURRENCE_CATEGORIES;

  readonly form = this.fb.group({
    route: [null as number | null, Validators.required],
    event_type: ['delay' as OccurrenceType, Validators.required],
    category: [''],
    delay_minutes: [null as number | null, [Validators.min(1), Validators.max(600)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
    notify_passengers: [false],
  });
  readonly eventType = toSignal(
    this.form.controls.event_type.valueChanges.pipe(startWith(this.form.controls.event_type.value)),
  );

  isEdit = false;
  eventId: number | null = null;
  /** Ocorrência carregada na edição (origem, quem registrou, rota). */
  loaded: RouteEvent | null = null;
  routeList: Route[] = [];
  saving = false;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.eventId = +id;
      this.form.controls.route.disable();
      this.loadEvent(this.eventId);
    }
    this.loadRoutes();
  }

  loadEvent(id: number): void {
    this.eventService.getById(id).subscribe({
      next: (event) => {
        this.loaded = event;
        this.form.patchValue({
          route: event.route,
          event_type: event.event_type === 'incident' ? 'incident' : 'delay',
          category: event.category ?? '',
          delay_minutes: event.delay_minutes ?? null,
          description: event.description,
        });
      },
      error: (err) => this.snackBar.open(extractErrorMessage(err, 'Não foi possível abrir a ocorrência.'), 'Fechar', { duration: 6000 }),
    });
  }

  /** Rotas fixas e as avulsas de hoje em diante (as avulsas antigas só poluiriam a lista). */
  loadRoutes(): void {
    this.routeService.getAll({ page_size: 500 }).subscribe({
      next: (response) => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        this.routeList = extractPaginatedItems<Route>(response)
          // Na edição a rota não muda: mostra todas para a da ocorrência aparecer mesmo se for antiga.
          .filter(route => this.isEdit || !route.service_date || route.service_date >= today)
          .sort((a, b) => Number(!!b.service_date) - Number(!!a.service_date) || a.name.localeCompare(b.name));
      },
      error: (err) => console.error('Erro ao carregar rotas:', err),
    });
  }

  routeLabel(route: Route): string {
    if (!route.service_date) return route.name;
    const [, month, day] = route.service_date.split('-');
    return `${route.name} (avulsa ${day}/${month})`;
  }

  save(): void {
    if (this.form.invalid || this.saving) return;
    const value = this.form.getRawValue();
    const data: Partial<RouteEvent> = {
      event_type: value.event_type!,
      category: (value.category ?? '') as RouteEvent['category'],
      delay_minutes: value.event_type === 'delay' ? value.delay_minutes : null,
      description: (value.description ?? '').trim(),
    };
    const request$ = this.isEdit && this.eventId
      ? this.eventService.patch(this.eventId, data)
      : this.eventService.create({ ...data, route: value.route, notify_passengers: !!value.notify_passengers });

    this.saving = true;
    request$.subscribe({
      next: () => {
        this.snackBar.open(this.isEdit ? 'Ocorrência atualizada.' : 'Ocorrência registrada.', 'OK', { duration: 3000 });
        this.router.navigate(['/eventos-rota']);
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível salvar a ocorrência.'), 'Fechar', { duration: 6000 });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/eventos-rota']);
  }
}
