import {
  Component,
  ViewChild,
  ElementRef,
  inject,
  afterNextRender,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule, NgForm } from "@angular/forms";
import { ConfirmationService } from "primeng/api";
import { TableModule } from "primeng/table";
import { ButtonModule } from "primeng/button";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { InputNumberModule } from "primeng/inputnumber";
import { CheckboxModule } from "primeng/checkbox";
import { IRecord } from "../EcommerceInterface";
import { RecordsService } from "../services/RecordsService";
import { GroupsService } from "../services/GroupsService";
import { StockService } from "../services/StockService";
import { CartService } from "../services/CartService";
import { UserService } from "src/app/services/UserService";

@Component({
    selector: "app-records",
    templateUrl: "./RecordsComponent.html",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        ConfirmDialogModule,
        DialogModule,
        InputTextModule,
        InputNumberModule,
        CheckboxModule
    ],
    providers: [ConfirmationService]
})
export class RecordsComponent {
  @ViewChild("form") form!: NgForm;
  @ViewChild("fileInput") fileInput!: ElementRef;
  visibleError = false;
  errorMessage = "";
  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  visibleConfirm = false;
  imageRecord = "";
  visiblePhoto = false;
  photo = "";
  searchText: string = "";

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

  groups: any[] = [];
  recordService: any;

  private readonly recordsService = inject(RecordsService);
  private readonly groupsService = inject(GroupsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly stockService = inject(StockService);
  private readonly cartService = inject(CartService);
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);

  // Function to compare values in the select
  compareFn(option1: any, option2: any): boolean {
    // Compare the numerical values of the options
    return option1 && option2 ? option1 === option2 : option1 === option2;
  }

  constructor() {
    // Load initial data
    this.getRecords();
    this.getGroups();

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntilDestroyed())
      .subscribe((update) => {
        if (!update) return;
        
        const { recordId, newStock } = update;
        
        // Create new array references to trigger change detection
        this.records = this.records.map(record => 
          record.idRecord === recordId ? { ...record, stock: newStock } : record
        );
        
        this.filteredRecords = this.filteredRecords.map(record => 
          record.idRecord === recordId ? { ...record, stock: newStock } : record
        );
        this.cdr.markForCheck();
      });

    // Subscribe to cart updates
    this.cartService.cart$
      .pipe(takeUntilDestroyed())
      .subscribe((cartItems) => {
        this.records.forEach((record) => {
          const cartItem = cartItems.find(
            (item) => item.idRecord === record.idRecord
          );
          record.inCart = !!cartItem;
          record.amount = cartItem ? cartItem.amount || 0 : 0;
        });
        this.filteredRecords = [...this.records];
        this.cdr.markForCheck();
      });

    // afterNextRender runs once after the component is initially rendered
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });

  }

  getRecords() {
    this.recordsService.getRecords().subscribe({
      next: (data: any) => {
        // Extract records array from response
        let recordsArray: any[] = [];
        if (Array.isArray(data)) {
          recordsArray = data;
        } else if (data && Array.isArray(data.$values)) {
          recordsArray = data.$values;
        } else if (data && Array.isArray(data.data)) {
          recordsArray = data.data;
        }
        
        // Initialize stock values in the stock service
        recordsArray.forEach(record => {
          if (record.idRecord && typeof record.stock === 'number') {
            this.stockService.updateStock(record.idRecord, record.stock);
          }
        });

        // Get the groups to assign names
        this.groupsService.getGroups().subscribe({
          next: (groupsResponse: any) => {
            let groups: any[] = [];
            if (Array.isArray(groupsResponse)) {
              groups = groupsResponse;
            } else if (groupsResponse && Array.isArray(groupsResponse.$values)) {
              groups = groupsResponse.$values;
            }

            // Assign the group name to each record
            const processedRecords = recordsArray.map((record: any) => {
              // Ensure required properties exist
              const processedRecord: IRecord = {
                idRecord: record.idRecord || 0,
                titleRecord: record.titleRecord || '',
                yearOfPublication: record.yearOfPublication || null,
                imageRecord: record.imageRecord || null,
                photo: record.photo || null,
                photoName: record.photoName || null,
                price: record.price || 0,
                stock: record.stock || 0,
                discontinued: record.discontinued || false,
                groupId: record.groupId || null,
                groupName: '',
                nameGroup: ''
              };
              
              // Find matching group and assign name
              if (processedRecord.groupId !== null) {
                const group = groups.find(g => g.idGroup === processedRecord.groupId);
                if (group) {
                  processedRecord.groupName = group.nameGroup || '';
                  processedRecord.nameGroup = group.nameGroup || '';
                }
              }
              
              return processedRecord;
            });

            this.records = processedRecords;
            this.filteredRecords = [...this.records];
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error("Error getting groups:", err);
            this.records = recordsArray;
            this.filteredRecords = [...this.records];
            this.cdr.markForCheck();
          },
        });
      },
      error: (err) => {
        console.error("Error getting records:", err);
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  filterRecords() {
    if (!this.searchText?.trim()) {
      this.filteredRecords = [...this.records];
      this.cdr.markForCheck();
      return;
    }

    const searchTerm = this.searchText.toLowerCase();
    this.filteredRecords = this.records.filter((record) => {
      return (
        record.titleRecord?.toLowerCase().includes(searchTerm) ||
        record.groupName?.toLowerCase().includes(searchTerm) ||
        record.yearOfPublication?.toString().includes(searchTerm)
      );
    });
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.filterRecords();
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (response: any) => {
        // Flexible handling of different response structures
        let groupsArray = [];

        if (Array.isArray(response)) {
          // The answer is a direct array
          groupsArray = response;
        } else if (Array.isArray(response.$values)) {
          // The response has property $values
          groupsArray = response.$values;
        } else if (Array.isArray(response.data)) {
          // The response has data property
          groupsArray = response.data;
        } else {
          console.warn("Unexpected API response structure:", response);
        }

        this.groups = groupsArray;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Error loading groups:", err);
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  onChange(event: any) {
    const file = event.target.files;

    if (file && file.length > 0) {
      this.record.photo = file[0];
      this.record.photoName = file[0].name;
      this.cdr.markForCheck();
    }
  }

  onAceptar() {
    this.fileInput.nativeElement.value = "";
  }

  showImage(record: IRecord) {
    if (this.visiblePhoto && this.record === record) {
      this.visiblePhoto = false;
    } else {
      this.record = record;
      this.photo = record.imageRecord!;
      this.visiblePhoto = true;
      this.cdr.markForCheck();
    }
  }

  save() {
    if (this.record.idRecord === 0) {
      this.recordsService.addRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.form.reset();
          this.getRecords();
        },
        error: (err) => {
          console.log(err);
          this.visibleError = true;
          this.controlError(err);
        },
      });
    } else {
      this.recordsService.updateRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.reset();
          this.getRecords();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  confirmDelete(record: IRecord) {
    this.confirmationService.confirm({
      message: `Delete record ${record.titleRecord}?`,
      header: "Are you sure?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Yes",
      acceptButtonStyleClass: "p-button-danger",
      accept: () => this.deleteRecord(record.idRecord),
    });
  }

  deleteRecord(id: number) {
    this.recordsService.deleteRecord(id).subscribe({
      next: (data: IRecord) => {
        this.visibleError = false;
        this.getRecords();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.visibleError = true;
        this.controlError(err);
      }
    });
  }

  edit(record: IRecord) {
    this.record = { ...record };
    this.record.photo = null;
    this.record.photoName = record.imageRecord
      ? this.extractImageName(record.imageRecord)
      : null;
    this.cdr.markForCheck();
  }

  extractImageName(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  cancelEdition() {
    this.record = {
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
    this.cdr.markForCheck();
  }

  controlError(err: any) {
    if (err.error && typeof err.error === "object" && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === "string") {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = "An unexpected error has occurred";
    }
  }

  addToCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail) return;

    this.cartService.addToCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.inCart = true;
        record.amount = (record.amount || 0) + 1;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error adding to cart:", error);
        // Revert local changes if it fails
        record.inCart = false;
        record.amount = 0;
        this.filteredRecords = [...this.records];
      }
    );
  }

  removeFromCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail || !record.inCart) return;

    this.cartService.removeFromCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.amount = Math.max(0, (record.amount || 0) - 1);
        record.inCart = record.amount > 0;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error removing from cart:", error);
        // Revert local changes if it fails
        record.amount = (record.amount || 0) + 1;
        record.inCart = true;
        this.filteredRecords = [...this.records];
      }
    );
  }
}
