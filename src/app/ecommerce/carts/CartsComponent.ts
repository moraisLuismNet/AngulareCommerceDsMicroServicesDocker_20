import { Component, inject, afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserService } from 'src/app/services/UserService';
import { CartService } from '../services/CartService';
import { ICart } from '../EcommerceInterface';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';

@Component({
    selector: 'app-carts',
    templateUrl: './CartsComponent.html',
    styleUrls: ['./CartsComponent.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        TableModule,
        ButtonModule,
        TagModule,
        TooltipModule,
        ConfirmDialogModule,
        DialogModule
    ]
})
export class CartsComponent {
  carts: ICart[] = [];
  filteredCarts: ICart[] = [];
  loading = false;
  errorMessage = '';
  isAdmin = false;
  searchText: string = '';
  visibleError = false;

  private readonly cartService = inject(CartService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    this.isAdmin = this.userService.isAdmin();
    this.loadCarts();

    // afterNextRender runs once after the component is initially rendered
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });
  }

  loadCarts(): void {
    this.loading = true;
    this.cdr.markForCheck();

    if (this.isAdmin) {
      this.cartService.getAllCarts().pipe(
        takeUntilDestroyed()
      ).subscribe({
        next: (data: any) => {
          // Extracts values ​​correctly from the response object
          const receivedCarts = data.$values || data;

          // Ensures that it is always an array
          this.carts = Array.isArray(receivedCarts)
            ? receivedCarts
            : [receivedCarts];

          this.filteredCarts = [...this.carts];
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error:', error);
          this.errorMessage = 'Error loading carts';
          this.visibleError = true;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
    } else {
      const userEmail = this.userService.email;
      if (!userEmail) {
        this.errorMessage = 'No user logged in';
        this.visibleError = true;
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }

      this.cartService.getCart(userEmail).pipe(
        takeUntilDestroyed()
      ).subscribe({
        next: (data) => {
          this.carts = Array.isArray(data) ? data : [data];
          this.filteredCarts = [...this.carts];
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = 'Error loading your cart';
          this.visibleError = true;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
    }
  }

  filterCarts() {
    if (!this.searchText) {
      this.filteredCarts = [...this.carts];
    } else {
      this.filteredCarts = this.carts.filter((cart) =>
        cart.userEmail.toLowerCase().includes(this.searchText.toLowerCase())
      );
    }
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.filterCarts();
  }

  // Method to navigate to details
  navigateToCartDetails(userEmail: string) {
    this.router.navigate(['/cart-details'], {
      queryParams: { email: userEmail },
    });
  }

  toggleCartStatus(email: string, enable: boolean): void {
    this.loading = true;
    this.cdr.markForCheck();

    const operation = enable
      ? this.cartService.enableCart(email)
      : this.cartService.disableCart(email);

    operation.pipe(
      takeUntilDestroyed()
    ).subscribe({
      next: (updatedCart) => {
        // Update cart locally
        const cartIndex = this.carts.findIndex((c) => c.userEmail === email);
        if (cartIndex !== -1) {
          this.carts[cartIndex] = {
            ...this.carts[cartIndex],
            enabled: enable,
            totalPrice: enable ? this.carts[cartIndex].totalPrice : 0,
          };
          this.filterCarts(); // Refresh the filtered list
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error toggling cart status:', error);
        this.errorMessage = `Error ${enable ? 'enabling' : 'disabling'} cart`;
        this.visibleError = true;
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

}
