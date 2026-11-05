import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly theme = inject(ThemeService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  private static readonly ACCESS_DENIED_MESSAGE =
    'Este painel é restrito a gestores e gerentes. Use uma conta com esse perfil.';

  isSubmitting = false;
  errorMessage =
    this.route.snapshot.queryParamMap.get('motivo') === 'sem-acesso'
      ? LoginComponent.ACCESS_DENIED_MESSAGE
      : '';

  submit(): void {
    if (this.form.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    const { email, password } = this.form.getRawValue();

    this.auth.login(email.trim(), password).subscribe({
      next: response => {
        this.isSubmitting = false;
        if (response.person.role !== 'MANAGER' && response.person.role !== 'GERENTE') {
          this.auth.clearSession();
          this.errorMessage = LoginComponent.ACCESS_DENIED_MESSAGE;
          return;
        }
        if (response.must_change_password) {
          this.router.navigate(['/alterar-senha']);
          return;
        }
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/home');
      },
      error: err => {
        this.isSubmitting = false;
        this.errorMessage = extractErrorMessage(err, 'Não foi possível entrar. Tente novamente.');
      }
    });
  }
}
