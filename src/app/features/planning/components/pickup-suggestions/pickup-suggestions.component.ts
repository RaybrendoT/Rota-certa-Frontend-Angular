import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { PickupSuggestion, PickupSuggestions } from '../../models/planning';
import { PlanningService } from '../../service/planning.service';

/** Novos pontos de embarque sugeridos com H3 para quem mora longe de qualquer ponto. */
@Component({
  selector: 'app-pickup-suggestions',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './pickup-suggestions.component.html',
  styleUrl: './pickup-suggestions.component.scss',
})
export class PickupSuggestionsComponent implements OnInit {
  private readonly planning = inject(PlanningService);

  walkLimit = 1000;
  minPeople = 5;
  readonly result = signal<PickupSuggestions | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.planning.pickupSuggestions(this.walkLimit, this.minPeople).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(extractErrorMessage(err, 'Não foi possível calcular as sugestões.'));
      },
    });
  }

  coverage(result: PickupSuggestions): number {
    return result.employees ? (result.covered / result.employees) * 100 : 100;
  }

  title(suggestion: PickupSuggestion): string {
    const address = suggestion.address;
    if (!address?.street) return `Ponto em ${suggestion.latitude}, ${suggestion.longitude}`;
    const street = address.number ? `${address.street}, ${address.number}` : address.street;
    return address.sublocality ? `${address.sublocality} – ${street}` : street;
  }

  mapsLink(suggestion: PickupSuggestion): string {
    return `https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`;
  }

  names(suggestion: PickupSuggestion): string {
    return suggestion.names.join(', ');
  }
}
