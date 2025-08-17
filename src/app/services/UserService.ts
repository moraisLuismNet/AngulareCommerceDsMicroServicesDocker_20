import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { CartEventsService } from '../shared/services/CartEventsService';

@Injectable({
  providedIn: 'root',
})
export class UserService implements OnDestroy {
  private readonly STORAGE_KEY = 'user';
  private readonly destroy$ = new Subject<void>();

  private readonly emailSubject = new BehaviorSubject<string | null>(null);
  private readonly roleSubject = new BehaviorSubject<string | null>(null);
  private readonly userLoggedOutSubject = new Subject<string>();

  readonly email$ = this.emailSubject.asObservable();
  readonly role$ = this.roleSubject.asObservable();
  readonly userLoggedOut$ = this.userLoggedOutSubject.asObservable();
  readonly emailUser$ = this.emailSubject.asObservable();

  private readonly router = inject(Router);
  private readonly cartEvents = inject(CartEventsService);

  constructor() {
    this.initializeFromStorage();
  }

  private initializeFromStorage(): void {
    const userData = sessionStorage.getItem(this.STORAGE_KEY);
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user?.email) {
          this.emailSubject.next(user.email);
          this.roleSubject.next(user.role || null);
        }
      } catch (error) {
        console.error('Error parsing user data from storage:', error);
        sessionStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  setEmail(email: string): void {
    const currentEmail = this.emailSubject.value;
    if (currentEmail && currentEmail !== email) {
      // Clean up previous user's data and reset cart state
      this.cleanUserLocalData(currentEmail);
      // Emit cart reset event when switching users
      this.cartEvents.resetCart();
    }
    // Notify the email change so the cart can sync
    this.emailSubject.next(email);
  }

  setRole(role: string): void {
    this.roleSubject.next(role);
  }

  private cleanUserLocalData(email: string): void {
    if (!email) return;

    const keys = [
      `${email}_cart`,
      `${email}_cartItemsCount`,
      `${email}_cartItems`,
    ];

    keys.forEach((key) => localStorage.removeItem(key));
  }

  get email(): string | null {
    return this.emailSubject.value;
  }

  getRole(): string | null {
    return this.roleSubject.value;
  }

  clearEmail(): void {
    this.emailSubject.next(null);
  }

  clearRole(): void {
    this.roleSubject.next(null);
  }

  isAdmin(): boolean {
    return this.roleSubject.value === 'Admin';
  }

  redirectBasedOnRole(): void {
    this.router.navigate([this.isAdmin() ? '/genres' : '/']);
  }

  logout(): void {
    const currentEmail = this.emailSubject.value;
    if (currentEmail) {
      this.userLoggedOutSubject.next(currentEmail);
      this.cleanUserLocalData(currentEmail);
      
      // Emit cart reset event before clearing user data
      this.cartEvents.resetCart();
      
      sessionStorage.removeItem(this.STORAGE_KEY);
      this.clearEmail();
      this.clearRole();
      this.router.navigate(['/login']);
    }
  }

  clearUser(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.emailSubject.next(null);
    this.roleSubject.next(null);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
