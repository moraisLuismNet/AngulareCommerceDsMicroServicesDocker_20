import { Component, inject, afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderService } from '../services/OrderService';
import { IOrder } from '../EcommerceInterface';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
    selector: 'app-admin-orders',
    templateUrl: './AdminOrdersComponent.html',
    styleUrls: ['./AdminOrdersComponent.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        DatePipe
    ]
})
export class AdminOrdersComponent {
  orders: IOrder[] = [];
  filteredOrders: IOrder[] = [];
  loading = true;
  searchText: string = '';
  expandedOrderId: number | null = null;

  private readonly orderService = inject(OrderService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // afterNextRender runs once after the component is initialized
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });


    // Initial data load
    this.loadAllOrders();
  }

  loadAllOrders(): void {
    this.loading = true;
    this.orderService.getAllOrders().pipe(
      takeUntilDestroyed()
    ).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredOrders = [...orders];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading all orders:', err);
        this.orders = [];
        this.filteredOrders = [];
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleOrderDetails(orderId: number): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
    this.cdr.markForCheck();
  }

  isOrderExpanded(orderId: number): boolean {
    return this.expandedOrderId === orderId;
  }

  onSearchChange() {
    this.filterOrders(this.searchText);
    this.cdr.markForCheck();
  }

  private filterOrders(searchText: string): void {
    if (!searchText) {
      this.filteredOrders = [...this.orders];
      this.cdr.markForCheck();
      return;
    }

    const searchLower = searchText.toLowerCase();
    this.filteredOrders = this.orders.filter(
      (order) =>
        order.userEmail.toLowerCase().includes(searchLower) ||
        order.idOrder.toString().includes(searchLower) ||
        order.paymentMethod.toLowerCase().includes(searchLower) ||
        (order.orderDate &&
          new Date(order.orderDate).toLocaleDateString().includes(searchLower))
    );
  }


}
