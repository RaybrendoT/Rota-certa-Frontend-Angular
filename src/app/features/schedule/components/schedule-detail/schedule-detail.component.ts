import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { ScheduleService } from '../../service/schedule.service';
import { Schedule } from '../../models/schedule';
import { formatWeekdays, sortWeekdays, WEEKDAY_PRESETS, WEEKDAYS, WeekdayCode } from '../../models/weekdays';

/** Pelo menos um dia marcado. */
function atLeastOneDay(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length ? null : { required: true };
}

@Component({
  selector: 'app-schedule-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './schedule-detail.component.html',
  styleUrl: './schedule-detail.component.scss'
})
export class ScheduleDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private scheduleService = inject(ScheduleService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly weekdays = WEEKDAYS;
  readonly presets = WEEKDAY_PRESETS;

  form!: FormGroup;
  isEdit = false;
  scheduleId: number | null = null;
  saving = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      // A empresa é sempre a do gestor logado (a mesma dos funcionários); fica fora da tela.
      company: [this.auth.person()?.company_id ?? null, Validators.required],
      weekdays: [[...WEEKDAY_PRESETS[0].codes] as WeekdayCode[], atLeastOneDay],
      time: ['', Validators.required],
      is_active: [true]
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.scheduleId = +id;
      this.loadSchedule(this.scheduleId);
    }
  }

  loadSchedule(id: number): void {
    this.scheduleService.getById(id).subscribe({
      next: (schedule) => this.form.patchValue({
        ...schedule,
        weekdays: sortWeekdays(schedule.weekdays),
        time: (schedule.time ?? '').slice(0, 5)
      }),
      error: (err) => this.snackBar.open(extractErrorMessage(err, 'Não foi possível carregar o horário.'), 'Fechar', { duration: 6000 })
    });
  }

  applyPreset(codes: WeekdayCode[]): void {
    const control = this.form.controls['weekdays'];
    control.setValue([...codes]);
    control.markAsDirty();
  }

  /** Desmarca todos os dias: para um turno de um dia só, basta limpar e marcar o dia. */
  clearDays(): void {
    this.applyPreset([]);
  }

  isPresetActive(codes: WeekdayCode[]): boolean {
    const current = sortWeekdays(this.form.value.weekdays);
    return current.length === codes.length && current.every((code, i) => code === codes[i]);
  }

  get weekdaysSummary(): string {
    return formatWeekdays(this.form.value.weekdays);
  }

  save(): void {
    if (this.form.invalid || this.saving) return;

    const data: Partial<Schedule> = {
      ...this.form.value,
      company: Number(this.form.value.company),
      weekdays: sortWeekdays(this.form.value.weekdays)
    };
    const request$ = this.isEdit && this.scheduleId
      ? this.scheduleService.patch(this.scheduleId, data)
      : this.scheduleService.create(data);

    this.saving = true;
    request$.subscribe({
      next: () => this.router.navigate(['/horarios']),
      error: (err) => {
        this.saving = false;
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível salvar o horário.'), 'Fechar', { duration: 6000 });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/horarios']);
  }
}
