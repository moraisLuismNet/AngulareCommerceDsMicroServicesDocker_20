import { Component, inject, afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { MessagesModule } from 'primeng/messages';
import { ToastModule } from 'primeng/toast';
import { ILogin, ILoginResponse } from 'src/app/interfaces/LoginInterface';
import { AppService } from 'src/app/services/AppService';
import { AuthGuard } from 'src/app/guards/AuthGuardService';
import { UserService } from 'src/app/services/UserService';
import { jwtDecode } from 'jwt-decode';

@Component({
    selector: 'app-login',
    templateUrl: './LoginComponent.html',
    styleUrls: ['./LoginComponent.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        MessagesModule,
        ToastModule
    ],
    providers: [MessageService, AuthGuard]
})
export class LoginComponent {
  infoLogin: ILogin = {
    email: '',
    password: '',
    role: '',
  };

  private readonly router = inject(Router);
  private readonly appService = inject(AppService);
  private readonly messageService = inject(MessageService);
  private readonly authGuard = inject(AuthGuard);
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Initial setup
    this.userService.setEmail(this.infoLogin.email);
    
    // Check if user is already logged in
    if (this.authGuard.isLoggedIn()) {
      this.router.navigateByUrl('/ecommerce/listgroups');
    }

    // afterNextRender runs once after the component is initially rendered
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });

  }

  login() {
    this.appService.login(this.infoLogin).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: ILoginResponse) => {
        const decodedToken: any = jwtDecode(data.token);
        const role = decodedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
        const email = this.infoLogin.email;
        
        const userData = { 
          ...data, 
          role, 
          email,
          name: email.split('@')[0] 
        };
        
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        this.userService.setEmail(email);
        this.userService.setRole(role);
        this.cdr.markForCheck();
        
        // Redirect based on role
        this.userService.redirectBasedOnRole();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Incorrect credentials',
        });
        this.cdr.markForCheck();
      },
    });
  }

}
