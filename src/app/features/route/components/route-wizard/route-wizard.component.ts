import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, Subject } from 'rxjs';
import { catchError, debounceTime, filter, startWith, switchMap } from 'rxjs/operators';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { EmployeeListResult } from '../../../planning/models/planning';
import { PlanningService } from '../../../planning/service/planning.service';
import {
  BuilderEmployee,
  BuilderOptions,
  BuilderVehicle,
  PreviewStop,
  RouteInput,
  RouteKind,
  RoutePreview,
  StopInput,
} from '../../models/route-builder';
import { RouteBuilderService } from '../../service/route-builder.service';

/** Índices das etapas do stepper. */
const STEP = { basics: 0, vehicle: 1, passengers: 2, stops: 3, review: 4 } as const;

/**
 * Criação (stepper horizontal, linear) e edição (stepper vertical, livre, com resumo ao lado)
 * manual de rotas: dados → ônibus → colaboradores → paradas → revisão. O backend
 * (`/api/route-builder/`) escolhe o ponto mais perto de casa, ordena as paradas, estima os
 * horários e devolve os avisos; nada é gravado antes de "Criar rota" / "Salvar alterações".
 */
@Component({
  selector: 'app-route-wizard',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatTooltipModule,
  ],
  templateUrl: './route-wizard.component.html',
  styleUrl: './route-wizard.component.scss',
})
export class RouteWizardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly builder = inject(RouteBuilderService);
  private readonly planning = inject(PlanningService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly STEP = STEP;
  readonly stepper = viewChild<MatStepper>('stepper');

  readonly routeId = signal<number | null>(null);
  readonly isEdit = computed(() => this.routeId() !== null);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly options = signal<BuilderOptions | null>(null);
  readonly vehicles = signal<BuilderVehicle[]>([]);
  readonly vehiclesLoading = signal(false);
  /** Ônibus da rota quando ela foi aberta: continua escolhível mesmo sem motorista livre. */
  private originalVehicle: number | null = null;

  readonly selected = signal<ReadonlySet<number>>(new Set());
  readonly stops = signal<StopInput[] | null>(null);
  readonly preview = signal<RoutePreview | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  /** Nome sugerido pelo sistema (o gestor ainda não digitou um). */
  private nameIsSuggestion = true;

  readonly search = signal('');
  readonly bairroFilter = signal<string[]>([]);
  readonly onlySelected = signal(false);
  readonly listImport = signal<EmployeeListResult | null>(null);
  readonly importing = signal(false);
  readonly addPoint = signal<number | null>(null);

  readonly basics = this.fb.group({
    name: [''],
    kind: ['fixed' as RouteKind, Validators.required],
    schedule: [null as number | null, Validators.required],
    service_date: [null as string | null],
  });
  readonly vehicleForm = this.fb.group({ vehicle: [null as number | null, Validators.required] });
  readonly passengersForm = this.fb.group({ passengers: [[] as number[], Validators.required] });

  readonly basicsValue = toSignal(this.basics.valueChanges.pipe(startWith(this.basics.value)), {
    initialValue: this.basics.value,
  });
  readonly vehicleValue = toSignal(this.vehicleForm.controls.vehicle.valueChanges, { initialValue: null });

  private readonly previewRequests = new Subject<boolean>();
  private readonly editRefresh = new Subject<void>();

  // ------------------------------------------------------------------ derivados

  readonly schedule = computed(() => this.options()?.schedules.find((s) => s.id === this.basicsValue().schedule) ?? null);
  readonly vehicle = computed(() => this.vehicles().find((v) => v.id === this.vehicleValue()) ?? null);
  readonly capacity = computed(() => this.vehicle()?.capacity ?? 0);
  readonly selectedCount = computed(() => this.selected().size);
  readonly loadPercent = computed(() => {
    const capacity = this.capacity();
    return capacity ? Math.min(100, Math.round((this.selectedCount() / capacity) * 100)) : 0;
  });
  readonly overCapacity = computed(() => this.capacity() > 0 && this.selectedCount() > this.capacity());

  readonly bairros = computed(() =>
    [...new Set((this.options()?.employees ?? []).map((e) => e.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  );

  readonly filteredEmployees = computed(() => {
    const term = normalize(this.search());
    const bairros = this.bairroFilter();
    const selected = this.selected();
    return (this.options()?.employees ?? []).filter(
      (e) =>
        (!term || normalize(e.name).includes(term) || normalize(e.code).includes(term)) &&
        (!bairros.length || bairros.includes(e.bairro)) &&
        (!this.onlySelected() || selected.has(e.id)),
    );
  });
  readonly allVisibleSelected = computed(() => {
    const eligible = this.filteredEmployees().filter((e) => e.has_home);
    return eligible.length > 0 && eligible.every((e) => this.selected().has(e.id));
  });
  readonly someVisibleSelected = computed(
    () => !this.allVisibleSelected() && this.filteredEmployees().some((e) => this.selected().has(e.id)),
  );

  readonly availablePoints = computed(() => {
    const used = new Set((this.stops() ?? []).map((s) => s.meeting_point));
    return (this.options()?.meeting_points ?? []).filter((p) => !used.has(p.id));
  });
  readonly errors = computed(() => (this.preview()?.warnings ?? []).filter((w) => w.level === 'error'));
  readonly notices = computed(() => (this.preview()?.warnings ?? []).filter((w) => w.level !== 'error'));

  readonly basicsSummary = computed(() => {
    const value = this.basicsValue();
    const schedule = this.schedule();
    if (!schedule) return '';
    const kind = value.kind === 'extra' ? `Avulsa ${formatDate(value.service_date)}` : 'Fixa';
    return `${kind} · chegada ${schedule.time}`;
  });
  readonly vehicleSummary = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? `${vehicle.plate} · ${vehicle.driver?.name ?? 'sem motorista'}` : '';
  });

  // ------------------------------------------------------------------ ciclo de vida

  constructor() {
    this.previewRequests
      .pipe(
        debounceTime(150),
        switchMap((optimize) => {
          const input = this.input(optimize);
          if (!input.schedule) return of(null);
          this.previewLoading.set(true);
          this.previewError.set(null);
          return this.builder.preview(input).pipe(
            catchError((err) => {
              this.previewError.set(extractErrorMessage(err, 'Não foi possível calcular a rota.'));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((preview) => {
        this.previewLoading.set(false);
        if (preview) this.applyPreview(preview);
      });

    // Na edição, o resumo ao lado acompanha cada mudança.
    this.editRefresh
      .pipe(debounceTime(400), filter(() => this.isEdit() && !this.loading()), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.requestPreview());

    this.basics.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.editRefresh.next());
    this.vehicleForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.editRefresh.next());
    this.basics.controls.name.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.basics.controls.name.dirty) this.nameIsSuggestion = false;
    });
    this.basics.controls.kind.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((kind) => {
      const date = this.basics.controls.service_date;
      date.setValidators(kind === 'extra' ? Validators.required : null);
      date.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (id) this.routeId.set(Number(id));

    this.builder.options().subscribe({
      next: (options) => {
        this.options.set(options);
        if (this.routeId()) this.loadRoute(this.routeId()!);
        else this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(extractErrorMessage(err, 'Não foi possível carregar os dados para montar a rota.'));
      },
    });
  }

  private loadRoute(id: number): void {
    this.builder.get(id).subscribe({
      next: (loaded) => {
        const data = loaded.data;
        this.nameIsSuggestion = false;
        this.originalVehicle = data.vehicle;
        this.basics.patchValue(
          { name: data.name, kind: data.kind, schedule: data.schedule, service_date: data.service_date },
          { emitEvent: true },
        );
        this.vehicleForm.patchValue({ vehicle: data.vehicle });
        this.setSelection(new Set(data.passengers));
        this.stops.set(data.stops);
        if (loaded.preview) this.preview.set(loaded.preview);
        this.loading.set(false);
        this.loadVehicles();
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(extractErrorMessage(err, 'Não foi possível abrir a rota.'));
      },
    });
  }

  // ------------------------------------------------------------------ navegação

  onStepChange(event: StepperSelectionEvent): void {
    if (event.selectedIndex === STEP.vehicle) this.loadVehicles();
    if (event.selectedIndex >= STEP.stops) this.requestPreview();
  }

  goTo(step: number): void {
    const stepper = this.stepper();
    if (stepper) stepper.selectedIndex = step;
  }

  // ------------------------------------------------------------------ ônibus

  loadVehicles(): void {
    const { schedule, service_date, kind } = this.basics.getRawValue();
    if (!schedule) return;
    this.vehiclesLoading.set(true);
    this.builder.vehicles(schedule, kind === 'extra' ? service_date : null, this.routeId()).subscribe({
      next: ({ vehicles }) => {
        this.vehiclesLoading.set(false);
        // Livres primeiro, depois ocupados, depois sem motorista.
        const rank = (v: BuilderVehicle) => (!v.driver ? 2 : v.conflict ? 1 : 0);
        this.vehicles.set([...vehicles].sort((a, b) => rank(a) - rank(b) || b.capacity - a.capacity));
        const current = this.vehicleForm.controls.vehicle.value;
        if (current && !vehicles.some((v) => v.id === current)) this.vehicleForm.patchValue({ vehicle: null });
      },
      error: (err) => {
        this.vehiclesLoading.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível carregar os ônibus.'), 'Fechar', { duration: 5000 });
      },
    });
  }

  vehicleDisabled(vehicle: BuilderVehicle): boolean {
    return vehicle.id !== this.originalVehicle && (!vehicle.driver || !!vehicle.conflict);
  }

  // ------------------------------------------------------------------ colaboradores

  isSelected(employee: BuilderEmployee): boolean {
    return this.selected().has(employee.id);
  }

  toggle(employee: BuilderEmployee): void {
    const next = new Set(this.selected());
    if (next.has(employee.id)) next.delete(employee.id);
    else if (employee.has_home) next.add(employee.id);
    this.setSelection(next);
  }

  toggleAllVisible(): void {
    const next = new Set(this.selected());
    const eligible = this.filteredEmployees().filter((e) => e.has_home);
    if (this.allVisibleSelected()) eligible.forEach((e) => next.delete(e.id));
    else eligible.forEach((e) => next.add(e.id));
    this.setSelection(next);
  }

  clearSelection(): void {
    this.setSelection(new Set());
  }

  onListSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importing.set(true);
    this.planning.uploadEmployeeList(file).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.listImport.set(result);
        const withHome = new Set((this.options()?.employees ?? []).filter((e) => e.has_home).map((e) => e.id));
        const next = new Set(this.selected());
        result.matched.forEach((line) => withHome.has(line.person.id) && next.add(line.person.id));
        this.setSelection(next);
      },
      error: (err) => {
        this.importing.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível ler a lista.'), 'Fechar', { duration: 6000 });
      },
    });
  }

  distanceLabel(meters: number | null | undefined): string {
    if (meters === null || meters === undefined) return '—';
    return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  private setSelection(next: Set<number>): void {
    this.selected.set(next);
    this.passengersForm.controls.passengers.setValue([...next]);
    this.editRefresh.next();
  }

  // ------------------------------------------------------------------ paradas

  requestPreview(optimize = false): void {
    this.previewRequests.next(optimize);
  }

  dropStop(event: CdkDragDrop<PreviewStop[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const stops = [...(this.stops() ?? [])];
    moveItemInArray(stops, event.previousIndex, event.currentIndex);
    this.stops.set(stops);
    // Reordena já na tela; os horários chegam com a prévia.
    const preview = this.preview();
    if (preview) {
      const ordered = [...preview.stops];
      moveItemInArray(ordered, event.previousIndex, event.currentIndex);
      this.preview.set({ ...preview, stops: ordered });
    }
    this.requestPreview();
  }

  movePassenger(personId: number, toPoint: number): void {
    const stops = (this.stops() ?? []).map((s) => ({ ...s, passengers: s.passengers.filter((id) => id !== personId) }));
    stops.find((s) => s.meeting_point === toPoint)?.passengers.push(personId);
    this.stops.set(stops);
    this.requestPreview();
  }

  removeFromRoute(personId: number): void {
    const next = new Set(this.selected());
    next.delete(personId);
    this.setSelection(next);
    this.stops.set((this.stops() ?? []).map((s) => ({ ...s, passengers: s.passengers.filter((id) => id !== personId) })));
    this.requestPreview();
  }

  addStop(): void {
    const point = this.addPoint();
    if (!point) return;
    this.stops.set([...(this.stops() ?? []), { meeting_point: point, passengers: [] }]);
    this.addPoint.set(null);
    this.requestPreview();
  }

  removeStop(pointId: number): void {
    this.stops.set((this.stops() ?? []).filter((s) => s.meeting_point !== pointId));
    this.requestPreview();
  }

  otherStops(pointId: number): PreviewStop[] {
    return (this.preview()?.stops ?? []).filter((s) => s.meeting_point.id !== pointId);
  }

  // ------------------------------------------------------------------ gravação

  save(): void {
    if (this.saving()) return;
    const input = this.input(false);
    this.saving.set(true);
    this.saveError.set(null);
    const request$ = this.isEdit() ? this.builder.update(this.routeId()!, input) : this.builder.create(input);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open(this.isEdit() ? 'Rota atualizada.' : 'Rota criada. Os colaboradores foram avisados no app.', 'Fechar', {
          duration: 5000,
        });
        this.router.navigate(['/rotas']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.error?.preview) this.applyPreview(err.error.preview);
        this.saveError.set(extractErrorMessage(err, 'Não foi possível salvar a rota.'));
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/rotas']);
  }

  // ------------------------------------------------------------------ apoio

  private input(optimize: boolean): RouteInput {
    const value = this.basics.getRawValue();
    return {
      name: (value.name ?? '').trim(),
      kind: value.kind ?? 'fixed',
      schedule: value.schedule,
      service_date: value.kind === 'extra' ? value.service_date : null,
      vehicle: this.vehicleForm.controls.vehicle.value,
      passengers: [...this.selected()],
      stops: this.stops(),
      optimize,
      route: this.routeId(),
    };
  }

  private applyPreview(preview: RoutePreview): void {
    this.preview.set(preview);
    this.stops.set(
      preview.stops.map((s) => ({ meeting_point: s.meeting_point.id, passengers: s.passengers.map((p) => p.id) })),
    );
    if (this.nameIsSuggestion && preview.stops.length) {
      // Sem markAsDirty: continua sendo sugestão até o gestor digitar.
      this.basics.controls.name.setValue(suggestName(preview));
    }
  }

  /** 16.5 → "16,5" */
  decimal(value: number): string {
    return value.toFixed(1).replace('.', ',');
  }
}

function normalize(text: string): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** "Cidade Nova · Novo Aleixo · 07h30": os dois pontos com mais gente e o horário de chegada. */
function suggestName(preview: RoutePreview): string {
  const names = [...preview.stops]
    .sort((a, b) => b.passengers.length - a.passengers.length)
    .map((s) => s.meeting_point.short_name);
  const unique = [...new Set(names)].slice(0, 2);
  return `${unique.join(' · ')} · ${preview.arrival.replace(':', 'h')}`;
}
