import {Component, inject, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef, MatDialogActions, MatDialogClose, MatDialogContent} from '@angular/material/dialog';
import {MatButton} from '@angular/material/button';

export interface DialogData {
  message?: string;
  description?: string;
  /** Texto do botão de confirmação (padrão: "Deletar"). */
  confirmLabel?: string;
}

@Component({
  selector: 'app-dialog',
  imports: [MatDialogContent, MatDialogActions, MatButton],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss'
})
export class DialogComponent {

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {}

  private dialogRef = inject(MatDialogRef<DialogComponent>);

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

}
