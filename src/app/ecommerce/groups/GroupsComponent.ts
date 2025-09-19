import { Component, ViewChild, ElementRef, ChangeDetectorRef, inject, afterNextRender, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { IGroup } from '../EcommerceInterface';
import { GroupsService } from '../services/GroupsService';
import { GenresService } from '../services/GenresService';

@Component({
    selector: 'app-groups',
    templateUrl: './GroupsComponent.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        ConfirmDialogModule,
        DialogModule,
        InputTextModule,
        DropdownModule
    ],
    providers: [ConfirmationService]
})
export class GroupsComponent {
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
    musicGenreId: null,
    musicGenreName: '',
    musicGenre: '',
  };

  genres: any[] = [];
  isLoadingGenres = false;
  private readonly groupsService = inject(GroupsService);
  private readonly genresService = inject(GenresService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);


  // Function to compare values in the select
  compareFn(option1: any, option2: any): boolean {
    // Compare the numerical values of the options
    return option1 && option2 ? option1 === option2 : option1 === option2;
  }

  constructor() {
    // Load initial data
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

        // Directly assign the response array (without using .$values)
        this.groups = Array.isArray(data) ? data : [];
        this.filteredGroups = [...this.groups];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching groups:', err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  getGenres(): Promise<void> {
    this.isLoadingGenres = true;
    return new Promise((resolve, reject) => {
      this.genresService.getGenres().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data: any) => {
          try {
            // Extract the array of genres, handling different response formats
            let genresArray = [];
            
            if (Array.isArray(data)) {
              genresArray = data;
            } else if (data && typeof data === 'object' && data.$values) {
              genresArray = data.$values;
            } else if (data && typeof data === 'object') {
              // If it is an object, convert it to an array
              genresArray = Object.values(data);
            }
            
            this.genres = Array.isArray(genresArray) ? genresArray : [];
            resolve();
          } catch (error) {
            console.error('Error processing genres:', error);
            this.visibleError = true;
            this.errorMessage = 'Error loading music genres';
            reject(error);
          }
        },
        error: (err) => {
          console.error('Error getting genres:', err);
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
          reject(err);
        },
        complete: () => {
          this.isLoadingGenres = false;
        }
      });
    });
  }

  filterGroups() {
    this.filteredGroups = this.groups.filter((group) =>
      group.nameGroup.toLowerCase().includes(this.searchText.toLowerCase())
    );
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.filterGroups();
  }

  save() {
    if (this.group.idGroup === 0) {
      this.groupsService.addGroup(this.group).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.form.reset();
          this.getGroups();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[GroupsComponent] Error creating group:', {
            error: err,
            status: err.status,
            statusText: err.statusText,
            errorDetails: err.error,
            headers: err.headers,
            url: err.url
          });
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
        },
      });
    } else {
      this.groupsService.updateGroup(this.group).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.reset();
          this.getGroups();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[GroupsComponent] Error updating group:', {
            error: err,
            status: err.status,
            statusText: err.statusText,
            errorDetails: err.error,
            headers: err.headers,
            url: err.url,
            groupData: this.group,
            hasPhoto: !!this.group.photo,
            photoName: this.group.photo?.name || this.group.photoName
          });
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
        },
      });
    }
  }

  async edit(group: IGroup) {
    // Make sure the genres are loaded
    if (this.genres.length === 0) {
      try {
        await this.getGenres();
      } catch (error) {
        console.error('Error loading genres:', error);
        this.visibleError = true;
        this.errorMessage = 'The music genres could not be loaded';
        return;
      }
    }
    
    // Create a new object with all the necessary fields
    const editedGroup: IGroup = {
      idGroup: group.idGroup,
      nameGroup: group.nameGroup,
      imageGroup: group.imageGroup,
      photo: null, // The photo is reset to allow for a new selection.
      photoName: group.imageGroup ? this.extractNameImage(group.imageGroup) : '',
      musicGenreId: group.musicGenreId || 0,
      musicGenreName: group.musicGenreName || group.musicGenre || '',
      musicGenre: group.musicGenre || group.musicGenreName || ''
    };
    
    this.group = editedGroup;
    this.cdr.markForCheck();
    
    // Force change detection after a short delay
    setTimeout(() => {
      // Check if the current genre is in the genre list
      const selectedGenre = this.genres.find(g => g.idMusicGenre === this.group.musicGenreId);
      
      if (selectedGenre) {
        // Update the genre name to display in the interface
        this.group.musicGenreName = selectedGenre.nameMusicGenre;
        this.group.musicGenre = selectedGenre.nameMusicGenre;
      } else {
        console.warn('The genre was not found in the list of available genres');
      }
      
      // Force view refresh
      this.cdr.detectChanges();
    }, 100);
  }

  extractNameImage(url: string): string {
    return url.split('/').pop() || '';
  }

  cancelEdition() {
    this.group = {
      idGroup: 0,
      nameGroup: '',
      imageGroup: null,
      photo: null,
      musicGenreId: 0,
      musicGenreName: '',
      musicGenre: '',
    };
    this.cdr.markForCheck();
  }

  confirmDelete(group: IGroup) {
    this.confirmationService.confirm({
      message: `Delete the group ${group.nameGroup}?`,
      header: 'Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteGroup(group.idGroup!),
    });
  }

  async deleteGroup(id: number) {
    this.groupsService.deleteGroup(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.visibleError = false;
        this.form.reset({
          nameMusicGenre: '',
        });
        this.getGroups();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  controlError(err: any) {
    console.log('[GroupsComponent] Processing error in controlError:', {
      status: err.status,
      error: err.error,
      message: err.message
    });

    // If it is an authentication error (401)
    if (err.status === 401) {
      this.errorMessage = "Your session has expired or you don't have permission. Please log in again.";
      return;
    }

    // If it is a validation error (400) with details
    if (err.status === 400) {
      if (err.error && typeof err.error === 'object') {
        // If there are server validation errors
        if (err.error.errors) {
          const validationErrors: string[] = [];
          Object.keys(err.error.errors).forEach((key: string) => {
            if (Array.isArray(err.error.errors[key])) {
              validationErrors.push(...err.error.errors[key].map((e: any) => e.toString()));
            } else {
              validationErrors.push(err.error.errors[key].toString());
            }
          });
          this.errorMessage = `Validation errors: ${validationErrors.join(' ')}`;
          return;
        }
        
        if (err.error.message) {
          this.errorMessage = err.error.message;
          return;
        }
        
        if (err.error.title) {
          this.errorMessage = err.error.title;
          return;
        }
      }
      
      if (typeof err.error === 'string') {
        this.errorMessage = err.error;
        return;
      }
    }

    // If it is a network error
    if (err.status === 0) {
      this.errorMessage = 'Could not connect to the server. Please check your internet connection.';
      return;
    }

    // If it is a 500 server error
    if (err.status >= 500) {
      this.errorMessage = 'Internal server error. Please try again later.';
      return;
    }

    if (err.message) {
      this.errorMessage = err.message;
      return;
    }

    // Default message
    this.errorMessage = 'An unexpected error has occurred. Please try again.';
  }

  async onChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Create a copy of the original, unmodified file
      this.group.photo = file;
      this.group.photoName = file.name;
      
      // Do not set imageGroup here, the backend will generate it
      this.group.imageGroup = null;
      this.cdr.markForCheck();
    }
  }

  showImage(group: IGroup) {
    if (this.visiblePhoto && this.group === group) {
      this.visiblePhoto = false;
    } else {
      this.group = group;
      this.photo = group.imageGroup!;
      this.visiblePhoto = true;
    }
    this.cdr.markForCheck();
  }

}
