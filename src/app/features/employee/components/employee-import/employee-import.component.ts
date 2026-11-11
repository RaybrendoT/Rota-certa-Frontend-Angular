import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';
import { Company } from '../../../company/models/company';
import { CompanyService } from '../../../company/service/company.service';
import { ImportResult } from '../../models/person';
import { EmployeeService } from '../../services/employee.service';

/** Modelo baixado pelo botão: cabeçalho e uma linha de cada perfil que o painel importa. */
const TEMPLATE = [
  'perfil;nome;matricula;cnh;telefone;email;logradouro;numero;bairro;cidade;uf;cep;latitude;longitude;placa;modelo_veiculo;capacidade',
  'EMPRESA;Nome da empresa;;;;;Avenida Buriti;1500;Distrito Industrial I;Manaus;AM;69075-000;-3.113516;-59.967525;;;',
  'COLABORADOR;Ana Souza;MT0001;;(92) 99111-2222;;Avenida Noel Nutels;1350;Cidade Nova;Manaus;AM;69000-000;-3.030163;-59.981152;;;',
  'MOTORISTA;Marcos Lima;;63896621965;(92) 99336-6239;;;;;;;;;;ABC1D23;Volare W9;28',
].join('\n') + '\n';

type Step = 'pick' | 'preview' | 'done';

@Component({
  selector: 'app-employee-import',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule,
    MatProgressBarModule, MatSelectModule,
  ],
  templateUrl: './employee-import.component.html',
  styleUrl: './employee-import.component.scss',
})
export class EmployeeImportComponent implements OnInit {
  private readonly service = inject(EmployeeService);
  private readonly companies = inject(CompanyService);
  private readonly dialogRef = inject(MatDialogRef<EmployeeImportComponent, boolean>);
  readonly auth = inject(AuthService);

  readonly step = signal<Step>('pick');
  readonly busy = signal(false);
  readonly file = signal<File | null>(null);
  readonly result = signal<ImportResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly companyOptions = signal<Company[]>([]);
  companyId: number | null = null;

  ngOnInit(): void {
    if (this.auth.isGerente()) {
      this.companies.options().subscribe({
        next: (response) => this.companyOptions.set(extractPaginatedItems<Company>(response)),
      });
    }
  }

  get total(): number {
    const created = this.result()?.created;
    return created ? created.employees + created.drivers + created.managers : 0;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.errors.set([]);
    this.result.set(null);
    this.step.set('pick');
    input.value = '';
  }

  /** Envia sem gravar: o servidor confere todas as linhas e devolve a prévia ou os erros. */
  check(): void {
    this.send(false);
  }

  confirm(): void {
    this.send(true);
  }

  backToPick(): void {
    this.step.set('pick');
    this.errors.set([]);
  }

  close(): void {
    this.dialogRef.close(this.step() === 'done');
  }

  downloadTemplate(): void {
    const url = URL.createObjectURL(new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-importacao-funcionarios.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private send(confirm: boolean): void {
    const file = this.file();
    if (!file || this.busy()) {
      return;
    }
    if (this.auth.isGerente() && !this.companyId) {
      this.errors.set(['Escolha a empresa que vai receber os funcionários.']);
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    this.service.importCsv(file, confirm, this.companyId).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.result.set(result);
        this.step.set(confirm ? 'done' : 'preview');
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const lines = err instanceof HttpErrorResponse && Array.isArray(err.error?.errors) ? err.error.errors : null;
        this.errors.set(lines ?? [extractErrorMessage(err, 'Não foi possível ler o arquivo. Tente de novo.')]);
        this.step.set('pick');
      },
    });
  }
}
