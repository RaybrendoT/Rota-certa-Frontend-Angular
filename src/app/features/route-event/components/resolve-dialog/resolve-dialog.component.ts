import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouteEvent } from '../../models/route-event';

/** Respostas mais comuns, para resolver com um toque (dá para editar antes de confirmar). */
const SUGGESTIONS = [
  'Motorista confirmou que a rota seguiu normalmente.',
  'Ônibus reserva enviado.',
  'Passageiros avisados do atraso.',
  'Rota cancelada no dia.',
];

/** Pergunta como a ocorrência foi resolvida; fecha com o texto ou com null (cancelar). */
@Component({
  selector: 'app-resolve-dialog',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Resolver ocorrência</h2>
    <mat-dialog-content>
      <p class="context">
        <strong>{{ event.route_name }}</strong><br>
        {{ event.description }}
      </p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Como foi resolvida</mat-label>
        <textarea matInput rows="3" [(ngModel)]="resolution" cdkFocusInitial maxlength="1000"></textarea>
      </mat-form-field>
      <div class="suggestions" role="group" aria-label="Respostas prontas">
        @for (text of suggestions; track text) {
          <button mat-stroked-button type="button" (click)="resolution = text">{{ text }}</button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close(null)">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="!resolution.trim()" (click)="close(resolution.trim())">
        Resolver
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .context { color: var(--rc-text-2); font-size: 0.875rem; margin: 0 0 16px; }
    .full { width: 100%; }
    .suggestions { display: flex; flex-wrap: wrap; gap: 8px; }
    .suggestions button { font-size: 0.8125rem; }
  `],
})
export class ResolveDialogComponent {
  readonly event: RouteEvent = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ResolveDialogComponent, string | null>);
  readonly suggestions = SUGGESTIONS;
  resolution = '';

  close(value: string | null): void {
    this.dialogRef.close(value);
  }
}
