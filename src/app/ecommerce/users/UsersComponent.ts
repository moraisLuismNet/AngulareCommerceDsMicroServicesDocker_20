import { Component, inject, afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IUser } from "../EcommerceInterface";
import { UsersService } from "../services/UsersService";
import { ConfirmationService, MessageService } from "primeng/api";
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: "app-users",
    templateUrl: "./UsersComponent.html",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        ConfirmDialogModule,
        DialogModule,
        InputTextModule,
        TooltipModule
    ]
})
export class UsersComponent {
  users: IUser[] = [];
  filteredUsers: IUser[] = [];
  loading = true;
  searchText = "";
  errorMessage = "";
  visibleError = false;

  private readonly usersService = inject(UsersService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // Load users immediately in the constructor
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.usersService.getUsers().pipe(
      takeUntilDestroyed()
    ).subscribe({
      next: (users) => {
        this.users = users;
        this.filteredUsers = [...this.users];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error("Error loading users:", error);
        this.errorMessage = this.getErrorMessage(error);
        this.visibleError = true;
        this.users = [];
        this.filteredUsers = [];
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return "You don't have permission to view users. Please log in as an administrator.";
    }
    return "Error loading users. Please try again..";
  }

  confirmDelete(email: string): void {
    const message = this.sanitizer.bypassSecurityTrustHtml(
      `Are you sure you want to delete the user "${email}"?`
    );
    
    this.confirmationService.confirm({
      message: message as string,
      header: "Delete User",
      icon: "pi pi-exclamation-triangle",
      acceptButtonStyleClass: "p-button-danger",
      rejectButtonStyleClass: "p-button-secondary",
      acceptIcon: "pi pi-check",
      acceptLabel: "Yes",
      rejectLabel: "No",
      accept: () => {
        this.deleteUser(email);
      },
    });
  }

  deleteUser(email: string): void {
    this.usersService.deleteUser(email).pipe(
      takeUntilDestroyed()
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: "success",
          summary: "Success",
          detail: "User successfully deleted",
        });
        this.loadUsers();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error("Error deleting user:", error);
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: "Error deleting user",
        });
        this.cdr.markForCheck();
      },
    });
  }

  onSearchChange(): void {
    if (!this.searchText) {
      this.filteredUsers = [...this.users];
      this.cdr.markForCheck();
      return;
    }
    const searchTerm = this.searchText.toLowerCase();
    this.filteredUsers = this.users.filter((user) =>
      user.email.toLowerCase().includes(searchTerm)
    );
    this.cdr.markForCheck();
  }


}
