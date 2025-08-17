import { Component, inject, afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from "@angular/router";

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from "primeng/api";

// RxJS
import { of, throwError } from "rxjs";
import { finalize, switchMap, map, catchError, tap } from "rxjs/operators";

// Services
import { RecordsService } from "../services/RecordsService";
import { GroupsService } from "../services/GroupsService";
import { CartService } from "../services/CartService";
import { CartDetailService } from "../services/CartDetailService";
import { UserService } from "src/app/services/UserService";
import { StockService } from "../services/StockService";
import { AuthGuard } from "src/app/guards/AuthGuardService";

// Interfaces
import { IRecord } from "../EcommerceInterface";

@Component({
    selector: "app-listrecords",
    templateUrl: "./ListrecordsComponent.html",
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        TableModule,
        ButtonModule,
        ConfirmDialogModule,
        DialogModule
    ],
    providers: [ConfirmationService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListrecordsComponent {

  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  searchText: string = "";
  cart: IRecord[] = [];
  groupId: string | null = null;
  groupName: string = "";
  errorMessage: string = "";
  visibleError: boolean = false;
  visiblePhoto: boolean = false;
  photo: string = "";
  cartItemsCount: number = 0;
  isAddingToCart = false;
  loading: boolean = false;
  cartEnabled: boolean = false;
  
  private readonly destroyRef = inject(DestroyRef);

  record: IRecord = {
    idRecord: 0,
    titleRecord: "",
    yearOfPublication: null,
    imageRecord: null,
    photo: null,
    photoName: null,
    price: 0,
    stock: 0,
    discontinued: false,
    groupId: null,
    groupName: "",
    nameGroup: "",
  };
  userEmail: string | null = null;

  private readonly recordsService = inject(RecordsService);
  private readonly groupsService = inject(GroupsService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly cartService = inject(CartService);
  private readonly cartDetailService = inject(CartDetailService);
  private readonly userService = inject(UserService);
  private readonly stockService = inject(StockService);
  private readonly authGuard = inject(AuthGuard);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // Subscribe to route parameters immediately to load data on initial navigation
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const idGroup = params.get("idGroup");
      if (idGroup) {
        this.groupId = idGroup;
        this.loadRecords(idGroup);
      } else {
        this.errorMessage = "No group ID provided";
        this.visibleError = true;
      }
    });

    // Only configure subscriptions if the user is authenticated
    if (this.authGuard.isLoggedIn()) {
      this.setupSubscriptions();
      this.userEmail = this.authGuard.getUser();
      this.checkCartStatus();
    }

    // afterNextRender for any DOM-dependent initialization
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });

  }

  checkCartStatus() {
    if (!this.userEmail) {
      this.cartEnabled = false;
      return;
    }

    this.cartService.getCartStatus(this.userEmail).subscribe({
      next: (status) => {
        this.cartEnabled = status.enabled;
      },
      error: (error) => {
        console.error("Error checking cart status:", error);
        this.cartEnabled = true;
      },
    });
  }

  private setupSubscriptions(): void {
    // Subscribe to cart changes
    this.cartService.cart$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cartItems) => {
        // Update cart status for all records
        [this.records, this.filteredRecords].forEach((recordArray) => {
          recordArray.forEach((record) => {
            const cartItem = cartItems.find(
              (item: IRecord) => item.idRecord === record.idRecord
            );
            if (cartItem) {
              record.amount = cartItem.amount;
            } else {
              record.amount = 0;
            }
            // Ensure stock is up to date from the stock service
          });

          // Trigger change detection by creating new array references
          if (recordArray.length > 0) {
            if (recordArray === this.records) {
              this.records = [...this.records];
            } else {
              this.filteredRecords = [...this.filteredRecords];
            }
          }
        });
      });

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((update) => {
        if (!update) return;
        
        const { recordId, newStock } = update;
        
        // Update records array
        this.records = this.records.map((record) => 
          record.idRecord === recordId 
            ? { ...record, stock: newStock }
            : record
        );
        
        // Update filtered records
        this.filteredRecords = this.filteredRecords.map((record) => 
          record.idRecord === recordId 
            ? { ...record, stock: newStock }
            : record
        );
      });

    // Subscribe to cart item count
    this.cartService.cartItemCount$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((count) => {
        this.cartItemsCount = count;
      });

    // Subscribe to user email changes
    this.userService.emailUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((email) => {
        this.userEmail = email;
      });
  }

  confirm(): void {
    this.confirmationService.confirm({
      message: "Are you sure you want to continue?",
      accept: () => {},
    });
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem("user");
  }

  loadRecords(idGroup: string): void {
    this.loading = true;
    this.errorMessage = "";
    this.visibleError = false;

    // First we synchronize the cart with the backend
    if (this.userEmail) {
      this.cartService.syncCartWithBackend(this.userEmail);
    }

    // Clear any existing stock data to ensure fresh state
    this.records = [];
    this.filteredRecords = [];

    this.recordsService
      .getRecordsByGroup(idGroup)
      .pipe(
        tap((records: IRecord[]) => {
          // Initialize stock values in the stock service
          if (records && records.length > 0) {
            records.forEach(record => {
              if (record.idRecord && typeof record.stock === 'number') {
                this.stockService.updateStock(record.idRecord, record.stock);
              }
            });
          }
        }),
        switchMap((records: IRecord[]) => {
          if (!records || records.length === 0) {
            this.errorMessage = "No records found for this group";
            this.visibleError = true;
            return of([]);
          }

          this.records = records;
        this.cdr.markForCheck();
        // Get cart items to sync cart status
        return this.cartService.getCartItems().pipe(
            map((cartItems: IRecord[]) => {
              // Update cart status for each record
              this.records.forEach((record) => {
                const cartItem = cartItems.find(
                  (item) => item.idRecord === record.idRecord
                );
                if (cartItem) {
                  record.inCart = true;
                  record.amount = cartItem.amount;
                } else {
                  record.inCart = false;
                  record.amount = 0;
                }
              });
              return this.records;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (records: IRecord[]) => {
          this.getGroupName(idGroup);
          this.filterRecords();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error("Error loading records:", error);
          this.errorMessage = "Error loading records";
          this.visibleError = true;
        },
      });
  }

  getGroupName(idGroup: string): void {
    this.groupsService
      .getGroupName(idGroup)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nameGroup: string) => {
          this.groupName = nameGroup;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error("Error loading group name:", error);
          this.errorMessage = "Error loading group name";
          this.visibleError = true;
        },
      });
  }

  filterRecords(): void {
    if (!this.searchText) {
      this.filteredRecords = [...this.records];
    } else {
      this.filteredRecords = this.records.filter((record) => {
        return (
          record.groupName
            .toLowerCase()
            .includes(this.searchText.toLowerCase()) ||
          record.titleRecord
            .toLowerCase()
            .includes(this.searchText.toLowerCase()) ||
          (record.yearOfPublication
            ? record.yearOfPublication.toString().includes(this.searchText)
            : false)
        );
      });
    }
  }

  onSearchChange(): void {
    this.filterRecords();
  }

  showImage(record: IRecord): void {
    if (this.visiblePhoto && this.record === record) {
      this.visiblePhoto = false;
    } else {
      this.record = record;
      this.photo = record.imageRecord!;
      this.visiblePhoto = true;
    }
  }

  addToCart(record: IRecord): void {
    if (this.isAddingToCart || !record.stock || record.stock <= 0) {
      return;
    }

    this.isAddingToCart = true;
    this.errorMessage = "";
    this.visibleError = false;

    // Update stock locally first for immediate response
    const updatedRecords = this.records.map(r => 
      r.idRecord === record.idRecord 
        ? { ...r, stock: r.stock - 1 } 
        : r
    );
    
    const updatedFilteredRecords = this.filteredRecords.map(r => 
      r.idRecord === record.idRecord 
        ? { ...r, stock: r.stock - 1 } 
        : r
    );
    
    this.records = updatedRecords;
    this.filteredRecords = updatedFilteredRecords;

    this.cartService
      .addToCart(record)
      .pipe(
        finalize(() => (this.isAddingToCart = false)),
        catchError(error => {
          // Revert changes if there is an error
          const revertedRecords = this.records.map(r => 
            r.idRecord === record.idRecord 
              ? { ...r, stock: r.stock + 1 } 
              : r
          );
          
          this.records = revertedRecords;
          this.filteredRecords = revertedRecords;
          
          this.errorMessage = error.message || "Error adding to cart";
          this.visibleError = true;
          console.error("Error adding to cart:", error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (updatedRecord) => {
          // The stock has already been updated locally
          // If the server returns a different stock, we update it
          if (updatedRecord && updatedRecord.stock !== undefined) {
            this.records = this.records.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
            
            this.filteredRecords = this.filteredRecords.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
          }
        }
      });
  }

  removeRecord(record: IRecord): void {
    if (!record.amount || this.isAddingToCart) return;
    this.isAddingToCart = true;
    
    // Save the previous state so you can revert if necessary
    const prevAmount = record.amount;
    
    // Update locally first for immediate response
    const updatedRecords = this.records.map(r => 
      r.idRecord === record.idRecord 
        ? { 
            ...r, 
            amount: Math.max(0, prevAmount - 1),
            stock: (r.stock || 0) + 1 // Increase stock locally
          } 
        : r
    );
    
    this.records = updatedRecords;
    this.filteredRecords = this.filteredRecords.map(r => 
      r.idRecord === record.idRecord 
        ? { 
            ...r, 
            amount: Math.max(0, prevAmount - 1),
            stock: (r.stock || 0) + 1 // Increase stock locally
          } 
        : r
    );

    this.cartService
      .removeFromCart(record)
      .pipe(
        finalize(() => {
          this.isAddingToCart = false;
        }),
        catchError((error) => {
          // Revert local changes if there is an error
          this.records = this.records.map(r => 
            r.idRecord === record.idRecord 
              ? { 
                  ...r, 
                  amount: prevAmount,
                  stock: (r.stock || 0) - 1 // Reverse stock change
                } 
              : r
          );
          
          this.filteredRecords = this.filteredRecords.map(r => 
            r.idRecord === record.idRecord 
              ? { 
                  ...r, 
                  amount: prevAmount,
                  stock: (r.stock || 0) - 1 // Reverse stock change
                } 
              : r
          );
          
          this.errorMessage = error.message || "Error removing from cart";
          this.visibleError = true;
          console.error("Error removing from cart:", error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (updatedRecord) => {
          // The stock has already been updated locally
          // If the server returns a different stock, we update it
          if (updatedRecord && updatedRecord.stock !== undefined) {
            this.records = this.records.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
            
            this.filteredRecords = this.filteredRecords.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
          }
          
          // Synchronize the cart with the backend
          if (this.userEmail) {
            this.cartService.syncCartWithBackend(this.userEmail);
          }
        }
      });
  }

  isAdmin(): boolean {
    return this.userService.isAdmin();
  }
}
