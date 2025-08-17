import { Component, ViewChild, ElementRef, inject, afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IGroup } from '../EcommerceInterface';
import { GroupsService } from '../services/GroupsService';
import { GenresService } from '../services/GenresService';

@Component({
    selector: 'app-listgroups',
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        TableModule,
        ButtonModule,
        ConfirmDialogModule,
        DialogModule
    ],
    templateUrl: './ListgroupsComponent.html',
    providers: [ConfirmationService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListgroupsComponent {
  @ViewChild('form') form!: NgForm;
  @ViewChild('fileInput') fileInput!: ElementRef;
  visibleError = false;
  errorMessage = '';
  groups: IGroup[] = [];
  filteredGroups: IGroup[] = [];
  visibleConfirm = false;
  imageGroup = '';
  visiblePhoto = false;
  photo = '';
  searchText: string = '';

  group: IGroup = {
    idGroup: 0,
    nameGroup: '',
    imageGroup: null,
    photo: null,
    musicGenreId: 0,
    musicGenreName: '',
    musicGenre: '',
  };

  genres: any[] = [];
  records: any[] = [];

  private readonly groupsService = inject(GroupsService);
  private readonly genresService = inject(GenresService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Initial data loading
    this.getGroups();
    this.getGenres();

    // afterNextRender runs once after the component is initially rendered
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });
  }

  getGroups() {
    this.groupsService.getGroups().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: any) => {
        this.visibleError = false;

        // Handle different possible response formats
        if (Array.isArray(data)) {
          this.groups = data;
        } else if (data && typeof data === 'object') {
          // Check for $values property safely
          if (data.hasOwnProperty('$values')) {
            this.groups = Array.isArray(data.$values) ? data.$values : [];
          } else if (data.hasOwnProperty('data')) {
            this.groups = Array.isArray(data.data) ? data.data : [];
          } else {
            // If it's an object but not in the expected format, try to convert it to an array
            this.groups = Object.values(data);
          }
        } else {
          this.groups = [];
          console.warn('Unexpected data format:', data);
        }

        this.filterGroups();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Error loading groups:', err);
        this.visibleError = true;
        this.controlError(err);
        this.groups = [];
        this.filteredGroups = [];
        this.cdr.markForCheck();
      },
    });
  }

  getGenres() {
    this.genresService.getGenres().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.genres = data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  controlError(err: any) {
    if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = 'An unexpected error has occurred';
    }
  }

  filterGroups() {
    
    if (!Array.isArray(this.groups)) {
      console.warn('Groups is not an array:', this.groups);
      this.groups = [];
      this.filteredGroups = [];
      return;
    }

    try {
      const searchText = this.searchText ? this.searchText.toLowerCase() : '';
      this.filteredGroups = this.groups.filter((group) => {
        const groupName = group.nameGroup ? group.nameGroup.toLowerCase() : '';
        return groupName.includes(searchText);
      });
      
    } catch (error) {
      console.error('Error filtering groups:', error);
      this.filteredGroups = [];
    }
  }

  onSearchChange() {
    this.filterGroups();
  }

  showImage(group: IGroup) {
    if (this.visiblePhoto && this.group === group) {
      this.visiblePhoto = false;
    } else {
      this.group = group;
      this.photo = group.imageGroup!;
      this.visiblePhoto = true;
    }
  }

  loadRecords(idGroup: string): void {
    this.router.navigate(['/listrecords', idGroup]);
  }

}
