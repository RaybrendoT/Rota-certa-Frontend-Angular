import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Route, RouteListResponse } from '../../../route/models/route';
import { RouteService } from '../../../route/service/route.service';
import { RouteEventService } from '../../service/route-event.service';
import { RouteEvent } from '../../models/route-event';

@Component({
  selector: 'app-route-event-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './route-event-detail.component.html',
  styleUrl: './route-event-detail.component.scss'
})
export class RouteEventDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(RouteEventService);
  private routeService = inject(RouteService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form!: FormGroup;
  isEdit = false;
  eventId: number | null = null;
  routeList: Route[] = [];

  ngOnInit(): void {
    this.form = this.fb.group({
      route: [null, Validators.required],
      event_type: ['departure', Validators.required],
      description: ['', Validators.required],
      latitude: ['', Validators.required],
      longitude: ['', Validators.required],
      is_active: [true]
    });
    this.loadRoutes();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.eventId = +id;
      this.loadEvent(this.eventId);
    }
  }

  loadEvent(id: number): void {
    this.eventService.getById(id).subscribe({
      next: (event) => this.form.patchValue(event),
      error: (err) => console.error('Erro ao carregar evento:', err)
    });
  }

  loadRoutes(): void {
    this.routeService.getAll({ page_size: 500 }).subscribe({
      next: (response) => {
        this.routeList = this.getRoutesFromResponse(response);
      },
      error: (err) => console.error('Erro ao carregar rotas:', err)
    });
  }

  save(): void {
    if (this.form.invalid) return;

    const data: Partial<RouteEvent> = {
      ...this.form.value,
      route: Number(this.form.value.route)
    };
    const request$ = this.isEdit && this.eventId
      ? this.eventService.patch(this.eventId, data)
      : this.eventService.create(data);

    request$.subscribe({
      next: () => this.router.navigate(['/eventos-rota']),
      error: (err) => console.error('Erro ao salvar evento:', err)
    });
  }

  cancel(): void {
    this.router.navigate(['/eventos-rota']);
  }

  private getRoutesFromResponse(response: RouteListResponse | Route[]): Route[] {
    if (Array.isArray(response)) return response;
    return response.value ?? response.results ?? [];
  }
}
